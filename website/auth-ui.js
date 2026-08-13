/* Shared auth surface: masthead account area (#auth-slot) + login/register modal.
   Exposes window.WTAuth. Fires window event "wtauth:change" (detail = user|null). */
(function () {
  "use strict";
  var AUTH_PREVIEW_KEY = "walltopia_auth_preview";
  var current = null;          // user object, or null when guest
  var hasAuthPreview = false;
  try {
    var authPreview = localStorage.getItem(AUTH_PREVIEW_KEY);
    if (authPreview === null) authPreview = sessionStorage.getItem(AUTH_PREVIEW_KEY);
    if (authPreview !== null) {
      current = authPreview === "guest" ? null : JSON.parse(authPreview);
      hasAuthPreview = true;
    }
  } catch (e) {}
  var pending = [];            // resolvers waiting on requireAuth()
  var modal, form, errEl, mode = "login";
  var readyResolve, ready = new Promise(function (r) { readyResolve = r; }); // resolves after first session check

  function h(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (html != null) el.innerHTML = html;
    return el;
  }

  function buildModal() {
    modal = h("div", { class: "wt-modal-backdrop", hidden: "" });
    modal.innerHTML =
      '<div class="wt-modal" role="dialog" aria-modal="true" aria-labelledby="wt-modal-title">' +
      '  <button class="wt-modal-close" aria-label="Close">&times;</button>' +
      '  <div class="wt-tabs" role="tablist">' +
      '    <button type="button" data-mode="login">Log in</button>' +
      '    <button type="button" data-mode="register">Register</button>' +
      '  </div>' +
      '  <h2 id="wt-modal-title" class="wt-modal-title"></h2>' +
      '  <form id="wt-auth-form" novalidate>' +
      '    <label class="wt-field reg-only"><span>Name</span><input name="name" autocomplete="name" /></label>' +
      '    <label class="wt-field"><span>Email</span><input name="email" type="email" autocomplete="email" /></label>' +
      '    <label class="wt-field"><span>Password</span><input name="password" type="password" autocomplete="current-password" /></label>' +
      '    <p class="wt-error" hidden></p>' +
      '    <button type="submit" class="wt-submit"></button>' +
      '    <p class="wt-switch"></p>' +
      '  </form>' +
      '</div>';
    document.body.appendChild(modal);
    form = modal.querySelector("#wt-auth-form");
    errEl = modal.querySelector(".wt-error");

    modal.querySelector(".wt-modal-close").onclick = close;
    modal.addEventListener("mousedown", function (e) { if (e.target === modal) close(); });
    modal.querySelectorAll(".wt-tabs button").forEach(function (b) {
      b.onclick = function () { setMode(b.getAttribute("data-mode")); };
    });
    modal.querySelector(".wt-switch").addEventListener("click", function (e) {
      if (e.target.tagName === "A") { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); }
    });
    form.addEventListener("submit", onSubmit);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) close(); });
  }

  function setMode(m) {
    mode = m;
    modal.querySelectorAll(".wt-tabs button").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.getAttribute("data-mode") === m));
    });
    var reg = m === "register";
    modal.querySelector(".wt-modal-title").textContent = reg ? "Create your account" : "Welcome back";
    modal.querySelector(".reg-only").style.display = reg ? "" : "none";
    modal.querySelector('input[name="password"]').setAttribute("autocomplete", reg ? "new-password" : "current-password");
    modal.querySelector(".wt-submit").textContent = reg ? "Create account" : "Log in";
    modal.querySelector(".wt-switch").innerHTML = reg
      ? 'Already have an account? <a href="#">Log in</a>'
      : "New here? <a href=\"#\">Create an account</a>";
    hideErr();
  }

  function open(m) {
    if (!modal) buildModal();
    setMode(m || "login");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    var first = modal.querySelector(mode === "register" ? 'input[name="name"]' : 'input[name="email"]');
    if (first) setTimeout(function () { first.focus(); }, 30);
  }
  function close() {
    if (modal) modal.hidden = true;
    document.body.style.overflow = "";
    // reject any waiters that never authed
    var waiters = pending; pending = [];
    waiters.forEach(function (p) { if (current) p.resolve(current); else p.reject(new Error("cancelled")); });
  }
  function showErr(msg) { errEl.textContent = msg; errEl.hidden = false; }
  function hideErr() { errEl.hidden = true; }

  async function onSubmit(e) {
    e.preventDefault();
    hideErr();
    var f = new FormData(form);
    var email = (f.get("email") || "").trim();
    var password = f.get("password") || "";
    var name = (f.get("name") || "").trim();
    var btn = modal.querySelector(".wt-submit");
    btn.disabled = true; btn.textContent = "Please wait…";
    try {
      var res = mode === "register"
        ? await window.WTApi.register(name, email, password)
        : await window.WTApi.login(email, password);
      setUser(res.user);
      var waiters = pending; pending = [];
      waiters.forEach(function (p) { p.resolve(res.user); });
      modal.hidden = true; document.body.style.overflow = "";
      form.reset();
    } catch (err) {
      showErr(err.message || "Something went wrong");
    } finally {
      btn.disabled = false;
      setMode(mode);
    }
  }

  function setUser(u) {
    var previous = current;
    var hadAuthPreview = hasAuthPreview;
    current = u || null;
    hasAuthPreview = true;
    try {
      localStorage.setItem(AUTH_PREVIEW_KEY, current ? JSON.stringify(current) : "guest");
      sessionStorage.removeItem(AUTH_PREVIEW_KEY);
    } catch (e) {}
    var unchanged = hadAuthPreview && previous === null && current === null;
    if (previous && current) {
      unchanged = String(previous.id || previous._id || "") === String(current.id || current._id || "")
        && previous.name === current.name && previous.email === current.email;
    }
    if (!unchanged) renderSlot();
    // if a session was discovered while requireAuth() was waiting, satisfy those waiters
    if (current && pending.length) {
      var waiters = pending; pending = [];
      waiters.forEach(function (p) { p.resolve(current); });
      if (modal) { modal.hidden = true; document.body.style.overflow = ""; }
    }
    window.dispatchEvent(new CustomEvent("wtauth:change", { detail: current }));
  }

  function renderSlot() {
    var slot = document.getElementById("auth-slot");
    if (!slot) return;
    slot.innerHTML = "";
    if (current) {
      var wrap = h("div", { class: "auth-user" });
      var initials = (current.name || "?").trim().charAt(0).toUpperCase();
      wrap.appendChild(h("a", { href: "dashboard.html", class: "auth-name", title: current.email },
        '<span class="auth-avatar">' + initials + "</span>" + escapeHtml(current.name)));
      var out = h("button", { class: "auth-btn ghost", type: "button" }, "Log out");
      out.onclick = async function () { try { await window.WTApi.logout(); } catch (e) {} setUser(null); };
      wrap.appendChild(out);
      slot.appendChild(wrap);
    } else {
      var signIn = h("button", { class: "auth-btn solid", type: "button" }, "Sign in");
      signIn.onclick = function () { open("login"); };
      slot.appendChild(signIn);
    }
  }

  function renderLoadingSlot() {
    var slot = document.getElementById("auth-slot");
    if (!slot) return;
    slot.innerHTML = '<span class="auth-loading" role="status" aria-label="Checking account status"></span>';
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  window.WTAuth = {
    current: function () { return current; },
    ready: ready,
    open: open,
    logout: async function () { try { await window.WTApi.logout(); } catch (e) {} setUser(null); },
    // resolves with the user (opens modal if needed); rejects if the user cancels
    requireAuth: function (m) {
      if (current) return Promise.resolve(current);
      return new Promise(function (resolve, reject) { pending.push({ resolve: resolve, reject: reject }); open(m || "login"); });
    },
    onChange: function (cb) { window.addEventListener("wtauth:change", function (e) { cb(e.detail); }); },
  };

  // boot: discover current session
  async function init() {
    if (hasAuthPreview) renderSlot();
    else renderLoadingSlot();
    if (!window.WTApi) {
      setUser(null);
      readyResolve(current);
      return;
    }
    try {
      var res = await window.WTApi.me();
      setUser(res.user);
    } catch (e) {
      // Only an explicit authentication rejection means the session is gone.
      // Keep the last confirmed preview during temporary network/database errors.
      if (e && e.status === 401) setUser(null);
      else if (!hasAuthPreview) setUser(null);
    }
    readyResolve(current);
  }
  // The script is loaded after the masthead, so render the saved account state
  // immediately instead of waiting for DOMContentLoaded and causing a flash.
  init();
})();
