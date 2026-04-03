const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PORT = Number(process.env.PORT || 4173);
const SESSION_SECRET = process.env.DATA_DASHBOARD_SESSION_SECRET || crypto.randomBytes(24).toString("hex");
const TRUST_PROXY_HOPS = normalizeTrustProxyHops(process.env.DATA_DASHBOARD_TRUST_PROXY_HOPS);
const COOKIE_SECURE = normalizeCookieSecure(process.env.DATA_DASHBOARD_COOKIE_SECURE);
const DB_HOST = process.env.DATA_DASHBOARD_PG_HOST || process.env.POSTGRES_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DATA_DASHBOARD_PG_PORT || process.env.POSTGRES_PORT || 5432);
const DB_NAME = process.env.DATA_DASHBOARD_PG_DATABASE || process.env.POSTGRES_DB || "data_dashboard";
const DB_USER = process.env.DATA_DASHBOARD_PG_USER || process.env.POSTGRES_USER || "data_dashboard";
const DB_PASSWORD = process.env.DATA_DASHBOARD_PG_PASSWORD || process.env.POSTGRES_PASSWORD || "change-me";
const DB_SSL = normalizeDbSsl(process.env.DATA_DASHBOARD_PG_SSL || process.env.POSTGRES_SSL);
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

const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: DB_SSL
});

pool.on("error", (error) => {
    console.error("postgres pool error:", error);
});

class PostgresSessionStore extends session.Store {
    constructor(databasePool) {
        super();
        this.pool = databasePool;
    }

    get(sid, callback) {
        Promise.resolve()
            .then(() => this.cleanupExpiredSessions())
            .then(() => this.pool.query("SELECT data FROM sessions WHERE sid = $1 AND expires_at > $2", [sid, Date.now()]))
            .then((result) => {
                const row = result.rows[0];
                callback(null, row ? parseJson(row.data) : null);
            })
            .catch((error) => {
                callback(error);
            });
    }

    set(sid, sessionValue, callback) {
        const expiresAt = getSessionExpiresAt(sessionValue);
        this.pool.query(`
            INSERT INTO sessions (sid, data, expires_at, updated_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (sid) DO UPDATE SET
                data = EXCLUDED.data,
                expires_at = EXCLUDED.expires_at,
                updated_at = EXCLUDED.updated_at
        `, [sid, JSON.stringify(sessionValue), expiresAt, timestamp()])
            .then(() => {
                if (callback) {
                    callback(null);
                }
            })
            .catch((error) => {
                if (callback) {
                    callback(error);
                }
            });
    }

    destroy(sid, callback) {
        this.pool.query("DELETE FROM sessions WHERE sid = $1", [sid])
            .then(() => {
                if (callback) {
                    callback(null);
                }
            })
            .catch((error) => {
                if (callback) {
                    callback(error);
                }
            });
    }

    touch(sid, sessionValue, callback) {
        this.pool.query(
            "UPDATE sessions SET expires_at = $1, updated_at = $2 WHERE sid = $3",
            [getSessionExpiresAt(sessionValue), timestamp(), sid]
        )
            .then(() => {
                if (callback) {
                    callback(null);
                }
            })
            .catch((error) => {
                if (callback) {
                    callback(error);
                }
            });
    }

    cleanupExpiredSessions() {
        return this.pool.query("DELETE FROM sessions WHERE expires_at <= $1", [Date.now()]);
    }
}

const app = express();
const sessionStore = new PostgresSessionStore(pool);

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

const requireAuth = asyncHandler(async function (req, res, next) {
    const user = await getSessionUser(req);
    if (!user || user.status !== "active") {
        return res.status(401).json({ error: "未登录。" });
    }
    req.user = user;
    next();
});

const requireWorkbookAccess = asyncHandler(async function (req, res, next) {
    const workbookId = normalizeWorkbookId(req.params.id);
    const workbook = workbookMap[workbookId];

    if (!workbook || workbook.hidden) {
        return res.status(404).json({ error: "工作簿不存在。" });
    }

    if (req.user.role !== "super_admin") {
        const allowedWorkbookIds = await getAccessibleWorkbookIds(req.user);
        if (allowedWorkbookIds.indexOf(workbookId) === -1) {
            return res.status(403).json({ error: "当前账号无权访问该模板。" });
        }
    }

    req.workbook = workbook;
    next();
});

app.get("/", function (_req, res) {
    res.redirect("/index.html");
});

