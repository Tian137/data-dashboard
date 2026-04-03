(function () {
    var authState = window.__dashboardAuth || window.DataDashboardAuth.getAuth() || { username: "操作员" };
    var platform = window.DataDashboardTemplatePlatform;
    var storage = window.DataDashboardStorage;
    var rootQuickLinks = document.getElementById("homeQuickLinks");
    var overviewStrip = document.getElementById("overviewStrip");
    var chartGrid = document.getElementById("homeChartGrid");
    var refreshButton = document.getElementById("refreshDashboardButton");
    var exportAllButton = document.getElementById("exportAllButton");
    var actionStatus = document.getElementById("dashboardActionStatus");
    var adminLink = document.getElementById("adminLink");
    var workbooks = platform.getAllWorkbooks().filter(function (workbook) {
        return authState.role === "super_admin" || (Array.isArray(authState.allowedWorkbookIds) && authState.allowedWorkbookIds.indexOf(workbook.id) !== -1);
    });
    var totalSheets = workbooks.reduce(function (sum, workbook) {
        return sum + workbook.sheets.length;
    }, 0);
    var dashboardSignature = "";
    var actionTimer = 0;

    if (!rootQuickLinks || !overviewStrip || !chartGrid) {
        return;
    }

    document.getElementById("homeAuthUser").textContent = "已登录 / " + authState.username + " / " + authState.role;
    document.getElementById("templateCount").textContent = workbooks.length;
    document.getElementById("sheetCount").textContent = totalSheets;
    if (adminLink) {
        adminLink.hidden = authState.role !== "super_admin";
    }
    if (exportAllButton) {
        exportAllButton.hidden = !(authState.permissions && authState.permissions.exportAllBackups);
    }
    document.getElementById("logoutButton").addEventListener("click", function () {
        window.DataDashboardAuth.logout("./index.html");
    });

    function formatSavedAt(value) {
        if (!value) {
            return "未写入";
        }
        return new Date(value).toLocaleString("zh-CN", {
            hour12: false,
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function getSavedTimestamp(value) {
        var timestamp = Date.parse(value && value.savedAt ? value.savedAt : "");
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function setActionStatus(message, type, timeoutMs) {
        window.clearTimeout(actionTimer);
        if (!message) {
            actionStatus.hidden = true;
            actionStatus.textContent = "";
            actionStatus.className = "action-status";
            return;
        }
        actionStatus.hidden = false;
        actionStatus.textContent = message;
        actionStatus.className = "action-status action-status--" + (type || "info");
        if (timeoutMs) {
            actionTimer = window.setTimeout(function () {
                setActionStatus("", "info", 0);
            }, timeoutMs);
        }
    }

    function getQuickLinkClass(workbookId) {
        if (workbookId === "1") {
            return " quick-link-item--price";
        }
        if (workbookId === "2") {
            return " quick-link-item--monthly";
        }
        if (workbookId === "4") {
            return " quick-link-item--sales";
        }
        return " quick-link-item--default";
    }

    function getPrimaryAdapter(workbook) {
        var types = workbook.sheets.map(function (sheet) {
            return sheet.type;
        }).filter(Boolean);
        var uniqueTypes = Array.from(new Set(types));
        return uniqueTypes.length === 1 ? platform.getSheetAdapter(uniqueTypes[0]) : null;
    }

    function createSheetContext(workbook, store, sheet) {
        var adapter = platform.getSheetAdapter(sheet.type);
        var rawSheetState = store.sheets[sheet.id];

        if (!rawSheetState || typeof rawSheetState !== "object") {
            rawSheetState = {};
        }
        if (adapter && typeof adapter.normalizeState === "function") {
            rawSheetState = adapter.normalizeState(sheet, rawSheetState) || rawSheetState;
        }
        store.sheets[sheet.id] = rawSheetState;

        return {
            workbook: workbook,
            sheet: sheet,
            store: store,
            sheetState: rawSheetState,
            utils: window.DataDashboardUtils,
            storage: storage,
            platform: platform,
            models: window.DataDashboardReportModels
        };
    }

    function createWorkbookState(workbook) {
        var store = storage.loadWorkbookStore(workbook.id);
        var primaryAdapter = getPrimaryAdapter(workbook);
        var sheetContexts = workbook.sheets.map(function (sheet) {
            return createSheetContext(workbook, store, sheet);
        });
        var filledCount = sheetContexts.reduce(function (sum, context) {
            var adapter = platform.getSheetAdapter(context.sheet.type);
            return sum + (adapter && typeof adapter.countFilledFields === "function" ? adapter.countFilledFields(context) : 0);
        }, 0);
        var sheetSummaries = sheetContexts.map(function (context) {
            var adapter = platform.getSheetAdapter(context.sheet.type);
            return adapter && typeof adapter.getDashboardSummary === "function" ? adapter.getDashboardSummary(context) : null;
        }).filter(Boolean);
        var workbookContext = {
            workbook: workbook,
            store: store,
            savedAt: store.savedAt || "",
            filledCount: filledCount,
            sheetContexts: sheetContexts,
            sheetSummaries: sheetSummaries,
            utils: window.DataDashboardUtils,
            storage: storage,
            platform: platform,
            models: window.DataDashboardReportModels
        };
        var entryMeta = primaryAdapter && typeof primaryAdapter.getEntryMeta === "function"
            ? primaryAdapter.getEntryMeta(workbookContext) || {}
            : {};
        var panels = primaryAdapter && typeof primaryAdapter.getDashboardPanels === "function"
            ? primaryAdapter.getDashboardPanels(workbookContext) || []
            : [];

        return {
            workbook: workbook,
            store: store,
            savedAt: store.savedAt || "",
            filledCount: filledCount,
            entryMeta: entryMeta,
            panels: panels
        };
    }

    function collectDashboardData() {
        var workbookStates = workbooks.map(createWorkbookState);
        var latestSavedAt = workbookStates.reduce(function (latest, item) {
            return getSavedTimestamp({ savedAt: item.savedAt }) > getSavedTimestamp({ savedAt: latest }) ? item.savedAt : latest;
        }, "");

        return {
            workbookStates: workbookStates,
            totalFilledCount: workbookStates.reduce(function (sum, item) { return sum + item.filledCount; }, 0),
            updatedWorkbookCount: workbookStates.filter(function (item) { return item.savedAt; }).length,
            latestSavedAt: latestSavedAt
        };
    }

    function renderOverview(dashboard) {
        document.getElementById("filledFieldCount").textContent = window.DataDashboardUtils.formatNumber(dashboard.totalFilledCount);
        document.getElementById("updatedWorkbookCount").textContent = dashboard.updatedWorkbookCount + " 个";
        document.getElementById("dashboardUpdateStatus").textContent = dashboard.latestSavedAt
            ? "图表已基于本地录入数据刷新，最近更新于 " + formatSavedAt(dashboard.latestSavedAt) + "。"
            : "当前浏览器还没有录入数据，进入模板页录入后，这里会自动显示最新图表。";

        var maxFilledCount = Math.max.apply(Math, [1].concat(dashboard.workbookStates.map(function (item) {
            return item.filledCount;
        })));

        overviewStrip.innerHTML = dashboard.workbookStates.map(function (item, index) {
            var ratio = item.filledCount / maxFilledCount;
            return [
                '<article class="overview-card">',
                '<span class="overview-index">' + String(index + 1).padStart(2, "0") + "</span>",
                '<div class="overview-copy">',
                "<strong>" + window.DataDashboardUtils.escapeHtml(item.workbook.title) + "</strong>",
                "<p>" + window.DataDashboardUtils.escapeHtml(item.entryMeta.modeLabel || platform.getWorkbookMode(item.workbook)) + " / " + item.workbook.sheets.length + " 张表</p>",
                "</div>",
                '<div class="overview-meter">',
                '<div class="overview-meter-track"><i class="overview-meter-fill" style="--ratio:' + ratio.toFixed(4) + '"></i></div>',
                "<span>" + window.DataDashboardUtils.formatNumber(item.filledCount) + " 项</span>",
                "</div>",
                "</article>"
            ].join("");
        }).join("");
    }

    function renderQuickLinks(dashboard) {
        rootQuickLinks.innerHTML = dashboard.workbookStates.map(function (item, index) {
            return [
                '<a class="quick-link-item' + getQuickLinkClass(item.workbook.id) + '" href="./template.html?book=' + encodeURIComponent(item.workbook.id) + '">',
                '<div class="quick-link-topline">',
                '<span class="quick-link-index">' + String(index + 1).padStart(2, "0") + "</span>",
                '<div class="quick-link-copy">',
                "<strong>" + window.DataDashboardUtils.escapeHtml(item.workbook.title) + "</strong>",
                '<span>' + window.DataDashboardUtils.escapeHtml(item.workbook.fileName) + "</span>",
                "</div>",
                "</div>",
                '<span class="quick-link-enter">进入模板</span>',
                "</a>"
            ].join("");
        }).join("");
    }

    function renderGenericPanel(item) {
        return [
            '<article class="chart-card">',
            '<div class="chart-card-head">',
            "<div><span class=\"eyebrow\">Workbook</span><h3>" + window.DataDashboardUtils.escapeHtml(item.workbook.title) + "</h3><p>已录入 " + window.DataDashboardUtils.formatNumber(item.filledCount) + " 项 / 最近保存 " + window.DataDashboardUtils.escapeHtml(formatSavedAt(item.savedAt)) + "</p></div>",
            "</div>",
            '<div class="chart-empty">当前模板暂未配置专属图表，但已接入工作台入口和统计。</div>',
            "</article>"
        ].join("");
    }

    function renderCharts(dashboard) {
        chartGrid.innerHTML = dashboard.workbookStates.map(function (item) {
            return item.panels.length ? item.panels.map(function (panel) { return panel.html; }).join("") : renderGenericPanel(item);
        }).join("");
    }

    function renderDashboard(force) {
        var dashboard = collectDashboardData();
        var signature = dashboard.workbookStates.map(function (item) {
            return item.workbook.id + ":" + item.savedAt + ":" + item.filledCount;
        }).join("|");

        if (!force && signature === dashboardSignature) {
            return;
        }

        dashboardSignature = signature;
        renderOverview(dashboard);
        renderQuickLinks(dashboard);
        renderCharts(dashboard);
    }

    function renderClock() {
        var now = new Date();
        document.getElementById("homeNowDate").textContent = now.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            weekday: "long"
        });
        document.getElementById("homeNowTime").textContent = now.toLocaleTimeString("zh-CN", {
            hour12: false
        });
    }

    function buildBackupFileName() {
        var now = new Date();
        var stamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
            "-",
            String(now.getHours()).padStart(2, "0"),
            String(now.getMinutes()).padStart(2, "0"),
            String(now.getSeconds()).padStart(2, "0")
        ].join("");
        return "data-dashboard_全量快照_" + stamp + ".json";
    }

    refreshButton.addEventListener("click", function () {
        renderDashboard(true);
        setActionStatus("已手动刷新当前工作台。", "success", 2200);
    });

    exportAllButton.addEventListener("click", function () {
        var payload = storage.exportAllWorkbookStores(workbooks.map(function (workbook) {
            return workbook.id;
        }));
        window.DataDashboardUtils.downloadJson(buildBackupFileName(), payload);
        setActionStatus("已导出全部工作簿快照。", "success", 2800);
    });

    renderDashboard(true);
    renderClock();
    window.setInterval(renderClock, 1000);
    window.addEventListener("storage", function (event) {
        if (!event.key || event.key.indexOf(storage.STORAGE_PREFIX + ":") === 0) {
            renderDashboard(true);
        }
    });
    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) {
            renderDashboard(true);
        }
    });
})();
