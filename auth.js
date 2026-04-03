(function () {
    var AUTH_CACHE_KEY = "data_dashboard_auth_cache_v2";
    var authCache = null;

    function readStorageItem(key) {
        try {
            return window.sessionStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function writeStorageItem(key, value) {
        try {
            window.sessionStorage.setItem(key, value);
        } catch (error) {
            // Ignore cache failures.
        }
    }

    function removeStorageItem(key) {
        try {
            window.sessionStorage.removeItem(key);
        } catch (error) {
            // Ignore cache failures.
        }
    }

    function safeParse(value) {
        if (!value) {
            return null;
        }
        try {
            return JSON.parse(value);
        } catch (error) {
            return null;
        }
    }

    function sanitizeNextTarget(target) {
        var fallback = "./dashboard.html";
        if (!target) {
            return fallback;
        }

        var value = String(target).trim();
        if (!value) {
            return fallback;
        }

        if (/^([a-z]+:)?\/\//i.test(value) || /^javascript:/i.test(value)) {
            return fallback;
        }

        if (value.charAt(0) === "/") {
            return value;
        }

        if (value.indexOf(".html") !== -1 || value.indexOf("./") === 0) {
            return value;
        }

        return fallback;
    }

    function getCurrentTarget() {
        var fileName = window.location.pathname.split("/").pop() || "index.html";
        return fileName + window.location.search + window.location.hash;
    }

    function getNextTarget(fallback) {
        var params = new URLSearchParams(window.location.search);
        return sanitizeNextTarget(params.get("next") || fallback || "./dashboard.html");
    }

    function setCachedAuth(payload) {
        authCache = payload || null;
        if (authCache) {
            writeStorageItem(AUTH_CACHE_KEY, JSON.stringify(authCache));
        } else {
            removeStorageItem(AUTH_CACHE_KEY);
        }
        return authCache;
    }

    function readCachedAuth() {
        if (authCache) {
            return authCache;
        }
        authCache = safeParse(readStorageItem(AUTH_CACHE_KEY));
        return authCache;
    }

    function fetchAuthSync() {
        if (!window.DataDashboardApi || typeof window.DataDashboardApi.__getMeSync !== "function") {
            return readCachedAuth();
        }
        try {
            var payload = window.DataDashboardApi.__getMeSync();
            return setCachedAuth(payload);
        } catch (error) {
            setCachedAuth(null);
            return null;
        }
    }

    function getAuth() {
        return fetchAuthSync();
    }

    function hasWorkbookAccess(workbookId) {
        var authState = getAuth();
        if (!authState) {
            return false;
        }
        if (authState.role === "super_admin") {
            return true;
        }
        return Array.isArray(authState.allowedWorkbookIds) && authState.allowedWorkbookIds.indexOf(String(workbookId)) !== -1;
    }

    function requireAuth() {
        var payload = getAuth();
        if (payload) {
            return payload;
        }
        window.location.replace("./index.html?next=" + encodeURIComponent(getCurrentTarget()));
        return null;
    }

    function requireRole(roles, fallback) {
        var payload = requireAuth();
        var allowedRoles = Array.isArray(roles) ? roles : [roles];
        if (payload && allowedRoles.indexOf(payload.role) !== -1) {
            return payload;
        }
        window.location.replace(sanitizeNextTarget(fallback || "./dashboard.html"));
        return null;
    }

    function redirectIfAuthenticated(fallback) {
        var payload = getAuth();
        if (payload) {
            window.location.replace(getNextTarget(fallback || "./dashboard.html"));
        }
        return payload;
    }

    async function login(username, password) {
        var payload = await window.DataDashboardApi.login(username, password);
        return setCachedAuth(payload);
    }

    async function logout(target) {
        try {
            if (window.DataDashboardApi && typeof window.DataDashboardApi.logout === "function") {
                await window.DataDashboardApi.logout();
            }
        } catch (error) {
            // Ignore logout API failures before redirecting to login.
        }
        setCachedAuth(null);
        window.location.replace(sanitizeNextTarget(target || "./index.html"));
    }

    window.DataDashboardAuth = {
        getAuth: getAuth,
        getNextTarget: getNextTarget,
        hasWorkbookAccess: hasWorkbookAccess,
        login: login,
        logout: logout,
        redirectIfAuthenticated: redirectIfAuthenticated,
        requireAuth: requireAuth,
        requireRole: requireRole,
        setCachedAuth: setCachedAuth
    };
})();