app.post("/api/auth/login", asyncHandler(async function (req, res) {
    const username = String(req.body && req.body.username || "").trim();
    const password = String(req.body && req.body.password || "");

    if (!username || !password) {
        return res.status(400).json({ error: "请输入用户名和密码。" });
    }

    const user = await queryRow("SELECT * FROM users WHERE username = $1", [username]);
    if (!user || user.status !== "active") {
        return res.status(401).json({ error: "账号不存在或已停用。" });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "用户名或密码错误。" });
    }

    req.session.userId = user.id;
    await execute("UPDATE users SET last_login_at = $1, updated_at = $2 WHERE id = $3", [timestamp(), timestamp(), user.id]);
    return res.json(await buildAuthPayload(await getUserById(user.id)));
}));

app.post("/api/auth/logout", function (req, res) {
    req.session.destroy(function () {
        res.clearCookie("data_dashboard_session");
        res.json({ ok: true });
    });
});

app.get("/api/auth/me", asyncHandler(async function (req, res) {
    const user = await getSessionUser(req);
    if (!user) {
        return res.status(401).json({ error: "未登录。" });
    }
    return res.json(await buildAuthPayload(user));
}));

app.get("/api/workbooks", requireAuth, asyncHandler(async function (req, res) {
    const payload = (await getAccessibleWorkbooks(req.user)).map(stripWorkbookForClient);
    res.json(payload);
}));

app.get("/api/workbooks/:id", requireAuth, requireWorkbookAccess, asyncHandler(async function (req, res) {
    res.json({
        workbook: stripWorkbookForClient(req.workbook),
        snapshot: await getWorkbookSnapshot(req.workbook.id),
        permissions: buildPermissionFlags(req.user)
    });
}));

app.put("/api/workbooks/:id", requireAuth, requireWorkbookAccess, asyncHandler(async function (req, res) {
    const nextSnapshot = normalizeSnapshot(req.body && req.body.data ? req.body.data : req.body);
    const previousSnapshot = await getWorkbookSnapshot(req.workbook.id);

    try {
        assertCanWriteWorkbook(req.user, req.workbook, previousSnapshot, nextSnapshot);
    } catch (error) {
        return res.status(403).json({ error: error.message });
    }

    const savedSnapshot = await saveWorkbookSnapshot(req.workbook.id, nextSnapshot, req.user.id, "save");
    return res.json({ snapshot: savedSnapshot });
}));

app.post("/api/workbooks/:id/import", requireAuth, requireWorkbookAccess, requireRole(["super_admin", "admin"]), asyncHandler(async function (req, res) {
    const nextSnapshot = normalizeSnapshot(req.body && req.body.data ? req.body.data : req.body);
    const savedSnapshot = await saveWorkbookSnapshot(req.workbook.id, nextSnapshot, req.user.id, "import");
    return res.json({ snapshot: savedSnapshot });
}));

app.post("/api/workbooks/:id/clear", requireAuth, requireWorkbookAccess, requireRole(["super_admin", "admin"]), asyncHandler(async function (req, res) {
    const clearedSnapshot = createEmptySnapshot();
    await saveWorkbookSnapshot(req.workbook.id, clearedSnapshot, req.user.id, "clear");
    return res.json({ snapshot: clearedSnapshot });
}));

app.get("/api/workbooks/:id/history", requireAuth, requireWorkbookAccess, requireRole(["super_admin", "admin"]), asyncHandler(async function (req, res) {
    const rows = await queryAll(`
        SELECT h.id,
               h.workbook_id AS "workbookId",
               h.action,
               h.created_at AS "createdAt",
               u.username AS "actorUsername"
        FROM workbook_history h
        LEFT JOIN users u ON u.id = h.actor_user_id
        WHERE h.workbook_id = $1
        ORDER BY h.id DESC
        LIMIT 100
    `, [req.workbook.id]);
    res.json(rows);
}));

app.get("/api/admin/users", requireAuth, requireRole(["super_admin"]), asyncHandler(async function (_req, res) {
    const rows = await queryAll(`
        SELECT id,
               username,
               role,
               status,
               created_at AS "createdAt",
               updated_at AS "updatedAt",
               last_login_at AS "lastLoginAt"
        FROM users
        ORDER BY id ASC
    `);
    res.json(rows);
}));

