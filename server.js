const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = process.env.DATA_DASHBOARD_DB || path.join(DATA_DIR, "data-dashboard.sqlite");
const SESSION_SECRET = process.env.DATA_DASHBOARD_SESSION_SECRET || crypto.randomBytes(24).toString("hex");
const PORT = Number(process.env.PORT || 4173);
const TRUST_PROXY_HOPS = normalizeTrustProxyHops(process.env.DATA_DASHBOARD_TRUST_PROXY_HOPS);
const COOKIE_SECURE = normalizeCookieSecure(process.env.DATA_DASHBOARD_COOKIE_SECURE);
const ROLE_TYPES = ["super_admin", "admin", "data_entry"];
const USER_STATUS_TYPES = ["active", "disabled"];
const STRUCTURE_KEYS_BY_TYPE = {
    "monthly-matrix": ["rowDefs", "periodDefs", "headerDefs"],
    "price-comparison": ["itemDefs", "itemDefsVersion", "extraColumns", "headerDefs"],
    "weekly-sales": ["productDefs", "weekDefs", "headerDefs"],
    "simple-note": ["columnDefs", "rowDefs"]
};

fs.mkdirSync(DATA_DIR, { recursive: true });

const workbooks = loadWorkbookManifests();
const workbookMap = workbooks.reduce((map, workbook) => {
    map[workbook.id] = workbook;
    return map;
}, {});
const visibleWorkbooks = workbooks.filter((workbook) => !workbook.hidden);

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

initializeDatabase();
seedRoleTemplatePermissions();
bootstrapSuperAdmin();

class SQLiteSessionStore extends session.Store {
    constructor(database) {
        super();
        this.database = database;
        this.selectStatement = database.prepare("SELECT data FROM sessions WHERE sid = ? AND expires_at > ?");
        this.upsertStatement = database.prepare(`
            INSERT INTO sessions (sid, data, expires_at, updated_at)
            VALUES (@sid, @data, @expiresAt, @updatedAt)
            ON CONFLICT(sid) DO UPDATE SET
                data = excluded.data,
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at
        `);
        this.deleteStatement = database.prepare("DELETE FROM sessions WHERE sid = ?");
        this.touchStatement = database.prepare("UPDATE sessions SET expires_at = ?, updated_at = ? WHERE sid = ?");
        this.cleanupStatement = database.prepare("DELETE FROM sessions WHERE expires_at <= ?");
    }

    get(sid, callback) {
        try {
            this.cleanupStatement.run(Date.now());
            const row = this.selectStatement.get(sid, Date.now());
            callback(null, row ? JSON.parse(row.data) : null);
        } catch (error) {
            callback(error);
        }
    }

    set(sid, sessionValue, callback) {
        try {
            const expiresAt = getSessionExpiresAt(sessionValue);
            this.upsertStatement.run({
                sid,
                data: JSON.stringify(sessionValue),
                expiresAt,
                updatedAt: timestamp()
            });
            callback && callback(null);
        } catch (error) {
            callback && callback(error);
        }
    }

    destroy(sid, callback) {
        try {
            this.deleteStatement.run(sid);
            callback && callback(null);
        } catch (error) {
            callback && callback(error);
        }
    }

    touch(sid, sessionValue, callback) {
        try {
            this.touchStatement.run(getSessionExpiresAt(sessionValue), timestamp(), sid);
            callback && callback(null);
        } catch (error) {
            callback && callback(error);
        }
    }
}

const app = express();
const sessionStore = new SQLiteSessionStore(db);

