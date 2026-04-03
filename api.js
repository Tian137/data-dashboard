(function () {
    function buildHeaders(body) {
        var headers = {};
        if (body !== null && typeof body !== "undefined") {
            headers["Content-Type"] = "application/json";
        }
        return headers;
    }

    function parseJson(text) {
        if (!text) {
            return null;
        }
        try {
            return JSON.parse(text);
        } catch (error) {
            return null;
        }
    }

    function buildError(response) {
        var message = response && response.data && response.data.error ? response.data.error : "请求失败。";
        var error = new Error(message);
        error.status = response ? response.status : 0;
        error.response = response;
        return error;
    }

    function requestSync(method, url, body) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url, false);
        xhr.withCredentials = true;

        var headers = buildHeaders(body);
        Object.keys(headers).forEach(function (key) {
            xhr.setRequestHeader(key, headers[key]);
        });

        try {
            xhr.send(body !== null && typeof body !== "undefined" ? JSON.stringify(body) : null);
        } catch (error) {
            throw new Error("无法连接到服务器。");
        }

        var response = {
            status: xhr.status,
            ok: xhr.status >= 200 && xhr.status < 300,
            text: xhr.responseText || "",
            data: parseJson(xhr.responseText || "")
        };

        if (!response.ok) {
            throw buildError(response);
        }
        return response.data;
    }

    async function request(method, url, body) {
        var response;

        try {
            response = await fetch(url, {
                method: method,
                credentials: "same-origin",
                headers: buildHeaders(body),
                body: body !== null && typeof body !== "undefined" ? JSON.stringify(body) : undefined
            });
        } catch (error) {
            throw new Error("无法连接到服务器。");
        }

        var text = await response.text();
        var parsed = parseJson(text);
        var result = {
            status: response.status,
            ok: response.ok,
            text: text,
            data: parsed
        };

        if (!result.ok) {
            throw buildError(result);
        }
        return result.data;
    }

    function getMeSync() {
        return requestSync("GET", "/api/auth/me");
    }

    function getWorkbooksSync() {
        return requestSync("GET", "/api/workbooks");
    }

    function loadWorkbookSync(id) {
        return requestSync("GET", "/api/workbooks/" + encodeURIComponent(id));
    }

    function saveWorkbookSync(id, snapshot) {
        return requestSync("PUT", "/api/workbooks/" + encodeURIComponent(id), {
            data: snapshot
        });
    }

    function importWorkbookSync(id, payload) {
        return requestSync("POST", "/api/workbooks/" + encodeURIComponent(id) + "/import", payload);
    }

    function clearWorkbookSync(id) {
        return requestSync("POST", "/api/workbooks/" + encodeURIComponent(id) + "/clear", {});
    }

    window.DataDashboardApi = {
        __requestSync: requestSync,
        __getMeSync: getMeSync,
        __getWorkbooksSync: getWorkbooksSync,
        __loadWorkbookSync: loadWorkbookSync,
        __saveWorkbookSync: saveWorkbookSync,
        __importWorkbookSync: importWorkbookSync,
        __clearWorkbookSync: clearWorkbookSync,
        login: function (username, password) {
            return request("POST", "/api/auth/login", {
                username: username,
                password: password
            });
        },
        logout: function () {
            return request("POST", "/api/auth/logout", {});
        },
        getMe: function () {
            return request("GET", "/api/auth/me");
        },
        getWorkbooks: function () {
            return request("GET", "/api/workbooks");
        },
        loadWorkbook: function (id) {
            return request("GET", "/api/workbooks/" + encodeURIComponent(id));
        },
        saveWorkbook: function (id, snapshot) {
            return request("PUT", "/api/workbooks/" + encodeURIComponent(id), {
                data: snapshot
            });
        },
        importWorkbook: function (id, payload) {
            return request("POST", "/api/workbooks/" + encodeURIComponent(id) + "/import", payload);
        },
        clearWorkbook: function (id) {
            return request("POST", "/api/workbooks/" + encodeURIComponent(id) + "/clear", {});
        },
        exportAllBackups: function () {
            return request("GET", "/api/admin/backups/export");
        },
        importAllBackups: function (payload) {
            return request("POST", "/api/admin/backups/import", payload);
        },
        listUsers: function () {
            return request("GET", "/api/admin/users");
        },
        createUser: function (payload) {
            return request("POST", "/api/admin/users", payload);
        },
        updateUser: function (id, payload) {
            return request("PATCH", "/api/admin/users/" + encodeURIComponent(id), payload);
        },
        resetPassword: function (id, payload) {
            return request("POST", "/api/admin/users/" + encodeURIComponent(id) + "/reset-password", payload);
        },
        getRoleTemplatePermissions: function () {
            return request("GET", "/api/admin/role-template-permissions");
        },
        setRoleTemplatePermissions: function (payload) {
            return request("PUT", "/api/admin/role-template-permissions", payload);
        }
    };
})();
