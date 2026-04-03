(function () {
    var MONTHS = Array.from({ length: 12 }, function (_, index) {
        return (index + 1) + "月";
    });

    var workbookAliases = {
        "3": "2"
    };

    var registry = {
        workbookOrder: [],
        workbooks: {},
        sheetAdapters: {}
    };

    function clone(value) {
        return value === null || typeof value === "undefined"
            ? value
            : JSON.parse(JSON.stringify(value));
    }

    function normalizeSheetManifest(sheet) {
        var manifest = sheet && typeof sheet === "object" ? clone(sheet) : {};
        var config = manifest.config && typeof manifest.config === "object" ? clone(manifest.config) : {};

        ["rows", "endFields", "items", "products", "weeks"].forEach(function (key) {
            if (typeof manifest[key] !== "undefined" && typeof config[key] === "undefined") {
                config[key] = clone(manifest[key]);
                delete manifest[key];
            }
        });

        manifest.id = String(manifest.id || "");
        manifest.name = String(manifest.name || manifest.id || "未命名标签");
        manifest.type = String(manifest.type || "");
        manifest.description = String(manifest.description || "");
        manifest.config = config;
        return manifest;
    }

    function normalizeWorkbookManifest(manifest) {
        var workbook = manifest && typeof manifest === "object" ? clone(manifest) : {};

        workbook.id = String(workbook.id || "");
        workbook.fileName = String(workbook.fileName || (workbook.id ? workbook.id + ".xlsx" : "workbook.xlsx"));
        workbook.title = String(workbook.title || workbook.fileName);
        workbook.description = String(workbook.description || "");
        workbook.tags = Array.isArray(workbook.tags) ? workbook.tags.slice() : [];
        workbook.hidden = Boolean(workbook.hidden);
        workbook.sheets = Array.isArray(workbook.sheets)
            ? workbook.sheets.map(normalizeSheetManifest)
            : [];
        return workbook;
    }

    function registerWorkbook(manifest) {
        var workbook = normalizeWorkbookManifest(manifest);
        if (!workbook.id) {
            throw new Error("Workbook manifest 缺少 id。");
        }

        if (!registry.workbooks[workbook.id]) {
            registry.workbookOrder.push(workbook.id);
        }
        registry.workbooks[workbook.id] = workbook;
        return clone(workbook);
    }

    function registerSheetType(typeId, adapter) {
        var normalizedTypeId = String(typeId || "").trim();
        if (!normalizedTypeId) {
            throw new Error("Sheet adapter 缺少 typeId。");
        }
        if (!adapter || typeof adapter !== "object") {
            throw new Error("Sheet adapter 无效。");
        }
        registry.sheetAdapters[normalizedTypeId] = adapter;
        return adapter;
    }

    function getWorkbook(id) {
        var rawId = String(id || "").trim();
        var normalizedId = workbookAliases[rawId] || rawId;
        return registry.workbooks[normalizedId] ? clone(registry.workbooks[normalizedId]) : null;
    }

    function getAllWorkbooks(options) {
        var includeHidden = Boolean(options && options.includeHidden);
        return registry.workbookOrder
            .filter(function (id) {
                return includeHidden || !registry.workbooks[id].hidden;
            })
            .map(function (id) {
                return clone(registry.workbooks[id]);
            });
    }

    function getSheetAdapter(typeId) {
        return registry.sheetAdapters[String(typeId || "").trim()] || null;
    }

    function resolveWorkbookId(rawId, options) {
        var includeHidden = Boolean(options && options.includeHidden);
        var requestedId = String(rawId || "").trim();
        var normalizedId = workbookAliases[requestedId] || requestedId;

        if (normalizedId && registry.workbooks[normalizedId] && (includeHidden || !registry.workbooks[normalizedId].hidden)) {
            return normalizedId;
        }

        var visibleIds = registry.workbookOrder.filter(function (id) {
            return includeHidden || !registry.workbooks[id].hidden;
        });

        return visibleIds[0] || "";
    }

    function getWorkbookMode(workbook) {
        if (!workbook || !Array.isArray(workbook.sheets) || !workbook.sheets.length) {
            return "固定模板";
        }

        var labels = workbook.sheets.map(function (sheet) {
            var adapter = getSheetAdapter(sheet.type);
            return adapter && adapter.modeLabel ? adapter.modeLabel : "固定模板";
        }).filter(Boolean);

        if (!labels.length) {
            return "固定模板";
        }
        if (labels.every(function (label) { return label === labels[0]; })) {
            return labels[0];
        }
        return "混合模板";
    }

    var templateLibrary = {
        months: MONTHS,
        getWorkbook: getWorkbook
    };

    Object.defineProperty(templateLibrary, "workbooks", {
        enumerable: true,
        configurable: false,
        get: function () {
            return getAllWorkbooks().reduce(function (map, workbook) {
                map[workbook.id] = workbook;
                return map;
            }, {});
        }
    });

    window.DataDashboardTemplatePlatform = {
        months: MONTHS,
        registerWorkbook: registerWorkbook,
        registerSheetType: registerSheetType,
        getWorkbook: getWorkbook,
        getAllWorkbooks: getAllWorkbooks,
        getSheetAdapter: getSheetAdapter,
        getWorkbookMode: getWorkbookMode,
        resolveWorkbookId: resolveWorkbookId,
        workbookAliases: clone(workbookAliases)
    };

    window.TemplateLibrary = templateLibrary;
})();
