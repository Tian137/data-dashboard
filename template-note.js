(function () {
    var platform = window.DataDashboardTemplatePlatform;
    var utils = window.DataDashboardUtils;

    function getConfig(context) {
        var rawState = context.sheetState && typeof context.sheetState === "object" ? context.sheetState : {};
        var config = context.sheet && context.sheet.config && typeof context.sheet.config === "object" ? context.sheet.config : {};

        if (!Array.isArray(rawState.columnDefs)) {
            rawState.columnDefs = (config.columns || []).map(function (column) {
                return {
                    key: column.key || utils.createId("note-col"),
                    label: column.label || "列"
                };
            });
        }
        rawState.columnDefs = rawState.columnDefs.map(function (column, index) {
            return {
                key: column.key || utils.createId("note-col"),
                label: column.label || ("列" + (index + 1))
            };
        });

        if (!Array.isArray(rawState.rowDefs)) {
            rawState.rowDefs = (config.rows || []).map(function (row) {
                return {
                    id: row.id || utils.createId("note-row"),
                    cells: row.cells && typeof row.cells === "object" ? JSON.parse(JSON.stringify(row.cells)) : {}
                };
            });
        }
        rawState.rowDefs = rawState.rowDefs.map(function (row) {
            return {
                id: row.id || utils.createId("note-row"),
                cells: row.cells && typeof row.cells === "object" ? row.cells : {}
            };
        });

        rawState.rowDefs.forEach(function (row) {
            rawState.columnDefs.forEach(function (column) {
                if (typeof row.cells[column.key] === "undefined") {
                    row.cells[column.key] = "";
                }
            });
        });

        return rawState;
    }

    function renderEditor(context) {
        var config = getConfig(context);

        context.mount.innerHTML = [
            '<div class="table-card">',
            '<div class="table-top table-top--compact">',
            '<div class="table-heading-inline"><span class="table-help">演示新表型：只需新增适配器和 manifest，即可接入编辑、预览和工作台。</span></div>',
            '<div class="table-actions">',
            context.ui.actionButton("新增记录", "add-note-row", { "sheet-id": context.sheet.id }),
            "</div>",
            "</div>",
            context.ui.buildScrollShell(context.sheet.id + "-note", [
                '<div class="table-wrap excel-viewport" data-scroll-key="' + context.sheet.id + '-note">',
                '<table class="sticky-table price-table">',
                "<thead>",
                "<tr>",
                config.columnDefs.map(function (column) {
                    return '<th class="sticky-top-1">' + context.ui.headerInput("note-column-label", column.label, { "column-key": column.key }, "header-input--center") + "</th>";
                }).join(""),
                '<th class="sticky-top-1 action-col">操作</th>',
                "</tr>",
                "</thead>",
                "<tbody>",
                config.rowDefs.map(function (row) {
                    return [
                        "<tr>",
                        config.columnDefs.map(function (column) {
                            return '<td><input class="compact-input" type="text" data-role="note-cell-input" data-row-id="' + row.id + '" data-column-key="' + column.key + '" value="' + context.utils.escapeAttribute(row.cells[column.key] || "") + '"></td>';
                        }).join(""),
                        '<td class="action-cell">' + context.ui.actionButton("删行", "remove-note-row", { "row-id": row.id }, "tool-button-compact tool-button-danger") + "</td>",
                        "</tr>"
                    ].join("");
                }).join(""),
                "</tbody>",
                "</table>",
                "</div>"
            ].join(""), "price-shell"),
            "</div>"
        ].join("");
    }

    function renderPreview(context) {
        var config = getConfig(context);

        return [
            '<section class="preview-sheet' + (context.sheet.id === context.requestedSheetId ? " is-active-sheet" : "") + '">',
            '<div class="preview-sheet-head">',
            '<div><span class="preview-sheet-kicker">Simple Note</span><h2>' + context.utils.escapeHtml(context.sheet.name) + "</h2><p>" + context.utils.escapeHtml(context.sheet.description || "") + "</p></div>",
            '<div class="preview-sheet-meta"><span class="preview-chip">记录数 / ' + config.rowDefs.length + "</span></div>",
            "</div>",
            '<div class="preview-table-wrap">',
            '<table class="preview-report-table preview-report-table--price">',
            "<thead><tr>",
            config.columnDefs.map(function (column) {
                return "<th>" + context.utils.escapeHtml(column.label) + "</th>";
            }).join(""),
            "</tr></thead>",
            "<tbody>",
            config.rowDefs.map(function (row) {
                return "<tr>" + config.columnDefs.map(function (column) {
                    var value = row.cells[column.key];
                    return "<td>" + (String(value || "").trim() ? context.utils.escapeHtml(String(value)) : "—") + "</td>";
                }).join("") + "</tr>";
            }).join(""),
            "</tbody>",
            "</table>",
            "</div>",
            "</section>"
        ].join("");
    }

    function countFilledFields(context) {
        var count = 0;
        getConfig(context).rowDefs.forEach(function (row) {
            Object.values(row.cells || {}).forEach(function (value) {
                if (String(value || "").trim()) {
                    count += 1;
                }
            });
        });
        return count;
    }

    function renderDashboardPanel(workbookContext) {
        return [
            '<article class="chart-card">',
            '<div class="chart-card-head">',
            "<div><span class=\"eyebrow\">Workbook</span><h3>" + workbookContext.utils.escapeHtml(workbookContext.workbook.title) + "</h3><p>演示新增新表型后，工作台无需再写硬编码分支。</p></div>",
            "</div>",
            '<div class="chart-kpis">',
            '<div class="chart-kpi"><span>记录数</span><strong>' + workbookContext.utils.formatNumber(workbookContext.sheetSummaries[0].rowCount) + "</strong></div>",
            '<div class="chart-kpi"><span>已写字段</span><strong>' + workbookContext.utils.formatNumber(workbookContext.filledCount) + "</strong></div>",
            "</div>",
            "</article>"
        ].join("");
    }

    platform.registerSheetType("simple-note", {
        modeLabel: "简易记录",

        normalizeState: function (sheetManifest, rawSheetState) {
            return getConfig({
                sheet: sheetManifest,
                sheetState: rawSheetState && typeof rawSheetState === "object" ? rawSheetState : {}
            });
        },

        renderEditor: renderEditor,

        handleAction: function (context, actionName, actionNode) {
            var config = getConfig(context);
            if (actionName === "add-note-row") {
                config.rowDefs.push({
                    id: context.utils.createId("note-row"),
                    cells: config.columnDefs.reduce(function (map, column) {
                        map[column.key] = "";
                        return map;
                    }, {})
                });
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            if (actionName === "remove-note-row") {
                config.rowDefs = config.rowDefs.filter(function (row) {
                    return row.id !== actionNode.getAttribute("data-row-id");
                });
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            return false;
        },

        handleChange: function (context, target) {
            var config = getConfig(context);
            var role = target.getAttribute("data-role");

            if (role === "note-column-label") {
                var column = config.columnDefs.find(function (item) {
                    return item.key === target.getAttribute("data-column-key");
                });
                if (column) {
                    column.label = target.value.trim();
                }
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            if (role === "note-cell-input") {
                var row = config.rowDefs.find(function (item) {
                    return item.id === target.getAttribute("data-row-id");
                });
                if (row) {
                    row.cells[target.getAttribute("data-column-key")] = target.value.trim();
                }
                context.queueSave();
                return true;
            }

            return false;
        },

        countFilledFields: countFilledFields,

        getEntryMeta: function () {
            return {
                modeLabel: "简易记录"
            };
        },

        getDashboardSummary: function (context) {
            var config = getConfig(context);
            return {
                rowCount: config.rowDefs.length
            };
        },

        getDashboardPanels: function (workbookContext) {
            return [{
                html: renderDashboardPanel(workbookContext)
            }];
        },

        renderPreview: renderPreview
    });
})();