app.post("/api/admin/users", requireAuth, requireRole(["super_admin"]), asyncHandler(async function (req, res) {
    const username = String(req.body && req.body.username || "").trim();
    const password = String(req.body && req.body.password || "");
    const role = normalizeRole(req.body && req.body.role, "data_entry");

    if (!username || !password) {
        return res.status(400).json({ error: "用户名和密码不能为空。" });
    }

    const existed = await queryRow("SELECT 1 AS existed FROM users WHERE username = $1", [username]);
    if (existed) {
        return res.status(409).json({ error: "用户名已存在。" });
    }

    const now = timestamp();
    await execute(`
        INSERT INTO users (username, password_hash, role, status, created_at, updated_at)
        VALUES ($1, $2, $3, 'active', $4, $5)
    `, [username, bcrypt.hashSync(password, 10), role, now, now]);

    res.json({ ok: true });
}));

app.patch("/api/admin/users/:id", requireAuth, requireRole(["super_admin"]), asyncHandler(async function (req, res) {
    const userId = Number(req.params.id);
    const user = await getUserById(userId);
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

    await execute("UPDATE users SET role = $1, status = $2, updated_at = $3 WHERE id = $4", [role, status, timestamp(), userId]);
    res.json({ ok: true });
}));

app.post("/api/admin/users/:id/reset-password", requireAuth, requireRole(["super_admin"]), asyncHandler(async function (req, res) {
    const userId = Number(req.params.id);
    const password = String(req.body && req.body.password || "");
    if (!await getUserById(userId)) {
        return res.status(404).json({ error: "账号不存在。" });
    }
    if (!password) {
        return res.status(400).json({ error: "新密码不能为空。" });
    }
    await execute("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3", [bcrypt.hashSync(password, 10), timestamp(), userId]);
    res.json({ ok: true });
}));

app.get("/api/admin/role-template-permissions", requireAuth, requireRole(["super_admin"]), asyncHandler(async function (_req, res) {
    const permissions = {};
    for (const role of ["admin", "data_entry"]) {
        permissions[role] = (await queryAll(
            "SELECT workbook_id FROM role_template_permissions WHERE role = $1 ORDER BY workbook_id",
            [role]
        )).map((row) => row.workbook_id);
    }

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
}));

app.put("/api/admin/role-template-permissions", requireAuth, requireRole(["super_admin"]), asyncHandler(async function (req, res) {
    const payload = req.body && req.body.permissions ? req.body.permissions : {};

    await withTransaction(async function (client) {
        for (const role of ["admin", "data_entry"]) {
            await execute("DELETE FROM role_template_permissions WHERE role = $1", [role], client);
            for (const workbookId of payload[role] || []) {
                if (workbookMap[workbookId] && !workbookMap[workbookId].hidden) {
                    await execute(
                        "INSERT INTO role_template_permissions (role, workbook_id) VALUES ($1, $2) ON CONFLICT (role, workbook_id) DO NOTHING",
                        [role, workbookId],
                        client
                    );
                }
            }
        }
    });

    res.json({ ok: true });
}));

app.get("/api/admin/backups/export", requireAuth, requireRole(["super_admin"]), asyncHandler(async function (_req, res) {
    const users = await queryAll(`
        SELECT username,
               password_hash AS "passwordHash",
               role,
               status,
               created_at AS "createdAt",
               updated_at AS "updatedAt",
               last_login_at AS "lastLoginAt"
        FROM users
        ORDER BY id
    `);
    const roleTemplatePermissions = await queryAll(`
        SELECT role,
               workbook_id AS "workbookId"
        FROM role_template_permissions
        ORDER BY role, workbook_id
    `);
    const workbookSnapshots = (await queryAll(`
        SELECT workbook_id AS "workbookId",
               schema_version AS "schemaVersion",
               data_json AS "dataJson",
               updated_at AS "updatedAt"
        FROM workbook_snapshots
        ORDER BY workbook_id
    `)).map(function (row) {
        return {
            workbookId: row.workbookId,
            schemaVersion: row.schemaVersion,
            updatedAt: row.updatedAt,
            data: parseJson(row.dataJson) || createEmptySnapshot()
        };
    });

    res.json({
        exportedAt: timestamp(),
        users: users,
        roleTemplatePermissions: roleTemplatePermissions,
        workbookSnapshots: workbookSnapshots
    });
}));

