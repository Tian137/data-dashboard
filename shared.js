(function () {
    var numberFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

    function safeParse(value, fallback) {
        if (value === null || typeof value === "undefined" || value === "") {
            return typeof fallback === "undefined" ? null : fallback;
        }
        if (typeof value !== "string") {
            return value;
        }
        try {
            var parsed = JSON.parse(value);
            return parsed === null && typeof fallback !== "undefined" ? fallback : parsed;
        } catch (error) {
            return typeof fallback === "undefined" ? null : fallback;
        }
    }

    function cloneDeep(value) {
        if (value === null || typeof value === "undefined") {
            return value;
        }
        return JSON.parse(JSON.stringify(value));
    }

    function parseNumber(value) {
        if (value === "" || value === null || typeof value === "undefined") {
            return null;
        }
        var normalized = String(value).replace(/,/g, "").trim();
        if (!normalized) {
            return null;
        }
        var number = Number(normalized);
        return Number.isFinite(number) ? number : null;
    }

    function formatNumber(value) {
        if (value === null || typeof value === "undefined" || value === "") {
            return "—";
        }
        return numberFormatter.format(value);
    }

    function formatCompactNumber(value) {
        if (value === null || typeof value === "undefined") {
            return "—";
        }
        var absolute = Math.abs(value);
        if (absolute >= 100000000) {
            return numberFormatter.format(value / 100000000) + "亿";
        }
        if (absolute >= 10000) {
            return numberFormatter.format(value / 10000) + "万";
        }
        return numberFormatter.format(value);
    }

    function formatPercent(value) {
        if (value === null || typeof value === "undefined") {
            return "—";
        }
        return Number(value).toFixed(2) + "%";
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function escapeAttribute(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function createId(prefix) {
        return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    }

    function getDefaultYear() {
        return String(new Date().getFullYear());
    }

    function normalizeYear(value, fallback) {
        var normalized = String(value || "").trim();
        if (!normalized) {
            return fallback;
        }
        var year = Number(normalized);
        if (!Number.isInteger(year) || year < 1900 || year > 9999) {
            return fallback;
        }
        return String(year);
    }

    function downloadJson(fileName, payload) {
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        window.setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 0);
    }

    function readTextFile(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                resolve(String(reader.result || ""));
            };
            reader.onerror = function () {
                reject(new Error("读取文件失败。"));
            };
            reader.readAsText(file, "utf-8");
        });
    }

    window.DataDashboardUtils = {
        cloneDeep: cloneDeep,
        createId: createId,
        downloadJson: downloadJson,
        escapeAttribute: escapeAttribute,
        escapeHtml: escapeHtml,
        formatCompactNumber: formatCompactNumber,
        formatNumber: formatNumber,
        formatPercent: formatPercent,
        getDefaultYear: getDefaultYear,
        normalizeYear: normalizeYear,
        parseNumber: parseNumber,
        readTextFile: readTextFile,
        safeParse: safeParse
    };
})();
