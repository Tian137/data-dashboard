(function () {
    var root = document.getElementById("previewRoot");
    var utils = window.DataDashboardUtils;
    var storage = window.DataDashboardStorage;
    var platform = window.DataDashboardTemplatePlatform;
    var models = window.DataDashboardReportModels;
    var authState = window.DataDashboardAuth.getAuth() || {
        role: "data_entry",
        allowedWorkbookIds: []
    };
    var params = new URLSearchParams(window.location.search);
    var workbookId = platform.resolveWorkbookId(params.get("book"), { includeHidden: true });
    if (authState.role !== "super_admin" && Array.isArray(authState.allowedWorkbookIds) && authState.allowedWorkbookIds.indexOf(workbookId) === -1) {
        workbookId = authState.allowedWorkbookIds[0] || "";
    }
    var requestedSheetId = String(params.get("sheet") || "").trim();
    var workbook = workbookId ? platform.getWorkbook(workbookId) : null;
    var store = workbook ? storage.loadWorkbookStore(workbook.id) : null;

    if (!root) {
        return;
    }

    if (!workbook || !store) {
        renderMissing();
        return;
    }

    document.title = workbook.title + " - 报表预览";
    renderPreview();
    bindEvents();

    function ensureSheetState(sheet) {
        var adapter = platform.getSheetAdapter(sheet.type);
        var rawSheetState = store.sheets[sheet.id];

        if (!rawSheetState || typeof rawSheetState !== "object") {
            rawSheetState = {};
        }
        if (adapter && typeof adapter.normalizeState === "function") {
            rawSheetState = adapter.normalizeState(sheet, rawSheetState) || rawSheetState;
        }
        store.sheets[sheet.id] = rawSheetState;
        return rawSheetState;
    }

    function renderMissing() {
        root.innerHTML = [
            '<main class="preview-shell">',
            '<section class="preview-empty">',
            "<h1>没有找到可预览的工作簿</h1>",
            "<p>请返回模板编辑页重新选择。</p>",
            '<a class="preview-link" href="./dashboard.html">返回工作台</a>',
            "</section>",
            "</main>"
        ].join("");
    }

    function bindEvents() {
        var printButton = document.getElementById("previewPrintButton");
        if (printButton) {
            printButton.addEventListener("click", function () {
                window.print();
            });
        }
    }

    function formatSavedAt(value) {
        if (!value) {
            return "未保存";
        }
        return new Date(value).toLocaleString("zh-CN", {
            hour12: false,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function getOrderedSheets() {
        if (!requestedSheetId) {
            return workbook.sheets.slice();
        }
        return workbook.sheets.slice().sort(function (a, b) {
            if (a.id === requestedSheetId) {
                return -1;
            }
            if (b.id === requestedSheetId) {
                return 1;
            }
            return 0;
        });
    }

    function buildSummary() {
        return [
            '<section class="preview-summary preview-summary--compact">',
            '<div class="preview-summary-main">',
            '<span class="preview-kicker">Report Preview / ' + utils.escapeHtml(platform.getWorkbookMode(workbook)) + "</span>",
            "<h1>" + utils.escapeHtml(workbook.title) + "</h1>",
            '<p class="preview-summary-subline">' + utils.escapeHtml(workbook.fileName) + " / " + utils.escapeHtml(workbook.description || "按服务端最新数据生成只读报表预览，可直接打印或导出 PDF。") + "</p>",
            "</div>",
            '<div class="preview-summary-meta">',
            '<div class="preview-meta-card preview-meta-card--compact"><span>工作表数</span><strong>' + workbook.sheets.length + "</strong></div>",
            '<div class="preview-meta-card preview-meta-card--compact"><span>最近保存</span><strong>' + utils.escapeHtml(formatSavedAt(store.savedAt)) + "</strong></div>",
            "</div>",
            "</section>"
        ].join("");
    }

    function createPreviewContext(sheet) {
        return {
            workbook: workbook,
            sheet: sheet,
            store: store,
            sheetState: ensureSheetState(sheet),
            requestedSheetId: requestedSheetId,
            utils: utils,
            storage: storage,
            platform: platform,
            models: models
        };
    }

    function renderPreview() {
        root.innerHTML = [
            '<main class="preview-shell">',
            '<header class="preview-topbar">',
            '<a class="preview-link" href="./template.html?book=' + encodeURIComponent(workbook.id) + (requestedSheetId ? "&sheet=" + encodeURIComponent(requestedSheetId) : "") + '">← 返回编辑页</a>',
            '<div class="preview-topbar-actions">',
            '<button class="preview-print" id="previewPrintButton" type="button">打印 / 导出 PDF</button>',
            "</div>",
            "</header>",
            buildSummary(),
            '<div class="preview-sheet-stack">',
            getOrderedSheets().map(function (sheet) {
                var adapter = platform.getSheetAdapter(sheet.type);
                if (!adapter || typeof adapter.renderPreview !== "function") {
                    return "";
                }
                return adapter.renderPreview(createPreviewContext(sheet));
            }).join(""),
            "</div>",
            "</main>"
        ].join("");
    }
})();
