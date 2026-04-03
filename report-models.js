(function () {
    var utils = window.DataDashboardUtils;
    var platform = window.DataDashboardTemplatePlatform;

    function getPlatformMonths() {
        return platform && Array.isArray(platform.months) && platform.months.length
            ? platform.months.slice()
            : Array.from({ length: 12 }, function (_, index) {
                return (index + 1) + "月";
            });
    }

    function getConfigValue(sheet, key, fallback) {
        if (sheet && sheet.config && typeof sheet.config === "object" && typeof sheet.config[key] !== "undefined") {
            return sheet.config[key];
        }
        if (sheet && typeof sheet[key] !== "undefined") {
            return sheet[key];
        }
        return fallback;
    }

    function resolveWorkbookId(rawId) {
        return platform
            ? platform.resolveWorkbookId(rawId, { includeHidden: true })
            : String(rawId || "").trim();
    }

    function getWorkbookMode(workbook) {
        return platform ? platform.getWorkbookMode(workbook) : "固定模板";
    }

    function cloneLabels(labels, size) {
        var result = Array.isArray(labels) ? labels.slice(0, size) : [];
        while (result.length < size) {
            result.push("");
        }
        return result;
    }

    function ensureArrayLength(list, length) {
        while (list.length < length) {
            list.push("");
        }
        if (list.length > length) {
            list.length = length;
        }
        return list;
    }

    function findById(list, id) {
        return (list || []).find(function (item) {
            return item.id === id;
        });
    }

    function getMonthlySheetConfig(sheetState, sheet) {
        var defaultYear = utils.getDefaultYear();
        var sourceRows = getConfigValue(sheet, "rows", []);
        var sourceEndFields = getConfigValue(sheet, "endFields", []);

        if (!Array.isArray(sheetState.rowDefs)) {
            sheetState.rowDefs = sourceRows.map(function (row) {
                return {
                    id: row.id || utils.createId("matrix-row"),
                    labels: cloneLabels(row.labels, 4),
                    annualPlan: row.annualPlan || ""
                };
            });
        }
        sheetState.rowDefs = sheetState.rowDefs.map(function (row) {
            return {
                id: row.id || utils.createId("matrix-row"),
                labels: cloneLabels(row.labels, 4),
                annualPlan: row.annualPlan || ""
            };
        });

        if (!Array.isArray(sheetState.periodDefs) || !sheetState.periodDefs.length) {
            sheetState.periodDefs = getPlatformMonths().map(function (label, index) {
                return {
                    id: "m" + (index + 1),
                    label: label
                };
            });
        }
        sheetState.periodDefs = sheetState.periodDefs.map(function (period, index) {
            return {
                id: period.id || utils.createId("matrix-period"),
                label: period.label || ("列" + (index + 1))
            };
        });

        sheetState.activeYear = utils.normalizeYear(sheetState.activeYear, defaultYear);
        if (!sheetState.activePeriodId || !findById(sheetState.periodDefs, sheetState.activePeriodId)) {
            sheetState.activePeriodId = sheetState.periodDefs[0].id;
        }

        if (!sheetState.headerDefs || typeof sheetState.headerDefs !== "object") {
            sheetState.headerDefs = {};
        }
        if (!Array.isArray(sheetState.headerDefs.rowHeaders)) {
            sheetState.headerDefs.rowHeaders = ["板块及公司名称", "公司", "产品/说明", "单位", "全年计划"];
        }
        sheetState.headerDefs.rowHeaders = cloneLabels(sheetState.headerDefs.rowHeaders, 5);

        ["currentGroup", "cumulativeGroup", "monthActual", "monthPrevious", "monthRate", "cumulativeActual", "cumulativePrevious", "cumulativeRate"].forEach(function (key) {
            if (!sheetState.headerDefs[key]) {
                sheetState.headerDefs[key] = {
                    currentGroup: "当月",
                    cumulativeGroup: "累计",
                    monthActual: "实际",
                    monthPrevious: "去年同期",
                    monthRate: "增降幅",
                    cumulativeActual: "实际",
                    cumulativePrevious: "去年同期",
                    cumulativeRate: "增降幅"
                }[key];
            }
        });

        if (!sheetState.headerDefs.endFields || typeof sheetState.headerDefs.endFields !== "object") {
            sheetState.headerDefs.endFields = {};
        }
        sourceEndFields.forEach(function (field) {
            if (!sheetState.headerDefs.endFields[field.key]) {
                sheetState.headerDefs.endFields[field.key] = field.label;
            }
        });

        if (!sheetState.rows || typeof sheetState.rows !== "object") {
            sheetState.rows = {};
        }

        return sheetState;
    }

    function getMonthlyRowState(sheetState, sheet, row, yearKey) {
        var config = getMonthlySheetConfig(sheetState, sheet);
        var activeYear = utils.normalizeYear(yearKey || config.activeYear, utils.getDefaultYear());

        if (!sheetState.rows[row.id]) {
            sheetState.rows[row.id] = { years: {} };
        }

        var rowState = sheetState.rows[row.id];
        if (!rowState.years || typeof rowState.years !== "object") {
            rowState.years = {};
        }
        if (!rowState.years[activeYear]) {
            rowState.years[activeYear] = {
                annualPlan: rowState.annualPlan || row.annualPlan || "",
                forecastComplete: rowState.forecastComplete || "",
                months: rowState.months && typeof rowState.months === "object" ? rowState.months : {}
            };
        }
        if (typeof rowState.years[activeYear].annualPlan === "undefined") {
            rowState.years[activeYear].annualPlan = row.annualPlan || "";
        }
        if (typeof rowState.years[activeYear].forecastComplete === "undefined") {
            rowState.years[activeYear].forecastComplete = "";
        }
        if (!rowState.years[activeYear].months || typeof rowState.years[activeYear].months !== "object") {
            rowState.years[activeYear].months = {};
        }

        var yearState = rowState.years[activeYear];
        config.periodDefs.forEach(function (period) {
            if (!yearState.months[period.id]) {
                yearState.months[period.id] = {
                    actual: "",
                    previous: ""
                };
            }
        });

        return yearState;
    }

    function pickMonthlyPreviewYear(sheetState, config) {
        var years = {};
        var defaultYear = utils.getDefaultYear();

        years[defaultYear] = true;
        if (config.activeYear) {
            years[config.activeYear] = true;
        }

        Object.keys(sheetState.rows || {}).forEach(function (rowId) {
            var rowState = sheetState.rows[rowId];
            if (rowState && rowState.years && typeof rowState.years === "object") {
                Object.keys(rowState.years).forEach(function (year) {
                    years[utils.normalizeYear(year, defaultYear)] = true;
                });
            }
        });

        return Object.keys(years).sort(function (a, b) {
            return Number(b) - Number(a);
        })[0] || defaultYear;
    }

    function getRate(current, previous) {
        if (current === null || previous === null || previous === 0) {
            return null;
        }
        return ((current - previous) / previous) * 100;
    }

    function computeMonthlyMetrics(state, periods) {
        var result = {};
        var runningActual = null;
        var runningPrevious = null;

        periods.forEach(function (period) {
            var actual = utils.parseNumber(state.months[period.id].actual);
            var previous = utils.parseNumber(state.months[period.id].previous);

            if (actual !== null) {
                runningActual = (runningActual === null ? 0 : runningActual) + actual;
            }
            if (previous !== null) {
                runningPrevious = (runningPrevious === null ? 0 : runningPrevious) + previous;
            }

            result[period.id] = {
                monthRate: getRate(actual, previous),
                cumulativeActual: runningActual,
                cumulativePrevious: runningPrevious,
                cumulativeRate: getRate(runningActual, runningPrevious)
            };
        });

        var plan = utils.parseNumber(state.annualPlan);
        var forecast = utils.parseNumber(state.forecastComplete);
        result.planGap = plan !== null && forecast !== null ? forecast - plan : null;
        return result;
    }

    function buildMonthlySeries(sheetState, sheet) {
        var config = getMonthlySheetConfig(sheetState, sheet);
        var targetYear = pickMonthlyPreviewYear(sheetState, config);
        var periods = config.periodDefs;

        var values = periods.map(function (period) {
            var sum = 0;
            var hasValue = false;
            config.rowDefs.forEach(function (row) {
                var rowYearState = getMonthlyRowState(sheetState, sheet, row, targetYear);
                var number = utils.parseNumber(rowYearState.months[period.id].actual);
                if (number !== null) {
                    sum += number;
                    hasValue = true;
                }
            });
            return hasValue ? sum : null;
        });

        var presentValues = values.filter(function (value) {
            return value !== null;
        });

        return {
            sheetId: sheet.id,
            title: sheet.name,
            year: targetYear,
            periods: periods,
            values: values,
            peak: presentValues.length ? Math.max.apply(Math, presentValues) : 0,
            total: values.reduce(function (sum, value) { return sum + (value || 0); }, 0),
            filledMonths: presentValues.length
        };
    }

    function getPriceSheetConfig(sheetState, sheet) {
        var sourceItems = getConfigValue(sheet, "items", []);

        if (!Array.isArray(sheetState.itemDefs)) {
            sheetState.itemDefs = sourceItems.map(function (item) {
                return {
                    id: item.id || utils.createId("price-item"),
                    name: item.name || ""
                };
            });
        }
        sheetState.itemDefs = sheetState.itemDefs.map(function (item) {
            return {
                id: item.id || utils.createId("price-item"),
                name: item.name || ""
            };
        });

        if ((sheetState.itemDefsVersion || 0) < 2) {
            var defaultIds = {};
            var existingById = {};
            var mergedItemDefs = [];

            sourceItems.forEach(function (item) {
                defaultIds[item.id] = true;
            });
            sheetState.itemDefs.forEach(function (item) {
                existingById[item.id] = item;
            });
            sourceItems.forEach(function (item) {
                mergedItemDefs.push(existingById[item.id] || item);
            });
            sheetState.itemDefs.forEach(function (item) {
                if (!defaultIds[item.id]) {
                    mergedItemDefs.push(item);
                }
            });

            sheetState.itemDefs = mergedItemDefs;
            sheetState.itemDefsVersion = 2;
        }

        if (!Array.isArray(sheetState.extraColumns)) {
            sheetState.extraColumns = [];
        }
        sheetState.extraColumns = sheetState.extraColumns.map(function (column, index) {
            return {
                id: column.id || utils.createId("price-extra"),
                label: column.label || ("自定义列" + (index + 1))
            };
        });

        if (!sheetState.headerDefs || typeof sheetState.headerDefs !== "object") {
            sheetState.headerDefs = {};
        }

        {
            var defaults = {
                item: "品种",
                jingmeiGroup: "靖煤公司",
                yaomeiGroup: "窑煤公司",
                jingmeiCurrent: "本周价格",
                jingmeiPrevious: "上周价格",
                jingmeiDelta: "环比增减",
                jingmeiRate: "增降幅",
                yaomeiCurrent: "本周价格",
                yaomeiPrevious: "上周价格",
                yaomeiDelta: "环比增减",
                yaomeiRate: "增降幅",
                forecast: "全国预测价",
                market: "参考市场",
                note: "备注"
            };
            Object.keys(defaults).forEach(function (key) {
                if (!sheetState.headerDefs[key]) {
                    sheetState.headerDefs[key] = defaults[key];
                }
            });
        }

        if (!sheetState.items || typeof sheetState.items !== "object") {
            sheetState.items = {};
        }

        return sheetState;
    }

    function getPriceItemState(sheetState, sheet, item) {
        var config = getPriceSheetConfig(sheetState, sheet);

        if (!sheetState.items[item.id]) {
            sheetState.items[item.id] = {
                jingmeiCurrent: "",
                jingmeiPrevious: "",
                yaomeiCurrent: "",
                yaomeiPrevious: "",
                forecast: "",
                market: "",
                note: "",
                extraValues: {}
            };
        }

        var itemState = sheetState.items[item.id];
        if (!itemState.extraValues || typeof itemState.extraValues !== "object") {
            itemState.extraValues = {};
        }

        config.extraColumns.forEach(function (column) {
            if (typeof itemState.extraValues[column.id] === "undefined") {
                itemState.extraValues[column.id] = "";
            }
        });

        return itemState;
    }

    function buildPriceMetric(state) {
        var jingmeiCurrent = utils.parseNumber(state.jingmeiCurrent);
        var jingmeiPrevious = utils.parseNumber(state.jingmeiPrevious);
        var yaomeiCurrent = utils.parseNumber(state.yaomeiCurrent);
        var yaomeiPrevious = utils.parseNumber(state.yaomeiPrevious);

        return {
            jingmeiDelta: jingmeiCurrent !== null && jingmeiPrevious !== null ? jingmeiCurrent - jingmeiPrevious : null,
            jingmeiRate: getRate(jingmeiCurrent, jingmeiPrevious),
            yaomeiDelta: yaomeiCurrent !== null && yaomeiPrevious !== null ? yaomeiCurrent - yaomeiPrevious : null,
            yaomeiRate: getRate(yaomeiCurrent, yaomeiPrevious)
        };
    }

    function buildPriceChartData(sheetState, sheet) {
        var config = getPriceSheetConfig(sheetState, sheet);
        var rows = config.itemDefs.map(function (item) {
            var itemState = getPriceItemState(sheetState, sheet, item);
            return {
                label: item.name,
                jingmei: utils.parseNumber(itemState.jingmeiCurrent),
                yaomei: utils.parseNumber(itemState.yaomeiCurrent)
            };
        }).filter(function (row) {
            return row.jingmei !== null || row.yaomei !== null;
        }).slice(0, 5);

        var values = rows.flatMap(function (row) {
            return [row.jingmei, row.yaomei];
        }).filter(function (value) {
            return value !== null;
        });
        var maxValue = values.length ? Math.max.apply(Math, values) : 0;
        var jingmeiValues = rows.map(function (row) { return row.jingmei; }).filter(function (value) { return value !== null; });
        var yaomeiValues = rows.map(function (row) { return row.yaomei; }).filter(function (value) { return value !== null; });

        return {
            sheetId: sheet.id,
            rows: rows,
            maxValue: maxValue,
            jingmeiAvg: jingmeiValues.length ? jingmeiValues.reduce(function (sum, value) { return sum + value; }, 0) / jingmeiValues.length : null,
            yaomeiAvg: yaomeiValues.length ? yaomeiValues.reduce(function (sum, value) { return sum + value; }, 0) / yaomeiValues.length : null
        };
    }

    function getWeeklySheetConfig(sheetState, sheet) {
        var sourceProducts = getConfigValue(sheet, "products", []);
        var sourceWeeks = getConfigValue(sheet, "weeks", []);

        if (!Array.isArray(sheetState.productDefs)) {
            sheetState.productDefs = sourceProducts.map(function (product) {
                return {
                    id: product.id || utils.createId("sales-product"),
                    name: product.name || ""
                };
            });
        }
        sheetState.productDefs = sheetState.productDefs.map(function (product) {
            return {
                id: product.id || utils.createId("sales-product"),
                name: product.name || ""
            };
        });

        if (!Array.isArray(sheetState.weekDefs)) {
            sheetState.weekDefs = sourceWeeks.map(function (week) {
                return {
                    id: week.id || utils.createId("sales-week"),
                    label: week.label || "",
                    days: Array.isArray(week.days) && week.days.length ? week.days.slice() : ["日期1"]
                };
            });
        }
        sheetState.weekDefs = sheetState.weekDefs.map(function (week) {
            return {
                id: week.id || utils.createId("sales-week"),
                label: week.label || "",
                days: Array.isArray(week.days) && week.days.length ? week.days.slice() : ["日期1"]
            };
        });

        if (!sheetState.headerDefs || typeof sheetState.headerDefs !== "object") {
            sheetState.headerDefs = {};
        }
        ["row", "yaomeiGroup", "jingmeiGroup", "yaomeiSubtotal", "jingmeiSubtotal"].forEach(function (key) {
            if (!sheetState.headerDefs[key]) {
                sheetState.headerDefs[key] = {
                    row: "销售类别",
                    yaomeiGroup: "窑煤公司",
                    jingmeiGroup: "靖煤公司",
                    yaomeiSubtotal: "周小计",
                    jingmeiSubtotal: "周小计"
                }[key];
            }
        });

        if (!sheetState.weeks || typeof sheetState.weeks !== "object") {
            sheetState.weeks = {};
        }
        if (typeof sheetState.analysis === "undefined") {
            sheetState.analysis = "";
        }

        return sheetState;
    }

    function getWeekDefinition(config, weekId) {
        return findById(config.weekDefs, weekId);
    }

    function getSalesRowState(sheetState, sheet, weekId, productId) {
        var config = getWeeklySheetConfig(sheetState, sheet);
        var week = getWeekDefinition(config, weekId);
        var dayCount = week ? week.days.length : 0;

        if (!sheetState.weeks[weekId]) {
            sheetState.weeks[weekId] = {};
        }
        if (!sheetState.weeks[weekId][productId]) {
            sheetState.weeks[weekId][productId] = {
                yaomei: [],
                jingmei: []
            };
        }

        var rowState = sheetState.weeks[weekId][productId];
        if (!Array.isArray(rowState.yaomei)) {
            rowState.yaomei = [];
        }
        if (!Array.isArray(rowState.jingmei)) {
            rowState.jingmei = [];
        }

        ensureArrayLength(rowState.yaomei, dayCount);
        ensureArrayLength(rowState.jingmei, dayCount);
        return rowState;
    }

    function computeWeekTotals(sheetState, sheet, weekId) {
        var config = getWeeklySheetConfig(sheetState, sheet);
        var week = getWeekDefinition(config, weekId);
        var dayCount = week ? week.days.length : 0;
        var yaomeiDaily = [];
        var jingmeiDaily = [];
        var rows = {};

        while (yaomeiDaily.length < dayCount) {
            yaomeiDaily.push(0);
            jingmeiDaily.push(0);
        }

        config.productDefs.forEach(function (product) {
            var state = getSalesRowState(sheetState, sheet, weekId, product.id);
            var yaomeiSubtotal = 0;
            var jingmeiSubtotal = 0;

            state.yaomei.forEach(function (value, index) {
                var parsed = utils.parseNumber(value);
                if (parsed !== null) {
                    yaomeiDaily[index] += parsed;
                    yaomeiSubtotal += parsed;
                }
            });
            state.jingmei.forEach(function (value, index) {
                var parsed = utils.parseNumber(value);
                if (parsed !== null) {
                    jingmeiDaily[index] += parsed;
                    jingmeiSubtotal += parsed;
                }
            });

            rows[product.id] = {
                yaomeiSubtotal: yaomeiSubtotal,
                jingmeiSubtotal: jingmeiSubtotal
            };
        });

        return {
            rows: rows,
            yaomeiDaily: yaomeiDaily,
            jingmeiDaily: jingmeiDaily,
            yaomeiGrand: yaomeiDaily.reduce(function (sum, value) { return sum + value; }, 0),
            jingmeiGrand: jingmeiDaily.reduce(function (sum, value) { return sum + value; }, 0)
        };
    }

    function buildSalesChartData(sheetState, sheet) {
        var config = getWeeklySheetConfig(sheetState, sheet);
        var week = config.weekDefs.find(function (candidate) {
            var weekState = sheetState.weeks && sheetState.weeks[candidate.id];
            return Object.values(weekState || {}).some(function (rowState) {
                return ["yaomei", "jingmei"].some(function (key) {
                    return (Array.isArray(rowState && rowState[key]) ? rowState[key] : []).some(function (value) {
                        return utils.parseNumber(value) !== null;
                    });
                });
            });
        }) || config.weekDefs[0] || { id: "currentWeek", label: "本周", days: [] };

        var totals = computeWeekTotals(sheetState, sheet, week.id);

        return {
            sheetId: sheet.id,
            label: week.label,
            days: week.days,
            yaomeiDaily: totals.yaomeiDaily,
            jingmeiDaily: totals.jingmeiDaily,
            peak: Math.max.apply(Math, [0].concat(totals.yaomeiDaily, totals.jingmeiDaily)),
            yaomeiTotal: totals.yaomeiGrand,
            jingmeiTotal: totals.jingmeiGrand
        };
    }

    window.DataDashboardReportModels = {
        buildMonthlySeries: buildMonthlySeries,
        buildPriceChartData: buildPriceChartData,
        buildPriceMetric: buildPriceMetric,
        buildSalesChartData: buildSalesChartData,
        computeMonthlyMetrics: computeMonthlyMetrics,
        computeWeekTotals: computeWeekTotals,
        findById: findById,
        getConfigValue: getConfigValue,
        getMonthlyRowState: getMonthlyRowState,
        getMonthlySheetConfig: getMonthlySheetConfig,
        getPriceItemState: getPriceItemState,
        getPriceSheetConfig: getPriceSheetConfig,
        getSalesRowState: getSalesRowState,
        getWeekDefinition: getWeekDefinition,
        getWeeklySheetConfig: getWeeklySheetConfig,
        getWorkbookMode: getWorkbookMode,
        pickMonthlyPreviewYear: pickMonthlyPreviewYear,
        resolveWorkbookId: resolveWorkbookId
    };
})();
