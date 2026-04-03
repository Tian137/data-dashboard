(function () {
    var authState = window.__adminAuth || window.DataDashboardAuth.getAuth();
    var statusNode = document.getElementById("adminStatus");
    var usersTableBody = document.querySelector("#usersTable tbody");
    var permissionsMount = document.getElementById("permissionsMount");
    var createForm = document.getElementById("createUserForm");
    var savePermissionsButton = document.getElementById("savePermissionsButton");
    var exportBackupButton = document.getElementById("exportBackupButton");
    var importBackupInput = document.getElementById("importBackupInput");

    if (!authState) {
        return;
    }

    document.getElementById("adminCurrentUser").textContent = authState.username + " / " + authState.role;
    document.getElementById("adminLogoutButton").addEventListener("click", function () {
        window.DataDashboardAuth.logout("./index.html");
    });

    function setStatus(message) {
        if (!message) {
            statusNode.hidden = true;
            statusNode.textContent = "";
            return;
        }
        statusNode.hidden = false;
        statusNode.textContent = message;
    }

    function getErrorMessage(error, fallback) {
        if (error && typeof error.message === "string" && error.message.trim()) {
            return error.message.trim();
        }
        if (error && error.response && error.response.data && error.response.data.error) {
            return String(error.response.data.error);
        }
        return fallback || "操作失败，请稍后重试。";
    }

    function setButtonBusy(button, busy, busyText) {
        if (!button) {
            return;
        }
        var defaultText = button.getAttribute("data-default-text") || button.textContent;
        button.setAttribute("data-default-text", defaultText);
        button.disabled = Boolean(busy);
        button.textContent = busy ? (busyText || "处理中...") : defaultText;
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }
        return new Date(value).toLocaleString("zh-CN", { hour12: false });
    }

    function renderUsers(users) {
        usersTableBody.innerHTML = users.map(function (user) {
            return [
                "<tr>",
                "<td>" + window.DataDashboardUtils.escapeHtml(user.username) + "</td>",
                "<td>",
                '<div class="admin-user-row-actions">',
                '<select data-user-id="' + user.id + '" data-field="role">',
                ['super_admin', 'admin', 'data_entry'].map(function (role) {
                    return '<option value="' + role + '"' + (role === user.role ? " selected" : "") + ">" + role + "</option>";
                }).join(""),
                "</select>",
                '<select data-user-id="' + user.id + '" data-field="status">',
                ['active', 'disabled'].map(function (status) {
                    return '<option value="' + status + '"' + (status === user.status ? " selected" : "") + ">" + status + "</option>";
                }).join(""),
                "</select>",
                '<input type="password" placeholder="新密码" data-user-id="' + user.id + '" data-field="password">',
                '<button class="admin-primary" type="button" data-user-id="' + user.id + '" data-action="save-user">保存</button>',
                "</div>",
                "</td>",
                "<td>" + window.DataDashboardUtils.escapeHtml(user.status) + "</td>",
                "<td>" + window.DataDashboardUtils.escapeHtml(formatDate(user.lastLoginAt)) + "</td>",
                "<td><button class=\"admin-primary\" type=\"button\" data-user-id=\"" + user.id + "\" data-action=\"reset-password-inline\">重置密码</button></td>",
                "</tr>"
            ].join("");
        }).join("");
    }

    function renderPermissions(payload) {
        permissionsMount.innerHTML = payload.roles.map(function (role) {
            return [
                '<section class="admin-permission-card">',
                "<h3>" + window.DataDashboardUtils.escapeHtml(role) + "</h3>",
                '<div class="admin-permission-grid">',
                payload.workbooks.map(function (workbook) {
                    var checked = payload.permissions[role] && payload.permissions[role].indexOf(workbook.id) !== -1;
                    return '<label><input type="checkbox" data-role-name="' + role + '" data-workbook-id="' + workbook.id + '"' + (checked ? " checked" : "") + "> " + window.DataDashboardUtils.escapeHtml(workbook.title) + "</label>";
                }).join(""),
                "</div>",
                "</section>"
            ].join("");
        }).join("");
    }

    async function reloadUsers() {
        renderUsers(await window.DataDashboardApi.listUsers());
    }

    async function reloadPermissions() {
        renderPermissions(await window.DataDashboardApi.getRoleTemplatePermissions());
    }

    createForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        var username = document.getElementById("createUsername").value.trim();
        var password = document.getElementById("createPassword").value.trim();
        var role = document.getElementById("createRole").value;
        var submitButton = createForm.querySelector("button[type='submit']");

        if (!username || !password) {
            setStatus("请输入用户名和初始密码。");
            return;
        }

        try {
            setButtonBusy(submitButton, true, "创建中...");
            await window.DataDashboardApi.createUser({
                username: username,
                password: password,
                role: role
            });

            createForm.reset();
            setStatus("账号已创建。");
            await reloadUsers();
        } catch (error) {
            setStatus(getErrorMessage(error, "创建账号失败。"));
        } finally {
            setButtonBusy(submitButton, false);
        }
    });

    usersTableBody.addEventListener("click", async function (event) {
        var button = event.target.closest("[data-action]");
        if (!button) {
            return;
        }
        var userId = button.getAttribute("data-user-id");

        try {
            if (button.getAttribute("data-action") === "save-user") {
                var rowRoot = button.closest(".admin-user-row-actions");
                var role = rowRoot.querySelector("[data-field='role']").value;
                var status = rowRoot.querySelector("[data-field='status']").value;
                var password = rowRoot.querySelector("[data-field='password']").value.trim();

                setButtonBusy(button, true, "保存中...");
                await window.DataDashboardApi.updateUser(userId, {
                    role: role,
                    status: status
                });

                if (password) {
                    await window.DataDashboardApi.resetPassword(userId, { password: password });
                }

                setStatus("账号已更新。");
                await reloadUsers();
            }

            if (button.getAttribute("data-action") === "reset-password-inline") {
                var nextPassword = window.prompt("输入新密码");
                if (!nextPassword) {
                    return;
                }

                setButtonBusy(button, true, "重置中...");
                await window.DataDashboardApi.resetPassword(userId, {
                    password: nextPassword
                });
                setStatus("密码已重置。");
            }
        } catch (error) {
            setStatus(getErrorMessage(error, "账号操作失败。"));
        } finally {
            setButtonBusy(button, false);
        }
    });

    savePermissionsButton.addEventListener("click", async function () {
        var payload = {
            permissions: {
                admin: [],
                data_entry: []
            }
        };

        permissionsMount.querySelectorAll("input[type='checkbox']").forEach(function (input) {
            if (input.checked) {
                payload.permissions[input.getAttribute("data-role-name")].push(input.getAttribute("data-workbook-id"));
            }
        });

        try {
            setButtonBusy(savePermissionsButton, true, "保存中...");
            await window.DataDashboardApi.setRoleTemplatePermissions(payload);
            setStatus("模板权限已保存。");
        } catch (error) {
            setStatus(getErrorMessage(error, "保存模板权限失败。"));
        } finally {
            setButtonBusy(savePermissionsButton, false);
        }
    });

    exportBackupButton.addEventListener("click", async function () {
        try {
            setButtonBusy(exportBackupButton, true, "导出中...");
            var payload = await window.DataDashboardApi.exportAllBackups();
            window.DataDashboardUtils.downloadJson("data-dashboard_backup.json", payload);
            setStatus("已导出全部备份。");
        } catch (error) {
            setStatus(getErrorMessage(error, "导出备份失败。"));
        } finally {
            setButtonBusy(exportBackupButton, false);
        }
    });

    importBackupInput.addEventListener("change", async function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }

        try {
            var text = await window.DataDashboardUtils.readTextFile(file);
            var payload = JSON.parse(text);
            await window.DataDashboardApi.importAllBackups(payload);
            setStatus("已导入全部备份。");
            await reloadUsers();
            await reloadPermissions();
        } catch (error) {
            setStatus(getErrorMessage(error, "导入备份失败。"));
        } finally {
            event.target.value = "";
        }
    });

    Promise.all([reloadUsers(), reloadPermissions()]).catch(function (error) {
        setStatus(error && error.message ? error.message : "后台数据加载失败。");
    });
})();
