(function () {
    var platform = window.DataDashboardTemplatePlatform;
    var models = window.DataDashboardReportModels;

    function getConfig(context) {
        return models.getPriceSheetConfig(context.sheetState, context.sheet);
    }

    function priceCell(context, itemId, field, value) {
        return [
            "<td>",
            '<input class="compact-input" type="text" data-role="price-input" data-item-id="' + itemId + '" data-field="' + field + '" value="' + context.utils.escapeAttribute(value || "") + '">',
            "</td>"
        ].join("");
    }

    function buildPriceTable(context) {
        var config = getConfig(context);
        var headers = config.headerDefs;
        var extraColumns = config.extraColumns;
        var extraHeaderCells = extraColumns.map(function (column) {
            return '<th rowspan="2" class="sticky-top-1">' + context.ui.headerEditor(
                context.ui.headerInput("price-header-input", column.label, { field: "extra-column", "column-id": column.id }, "header-input--center"),
                context.ui.actionButton("删列", "remove-price-column", { "sheet-id": context.sheet.id, "column-id": column.id }, "tool-button-compact tool-button-danger")
            ) + "</th>";
        }).join("");

        return [
            '<table class="sticky-table price-table">',
            "<thead>",
            "<tr>",
            '<th rowspan="2" class="sticky-left sticky-corner col-1 sticky-top-1">' + context.ui.headerInput("price-header-input", headers.item, { field: "item" }, "header-input--left") + "</th>",
            '<th class="header-band sticky-top-1" colspan="4">' + context.ui.headerInput("price-header-input", headers.jingmeiGroup, { field: "jingmeiGroup" }, "header-input--center") + "</th>",
            '<th class="header-band sticky-top-1" colspan="4">' + context.ui.headerInput("price-header-input", headers.yaomeiGroup, { field: "yaomeiGroup" }, "header-input--center") + "</th>",
            '<th rowspan="2" class="sticky-top-1">' + context.ui.headerInput("price-header-input", headers.forecast, { field: "forecast" }, "header-input--center") + "</th>",
            '<th rowspan="2" class="sticky-top-1">' + context.ui.headerInput("price-header-input", headers.market, { field: "market" }, "header-input--center") + "</th>",
            '<th rowspan="2" class="sticky-top-1">' + context.ui.headerInput("price-header-input", headers.note, { field: "note" }, "header-input--center") + "</th>",
            extraHeaderCells,
            '<th rowspan="2" class="sticky-top-1 action-col">操作</th>',
            "</tr>",
            "<tr>",
            '<th class="sticky-top-2">' + context.ui.headerInput("price-header-input", headers.jingmeiCurrent, { field: "jingmeiCurrent" }, "header-input--center") + "</th>",
            '<th class="sticky-top-2">' + context.ui.headerInput("price-header-input", headers.jingmeiPrevious, { field: "jingmeiPrevious" }, "header-input--center") + "</th>",
            '<th class="sticky-top-2">' + context.ui.headerInput("price-header-input", headers.jingmeiDelta, { field: "jingmeiDelta" }, "header-input--center") + "</th>",
            '<th class="sticky-top-2">' + context.ui.headerInput("price-header-input", headers.jingmeiRate, { field: "jingmeiRate" }, "header-input--center") + "</th>",
            '<th class="sticky-top-2">' + context.ui.headerInput("price-header-input", headers.yaomeiCurrent, { field: "yaomeiCurrent" }, "header-input--center") + "</th>",
            '<th class="sticky-top-2">' + context.ui.headerInput("price-header-input", headers.yaomeiPrevious, { field: "yaomeiPrevious" }, "header-input--center") + "</th>",
            '<th class="sticky-top-2">' + context.ui.headerInput("price-header-input", headers.yaomeiDelta, { field: "yaomeiDelta" }, "header-input--center") + "</th>",
            '<th class="sticky-top-2">' + context.ui.headerInput("price-header-input", headers.yaomeiRate, { field: "yaomeiRate" }, "header-input--center") + "</th>",
            "</tr>",
            "</thead>",
            "<tbody>",
            config.itemDefs.map(function (item) {
                var state = models.getPriceItemState(context.sheetState, context.sheet, item);
                var metric = models.buildPriceMetric(state);
                var extraCells = extraColumns.map(function (column) {
                    return '<td><input class="compact-input" type="text" data-role="price-extra-input" data-item-id="' + context.utils.escapeAttribute(item.id) + '" data-column-id="' + context.utils.escapeAttribute(column.id) + '" value="' + context.utils.escapeAttribute(state.extraValues[column.id] || "") + '"></td>';
                }).join("");

                return [
                    "<tr>",
                    '<td class="label-cell sticky-left col-1">' + context.ui.rowTitleInput("price-item-label", item.name, { "item-id": item.id }, "row-title-input--sticky") + "</td>",
                    priceCell(context, item.id, "jingmeiCurrent", state.jingmeiCurrent),
                    priceCell(context, item.id, "jingmeiPrevious", state.jingmeiPrevious),
                    '<td class="computed-cell number-cell">' + context.utils.formatNumber(metric.jingmeiDelta) + "</td>",
                    '<td class="computed-cell">' + context.utils.formatPercent(metric.jingmeiRate) + "</td>",
                    priceCell(context, item.id, "yaomeiCurrent", state.yaomeiCurrent),
                    priceCell(context, item.id, "yaomeiPrevious", state.yaomeiPrevious),
                    '<td class="computed-cell number-cell">' + context.utils.formatNumber(metric.yaomeiDelta) + "</td>",
                    '<td class="computed-cell">' + context.utils.formatPercent(metric.yaomeiRate) + "</td>",
                    priceCell(context, item.id, "forecast", state.forecast),
                    priceCell(context, item.id, "market", state.market),
                    '<td><input class="row-note-input" type="text" data-role="price-note" data-item-id="' + context.utils.escapeAttribute(item.id) + '" value="' + context.utils.escapeAttribute(state.note || "") + '"></td>',
                    extraCells,
                    '<td class="action-cell">' + context.ui.actionButton("删行", "remove-price-row", { "sheet-id": context.sheet.id, "item-id": item.id }, "tool-button-compact tool-button-danger") + "</td>",
                    "</tr>"
                ].join("");
            }).join(""),
            "</tbody>",
            "</table>"
        ].join("");
    }

    function renderEditor(context) {
        context.mount.innerHTML = [
            '<div class="table-card">',
            '<div class="table-top table-top--compact">',
            '<div class="table-heading-inline"><span class="table-help">冻结标题支持改名，并可继续新增品种行和自定义列。</span></div>',
            '<div class="table-actions">',
            context.ui.actionButton("新增行", "add-price-row", { "sheet-id": context.sheet.id }),
            context.ui.actionButton("新增列", "add-price-column", { "sheet-id": context.sheet.id }),
            "</div>",
            "</div>",
            context.ui.buildScrollShell(context.sheet.id + "-price", [
                '<div class="table-wrap excel-viewport" data-scroll-key="' + context.sheet.id + '-price">',
                buildPriceTable(context),
                "</div>"
            ].join(""), "price-shell"),
            "</div>"
        ].join("");
    }

    function addPriceRow(context) {
        var config = getConfig(context);
        var item = {
            id: context.utils.createId("price-item"),
            name: "新增品种"
        };
        config.itemDefs.push(item);
        models.getPriceItemState(context.sheetState, context.sheet, item);
    }

    function removePriceRow(context, itemId) {
        var config = getConfig(context);
        config.itemDefs = config.itemDefs.filter(function (item) {
            return item.id !== itemId;
        });
        delete context.sheetState.items[itemId];
    }

    function addPriceColumn(context) {
        var config = getConfig(context);
        var column = {
            id: context.utils.createId("price-extra"),
            label: "自定义列" + (config.extraColumns.length + 1)
        };
        config.extraColumns.push(column);
        config.itemDefs.forEach(function (item) {
            models.getPriceItemState(context.sheetState, context.sheet, item).extraValues[column.id] = "";
        });
    }

    function removePriceColumn(context, columnId) {
        var config = getConfig(context);
        config.extraColumns = config.extraColumns.filter(function (column) {
            return column.id !== columnId;
        });
        Object.keys(context.sheetState.items || {}).forEach(function (itemId) {
            if (context.sheetState.items[itemId] && context.sheetState.items[itemId].extraValues) {
                delete context.sheetState.items[itemId].extraValues[columnId];
            }
        });
    }

    function updatePriceState(context, input) {
        var role = input.getAttribute("data-role");
        var config = getConfig(context);

        if (role === "price-header-input") {
            if (input.getAttribute("data-field") === "extra-column") {
                var column = models.findById(config.extraColumns, input.getAttribute("data-column-id"));
                if (column) {
                    column.label = input.value.trim();
                }
                return;
            }
            config.headerDefs[input.getAttribute("data-field")] = input.value.trim();
            return;
        }

        var itemId = input.getAttribute("data-item-id");
        var item = models.findById(config.itemDefs, itemId);
        if (!item) {
            return;
        }

        if (role === "price-item-label") {
            item.name = input.value.trim();
            return;
        }

        var itemState = models.getPriceItemState(context.sheetState, context.sheet, item);
        if (role === "price-note") {
            itemState.note = input.value;
            return;
        }
        if (role === "price-extra-input") {
            itemState.extraValues[input.getAttribute("data-column-id")] = input.value.trim();
            return;
        }

        itemState[input.getAttribute("data-field")] = input.value.trim();
    }

    function countFilledFields(context) {
        var count = 0;

        Object.values(context.sheetState.items || {}).forEach(function (itemState) {
            ["jingmeiCurrent", "jingmeiPrevious", "yaomeiCurrent", "yaomeiPrevious", "forecast", "market", "note"].forEach(function (key) {
                if (itemState && String(itemState[key] || "").trim()) {
                    count += 1;
                }
            });
            Object.values(itemState && itemState.extraValues ? itemState.extraValues : {}).forEach(function (value) {
                if (String(value || "").trim()) {
                    count += 1;
                }
            });
        });

        return count;
    }

    function buildLegend(items) {
        return items.map(function (item) {
            return '<span class="legend-item"><i class="legend-dot ' + item.className + '"></i>' + item.label + "</span>";
        }).join("");
    }

    function renderDashboardPanel(workbookContext) {
        var data = workbookContext.sheetSummaries[0];
        if (!data || !data.rows.length) {
            return [
                '<article class="chart-card">',
                '<div class="chart-card-head"><div><span class="eyebrow">Price Snapshot</span><h3>售价表对比</h3><p>读取本周价格字段，展示靖煤和窑煤的当前录入值。</p></div></div>',
                '<div class="chart-empty">当前还没有录入售价数据。</div>',
                "</article>"
            ].join("");
        }

        return [
            '<article class="chart-card">',
            '<div class="chart-card-head">',
            "<div><span class=\"eyebrow\">Price Snapshot</span><h3>售价表对比</h3><p>" + workbookContext.utils.escapeHtml(workbookContext.workbook.title) + " / 已录入 " + workbookContext.utils.formatNumber(workbookContext.filledCount) + " 项</p></div>",
            '<div class="chart-legend">' + buildLegend([
                { label: "靖煤公司", className: "legend-dot--jingmei" },
                { label: "窑煤公司", className: "legend-dot--yaomei" }
            ]) + "</div>",
            "</div>",
            '<div class="chart-kpis">',
            '<div class="chart-kpi"><span>靖煤均价</span><strong>' + workbookContext.utils.formatCompactNumber(data.jingmeiAvg) + "</strong></div>",
            '<div class="chart-kpi"><span>窑煤均价</span><strong>' + workbookContext.utils.formatCompactNumber(data.yaomeiAvg) + "</strong></div>",
            "</div>",
            '<div class="price-trend-list">',
            data.rows.map(function (row, index) {
                return [
                    '<div class="price-trend-row">',
                    '<div class="price-trend-title">' + workbookContext.utils.escapeHtml(row.label) + "</div>",
                    '<div class="price-trend-series">',
                    '<span class="price-series-label">靖煤</span>',
                    '<div class="price-trend-track"><i class="price-trend-fill price-trend-fill--jingmei" style="--ratio:' + ((row.jingmei || 0) / Math.max(data.maxValue, 1)).toFixed(4) + ";--delay:" + (index * 0.08).toFixed(2) + 's"></i></div>',
                    '<span class="price-series-value">' + workbookContext.utils.formatNumber(row.jingmei) + "</span>",
                    "</div>",
                    '<div class="price-trend-series">',
                    '<span class="price-series-label">窑煤</span>',
                    '<div class="price-trend-track"><i class="price-trend-fill price-trend-fill--yaomei" style="--ratio:' + ((row.yaomei || 0) / Math.max(data.maxValue, 1)).toFixed(4) + ";--delay:" + (index * 0.08 + 0.04).toFixed(2) + 's"></i></div>',
                    '<span class="price-series-value">' + workbookContext.utils.formatNumber(row.yaomei) + "</span>",
                    "</div>",
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
        var extraColumns = config.extraColumns;

        return [
            '<section class="preview-sheet' + (context.sheet.id === context.requestedSheetId ? " is-active-sheet" : "") + '">',
            '<div class="preview-sheet-head">',
            '<div><span class="preview-sheet-kicker">Price Comparison</span><h2>' + context.utils.escapeHtml(context.sheet.name) + "</h2><p>" + context.utils.escapeHtml(context.sheet.description || "") + "</p></div>",
            '<div class="preview-sheet-meta"><span class="preview-chip">品种数 / ' + config.itemDefs.length + "</span></div>",
            "</div>",
            '<div class="preview-table-wrap">',
            '<table class="preview-report-table preview-report-table--price">',
            "<thead>",
            "<tr>",
            "<th rowspan=\"2\">" + context.utils.escapeHtml(headers.item) + "</th>",
            '<th colspan="4">' + context.utils.escapeHtml(headers.jingmeiGroup) + "</th>",
            '<th colspan="4">' + context.utils.escapeHtml(headers.yaomeiGroup) + "</th>",
            "<th rowspan=\"2\">" + context.utils.escapeHtml(headers.forecast) + "</th>",
            "<th rowspan=\"2\">" + context.utils.escapeHtml(headers.market) + "</th>",
            "<th rowspan=\"2\">" + context.utils.escapeHtml(headers.note) + "</th>",
            extraColumns.map(function (column) {
                return "<th rowspan=\"2\">" + context.utils.escapeHtml(column.label) + "</th>";
            }).join(""),
            "</tr>",
            "<tr>",
            "<th>" + context.utils.escapeHtml(headers.jingmeiCurrent) + "</th>",
            "<th>" + context.utils.escapeHtml(headers.jingmeiPrevious) + "</th>",
            "<th>" + context.utils.escapeHtml(headers.jingmeiDelta) + "</th>",
            "<th>" + context.utils.escapeHtml(headers.jingmeiRate) + "</th>",
            "<th>" + context.utils.escapeHtml(headers.yaomeiCurrent) + "</th>",
            "<th>" + context.utils.escapeHtml(headers.yaomeiPrevious) + "</th>",
            "<th>" + context.utils.escapeHtml(headers.yaomeiDelta) + "</th>",
            "<th>" + context.utils.escapeHtml(headers.yaomeiRate) + "</th>",
            "</tr>",
            "</thead>",
            "<tbody>",
            config.itemDefs.map(function (item) {
                var itemState = models.getPriceItemState(context.sheetState, context.sheet, item);
                var metric = models.buildPriceMetric(itemState);
                return [
                    "<tr>",
                    "<td>" + displayText(context, item.name) + "</td>",
                    "<td>" + displayMaybeNumber(context, itemState.jingmeiCurrent) + "</td>",
                    "<td>" + displayMaybeNumber(context, itemState.jingmeiPrevious) + "</td>",
                    "<td>" + context.utils.formatNumber(metric.jingmeiDelta) + "</td>",
                    "<td>" + context.utils.formatPercent(metric.jingmeiRate) + "</td>",
                    "<td>" + displayMaybeNumber(context, itemState.yaomeiCurrent) + "</td>",
                    "<td>" + displayMaybeNumber(context, itemState.yaomeiPrevious) + "</td>",
                    "<td>" + context.utils.formatNumber(metric.yaomeiDelta) + "</td>",
                    "<td>" + context.utils.formatPercent(metric.yaomeiRate) + "</td>",
                    "<td>" + displayMaybeNumber(context, itemState.forecast) + "</td>",
                    "<td>" + displayText(context, itemState.market) + "</td>",
                    "<td>" + displayText(context, itemState.note) + "</td>",
                    extraColumns.map(function (column) {
                        return "<td>" + displayText(context, itemState.extraValues[column.id]) + "</td>";
                    }).join(""),
                    "</tr>"
                ].join("");
            }).join(""),
            "</tbody>",
            "</table>",
            "</div>",
            "</section>"
        ].join("");
    }

    platform.registerSheetType("price-comparison", {
        modeLabel: "周价格对比",

        normalizeState: function (sheetManifest, rawSheetState) {
            var sheetState = rawSheetState && typeof rawSheetState === "object" ? rawSheetState : { items: {} };
            return getConfig({
                sheet: sheetManifest,
                sheetState: sheetState
            });
        },

        renderEditor: renderEditor,

        handleAction: function (context, actionName, actionNode) {
            if (actionName === "add-price-row") {
                addPriceRow(context);
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            if (actionName === "remove-price-row") {
                removePriceRow(context, actionNode.getAttribute("data-item-id"));
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            if (actionName === "add-price-column") {
                addPriceColumn(context);
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            if (actionName === "remove-price-column") {
                removePriceColumn(context, actionNode.getAttribute("data-column-id"));
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            return false;
        },

        handleChange: function (context, target) {
            var role = target.getAttribute("data-role");
            if (!role || role.indexOf("price-") !== 0) {
                return false;
            }

            updatePriceState(context, target);
            context.rerenderPreservingScroll();
            context.queueSave();
            return true;
        },

        countFilledFields: countFilledFields,

        getEntryMeta: function () {
            return {
                modeLabel: "周价格对比"
            };
        },

        getDashboardSummary: function (context) {
            return models.buildPriceChartData(context.sheetState, context.sheet);
        },

        getDashboardPanels: function (workbookContext) {
            return [{
                html: renderDashboardPanel(workbookContext)
            }];
        },

        renderPreview: renderPreview
    });
})();