if (TRUST_PROXY_HOPS > 0) {
    app.set("trust proxy", TRUST_PROXY_HOPS);
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
    name: "data_dashboard_session",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: COOKIE_SECURE,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

app.get("/", function (_req, res) {
    res.redirect("/index.html");
});

app.post("/api/auth/login", function (req, res) {
    const username = String(req.body && req.body.username || "").trim();
    const password = String(req.body && req.body.password || "");

    if (!username || !password) {
        return res.status(400).json({ error: "请输入用户名和密码。" });
    }

    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user || user.status !== "active") {
        return res.status(401).json({ error: "账号不存在或已停用。" });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "用户名或密码错误。" });
    }

    req.session.userId = user.id;
    db.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(timestamp(), timestamp(), user.id);
    return res.json(buildAuthPayload(getUserById(user.id)));
});

app.post("/api/auth/logout", function (req, res) {
    req.session.destroy(function () {
        res.clearCookie("data_dashboard_session");
        res.json({ ok: true });
    });
});

app.get("/api/auth/me", function (req, res) {
    const user = getSessionUser(req);
    if (!user) {
        return res.status(401).json({ error: "未登录。" });
    }
    return res.json(buildAuthPayload(user));
});

app.get("/api/workbooks", requireAuth, function (req, res) {
    const payload = getAccessibleWorkbooks(req.user).map(stripWorkbookForClient);
    res.json(payload);
});

app.get("/api/workbooks/:id", requireAuth, requireWorkbookAccess, function (req, res) {
    res.json({
        workbook: stripWorkbookForClient(req.workbook),
        snapshot: getWorkbookSnapshot(req.workbook.id),
        permissions: buildPermissionFlags(req.user)
    });
});

app.put("/api/workbooks/:id", requireAuth, requireWorkbookAccess, function (req, res) {
    const nextSnapshot = normalizeSnapshot(req.body && req.body.data ? req.body.data : req.body);
    const previousSnapshot = getWorkbookSnapshot(req.workbook.id);

    try {
        assertCanWriteWorkbook(req.user, req.workbook, previousSnapshot, nextSnapshot);
    } catch (error) {
        return res.status(403).json({ error: error.message });
    }

    const savedSnapshot = saveWorkbookSnapshot(req.workbook.id, nextSnapshot, req.user.id, "save");
    return res.json({ snapshot: savedSnapshot });
});

app.post("/api/workbooks/:id/import", requireAuth, requireWorkbookAccess, requireRole(["super_admin", "admin"]), function (req, res) {
    const nextSnapshot = normalizeSnapshot(req.body && req.body.data ? req.body.data : req.body);
    const savedSnapshot = saveWorkbookSnapshot(req.workbook.id, nextSnapshot, req.user.id, "import");
    return res.json({ snapshot: savedSnapshot });
});

app.post("/api/workbooks/:id/clear", requireAuth, requireWorkbookAccess, requireRole(["super_admin", "admin"]), function (req, res) {
    const clearedSnapshot = createEmptySnapshot();
    saveWorkbookSnapshot(req.workbook.id, clearedSnapshot, req.user.id, "clear");
    return res.json({ snapshot: clearedSnapshot });
});

app.get("/api/workbooks/:id/history", requireAuth, requireWorkbookAccess, requireRole(["super_admin", "admin"]), function (req, res) {
    const rows = db.prepare(`
        SELECT h.id, h.workbook_id AS workbookId, h.action, h.created_at AS createdAt, u.username AS actorUsername
        FROM workbook_history h
        LEFT JOIN users u ON u.id = h.actor_user_id
        WHERE h.workbook_id = ?
        ORDER BY h.id DESC
        LIMIT 100
    `).all(req.workbook.id);
    res.json(rows);
});

app.get("/api/admin/users", requireAuth, requireRole(["super_admin"]), function (_req, res) {
    const rows = db.prepare(`
        SELECT id, username, role, status, created_at AS createdAt, updated_at AS updatedAt, last_login_at AS lastLoginAt
        FROM users
        ORDER BY id ASC
    `).all();
    res.json(rows);
});

