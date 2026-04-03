(function () {
    var utils = window.DataDashboardUtils;
    var platform = window.DataDashboardTemplatePlatform;
    var LEGACY_WORKBOOK_ID = "3";
    var MIGRATED_WORKBOOK_ID = "2";
    var SCHEMA_VERSION = 2;
    var STORAGE_PREFIX = "excel_template_center_v1";

    function storageKey(id) {
        return STORAGE_PREFIX + ":" + id;
    }

    function createEmptyWorkbookStore() {
        return {
            schemaVersion: SCHEMA_VERSION,
            savedAt: "",
            sheets: {}
        };
    }

    function normalizeStoreSnapshot(value) {
        var snapshot = value && typeof value === "object" ? utils.cloneDeep(value) : createEmptyWorkbookStore();

        if (!snapshot.schemaVersion || Number(snapshot.schemaVersion) < 1) {
            snapshot.schemaVersion = SCHEMA_VERSION;
        }
        if (!snapshot.savedAt) {
            snapshot.savedAt = "";
        }
        if (!snapshot.sheets || typeof snapshot.sheets !== "object") {
            snapshot.sheets = {};
        }
        return snapshot;
    }

    function getWorkbookMeta(id) {
        return platform && typeof platform.getWorkbook === "function"
            ? platform.getWorkbook(id)
            : null;
    }

    function buildWorkbookPayload(id, snapshot) {
        var meta = getWorkbookMeta(id);
        return {
            schemaVersion: SCHEMA_VERSION,
            workbookId: String(id),
            fileName: meta ? meta.fileName : String(id) + ".xlsx",
            title: meta ? meta.title : "",
            exportedAt: new Date().toISOString(),
            data: normalizeStoreSnapshot(snapshot)
        };
    }

    function resolveWorkbookId(id) {
        var rawId = String(id || "");
        return rawId === LEGACY_WORKBOOK_ID ? MIGRATED_WORKBOOK_ID : rawId;
    }

    function loadWorkbookStore(id) {
        var payload = window.DataDashboardApi.__loadWorkbookSync(resolveWorkbookId(id));
        return normalizeStoreSnapshot(payload && payload.snapshot ? payload.snapshot : payload);
    }

    function saveWorkbookStore(id, snapshot) {
        var payload = window.DataDashboardApi.__saveWorkbookSync(resolveWorkbookId(id), normalizeStoreSnapshot(snapshot));
        return normalizeStoreSnapshot(payload && payload.snapshot ? payload.snapshot : payload);
    }

    function clearWorkbookStore(id) {
        var payload = window.DataDashboardApi.__clearWorkbookSync(resolveWorkbookId(id));
        return normalizeStoreSnapshot(payload && payload.snapshot ? payload.snapshot : payload);
    }

    function exportWorkbookStore(id, snapshot) {
        return buildWorkbookPayload(resolveWorkbookId(id), typeof snapshot === "undefined" ? loadWorkbookStore(id) : snapshot);
    }

    function exportAllWorkbookStores(ids) {
        var workbookIds = Array.isArray(ids) && ids.length
            ? ids.map(function (id) { return resolveWorkbookId(id); })
            : platform.getAllWorkbooks().map(function (workbook) { return workbook.id; });

        return {
            schemaVersion: SCHEMA_VERSION,
            storagePrefix: STORAGE_PREFIX,
            exportedAt: new Date().toISOString(),
            workbooks: workbookIds.map(function (id) {
                return exportWorkbookStore(id);
            })
        };
    }

    function resolveImportPayload(id, payload) {
        if (!payload || typeof payload !== "object") {
            throw new Error("导入文件内容无效。");
        }

        if (Array.isArray(payload.workbooks)) {
            var match = payload.workbooks.find(function (item) {
                return String(item && item.workbookId || "") === String(resolveWorkbookId(id));
            });
            if (!match) {
                throw new Error("导入文件中没有当前工作簿的数据。");
            }
            return resolveImportPayload(id, match);
        }

        if (payload.workbookId && String(payload.workbookId) !== String(resolveWorkbookId(id))) {
            throw new Error("导入文件与当前工作簿不匹配。");
        }

        return normalizeStoreSnapshot(payload.data && typeof payload.data === "object" ? payload.data : payload);
    }

    function importWorkbookStore(id, payload) {
        var snapshot = resolveImportPayload(id, payload);
        var response = window.DataDashboardApi.__importWorkbookSync(resolveWorkbookId(id), {
            workbookId: resolveWorkbookId(id),
            data: snapshot
        });
        return normalizeStoreSnapshot(response && response.snapshot ? response.snapshot : response);
    }

    function migrateLegacyWorkbook3() {
        return {
            migrated: false,
            snapshot: loadWorkbookStore(MIGRATED_WORKBOOK_ID)
        };
    }

    window.DataDashboardStorage = {
        SCHEMA_VERSION: SCHEMA_VERSION,
        STORAGE_PREFIX: STORAGE_PREFIX,
        clearWorkbookStore: clearWorkbookStore,
        createEmptyWorkbookStore: createEmptyWorkbookStore,
        exportAllWorkbookStores: exportAllWorkbookStores,
        exportWorkbookStore: exportWorkbookStore,
        importWorkbookStore: importWorkbookStore,
        loadWorkbookStore: loadWorkbookStore,
        migrateLegacyWorkbook3: migrateLegacyWorkbook3,
        normalizeStoreSnapshot: normalizeStoreSnapshot,
        saveWorkbookStore: saveWorkbookStore,
        storageKey: storageKey
    };
})();
