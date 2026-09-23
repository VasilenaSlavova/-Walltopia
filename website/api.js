/* Thin client for the accounts, projects and support API (same-origin /api).
   Works only when the site is served by the Node server; on a static host these
   calls fail and the caller degrades gracefully (the calculator still works). */
(function () {
  "use strict";
  var BASE = "/api";

  async function req(method, path, body, timeoutMs) {
    var res;
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeout = controller && timeoutMs ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;
    try {
      res = await fetch(BASE + path, {
        method: method,
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller ? controller.signal : undefined,
      });
    } catch (e) {
      if (e && e.name === "AbortError") {
        throw new ApiError("The server is taking too long to respond. Check the project history before trying again.", 0);
      }
      throw new ApiError("Can't reach the server. Start the account server (server/) to use projects.", 0);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new ApiError((data && data.error) || ("Request failed (" + res.status + ")"), res.status);
    return data;
  }

  function ApiError(message, status) { this.message = message; this.status = status; this.name = "ApiError"; }
  ApiError.prototype = Object.create(Error.prototype);

  window.WTApi = {
    ApiError: ApiError,
    // auth
    me: function () { return req("GET", "/auth/me"); },
    register: function (name, email, password) { return req("POST", "/auth/register", { name: name, email: email, password: password }); },
    login: function (email, password) { return req("POST", "/auth/login", { email: email, password: password }); },
    logout: function () { return req("POST", "/auth/logout"); },
    // projects
    listProjects: function (params) {
      var qs = new URLSearchParams();
      if (params) Object.keys(params).forEach(function (k) { if (params[k]) qs.set(k, params[k]); });
      var s = qs.toString();
      return req("GET", "/projects" + (s ? "?" + s : ""));
    },
    listTags: function () { return req("GET", "/projects/meta/tags"); },
    getProject: function (id) { return req("GET", "/projects/" + id); },
    createProject: function (p) { return req("POST", "/projects", p); },
    updateProject: function (id, p) { return req("PUT", "/projects/" + id, p); },
    deleteProject: function (id) { return req("DELETE", "/projects/" + id); },
    sendSupportInquiry: function (id, message) { return req("POST", "/projects/" + id + "/support-inquiries", { message: message }, 60000); },
  };
})();
