(function () {
    var platform = window.DataDashboardTemplatePlatform;
    var models = window.DataDashboardReportModels;

    function getConfig(context) {
        return models.getWeeklySheetConfig(context.sheetState, context.sheet);
    }

    function salesInput(context, productId, weekId, company, dayIndex, value) {
        return [
            "<td>",
            '<input class="compact-input" type="text" data-role="sales-input" data-product-id="' + productId + '" data-week-id="' + weekId + '" data-company="' + company + '" data-day-index="' + dayIndex + '" value="' + context.utils.escapeAttribute(value || "") + '">',
            "</td>"
        ].join("");
    }

    function buildWeekTotalCells(context, totals) {
        var cells = [];
        totals.yaomeiDaily.forEach(function (value) {
            cells.push('<td class="computed-cell number-cell">' + context.utils.formatNumber(value) + "</td>");
        });
        cells.push('<td class="computed-cell number-cell">' + context.utils.formatNumber(totals.yaomeiGrand) + "</td>");
        totals.jingmeiDaily.forEach(function (value) {
            cells.push('<td class="computed-cell number-cell">' + context.utils.formatNumber(value) + "</td>");
        });
        cells.push('<td class="computed-cell number-cell">' + context.utils.formatNumber(totals.jingmeiGrand) + "</td>");
        return cells.join("");
    }

    function buildWeekRow(context, week, product, rowTotal) {
        var rowState = models.getSalesRowState(context.sheetState, context.sheet, week.id, product.id);
        var yaomeiInputs = rowState.yaomei.map(function (value, index) {
            return salesInput(context, product.id, week.id, "yaomei", index, value);
        }).join("");
        var jingmeiInputs = rowState.jingmei.map(function (value, index) {
            return salesInput(context, product.id, week.id, "jingmei", index, value);
        }).join("");

        return [
            "<tr>",
            '<td class="label-cell sticky-left col-1">' + context.ui.rowTitleInput("sales-product-label", product.name, { "product-id": product.id }, "row-title-input--sticky") + "</td>",
            yaomeiInputs,
            '<td class="computed-cell number-cell">' + context.utils.formatNumber(rowTotal ? rowTotal.yaomeiSubtotal : null) + "</td>",
            jingmeiInputs,
            '<td class="computed-cell number-cell">' + context.utils.formatNumber(rowTotal ? rowTotal.jingmeiSubtotal : null) + "</td>",
            '<td class="action-cell">' + context.ui.actionButton("删行", "remove-sales-row", { "sheet-id": context.sheet.id, "product-id": product.id }, "tool-button-compact tool-button-danger") + "</td>",
            "</tr>"
        ].join("");
    }

    function buildWeekCard(context, week) {
        var config = getConfig(context);
        var headers = config.headerDefs;
        var totals = models.computeWeekTotals(context.sheetState, context.sheet, week.id);

        return [
            '<section class="week-card">',
            '<div class="table-top table-top--compact">',
            '<div class="table-heading-inline">' + context.ui.rowTitleInput("sales-week-label", week.label, { "week-id": week.id }, "section-title-input section-title-input--compact") + '<span class="table-help">按原表结构录入并自动汇总周小计与周合计。</span></div>',
            '<div class="table-actions">',
            context.ui.actionButton("原因分析", "toggle-sales-analysis", { "sheet-id": context.sheet.id }),
            context.ui.actionButton("新增行", "add-sales-row", { "sheet-id": context.sheet.id, "week-id": week.id }),
            context.ui.actionButton("新增列", "add-sales-column", { "sheet-id": context.sheet.id, "week-id": week.id }),
            "</div>",
            "</div>",
            context.ui.buildScrollShell(context.sheet.id + "-" + week.id, [
                '<div class="week-grid excel-viewport" data-scroll-key="' + context.sheet.id + '-' + week.id + '">',
                '<table class="sticky-table weekly-table">',
                "<thead>",
                "<tr>",
                '<th rowspan="2" class="sticky-left sticky-corner col-1 sticky-top-1">' + context.ui.headerInput("sales-header-input", headers.row, { field: "row" }, "header-input--left") + "</th>",
                '<th class="header-band sticky-top-1" colspan="' + (week.days.length + 1) + '">' + context.ui.headerInput("sales-header-input", headers.yaomeiGroup, { field: "yaomeiGroup" }, "header-input--center") + "</th>",
                '<th class="header-band sticky-top-1" colspan="' + (week.days.length + 1) + '">' + context.ui.headerInput("sales-header-input", headers.jingmeiGroup, { field: "jingmeiGroup" }, "header-input--center") + "</th>",
                '<th rowspan="2" class="sticky-top-1 action-col">操作</th>',
                "</tr>",
                "<tr>",
                week.days.map(function (day, index) {
                    return '<th class="sticky-top-2">' + context.ui.headerEditor(
                        context.ui.headerInput("sales-day-label", day, { "week-id": week.id, "day-index": index }, "header-input--center"),
                        week.days.length > 1 ? context.ui.actionButton("删列", "remove-sales-column", { "sheet-id": context.sheet.id, "week-id": week.id, "day-index": index }, "tool-button-compact tool-button-danger") : ""
                    ) + "</th>";
                }).join(""),
                '<th class="sticky-top-2">' + context.ui.headerInput("sales-header-input", headers.yaomeiSubtotal, { field: "yaomeiSubtotal" }, "header-input--center") + "</th>",
                week.days.map(function (day) {
                    return '<th class="sticky-top-2">' + context.utils.escapeHtml(day) + "</th>";
                }).join(""),
                '<th class="sticky-top-2">' + context.ui.headerInput("sales-header-input", headers.jingmeiSubtotal, { field: "jingmeiSubtotal" }, "header-input--center") + "</th>",
                "</tr>",
                "</thead>",
                "<tbody>",
                config.productDefs.map(function (product) {
                    return buildWeekRow(context, week, product, totals.rows[product.id]);
                }).join(""),
                '<tr class="week-total"><td class="sticky-left col-1"><strong>周合计</strong></td>' + buildWeekTotalCells(context, totals) + '<td class="action-cell">—</td></tr>',
                "</tbody>",
                "</table>",
                "</div>"
            ].join(""), "weekly-shell"),
            "</section>"
        ].join("");
    }

    function renderEditor(context) {
        var config = getConfig(context);
        context.mount.innerHTML = [
            '<div class="sales-grid">',
            config.weekDefs.map(function (week) {
                return buildWeekCard(context, week);
            }).join(""),
            "</div>",
            '<div class="analysis-overlay' + (context.isSalesAnalysisOpen ? " is-open" : "") + '">',
            '<button class="analysis-overlay-backdrop" type="button" data-action="close-sales-analysis" aria-label="关闭原因分析"></button>',
            '<aside class="note-card analysis-panel">',
            '<div class="analysis-panel-head">',
            '<div><h3>原因分析</h3><p class="sheet-meta">对应原表中的“原因分析”区域，可用于补充销量变化说明。</p></div>',
            context.ui.actionButton("关闭", "close-sales-analysis", {}, "tool-button-danger"),
            "</div>",
            '<textarea data-role="sales-analysis">' + context.utils.escapeHtml(context.sheetState.analysis || "") + "</textarea>",
            "</aside>",
            "</div>"
        ].join("");
    }

    function addSalesRow(context) {
        var config = getConfig(context);
        var product = {
            id: context.utils.createId("sales-product"),
            name: "新增类别"
        };
        config.productDefs.push(product);
        config.weekDefs.forEach(function (week) {
            models.getSalesRowState(context.sheetState, context.sheet, week.id, product.id);
        });
    }

    function removeSalesRow(context, productId) {
        var config = getConfig(context);
        config.productDefs = config.productDefs.filter(function (product) {
            return product.id !== productId;
        });
        Object.keys(context.sheetState.weeks || {}).forEach(function (weekId) {
            if (context.sheetState.weeks[weekId]) {
                delete context.sheetState.weeks[weekId][productId];
            }
        });
    }

    function addSalesColumn(context, weekId) {
        var config = getConfig(context);
        var week = models.findById(config.weekDefs, weekId);
        if (!week) {
            return;
        }
        week.days.push("日期" + (week.days.length + 1));
        config.productDefs.forEach(function (product) {
            var rowState = models.getSalesRowState(context.sheetState, context.sheet, week.id, product.id);
            rowState.yaomei.push("");
            rowState.jingmei.push("");
        });
    }

    function removeSalesColumn(context, weekId, dayIndex) {
        var config = getConfig(context);
        var week = models.findById(config.weekDefs, weekId);
        if (!week || week.days.length <= 1) {
            return;
        }
        week.days.splice(dayIndex, 1);
        config.productDefs.forEach(function (product) {
            var rowState = models.getSalesRowState(context.sheetState, context.sheet, week.id, product.id);
            rowState.yaomei.splice(dayIndex, 1);
            rowState.jingmei.splice(dayIndex, 1);
        });
    }

    function updateSalesState(context, input) {
        var role = input.getAttribute("data-role");
        var config = getConfig(context);

        if (role === "sales-product-label") {
            var product = models.findById(config.productDefs, input.getAttribute("data-product-id"));
            if (product) {
                product.name = input.value.trim();
            }
            return;
        }

        if (role === "sales-header-input") {
            config.headerDefs[input.getAttribute("data-field")] = input.value.trim();
            return;
        }

        if (role === "sales-day-label") {
            var weekDef = models.findById(config.weekDefs, input.getAttribute("data-week-id"));
            if (weekDef) {
                weekDef.days[Number(input.getAttribute("data-day-index"))] = input.value.trim();
            }
            return;
        }

        if (role === "sales-week-label") {
            var week = models.findById(config.weekDefs, input.getAttribute("data-week-id"));
            if (week) {
                week.label = input.value.trim();
            }
            return;
        }

        var weekId = input.getAttribute("data-week-id");
        var productId = input.getAttribute("data-product-id");
        var company = input.getAttribute("data-company");
        var dayIndex = Number(input.getAttribute("data-day-index"));
        var rowState = models.getSalesRowState(context.sheetState, context.sheet, weekId, productId);
        rowState[company][dayIndex] = input.value.trim();
    }

    function countFilledFields(context) {
        var count = 0;

        Object.values(context.sheetState.weeks || {}).forEach(function (weekState) {
            Object.values(weekState || {}).forEach(function (rowState) {
                ["yaomei", "jingmei"].forEach(function (key) {
                    (rowState && Array.isArray(rowState[key]) ? rowState[key] : []).forEach(function (value) {
                        if (String(value || "").trim()) {
                            count += 1;
                        }
                    });
                });
            });
        });
        if (String(context.sheetState.analysis || "").trim()) {
            count += 1;
        }

        return count;
    }

    function buildLegend(items) {
        return items.map(function (item) {
            return '<span class="legend-item"><i class="legend-dot ' + item.className + '"></i>' + item.label + "</span>";
        }).join("");
    }

    function renderDashboardPanel(workbookContext) {
        var data = workbookContext.sheetSummaries[0];
        var hasAnyData = data && data.days.some(function (_, index) {
            return data.yaomeiDaily[index] > 0 || data.jingmeiDaily[index] > 0;
        });

        if (!hasAnyData) {
            return [
                '<article class="chart-card">',
                '<div class="chart-card-head"><div><span class="eyebrow">Sales Flow</span><h3>销售按日分布</h3><p>读取周销售表，按日期汇总窑煤和靖煤销量。</p></div></div>',
                '<div class="chart-empty">当前还没有录入销售数据。</div>',
                "</article>"
            ].join("");
        }

        return [
            '<article class="chart-card">',
            '<div class="chart-card-head">',
            "<div><span class=\"eyebrow\">Sales Flow</span><h3>销售按日分布</h3><p>" + workbookContext.utils.escapeHtml(data.label) + " / 已录入 " + workbookContext.utils.formatNumber(workbookContext.filledCount) + " 项</p></div>",
            '<div class="chart-legend">' + buildLegend([
                { label: "窑煤公司", className: "legend-dot--yaomei" },
                { label: "靖煤公司", className: "legend-dot--sales" }
            ]) + "</div>",
            "</div>",
            '<div class="chart-kpis">',
            '<div class="chart-kpi"><span>窑煤周合计</span><strong>' + workbookContext.utils.formatCompactNumber(data.yaomeiTotal) + "</strong></div>",
            '<div class="chart-kpi"><span>靖煤周合计</span><strong>' + workbookContext.utils.formatCompactNumber(data.jingmeiTotal) + "</strong></div>",
            "</div>",
            '<div class="sales-bars">',
            data.days.map(function (day, index) {
                return [
                    '<div class="sales-day">',
                    '<div class="sales-bar-group">',
                    '<i class="sales-bar sales-bar--yaomei" style="height:' + Math.max((data.yaomeiDaily[index] / Math.max(data.peak, 1)) * 100, data.yaomeiDaily[index] > 0 ? 8 : 2) + "%;--delay:" + (index * 0.05).toFixed(2) + 's"></i>',
                    '<i class="sales-bar sales-bar--sales" style="height:' + Math.max((data.jingmeiDaily[index] / Math.max(data.peak, 1)) * 100, data.jingmeiDaily[index] > 0 ? 8 : 2) + "%;--delay:" + (index * 0.05 + 0.04).toFixed(2) + 's"></i>',
                    "</div>",
                    "<strong>" + workbookContext.utils.escapeHtml(day) + "</strong>",
                    "<span>" + workbookContext.utils.formatCompactNumber((data.yaomeiDaily[index] || 0) + (data.jingmeiDaily[index] || 0)) + "</span>",
                    "</div>"
                ].join("");
            }).join(""),
            "</div>",
            "</article>"
        ].join("");
    }

    function displayText(context, value) {
        return value === null || typeof value === "undefined" || String(value).trim() === "" ? "—" : context.utils.escapeHtml(String(value));
    }

    function displayMaybeNumber(context, value) {
        var number = context.utils.parseNumber(value);
        return number === null ? displayText(context, value) : context.utils.formatNumber(number);
    }

    function renderPreview(context) {
        var config = getConfig(context);
        var headers = config.headerDefs;

        return [
            '<section class="preview-sheet' + (context.sheet.id === context.requestedSheetId ? " is-active-sheet" : "") + '">',
            '<div class="preview-sheet-head">',
            '<div><span class="preview-sheet-kicker">Weekly Sales</span><h2>' + context.utils.escapeHtml(context.sheet.name) + "</h2><p>" + context.utils.escapeHtml(context.sheet.description || "") + "</p></div>",
            '<div class="preview-sheet-meta"><span class="preview-chip">周模板 / ' + config.weekDefs.length + "</span></div>",
            "</div>",
            config.weekDefs.map(function (week) {
                var totals = models.computeWeekTotals(context.sheetState, context.sheet, week.id);
                return [
                    '<section class="preview-week-block">',
                    '<div class="preview-week-head"><strong>' + context.utils.escapeHtml(week.label) + "</strong></div>",
                    '<div class="preview-table-wrap">',
                    '<table class="preview-report-table preview-report-table--sales">',
                    "<thead>",
                    "<tr>",
                    "<th rowspan=\"2\">" + context.utils.escapeHtml(headers.row) + "</th>",
                    '<th colspan="' + (week.days.length + 1) + '">' + context.utils.escapeHtml(headers.yaomeiGroup) + "</th>",
                    '<th colspan="' + (week.days.length + 1) + '">' + context.utils.escapeHtml(headers.jingmeiGroup) + "</th>",
                    "</tr>",
                    "<tr>",
                    week.days.map(function (day) {
                        return "<th>" + context.utils.escapeHtml(day) + "</th>";
                    }).join(""),
                    "<th>" + context.utils.escapeHtml(headers.yaomeiSubtotal) + "</th>",
                    week.days.map(function (day) {
                        return "<th>" + context.utils.escapeHtml(day) + "</th>";
                    }).join(""),
                    "<th>" + context.utils.escapeHtml(headers.jingmeiSubtotal) + "</th>",
                    "</tr>",
                    "</thead>",
                    "<tbody>",
                    config.productDefs.map(function (product) {
                        var rowState = models.getSalesRowState(context.sheetState, context.sheet, week.id, product.id);
                        var rowTotal = totals.rows[product.id];
                        return [
                            "<tr>",
                            "<td>" + displayText(context, product.name) + "</td>",
                            rowState.yaomei.map(function (value) {
                                return "<td>" + displayMaybeNumber(context, value) + "</td>";
                            }).join(""),
                            "<td>" + context.utils.formatNumber(rowTotal ? rowTotal.yaomeiSubtotal : null) + "</td>",
                            rowState.jingmei.map(function (value) {
                                return "<td>" + displayMaybeNumber(context, value) + "</td>";
                            }).join(""),
                            "<td>" + context.utils.formatNumber(rowTotal ? rowTotal.jingmeiSubtotal : null) + "</td>",
                            "</tr>"
                        ].join("");
                    }).join(""),
                    '<tr class="preview-total-row"><td>周合计</td>',
                    totals.yaomeiDaily.map(function (value) {
                        return "<td>" + context.utils.formatNumber(value) + "</td>";
                    }).join(""),
                    "<td>" + context.utils.formatNumber(totals.yaomeiGrand) + "</td>",
                    totals.jingmeiDaily.map(function (value) {
                        return "<td>" + context.utils.formatNumber(value) + "</td>";
                    }).join(""),
                    "<td>" + context.utils.formatNumber(totals.jingmeiGrand) + "</td></tr>",
                    "</tbody>",
                    "</table>",
                    "</div>",
                    context.sheetState.analysis ? '<div class="preview-note"><strong>原因分析</strong><p>' + context.utils.escapeHtml(context.sheetState.analysis).replace(/\n/g, "<br>") + "</p></div>" : "",
                    "</section>"
                ].join("");
            }).join(""),
            "</section>"
        ].join("");
    }

    platform.registerSheetType("weekly-sales", {
        modeLabel: "周销售表",

        normalizeState: function (sheetManifest, rawSheetState) {
            var sheetState = rawSheetState && typeof rawSheetState === "object" ? rawSheetState : { weeks: {}, analysis: "" };
            return getConfig({
                sheet: sheetManifest,
                sheetState: sheetState
            });
        },

        renderEditor: renderEditor,

        handleAction: function (context, actionName, actionNode) {
            if (actionName === "add-sales-row") {
                addSalesRow(context);
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            if (actionName === "toggle-sales-analysis") {
                context.setSalesAnalysisOpen(!context.isSalesAnalysisOpen);
                context.rerenderPreservingScroll();
                return true;
            }

            if (actionName === "close-sales-analysis") {
                context.setSalesAnalysisOpen(false);
                context.rerenderPreservingScroll();
                return true;
            }

            if (actionName === "remove-sales-row") {
                removeSalesRow(context, actionNode.getAttribute("data-product-id"));
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            if (actionName === "add-sales-column") {
                addSalesColumn(context, actionNode.getAttribute("data-week-id"));
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            if (actionName === "remove-sales-column") {
                removeSalesColumn(context, actionNode.getAttribute("data-week-id"), Number(actionNode.getAttribute("data-day-index")));
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            return false;
        },

        handleInput: function (context, target) {
            if (target.getAttribute("data-role") !== "sales-analysis") {
                return false;
            }
            context.sheetState.analysis = target.value;
            context.queueSave();
            return true;
        },

        handleChange: function (context, target) {
            var role = target.getAttribute("data-role");
            if (!role || role.indexOf("sales-") !== 0) {
                return false;
            }
            updateSalesState(context, target);
            context.rerenderPreservingScroll();
            context.queueSave();
            return true;
        },

        countFilledFields: countFilledFields,

        getEntryMeta: function () {
            return {
                modeLabel: "周销售表"
            };
        },

        getDashboardSummary: function (context) {
            return models.buildSalesChartData(context.sheetState, context.sheet);
        },

        getDashboardPanels: function (workbookContext) {
            return [{
                html: renderDashboardPanel(workbookContext)
            }];
        },

        renderPreview: renderPreview
    });
})();