app.post("/api/admin/users", requireAuth, requireRole(["super_admin"]), function (req, res) {
    const username = String(req.body && req.body.username || "").trim();
    const password = String(req.body && req.body.password || "");
    const role = normalizeRole(req.body && req.body.role, "data_entry");

    if (!username || !password) {
        return res.status(400).json({ error: "用户名和密码不能为空。" });
    }
    if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
        return res.status(409).json({ error: "用户名已存在。" });
    }

    const now = timestamp();
    db.prepare(`
        INSERT INTO users (username, password_hash, role, status, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?)
    `).run(username, bcrypt.hashSync(password, 10), role, now, now);

    res.json({ ok: true });
});

app.patch("/api/admin/users/:id", requireAuth, requireRole(["super_admin"]), function (req, res) {
    const userId = Number(req.params.id);
    const user = getUserById(userId);
    if (!user) {
        return res.status(404).json({ error: "账号不存在。" });
    }

    const role = normalizeRole(req.body && req.body.role, user.role);
    const status = normalizeStatus(req.body && req.body.status, user.status);

    if (user.id === req.user.id && role !== "super_admin") {
        return res.status(400).json({ error: "不能取消当前主账号的主账号权限。" });
    }
    if (user.id === req.user.id && status !== "active") {
        return res.status(400).json({ error: "不能停用当前登录主账号。" });
    }

    db.prepare("UPDATE users SET role = ?, status = ?, updated_at = ? WHERE id = ?").run(role, status, timestamp(), userId);
    res.json({ ok: true });
});

app.post("/api/admin/users/:id/reset-password", requireAuth, requireRole(["super_admin"]), function (req, res) {
    const userId = Number(req.params.id);
    const password = String(req.body && req.body.password || "");
    if (!getUserById(userId)) {
        return res.status(404).json({ error: "账号不存在。" });
    }
    if (!password) {
        return res.status(400).json({ error: "新密码不能为空。" });
    }
    db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), timestamp(), userId);
    res.json({ ok: true });
});

app.get("/api/admin/role-template-permissions", requireAuth, requireRole(["super_admin"]), function (_req, res) {
    const permissions = {};
    ["admin", "data_entry"].forEach(function (role) {
        permissions[role] = db.prepare("SELECT workbook_id FROM role_template_permissions WHERE role = ? ORDER BY workbook_id").all(role).map(function (row) {
            return row.workbook_id;
        });
    });

    res.json({
        roles: ["admin", "data_entry"],
        workbooks: visibleWorkbooks.map(function (workbook) {
            return {
                id: workbook.id,
                title: workbook.title
            };
        }),
        permissions: permissions
    });
});

app.put("/api/admin/role-template-permissions", requireAuth, requireRole(["super_admin"]), function (req, res) {
    const payload = req.body && req.body.permissions ? req.body.permissions : {};
    const transaction = db.transaction(function () {
        ["admin", "data_entry"].forEach(function (role) {
            db.prepare("DELETE FROM role_template_permissions WHERE role = ?").run(role);
            (payload[role] || []).forEach(function (workbookId) {
                if (workbookMap[workbookId] && !workbookMap[workbookId].hidden) {
                    db.prepare("INSERT INTO role_template_permissions (role, workbook_id) VALUES (?, ?)").run(role, workbookId);
                }
            });
        });
    });
    transaction();
    res.json({ ok: true });
});

app.get("/api/admin/backups/export", requireAuth, requireRole(["super_admin"]), function (_req, res) {
    res.json({
        exportedAt: timestamp(),
        users: db.prepare("SELECT username, password_hash AS passwordHash, role, status, created_at AS createdAt, updated_at AS updatedAt, last_login_at AS lastLoginAt FROM users ORDER BY id").all(),
        roleTemplatePermissions: db.prepare("SELECT role, workbook_id AS workbookId FROM role_template_permissions ORDER BY role, workbook_id").all(),
        workbookSnapshots: db.prepare("SELECT workbook_id AS workbookId, schema_version AS schemaVersion, data_json AS dataJson, updated_at AS updatedAt FROM workbook_snapshots ORDER BY workbook_id").all().map(function (row) {
            return {
                workbookId: row.workbookId,
                schemaVersion: row.schemaVersion,
                updatedAt: row.updatedAt,
                data: parseJson(row.dataJson) || createEmptySnapshot()
            };
        })
    });
});

