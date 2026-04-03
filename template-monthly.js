(function () {
    var platform = window.DataDashboardTemplatePlatform;
    var models = window.DataDashboardReportModels;

    function getConfig(context) {
        return models.getMonthlySheetConfig(context.sheetState, context.sheet);
    }

    function getMatrixYearOptions(context, config) {
        var years = {};
        var defaultYear = context.utils.getDefaultYear();
        var rowStates = context.sheetState.rows || {};

        years[defaultYear] = true;
        if (config.activeYear) {
            years[config.activeYear] = true;
        }

        Object.keys(rowStates).forEach(function (rowId) {
            var rowState = rowStates[rowId];
            if (rowState && rowState.years && typeof rowState.years === "object") {
                Object.keys(rowState.years).forEach(function (year) {
                    years[context.utils.normalizeYear(year, defaultYear)] = true;
                });
            }
        });

        return Object.keys(years).sort(function (a, b) {
            return Number(b) - Number(a);
        });
    }

    function getRate(current, previous) {
        if (current === null || previous === null || previous === 0) {
            return null;
        }
        return ((current - previous) / previous) * 100;
    }

    function inputCell(context, role, rowId, field, monthKey, value, cellClass) {
        return [
            '<td' + (cellClass ? ' class="' + cellClass + '"' : "") + '>',
            '<input class="matrix-input" type="text" data-role="' + role + '" data-row-id="' + rowId + '" data-field="' + field + '" data-month="' + monthKey + '" value="' + context.utils.escapeAttribute(value || "") + '">',
            "</td>"
        ].join("");
    }

    function buildMonthlyMatrixRow(context, row, periods, activePeriodId) {
        var state = models.getMonthlyRowState(context.sheetState, context.sheet, row);
        var computed = models.computeMonthlyMetrics(state, periods);
        var stickyClasses = ["col-1", "col-2", "col-3", "col-4"];
        var endFields = models.getConfigValue(context.sheet, "endFields", []);
        var cells = row.labels.map(function (label, index) {
            return '<td class="label-cell sticky-left ' + stickyClasses[index] + '">' + context.ui.rowTitleInput("matrix-row-label", label, {
                "row-id": row.id,
                "label-index": index
            }, "row-title-input--sticky") + "</td>";
        }).join("");

        var monthCells = periods.map(function (period) {
            var rowState = state.months[period.id];
            var metric = computed[period.id];
            var periodClass = period.id === activePeriodId ? " period-cell-focus" : "";
            return [
                inputCell(context, "matrix-input", row.id, "actual", period.id, rowState.actual, periodClass.trim()),
                inputCell(context, "matrix-input", row.id, "previous", period.id, rowState.previous, periodClass.trim()),
                '<td class="computed-cell' + periodClass + '">' + context.utils.formatPercent(metric.monthRate) + "</td>",
                '<td class="computed-cell number-cell' + periodClass + '">' + context.utils.formatNumber(metric.cumulativeActual) + "</td>",
                '<td class="computed-cell number-cell' + periodClass + '">' + context.utils.formatNumber(metric.cumulativePrevious) + "</td>",
                '<td class="computed-cell' + periodClass + '">' + context.utils.formatPercent(metric.cumulativeRate) + "</td>"
            ].join("");
        }).join("");

        var endCells = endFields.map(function (field) {
            if (field.editable) {
                return inputCell(context, "matrix-end", row.id, field.key, "", state[field.key] || "");
            }
            return '<td class="computed-cell number-cell">' + context.utils.formatNumber(computed.planGap) + "</td>";
        }).join("");

        return [
            "<tr>",
            cells,
            inputCell(context, "matrix-plan", row.id, "annualPlan", "", state.annualPlan || "", "sticky-left col-5"),
            monthCells,
            endCells,
            '<td class="action-cell">' + context.ui.actionButton("删行", "remove-matrix-row", { "sheet-id": context.sheet.id, "row-id": row.id }, "tool-button-compact tool-button-danger") + "</td>",
            "</tr>"
        ].join("");
    }

    function buildMonthlyMatrixTable(context) {
        var config = getConfig(context);
        var periods = config.periodDefs;
        var endFields = models.getConfigValue(context.sheet, "endFields", []);
        var rowHeaders = config.headerDefs.rowHeaders;

        var headerTop = periods.map(function (period) {
            var activeClass = period.id === config.activePeriodId ? " is-active-period" : "";
            return '<th class="header-band sticky-top-1' + activeClass + '" colspan="6" data-period-anchor="' + context.utils.escapeAttribute(period.id) + '">' + context.ui.headerEditor(
                context.ui.headerInput("matrix-period-label", period.label, { "period-id": period.id }, "header-input--center"),
                periods.length > 1 ? context.ui.actionButton("删列", "remove-matrix-column", { "sheet-id": context.sheet.id, "period-id": period.id }, "tool-button-compact tool-button-danger") : ""
            ) + "</th>";
        }).join("");

        var headerMid = periods.map(function (_, index) {
            var activeClass = periods[index].id === config.activePeriodId ? " is-active-period" : "";
            var currentLabel = index === 0
                ? context.ui.headerInput("matrix-metric-label", config.headerDefs.currentGroup, { "field-key": "currentGroup" }, "header-input--center")
                : context.utils.escapeHtml(config.headerDefs.currentGroup);
            var cumulativeLabel = index === 0
                ? context.ui.headerInput("matrix-metric-label", config.headerDefs.cumulativeGroup, { "field-key": "cumulativeGroup" }, "header-input--center")
                : context.utils.escapeHtml(config.headerDefs.cumulativeGroup);
            return '<th class="subhead sticky-top-2' + activeClass + '" colspan="3">' + currentLabel + '</th><th class="subhead sticky-top-2' + activeClass + '" colspan="3">' + cumulativeLabel + "</th>";
        }).join("");

        var headerBottom = periods.map(function (_, index) {
            var activeClass = periods[index].id === config.activePeriodId ? " is-active-period" : "";
            if (index === 0) {
                return [
                    '<th class="sticky-top-3' + activeClass + '" data-period-start="' + context.utils.escapeAttribute(periods[index].id) + '">' + context.ui.headerInput("matrix-metric-label", config.headerDefs.monthActual, { "field-key": "monthActual" }, "header-input--center") + "</th>",
                    '<th class="sticky-top-3' + activeClass + '">' + context.ui.headerInput("matrix-metric-label", config.headerDefs.monthPrevious, { "field-key": "monthPrevious" }, "header-input--center") + "</th>",
                    '<th class="sticky-top-3' + activeClass + '">' + context.ui.headerInput("matrix-metric-label", config.headerDefs.monthRate, { "field-key": "monthRate" }, "header-input--center") + "</th>",
                    '<th class="sticky-top-3' + activeClass + '">' + context.ui.headerInput("matrix-metric-label", config.headerDefs.cumulativeActual, { "field-key": "cumulativeActual" }, "header-input--center") + "</th>",
                    '<th class="sticky-top-3' + activeClass + '">' + context.ui.headerInput("matrix-metric-label", config.headerDefs.cumulativePrevious, { "field-key": "cumulativePrevious" }, "header-input--center") + "</th>",
                    '<th class="sticky-top-3' + activeClass + '">' + context.ui.headerInput("matrix-metric-label", config.headerDefs.cumulativeRate, { "field-key": "cumulativeRate" }, "header-input--center") + "</th>"
                ].join("");
            }
            return [
                '<th class="sticky-top-3' + activeClass + '" data-period-start="' + context.utils.escapeAttribute(periods[index].id) + '">' + context.utils.escapeHtml(config.headerDefs.monthActual) + "</th>",
                '<th class="sticky-top-3' + activeClass + '">' + context.utils.escapeHtml(config.headerDefs.monthPrevious) + "</th>",
                '<th class="sticky-top-3' + activeClass + '">' + context.utils.escapeHtml(config.headerDefs.monthRate) + "</th>",
                '<th class="sticky-top-3' + activeClass + '">' + context.utils.escapeHtml(config.headerDefs.cumulativeActual) + "</th>",
                '<th class="sticky-top-3' + activeClass + '">' + context.utils.escapeHtml(config.headerDefs.cumulativePrevious) + "</th>",
                '<th class="sticky-top-3' + activeClass + '">' + context.utils.escapeHtml(config.headerDefs.cumulativeRate) + "</th>"
            ].join("");
        }).join("");

        var endTop = endFields.map(function (field) {
            return '<th rowspan="3" class="sticky-top-1">' + context.ui.headerInput("matrix-end-label", config.headerDefs.endFields[field.key], { "field-key": field.key }, "header-input--center") + "</th>";
        }).join("");

        return [
            '<table class="sticky-table monthly-table">',
            "<thead>",
            "<tr>",
            '<th rowspan="3" class="sticky-left sticky-corner col-1 sticky-top-1">' + context.ui.headerInput("matrix-row-header", rowHeaders[0], { "header-index": 0 }, "header-input--left") + "</th>",
            '<th rowspan="3" class="sticky-left sticky-corner col-2 sticky-top-1">' + context.ui.headerInput("matrix-row-header", rowHeaders[1], { "header-index": 1 }, "header-input--left") + "</th>",
            '<th rowspan="3" class="sticky-left sticky-corner col-3 sticky-top-1">' + context.ui.headerInput("matrix-row-header", rowHeaders[2], { "header-index": 2 }, "header-input--left") + "</th>",
            '<th rowspan="3" class="sticky-left sticky-corner col-4 sticky-top-1">' + context.ui.headerInput("matrix-row-header", rowHeaders[3], { "header-index": 3 }, "header-input--left") + "</th>",
            '<th rowspan="3" class="sticky-left sticky-corner col-5 sticky-top-1">' + context.ui.headerInput("matrix-row-header", rowHeaders[4], { "header-index": 4 }, "header-input--left") + "</th>",
            headerTop,
            endTop,
            '<th rowspan="3" class="sticky-top-1 action-col">操作</th>',
            "</tr>",
            "<tr>",
            headerMid,
            "</tr>",
            "<tr>",
            headerBottom,
            "</tr>",
            "</thead>",
            "<tbody>",
            config.rowDefs.map(function (row) {
                return buildMonthlyMatrixRow(context, row, periods, config.activePeriodId);
            }).join(""),
            "</tbody>",
            "</table>"
        ].join("");
    }

    function scrollMonthlyPeriodIntoView(context, periodId) {
        var viewport = context.root.querySelector('[data-scroll-key="' + context.sheet.id + '-matrix"]');
        if (!viewport) {
            return;
        }
        var target = viewport.querySelector('[data-period-start="' + periodId + '"]') || viewport.querySelector('[data-period-anchor="' + periodId + '"]');
        if (!target) {
            return;
        }
        var viewportRect = viewport.getBoundingClientRect();
        var stickyBoundary = viewportRect.left;
        viewport.querySelectorAll("thead .sticky-left").forEach(function (cell) {
            stickyBoundary = Math.max(stickyBoundary, cell.getBoundingClientRect().right);
        });
        var targetRect = target.getBoundingClientRect();
        viewport.scrollLeft = Math.max(viewport.scrollLeft + (targetRect.left - stickyBoundary), 0);
    }

    function buildMatrixFilterBar(context) {
        var config = getConfig(context);
        var yearOptions = getMatrixYearOptions(context, config);

        return [
            '<div class="matrix-filter-bar">',
            '<div class="matrix-filter-main">',
            '<label class="filter-field filter-field--year">',
            '<span class="filter-label">年份</span>',
            '<select data-role="matrix-year-filter">',
            yearOptions.map(function (year) {
                var selected = year === config.activeYear ? " selected" : "";
                return '<option value="' + context.utils.escapeAttribute(year) + '"' + selected + ">" + context.utils.escapeHtml(year) + " 年</option>";
            }).join(""),
            "</select>",
            "</label>",
            '<label class="filter-field filter-field--month">',
            '<span class="filter-label">月份</span>',
            '<select data-role="matrix-month-filter">',
            config.periodDefs.map(function (period) {
                var selected = period.id === config.activePeriodId ? " selected" : "";
                return '<option value="' + context.utils.escapeAttribute(period.id) + '"' + selected + ">" + context.utils.escapeHtml(period.label) + "</option>";
            }).join(""),
            "</select>",
            "</label>",
            "</div>",
            '<div class="filter-field filter-field--actions filter-field--actions-inline">',
            '<span class="filter-label">操作</span>',
            '<div class="filter-action-row filter-action-row--compact">',
            context.ui.actionButton("新增年份", "add-matrix-year", { "sheet-id": context.sheet.id }, "tool-button--filter"),
            context.ui.actionButton("新增行", "add-matrix-row", { "sheet-id": context.sheet.id }, "tool-button--filter"),
            context.ui.actionButton("新增列", "add-matrix-column", { "sheet-id": context.sheet.id }, "tool-button--filter"),
            "</div>",
            "</div>",
            '<span class="filter-help">年份用下拉管理，月份切换会自动定位到对应月份列。</span>',
            "</div>"
        ].join("");
    }

    function addMatrixRow(context) {
        var config = getConfig(context);
        var row = {
            id: context.utils.createId("matrix-row"),
            labels: ["", "", "", ""],
            annualPlan: ""
        };
        config.rowDefs.push(row);
        models.getMonthlyRowState(context.sheetState, context.sheet, row);
    }

    function removeMatrixRow(context, rowId) {
        var config = getConfig(context);
        config.rowDefs = config.rowDefs.filter(function (row) {
            return row.id !== rowId;
        });
        delete config.rows[rowId];
    }

    function addMatrixColumn(context) {
        var config = getConfig(context);
        var period = {
            id: context.utils.createId("matrix-period"),
            label: "新增列" + (config.periodDefs.length + 1)
        };
        config.periodDefs.push(period);
        config.rowDefs.forEach(function (row) {
            var rowStore = context.sheetState.rows[row.id];
            if (!rowStore || !rowStore.years || typeof rowStore.years !== "object") {
                models.getMonthlyRowState(context.sheetState, context.sheet, row).months[period.id] = {
                    actual: "",
                    previous: ""
                };
                return;
            }
            Object.keys(rowStore.years).forEach(function (year) {
                models.getMonthlyRowState(context.sheetState, context.sheet, row, year).months[period.id] = {
                    actual: "",
                    previous: ""
                };
            });
        });
    }

    function removeMatrixColumn(context, periodId) {
        var config = getConfig(context);
        if (config.periodDefs.length <= 1) {
            return;
        }

        config.periodDefs = config.periodDefs.filter(function (period) {
            return period.id !== periodId;
        });

        Object.keys(config.rows || {}).forEach(function (rowId) {
            if (config.rows[rowId] && config.rows[rowId].years) {
                Object.keys(config.rows[rowId].years).forEach(function (year) {
                    if (config.rows[rowId].years[year] && config.rows[rowId].years[year].months) {
                        delete config.rows[rowId].years[year].months[periodId];
                    }
                });
            }
        });

        if (config.activePeriodId === periodId && config.periodDefs.length) {
            config.activePeriodId = config.periodDefs[0].id;
        }
    }

    function addMatrixYear(context) {
        var config = getConfig(context);
        var suggested = String(Number(config.activeYear || context.utils.getDefaultYear()) + 1);
        var rawValue = window.prompt("输入需要新增或切换的年份（例如 2027）", suggested);

        if (rawValue === null) {
            return;
        }

        var year = context.utils.normalizeYear(rawValue, "");
        if (!year) {
            context.setActionStatus("年份格式无效，请输入四位年份。", "error", 3200);
            return;
        }

        config.activeYear = year;
        config.rowDefs.forEach(function (row) {
            models.getMonthlyRowState(context.sheetState, context.sheet, row, year);
        });

        context.rerender();
        window.requestAnimationFrame(function () {
            scrollMonthlyPeriodIntoView(context, config.activePeriodId);
        });
        context.queueSave();
        context.setActionStatus("已切换到 " + year + " 年。", "success", 2400);
    }

    function updateMatrixState(context, input) {
        var role = input.getAttribute("data-role");
        var config = getConfig(context);

        if (role === "matrix-year-filter") {
            config.activeYear = context.utils.normalizeYear(input.value, config.activeYear);
            context.rerender();
            window.requestAnimationFrame(function () {
                scrollMonthlyPeriodIntoView(context, config.activePeriodId);
            });
            return;
        }

        if (role === "matrix-month-filter") {
            config.activePeriodId = input.value;
            context.rerender();
            window.requestAnimationFrame(function () {
                scrollMonthlyPeriodIntoView(context, config.activePeriodId);
            });
            return;
        }

        if (role === "matrix-row-label") {
            var rowDef = models.findById(config.rowDefs, input.getAttribute("data-row-id"));
            if (rowDef) {
                rowDef.labels[Number(input.getAttribute("data-label-index"))] = input.value.trim();
            }
            return;
        }

        if (role === "matrix-row-header") {
            config.headerDefs.rowHeaders[Number(input.getAttribute("data-header-index"))] = input.value.trim();
            return;
        }

        if (role === "matrix-period-label") {
            var period = models.findById(config.periodDefs, input.getAttribute("data-period-id"));
            if (period) {
                period.label = input.value.trim();
            }
            return;
        }

        if (role === "matrix-metric-label") {
            config.headerDefs[input.getAttribute("data-field-key")] = input.value.trim();
            return;
        }

        if (role === "matrix-end-label") {
            config.headerDefs.endFields[input.getAttribute("data-field-key")] = input.value.trim();
            return;
        }

        var rowId = input.getAttribute("data-row-id");
        var row = models.findById(config.rowDefs, rowId);
        if (!row) {
            return;
        }

        var rowState = models.getMonthlyRowState(context.sheetState, context.sheet, row);
        var field = input.getAttribute("data-field");
        var monthKey = input.getAttribute("data-month");

        if (field === "annualPlan") {
            rowState.annualPlan = input.value.trim();
        } else if (field === "forecastComplete") {
            rowState.forecastComplete = input.value.trim();
        } else if (monthKey && rowState.months[monthKey]) {
            rowState.months[monthKey][field] = input.value.trim();
        }
    }

    function countFilledFields(context) {
        var count = 0;

        Object.values(context.sheetState.rows || {}).forEach(function (rowState) {
            Object.values(rowState && rowState.years ? rowState.years : {}).forEach(function (yearState) {
                if (!yearState) {
                    return;
                }
                if (String(yearState.annualPlan || "").trim()) {
                    count += 1;
                }
                if (String(yearState.forecastComplete || "").trim()) {
                    count += 1;
                }
                Object.values(yearState.months || {}).forEach(function (monthState) {
                    if (monthState && String(monthState.actual || "").trim()) {
                        count += 1;
                    }
                    if (monthState && String(monthState.previous || "").trim()) {
                        count += 1;
                    }
                });
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
        var seriesList = workbookContext.sheetSummaries || [];
        var hasAnyData = seriesList.some(function (series) {
            return series.values.some(function (value) {
                return value !== null;
            });
        });

        if (!hasAnyData) {
            return [
                '<article class="chart-card">',
                '<div class="chart-card-head"><div><span class="eyebrow">Monthly Radar</span><h3>月度录入走势</h3><p>读取产量表和工业总产值表的“实际”字段，按月份汇总展示。</p></div></div>',
                '<div class="chart-empty">当前还没有录入月度实际数据。</div>',
                "</article>"
            ].join("");
        }

        return [
            '<article class="chart-card">',
            '<div class="chart-card-head">',
            "<div><span class=\"eyebrow\">Monthly Radar</span><h3>月度录入走势</h3><p>" + workbookContext.utils.escapeHtml(workbookContext.workbook.title) + " / 已录入 " + workbookContext.utils.formatNumber(workbookContext.filledCount) + " 项</p></div>",
            '<div class="chart-legend">' + buildLegend([
                { label: "产量表", className: "legend-dot--production" },
                { label: "工业总产值表", className: "legend-dot--output" }
            ]) + "</div>",
            "</div>",
            '<div class="mini-series-grid">',
            seriesList.map(function (series, index) {
                return [
                    '<section class="series-card">',
                    '<div class="series-card-head"><div><strong>' + workbookContext.utils.escapeHtml(series.title) + "</strong><span>" + workbookContext.utils.escapeHtml(series.year) + " 年 / 已录入 " + series.filledMonths + " 个月</span></div><b>" + workbookContext.utils.formatCompactNumber(series.total) + "</b></div>",
                    '<div class="month-strip">',
                    series.periods.map(function (period, periodIndex) {
                        var value = series.values[periodIndex];
                        var ratio = value !== null && series.peak > 0 ? value / series.peak : 0;
                        return [
                            '<div class="month-col">',
                            '<div class="month-bar-wrap"><i class="month-bar-fill ' + (index === 0 ? "month-bar-fill--production" : "month-bar-fill--output") + '" style="height:' + Math.max(ratio * 100, value !== null ? 6 : 2) + "%;--delay:" + (periodIndex * 0.04).toFixed(2) + 's"></i></div>',
                            '<span class="month-col-label">' + workbookContext.utils.escapeHtml(period.label) + "</span>",
                            "<strong>" + workbookContext.utils.formatCompactNumber(value) + "</strong>",
                            "</div>"
                        ].join("");
                    }).join(""),
                    "</div>",
                    "</section>"
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
        var previewYear = models.pickMonthlyPreviewYear(context.sheetState, config);
        var periods = config.periodDefs;
        var endFields = models.getConfigValue(context.sheet, "endFields", []);
        var rowHeaders = config.headerDefs.rowHeaders;

        return [
            '<section class="preview-sheet' + (context.sheet.id === context.requestedSheetId ? " is-active-sheet" : "") + '">',
            '<div class="preview-sheet-head">',
            '<div><span class="preview-sheet-kicker">Monthly Matrix</span><h2>' + context.utils.escapeHtml(context.sheet.name) + "</h2><p>" + context.utils.escapeHtml(context.sheet.description || "") + "</p></div>",
            '<div class="preview-sheet-meta"><span class="preview-chip">年份 / ' + context.utils.escapeHtml(previewYear) + '</span><span class="preview-chip">月份列 / ' + periods.length + "</span></div>",
            "</div>",
            '<div class="preview-table-wrap">',
            '<table class="preview-report-table preview-report-table--monthly">',
            "<thead>",
            "<tr>",
            "<th rowspan=\"3\">" + context.utils.escapeHtml(rowHeaders[0]) + "</th>",
            "<th rowspan=\"3\">" + context.utils.escapeHtml(rowHeaders[1]) + "</th>",
            "<th rowspan=\"3\">" + context.utils.escapeHtml(rowHeaders[2]) + "</th>",
            "<th rowspan=\"3\">" + context.utils.escapeHtml(rowHeaders[3]) + "</th>",
            "<th rowspan=\"3\">" + context.utils.escapeHtml(rowHeaders[4]) + "</th>",
            periods.map(function (period) {
                return '<th colspan="6">' + context.utils.escapeHtml(period.label) + "</th>";
            }).join(""),
            endFields.map(function (field) {
                return "<th rowspan=\"3\">" + context.utils.escapeHtml(config.headerDefs.endFields[field.key]) + "</th>";
            }).join(""),
            "</tr>",
            "<tr>",
            periods.map(function () {
                return '<th colspan="3">' + context.utils.escapeHtml(config.headerDefs.currentGroup) + '</th><th colspan="3">' + context.utils.escapeHtml(config.headerDefs.cumulativeGroup) + "</th>";
            }).join(""),
            "</tr>",
            "<tr>",
            periods.map(function () {
                return [
                    "<th>" + context.utils.escapeHtml(config.headerDefs.monthActual) + "</th>",
                    "<th>" + context.utils.escapeHtml(config.headerDefs.monthPrevious) + "</th>",
                    "<th>" + context.utils.escapeHtml(config.headerDefs.monthRate) + "</th>",
                    "<th>" + context.utils.escapeHtml(config.headerDefs.cumulativeActual) + "</th>",
                    "<th>" + context.utils.escapeHtml(config.headerDefs.cumulativePrevious) + "</th>",
                    "<th>" + context.utils.escapeHtml(config.headerDefs.cumulativeRate) + "</th>"
                ].join("");
            }).join(""),
            "</tr>",
            "</thead>",
            "<tbody>",
            config.rowDefs.map(function (row) {
                var rowYearState = models.getMonthlyRowState(context.sheetState, context.sheet, row, previewYear);
                var computed = models.computeMonthlyMetrics(rowYearState, periods);
                return [
                    "<tr>",
                    row.labels.map(function (label) {
                        return "<td>" + displayText(context, label) + "</td>";
                    }).join(""),
                    "<td>" + displayMaybeNumber(context, rowYearState.annualPlan) + "</td>",
                    periods.map(function (period) {
                        var monthState = rowYearState.months[period.id];
                        var metric = computed[period.id];
                        return [
                            "<td>" + displayMaybeNumber(context, monthState.actual) + "</td>",
                            "<td>" + displayMaybeNumber(context, monthState.previous) + "</td>",
                            "<td>" + context.utils.formatPercent(metric.monthRate) + "</td>",
                            "<td>" + context.utils.formatNumber(metric.cumulativeActual) + "</td>",
                            "<td>" + context.utils.formatNumber(metric.cumulativePrevious) + "</td>",
                            "<td>" + context.utils.formatPercent(metric.cumulativeRate) + "</td>"
                        ].join("");
                    }).join(""),
                    endFields.map(function (field) {
                        if (field.editable) {
                            return "<td>" + displayMaybeNumber(context, rowYearState[field.key]) + "</td>";
                        }
                        return "<td>" + context.utils.formatNumber(computed.planGap) + "</td>";
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

    platform.registerSheetType("monthly-matrix", {
        modeLabel: "月度矩阵",

        normalizeState: function (sheetManifest, rawSheetState) {
            var sheetState = rawSheetState && typeof rawSheetState === "object" ? rawSheetState : { rows: {} };
            return getConfig({
                sheet: sheetManifest,
                sheetState: sheetState,
                utils: window.DataDashboardUtils
            });
        },

        renderEditor: function (context) {
            context.mount.innerHTML = [
                '<div class="table-card">',
                '<div class="table-top table-top--compact">',
                '<div class="table-heading-inline"><span class="table-help">冻结标题支持直接编辑，并可在筛选栏中新增年份、行和列。</span></div>',
                "</div>",
                buildMatrixFilterBar(context),
                context.ui.buildScrollShell(context.sheet.id + "-matrix", [
                    '<div class="table-wrap excel-viewport" data-scroll-key="' + context.sheet.id + '-matrix">',
                    buildMonthlyMatrixTable(context),
                    "</div>"
                ].join(""), "monthly-shell"),
                "</div>"
            ].join("");
        },

        handleAction: function (context, actionName, actionNode) {
            if (actionName === "add-matrix-row") {
                addMatrixRow(context);
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            if (actionName === "remove-matrix-row") {
                removeMatrixRow(context, actionNode.getAttribute("data-row-id"));
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            if (actionName === "add-matrix-column") {
                addMatrixColumn(context);
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            if (actionName === "remove-matrix-column") {
                removeMatrixColumn(context, actionNode.getAttribute("data-period-id"));
                context.rerenderPreservingScroll();
                context.queueSave();
                return true;
            }

            if (actionName === "add-matrix-year") {
                addMatrixYear(context);
                return true;
            }

            return false;
        },

        handleChange: function (context, target) {
            var role = target.getAttribute("data-role");
            if (!role || role.indexOf("matrix-") !== 0) {
                return false;
            }

            if (role === "matrix-year-filter" || role === "matrix-month-filter") {
                updateMatrixState(context, target);
                context.queueSave();
                return true;
            }

            updateMatrixState(context, target);
            context.rerenderPreservingScroll();
            context.queueSave();
            return true;
        },

        countFilledFields: countFilledFields,

        getEntryMeta: function () {
            return {
                modeLabel: "月度矩阵"
            };
        },

        getDashboardSummary: function (context) {
            return models.buildMonthlySeries(context.sheetState, context.sheet);
        },

        getDashboardPanels: function (workbookContext) {
            return [{
                html: renderDashboardPanel(workbookContext)
            }];
        },

        renderPreview: renderPreview
    });
})();