app.post("/api/admin/backups/import", requireAuth, requireRole(["super_admin"]), asyncHandler(async function (req, res) {
    const payload = req.body || {};

    if (!Array.isArray(payload.users) || !Array.isArray(payload.roleTemplatePermissions) || !Array.isArray(payload.workbookSnapshots)) {
        return res.status(400).json({ error: "备份文件格式无效。" });
    }

    await withTransaction(async function (client) {
        await execute("DELETE FROM role_template_permissions", [], client);
        await execute("DELETE FROM workbook_snapshots", [], client);
        await execute("DELETE FROM workbook_history", [], client);
        await execute("DELETE FROM users WHERE id <> $1", [req.user.id], client);

        for (const user of payload.users) {
            if (user.username === req.user.username) {
                await execute(`
                    UPDATE users
                    SET password_hash = $1,
                        role = $2,
                        status = $3,
                        updated_at = $4,
                        last_login_at = $5
                    WHERE id = $6
                `, [
                    user.passwordHash,
                    "super_admin",
                    "active",
                    user.updatedAt || timestamp(),
                    user.lastLoginAt || null,
                    req.user.id
                ], client);
            } else {
                await execute(`
                    INSERT INTO users (username, password_hash, role, status, created_at, updated_at, last_login_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    user.username,
                    user.passwordHash,
                    normalizeRole(user.role, "data_entry"),
                    normalizeStatus(user.status, "active"),
                    user.createdAt || timestamp(),
                    user.updatedAt || timestamp(),
                    user.lastLoginAt || null
                ], client);
            }
        }

        for (const item of payload.roleTemplatePermissions) {
            if (["admin", "data_entry"].indexOf(item.role) !== -1 && workbookMap[item.workbookId]) {
                await execute(
                    "INSERT INTO role_template_permissions (role, workbook_id) VALUES ($1, $2) ON CONFLICT (role, workbook_id) DO NOTHING",
                    [item.role, item.workbookId],
                    client
                );
            }
        }

        for (const snapshot of payload.workbookSnapshots) {
            if (workbookMap[snapshot.workbookId]) {
                await execute(`
                    INSERT INTO workbook_snapshots (workbook_id, schema_version, data_json, updated_by_user_id, updated_at)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (workbook_id) DO UPDATE SET
                        schema_version = EXCLUDED.schema_version,
                        data_json = EXCLUDED.data_json,
                        updated_by_user_id = EXCLUDED.updated_by_user_id,
                        updated_at = EXCLUDED.updated_at
                `, [
                    snapshot.workbookId,
                    Number(snapshot.schemaVersion || 2),
                    JSON.stringify(normalizeSnapshot(snapshot.data)),
                    req.user.id,
                    snapshot.updatedAt || timestamp()
                ], client);
            }
        }
    });

    await seedRoleTemplatePermissions();
    res.json({ ok: true });
}));

app.use(express.static(ROOT, {
    index: false,
    setHeaders: function (res, filePath) {
        if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache");
        }
    }
}));

app.use(function (error, req, res, _next) {
    console.error("request failed:", error);
    if (res.headersSent) {
        return;
    }
    if (req.path && req.path.startsWith("/api/")) {
        return res.status(500).json({ error: "服务器内部错误。" });
    }
    return res.status(500).send("Internal Server Error");
});

startServer().catch((error) => {
    console.error("failed to bootstrap server:", error);
    process.exit(1);
});

async function startServer() {
    await initializeDatabase();
    await seedRoleTemplatePermissions();
    await bootstrapSuperAdmin();

    app.listen(PORT, function () {
        console.log("data-dashboard server listening on http://127.0.0.1:" + PORT);
    });
}

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

async function initializeDatabase() {
    const statements = [
        `
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_login_at TEXT
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS role_template_permissions (
            role TEXT NOT NULL,
            workbook_id TEXT NOT NULL,
            PRIMARY KEY (role, workbook_id)
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS workbook_snapshots (
            workbook_id TEXT PRIMARY KEY,
            schema_version INTEGER NOT NULL,
            data_json TEXT NOT NULL,
            updated_by_user_id BIGINT,
            updated_at TEXT NOT NULL
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS workbook_history (
            id BIGSERIAL PRIMARY KEY,
            workbook_id TEXT NOT NULL,
            action TEXT NOT NULL,
            snapshot_json TEXT NOT NULL,
            actor_user_id BIGINT,
            created_at TEXT NOT NULL
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS sessions (
            sid TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            expires_at BIGINT NOT NULL,
            updated_at TEXT NOT NULL
        )
        `,
        "CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)",
        "CREATE INDEX IF NOT EXISTS idx_workbook_history_workbook_id ON workbook_history (workbook_id)"
    ];

    for (const statement of statements) {
        await execute(statement);
    }
}

async function seedRoleTemplatePermissions() {
    for (const workbook of visibleWorkbooks) {
        await execute(
            "INSERT INTO role_template_permissions (role, workbook_id) VALUES ($1, $2) ON CONFLICT (role, workbook_id) DO NOTHING",
            ["admin", workbook.id]
        );
        await execute(
            "INSERT INTO role_template_permissions (role, workbook_id) VALUES ($1, $2) ON CONFLICT (role, workbook_id) DO NOTHING",
            ["data_entry", workbook.id]
        );
    }
}

async function bootstrapSuperAdmin() {
    const row = await queryRow("SELECT COUNT(*)::int AS count FROM users WHERE role = 'super_admin'");
    if (row && row.count > 0) {
        return;
    }

    const username = process.env.DATA_DASHBOARD_SUPERADMIN_USERNAME || (process.env.NODE_ENV === "production" ? "" : "root");
    const password = process.env.DATA_DASHBOARD_SUPERADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "ChangeMe123!");

    if (!username || !password) {
        throw new Error("缺少主账号引导环境变量：DATA_DASHBOARD_SUPERADMIN_USERNAME / DATA_DASHBOARD_SUPERADMIN_PASSWORD");
    }

    const now = timestamp();
    await execute(`
        INSERT INTO users (username, password_hash, role, status, created_at, updated_at)
        VALUES ($1, $2, 'super_admin', 'active', $3, $4)
    `, [username, bcrypt.hashSync(password, 10), now, now]);

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

function parseJson(value) {
    if (!value) {
        return null;
    }
    if (typeof value === "object") {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch (error) {
        return null;
    }
}

function timestamp() {
    return new Date().toISOString();
}

function normalizeDbSsl(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "require" || normalized === "yes") {
        return { rejectUnauthorized: false };
    }
    return false;
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

async function getUserById(userId) {
    return queryRow("SELECT * FROM users WHERE id = $1", [userId]);
}

async function getSessionUser(req) {
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

async function getAccessibleWorkbookIds(user) {
    if (user.role === "super_admin") {
        return visibleWorkbooks.map((workbook) => workbook.id);
    }
    return (await queryAll(
        "SELECT workbook_id FROM role_template_permissions WHERE role = $1 ORDER BY workbook_id",
        [user.role]
    )).map((row) => row.workbook_id);
}

async function getAccessibleWorkbooks(user) {
    const ids = await getAccessibleWorkbookIds(user);
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

async function buildAuthPayload(user) {
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        allowedWorkbookIds: await getAccessibleWorkbookIds(user),
        permissions: buildPermissionFlags(user)
    };
}

async function getWorkbookSnapshot(workbookId) {
    const row = await queryRow("SELECT data_json FROM workbook_snapshots WHERE workbook_id = $1", [workbookId]);
    return normalizeSnapshot(row ? parseJson(row.data_json) : null);
}

async function saveWorkbookSnapshot(workbookId, snapshot, actorUserId, action) {
    const normalized = normalizeSnapshot(snapshot);
    normalized.savedAt = timestamp();

    await execute(`
        INSERT INTO workbook_snapshots (workbook_id, schema_version, data_json, updated_by_user_id, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (workbook_id) DO UPDATE SET
            schema_version = EXCLUDED.schema_version,
            data_json = EXCLUDED.data_json,
            updated_by_user_id = EXCLUDED.updated_by_user_id,
            updated_at = EXCLUDED.updated_at
    `, [workbookId, Number(normalized.schemaVersion || 2), JSON.stringify(normalized), actorUserId || null, normalized.savedAt]);

    await execute(`
        INSERT INTO workbook_history (workbook_id, action, snapshot_json, actor_user_id, created_at)
        VALUES ($1, $2, $3, $4, $5)
    `, [workbookId, action || "save", JSON.stringify(normalized), actorUserId || null, normalized.savedAt]);

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

function requireRole(roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    return function (req, res, next) {
        if (allowed.indexOf(req.user.role) === -1) {
            return res.status(403).json({ error: "当前账号无权访问该功能。" });
        }
        next();
    };
}

function asyncHandler(handler) {
    return function (req, res, next) {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

async function withTransaction(work) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await work(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (_rollbackError) {
            // ignore rollback failure
        }
        throw error;
    } finally {
        client.release();
    }
}

async function execute(sql, params, client) {
    const target = client || pool;
    await target.query(sql, params || []);
}

async function queryAll(sql, params, client) {
    const target = client || pool;
    const result = await target.query(sql, params || []);
    return result.rows;
}

async function queryRow(sql, params, client) {
    const rows = await queryAll(sql, params, client);
    return rows[0] || null;
}