app.post("/api/admin/backups/import", requireAuth, requireRole(["super_admin"]), function (req, res) {
    const payload = req.body || {};

    if (!Array.isArray(payload.users) || !Array.isArray(payload.roleTemplatePermissions) || !Array.isArray(payload.workbookSnapshots)) {
        return res.status(400).json({ error: "备份文件格式无效。" });
    }

    const transaction = db.transaction(function () {
        db.prepare("DELETE FROM role_template_permissions").run();
        db.prepare("DELETE FROM workbook_snapshots").run();
        db.prepare("DELETE FROM workbook_history").run();
        db.prepare("DELETE FROM users WHERE id != ?").run(req.user.id);

        payload.users.forEach(function (user) {
            if (user.username === req.user.username) {
                db.prepare(`
                    UPDATE users
                    SET password_hash = ?, role = ?, status = ?, updated_at = ?, last_login_at = ?
                    WHERE id = ?
                `).run(user.passwordHash, "super_admin", "active", user.updatedAt || timestamp(), user.lastLoginAt || null, req.user.id);
            } else {
                db.prepare(`
                    INSERT INTO users (username, password_hash, role, status, created_at, updated_at, last_login_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(user.username, user.passwordHash, normalizeRole(user.role, "data_entry"), normalizeStatus(user.status, "active"), user.createdAt || timestamp(), user.updatedAt || timestamp(), user.lastLoginAt || null);
            }
        });

        payload.roleTemplatePermissions.forEach(function (item) {
            if (["admin", "data_entry"].indexOf(item.role) !== -1 && workbookMap[item.workbookId]) {
                db.prepare("INSERT INTO role_template_permissions (role, workbook_id) VALUES (?, ?)").run(item.role, item.workbookId);
            }
        });

        payload.workbookSnapshots.forEach(function (snapshot) {
            if (workbookMap[snapshot.workbookId]) {
                db.prepare(`
                    INSERT INTO workbook_snapshots (workbook_id, schema_version, data_json, updated_by_user_id, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `).run(snapshot.workbookId, Number(snapshot.schemaVersion || 2), JSON.stringify(normalizeSnapshot(snapshot.data)), req.user.id, snapshot.updatedAt || timestamp());
            }
        });
    });

    transaction();
    seedRoleTemplatePermissions();
    res.json({ ok: true });
});

app.use(express.static(ROOT, {
    index: false,
    setHeaders: function (res, filePath) {
        if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache");
        }
    }
}));

app.listen(PORT, function () {
    console.log("data-dashboard server listening on http://127.0.0.1:" + PORT);
});

function loadWorkbookManifests() {
    const manifestsDir = path.join(ROOT, "manifests");
    const files = fs.readdirSync(manifestsDir).filter((name) => name.endsWith(".js")).sort();
    const registered = [];
    const context = {
        window: {
            DataDashboardTemplatePlatform: {
                registerWorkbook(manifest) {
                    registered.push(JSON.parse(JSON.stringify(manifest)));
                }
            }
        }
    };
    context.window.window = context.window;
    vm.createContext(context);

    files.forEach((file) => {
        const source = fs.readFileSync(path.join(manifestsDir, file), "utf8");
        vm.runInContext(source, context, { filename: file });
    });

    return registered;
}

function initializeDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_login_at TEXT
        );

        CREATE TABLE IF NOT EXISTS role_template_permissions (
            role TEXT NOT NULL,
            workbook_id TEXT NOT NULL,
            PRIMARY KEY (role, workbook_id)
        );

        CREATE TABLE IF NOT EXISTS workbook_snapshots (
            workbook_id TEXT PRIMARY KEY,
            schema_version INTEGER NOT NULL,
            data_json TEXT NOT NULL,
            updated_by_user_id INTEGER,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workbook_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workbook_id TEXT NOT NULL,
            action TEXT NOT NULL,
            snapshot_json TEXT NOT NULL,
            actor_user_id INTEGER,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            sid TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            updated_at TEXT NOT NULL
        );
    `);
}

function seedRoleTemplatePermissions() {
    const insert = db.prepare("INSERT OR IGNORE INTO role_template_permissions (role, workbook_id) VALUES (?, ?)");
    visibleWorkbooks.forEach((workbook) => {
        insert.run("admin", workbook.id);
        insert.run("data_entry", workbook.id);
    });
}

function bootstrapSuperAdmin() {
    const count = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'super_admin'").get().count;
    if (count > 0) {
        return;
    }

    const username = process.env.DATA_DASHBOARD_SUPERADMIN_USERNAME || (process.env.NODE_ENV === "production" ? "" : "root");
    const password = process.env.DATA_DASHBOARD_SUPERADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "ChangeMe123!");

    if (!username || !password) {
        throw new Error("缺少主账号引导环境变量：DATA_DASHBOARD_SUPERADMIN_USERNAME / DATA_DASHBOARD_SUPERADMIN_PASSWORD");
    }

    const now = timestamp();
    db.prepare(`
        INSERT INTO users (username, password_hash, role, status, created_at, updated_at)
        VALUES (?, ?, 'super_admin', 'active', ?, ?)
    `).run(username, bcrypt.hashSync(password, 10), now, now);

    if (process.env.NODE_ENV !== "production") {
        console.log("bootstrapped super_admin:", username, password);
    }
}

function createEmptySnapshot() {
    return {
        schemaVersion: 2,
        savedAt: "",
        sheets: {}
    };
}

function normalizeSnapshot(snapshot) {
    const normalized = snapshot && typeof snapshot === "object"
        ? JSON.parse(JSON.stringify(snapshot))
        : createEmptySnapshot();

    if (!normalized.schemaVersion) {
        normalized.schemaVersion = 2;
    }
    if (!normalized.savedAt) {
        normalized.savedAt = "";
    }
    if (!normalized.sheets || typeof normalized.sheets !== "object") {
        normalized.sheets = {};
    }
    return normalized;
}

function parseJson(text) {
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}

function timestamp() {
    return new Date().toISOString();
}

function normalizeCookieSecure(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "1" || normalized === "true") {
        return true;
    }
    if (normalized === "0" || normalized === "false") {
        return false;
    }
    if (normalized === "auto") {
        return "auto";
    }
    return process.env.NODE_ENV === "production" ? "auto" : false;
}

function normalizeTrustProxyHops(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function getSessionExpiresAt(sessionValue) {
    return sessionValue && sessionValue.cookie && sessionValue.cookie.expires
        ? new Date(sessionValue.cookie.expires).getTime()
        : Date.now() + 7 * 24 * 60 * 60 * 1000;
}

function normalizeWorkbookId(id) {
    const rawId = String(id || "");
    return rawId === "3" ? "2" : rawId;
}

function stripWorkbookForClient(workbook) {
    return JSON.parse(JSON.stringify(workbook));
}

function getUserById(userId) {
    return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
}

function getSessionUser(req) {
    return req.session && req.session.userId ? getUserById(req.session.userId) : null;
}

function normalizeRole(role, fallback) {
    const value = String(role || "").trim();
    return ROLE_TYPES.indexOf(value) !== -1 ? value : fallback;
}

function normalizeStatus(status, fallback) {
    const value = String(status || "").trim();
    return USER_STATUS_TYPES.indexOf(value) !== -1 ? value : fallback;
}

function getAccessibleWorkbookIds(user) {
    if (user.role === "super_admin") {
        return visibleWorkbooks.map((workbook) => workbook.id);
    }
    return db.prepare("SELECT workbook_id FROM role_template_permissions WHERE role = ? ORDER BY workbook_id").all(user.role).map((row) => row.workbook_id);
}

function getAccessibleWorkbooks(user) {
    const ids = getAccessibleWorkbookIds(user);
    return visibleWorkbooks.filter((workbook) => ids.indexOf(workbook.id) !== -1);
}

function buildPermissionFlags(user) {
    return {
        manageUsers: user.role === "super_admin",
        manageRoleTemplatePermissions: user.role === "super_admin",
        exportAllBackups: user.role === "super_admin",
        importAllBackups: user.role === "super_admin",
        canEditStructure: user.role !== "data_entry",
        canManageData: user.role !== "data_entry",
        canEditValues: true
    };
}

function buildAuthPayload(user) {
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        allowedWorkbookIds: getAccessibleWorkbookIds(user),
        permissions: buildPermissionFlags(user)
    };
}

function getWorkbookSnapshot(workbookId) {
    const row = db.prepare("SELECT data_json FROM workbook_snapshots WHERE workbook_id = ?").get(workbookId);
    return normalizeSnapshot(row ? parseJson(row.data_json) : null);
}

function saveWorkbookSnapshot(workbookId, snapshot, actorUserId, action) {
    const normalized = normalizeSnapshot(snapshot);
    normalized.savedAt = timestamp();

    db.prepare(`
        INSERT INTO workbook_snapshots (workbook_id, schema_version, data_json, updated_by_user_id, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(workbook_id) DO UPDATE SET
            schema_version = excluded.schema_version,
            data_json = excluded.data_json,
            updated_by_user_id = excluded.updated_by_user_id,
            updated_at = excluded.updated_at
    `).run(workbookId, Number(normalized.schemaVersion || 2), JSON.stringify(normalized), actorUserId || null, normalized.savedAt);

    db.prepare(`
        INSERT INTO workbook_history (workbook_id, action, snapshot_json, actor_user_id, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(workbookId, action || "save", JSON.stringify(normalized), actorUserId || null, normalized.savedAt);

    return normalized;
}

function assertCanWriteWorkbook(user, workbook, previousSnapshot, nextSnapshot) {
    if (user.role !== "data_entry") {
        return;
    }
    if (!previousSnapshot || !previousSnapshot.savedAt) {
        return;
    }

    workbook.sheets.forEach((sheet) => {
        const keys = STRUCTURE_KEYS_BY_TYPE[sheet.type] || [];
        const previousSheetState = previousSnapshot.sheets && previousSnapshot.sheets[sheet.id] ? previousSnapshot.sheets[sheet.id] : {};
        const nextSheetState = nextSnapshot.sheets && nextSnapshot.sheets[sheet.id] ? nextSnapshot.sheets[sheet.id] : {};

        keys.forEach((key) => {
            const previousValue = JSON.stringify(previousSheetState[key] || null);
            const nextValue = JSON.stringify(nextSheetState[key] || null);
            if (previousValue !== nextValue) {
                throw new Error("当前账号无权修改模板结构。");
            }
        });
    });
}

function requireAuth(req, res, next) {
    const user = getSessionUser(req);
    if (!user || user.status !== "active") {
        return res.status(401).json({ error: "未登录。" });
    }
    req.user = user;
    next();
}

function requireRole(roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    return function (req, res, next) {
        if (allowed.indexOf(req.user.role) === -1) {
            return res.status(403).json({ error: "当前账号无权访问该功能。" });
        }
        next();
    };
}

function requireWorkbookAccess(req, res, next) {
    const workbookId = normalizeWorkbookId(req.params.id);
    const workbook = workbookMap[workbookId];

    if (!workbook || workbook.hidden) {
        return res.status(404).json({ error: "工作簿不存在。" });
    }

    if (req.user.role !== "super_admin" && getAccessibleWorkbookIds(req.user).indexOf(workbookId) === -1) {
        return res.status(403).json({ error: "当前账号无权访问该模板。" });
    }

    req.workbook = workbook;
    next();
}
