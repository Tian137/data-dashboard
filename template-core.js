(function () {
    var utils = window.DataDashboardUtils;
    var storage = window.DataDashboardStorage;
    var platform = window.DataDashboardTemplatePlatform;
    var models = window.DataDashboardReportModels;
    var authState = window.DataDashboardAuth.getAuth() || {
        role: "data_entry",
        permissions: {
            canEditStructure: false
        },
        allowedWorkbookIds: []
    };

    var state = {
        root: document.getElementById("pageRoot"),
        workbook: null,
        workbookId: "",
        currentSheetId: "",
        saveTimer: 0,
        statusTimer: 0,
        isSalesAnalysisOpen: false,
        actionStatus: {
            type: "info",
            message: ""
        },
        store: null,
        booted: false
    };

    function resolveWorkbookId() {
        var params = new URLSearchParams(window.location.search);
        var allowedIds = authState.role === "super_admin"
            ? null
            : (Array.isArray(authState.allowedWorkbookIds) ? authState.allowedWorkbookIds : []);
        var requestedId = platform.resolveWorkbookId(params.get("book"), { includeHidden: false });

        if (authState.role === "super_admin") {
            return requestedId;
        }
        if (allowedIds.indexOf(requestedId) !== -1) {
            return requestedId;
        }
        return allowedIds[0] || "";
    }

    function findSheet(id) {
        return state.workbook.sheets.find(function (sheet) {
            return sheet.id === id;
        });
    }

    function getCurrentSheet() {
        return findSheet(state.currentSheetId);
    }

    function getAdapter(sheet) {
        return sheet ? platform.getSheetAdapter(sheet.type) : null;
    }

    function ensureSheetState(sheet) {
        var adapter = getAdapter(sheet);
        var rawSheetState = state.store.sheets[sheet.id];

        if (!rawSheetState || typeof rawSheetState !== "object") {
            rawSheetState = {};
        }
        if (adapter && typeof adapter.normalizeState === "function") {
            rawSheetState = adapter.normalizeState(sheet, rawSheetState) || rawSheetState;
        }
        state.store.sheets[sheet.id] = rawSheetState;
        return rawSheetState;
    }

    function updateSheetQuery() {
        var url = new URL(window.location.href);
        url.searchParams.set("book", state.workbook.id);
        url.searchParams.set("sheet", state.currentSheetId);
        window.history.replaceState({}, "", url.toString());
    }

    function buildDataAttributes(attrs) {
        return Object.keys(attrs || {}).map(function (key) {
            return " data-" + key + '="' + utils.escapeAttribute(attrs[key]) + '"';
        }).join("");
    }

    function actionButton(label, action, attrs, extraClass) {
        var classes = "tool-button";
        var data = attrs || {};

        if (extraClass) {
            classes += " " + extraClass;
        }
        data.action = action;
        return '<button class="' + classes + '" type="button"' + buildDataAttributes(data) + ">" + label + "</button>";
    }

    function headerInput(role, value, attrs, extraClass) {
        var classes = "header-input";
        var data = attrs || {};

        if (extraClass) {
            classes += " " + extraClass;
        }
        data.role = role;
        return '<input class="' + classes + '" type="text"' + buildDataAttributes(data) + ' value="' + utils.escapeAttribute(value || "") + '">';
    }

    function rowTitleInput(role, value, attrs, extraClass) {
        var classes = "row-title-input";
        var data = attrs || {};

        if (extraClass) {
            classes += " " + extraClass;
        }
        data.role = role;
        return '<input class="' + classes + '" type="text"' + buildDataAttributes(data) + ' value="' + utils.escapeAttribute(value || "") + '">';
    }

    function headerEditor(content, actions) {
        return [
            '<div class="header-editor">',
            content,
            actions ? '<div class="header-editor-actions">' + actions + "</div>" : "",
            "</div>"
        ].join("");
    }

    function buildScrollShell(key, innerHtml, extraClass) {
        return [
            '<div class="scroll-shell' + (extraClass ? " " + extraClass : "") + '">',
            innerHtml,
            '<div class="scrollbar-dock" data-scrollbar-for="' + key + '"><div class="scrollbar-ghost"></div></div>',
            "</div>"
        ].join("");
    }

    function captureSheetScrollState() {
        var mount = document.getElementById("sheetMount");
        if (!mount) {
            return null;
        }

        var scrollState = {
            mountTop: mount.scrollTop,
            mountLeft: mount.scrollLeft,
            areas: {}
        };

        mount.querySelectorAll("[data-scroll-key]").forEach(function (node) {
            scrollState.areas[node.getAttribute("data-scroll-key")] = {
                top: node.scrollTop,
                left: node.scrollLeft
            };
        });

        return scrollState;
    }

    function restoreSheetScrollState(scrollState) {
        var mount = document.getElementById("sheetMount");
        if (!mount || !scrollState) {
            return;
        }

        mount.scrollTop = scrollState.mountTop || 0;
        mount.scrollLeft = scrollState.mountLeft || 0;

        mount.querySelectorAll("[data-scroll-key]").forEach(function (node) {
            var key = node.getAttribute("data-scroll-key");
            var saved = scrollState.areas[key];
            if (!saved) {
                return;
            }
            node.scrollTop = saved.top || 0;
            node.scrollLeft = saved.left || 0;
        });
    }

    function initializeScrollDocks() {
        state.root.querySelectorAll(".sticky-table thead").forEach(function (thead) {
            var rows = Array.prototype.slice.call(thead.querySelectorAll("tr"));
            var offset = 0;

            rows.forEach(function (row) {
                Array.prototype.slice.call(row.children).forEach(function (cell) {
                    cell.style.top = offset + "px";
                });
                offset += row.getBoundingClientRect().height;
            });
        });

        state.root.querySelectorAll(".scroll-shell").forEach(function (shell) {
            var viewport = shell.querySelector("[data-scroll-key]");
            var dock = shell.querySelector("[data-scrollbar-for]");
            var ghost = shell.querySelector(".scrollbar-ghost");
            var syncing = false;

            if (!viewport || !dock || !ghost) {
                return;
            }

            ghost.style.width = Math.max(viewport.scrollWidth, viewport.clientWidth) + "px";
            dock.scrollLeft = viewport.scrollLeft;

            function syncState() {
                shell.classList.toggle("is-scrolled-left", viewport.scrollLeft > 2);
                shell.classList.toggle("is-scrolled-right", viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 2);
            }

            viewport.addEventListener("scroll", function () {
                if (syncing) {
                    return;
                }
                syncing = true;
                dock.scrollLeft = viewport.scrollLeft;
                syncing = false;
                syncState();
            });

            dock.addEventListener("scroll", function () {
                if (syncing) {
                    return;
                }
                syncing = true;
                viewport.scrollLeft = dock.scrollLeft;
                syncing = false;
                syncState();
            });

            syncState();
        });
    }

    function updateSaveStatus() {
        var status = document.getElementById("saveStatus");
        if (!status) {
            return;
        }

        if (!state.store.savedAt) {
            status.textContent = "自动保存：未写入";
            return;
        }

        status.textContent = "自动保存：" + new Date(state.store.savedAt).toLocaleString("zh-CN", {
            hour12: false
        });
    }

    function updateActionStatus() {
        var node = document.getElementById("sheetActionStatus");
        if (!node) {
            return;
        }

        if (!state.actionStatus.message) {
            node.hidden = true;
            node.textContent = "";
            node.className = "action-status";
            return;
        }

        node.hidden = false;
        node.textContent = state.actionStatus.message;
        node.className = "action-status action-status--" + (state.actionStatus.type || "info");
    }

    function setActionStatus(message, type, timeoutMs) {
        window.clearTimeout(state.statusTimer);
        state.actionStatus = {
            type: type || "info",
            message: message || ""
        };
        updateActionStatus();

        if (message && timeoutMs) {
            state.statusTimer = window.setTimeout(function () {
                setActionStatus("", "info", 0);
            }, timeoutMs);
        }
    }

    function queueSave() {
        window.clearTimeout(state.saveTimer);
        state.saveTimer = window.setTimeout(function () {
            state.store.savedAt = new Date().toISOString();
            try {
                state.store = storage.saveWorkbookStore(state.workbook.id, state.store);
                updateSaveStatus();
            } catch (error) {
                setActionStatus(error.message || "保存失败，请检查浏览器本地存储。", "error", 3600);
            }
        }, 120);
    }

    function createEditorContext(sheet, mount) {
        return {
            root: state.root,
            workbook: state.workbook,
            sheet: sheet,
            mount: mount,
            store: state.store,
            sheetState: ensureSheetState(sheet),
            utils: utils,
            storage: storage,
            platform: platform,
            models: models,
            auth: authState,
            permissions: authState.permissions || {},
            isSalesAnalysisOpen: state.isSalesAnalysisOpen,
            setSalesAnalysisOpen: function (nextValue) {
                state.isSalesAnalysisOpen = Boolean(nextValue);
            },
            queueSave: queueSave,
            rerender: renderCurrentSheet,
            rerenderPreservingScroll: rerenderSheetPreservingScroll,
            setActionStatus: setActionStatus,
            getSheetState: ensureSheetState,
            findSheet: findSheet,
            ui: {
                actionButton: actionButton,
                buildDataAttributes: buildDataAttributes,
                buildScrollShell: buildScrollShell,
                headerEditor: headerEditor,
                headerInput: headerInput,
                rowTitleInput: rowTitleInput
            }
        };
    }

    function renderMissing() {
        state.root.innerHTML = [
            '<div class="empty-card">',
            '<span class="eyebrow">Not Found</span>',
            "<h2>没有找到对应的模板入口</h2>",
            "<p>请回到工作台重新选择，或者检查 URL 中的 `book` 参数是否正确。</p>",
            '<a class="primary-link" href="./dashboard.html">返回工作台</a>',
            "</div>"
        ].join("");
    }

    function renderFrame() {
        var currentSheet = getCurrentSheet() || state.workbook.sheets[0];

        state.root.innerHTML = [
            '<div class="template-layout template-layout--minimal">',
            '<div class="template-fixed-head template-fixed-head--minimal">',
            '<div class="page-head page-head--minimal">',
            '<a class="back-link" href="./dashboard.html">← 返回工作台</a>',
            '<div class="template-head-main">',
            '<strong class="template-head-title">' + utils.escapeHtml(state.workbook.title) + '</strong>',
            '<span class="template-head-subtitle">' + utils.escapeHtml(state.workbook.fileName) + " / " + utils.escapeHtml(platform.getWorkbookMode(state.workbook)) + " / " + utils.escapeHtml(currentSheet.name) + "</span>",
            "</div>",
            '<div class="template-head-side">',
            '<span class="action-status" id="sheetActionStatus" hidden></span>',
            '<button class="tool-button" type="button" data-action="preview">报表预览</button>',
            '<span class="save-pill" id="saveStatus"></span>',
            "</div>",
            "</div>",
            '<div class="sheet-toolbar sheet-toolbar--minimal">',
            '<div class="sheet-toolbar-row sheet-toolbar-row--minimal">',
            '<div class="sheet-tabs sheet-tabs--compact">',
            state.workbook.sheets.map(function (sheet) {
                var activeClass = sheet.id === state.currentSheetId ? " active" : "";
                return '<button class="sheet-tab' + activeClass + '" type="button" data-sheet="' + sheet.id + '">' + sheet.name + "</button>";
            }).join(""),
            "</div>",
            "</div>",
            "</div>",
            '<section class="sheet-panel template-sheet-panel">',
            '<div class="sheet-body"><div id="sheetMount"></div></div>',
            "</section>",
            "</div>"
        ].join("");

        updateSaveStatus();
        updateActionStatus();
        updateSheetQuery();
    }

    function renderCurrentSheet() {
        var sheet = getCurrentSheet();
        var mount = document.getElementById("sheetMount");
        var adapter = getAdapter(sheet);

        if (!adapter || typeof adapter.renderEditor !== "function") {
            mount.innerHTML = '<div class="empty-card"><h2>当前模板类型暂未接入渲染器</h2></div>';
            return;
        }

        mount.className = "sheet-content-sheet";
        adapter.renderEditor(createEditorContext(sheet, mount));
        initializeScrollDocks();
        updateSaveStatus();
        updateActionStatus();
    }

    function rerenderSheetPreservingScroll() {
        var scrollState = captureSheetScrollState();
        renderCurrentSheet();
        restoreSheetScrollState(scrollState);
    }

    function handleClick(event) {
        var tab = event.target.closest("[data-sheet]");
        if (tab) {
            state.currentSheetId = tab.getAttribute("data-sheet");
            renderFrame();
            renderCurrentSheet();
            return;
        }

        var action = event.target.closest("[data-action]");
        if (!action) {
            return;
        }

        var actionName = action.getAttribute("data-action");
        if (actionName === "preview") {
            window.location.href = "./preview.html?book=" + encodeURIComponent(state.workbook.id) + "&sheet=" + encodeURIComponent(state.currentSheetId);
            return;
        }

        if (!(authState.permissions && authState.permissions.canEditStructure) && /^add-|^remove-/.test(actionName)) {
            return;
        }

        var sheet = getCurrentSheet();
        var adapter = getAdapter(sheet);
        if (adapter && typeof adapter.handleAction === "function" && adapter.handleAction(createEditorContext(sheet, document.getElementById("sheetMount")), actionName, action)) {
            return;
        }
    }

    function handleInput(event) {
        var target = event.target;
        var sheet = getCurrentSheet();
        var adapter = getAdapter(sheet);

        if (adapter && typeof adapter.handleInput === "function") {
            adapter.handleInput(createEditorContext(sheet, document.getElementById("sheetMount")), target);
        }
    }

    function handleChange(event) {
        var target = event.target;
        var sheet = getCurrentSheet();
        var adapter = getAdapter(sheet);
        var role = target && target.getAttribute ? target.getAttribute("data-role") : "";

        if (!(authState.permissions && authState.permissions.canEditStructure) && /^(matrix-row-label|matrix-row-header|matrix-period-label|matrix-metric-label|matrix-end-label|price-item-label|price-header-input|sales-product-label|sales-header-input|sales-day-label|sales-week-label)$/.test(role)) {
            return;
        }

        if (adapter && typeof adapter.handleChange === "function") {
            adapter.handleChange(createEditorContext(sheet, document.getElementById("sheetMount")), target);
        }
    }

    window.DataDashboardTemplateApp = {
        state: state,
        boot: function () {
            if (state.booted || !state.root) {
                return;
            }

            state.workbookId = resolveWorkbookId();
        state.workbook = state.workbookId ? platform.getWorkbook(state.workbookId) : null;
        if (!state.workbook) {
            renderMissing();
            state.booted = true;
            return;
        }

        document.body.classList.toggle("is-structure-readonly", !(authState.permissions && authState.permissions.canEditStructure));

            var params = new URLSearchParams(window.location.search);
            state.currentSheetId = params.get("sheet");
            state.store = storage.loadWorkbookStore(state.workbook.id);

            if (!state.currentSheetId || !findSheet(state.currentSheetId)) {
                state.currentSheetId = state.workbook.sheets[0].id;
            }

            state.root.addEventListener("click", handleClick);
            state.root.addEventListener("change", handleChange);
            state.root.addEventListener("input", handleInput);
            window.addEventListener("resize", initializeScrollDocks);

            renderFrame();
            renderCurrentSheet();
            state.booted = true;
        }
    };
})();
