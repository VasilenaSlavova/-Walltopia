/* My Projects dashboard: filterable list of the user's saved designs. */
(function () {
  "use strict";
  var body = document.getElementById("dash-body");
  var sub = document.getElementById("dash-sub");
  var filters = { q: "", tag: "", sort: "updated" };
  var selected = new Set();
  var selectionMode = false;
  var currentProjects = [];
  var debounce;
  var PROJECT_RETURN_KEY = "walltopia.projects.return.v1";
  var projectReturnState = null;
  try {
    projectReturnState = JSON.parse(sessionStorage.getItem(PROJECT_RETURN_KEY) || "null");
    if (projectReturnState && projectReturnState.filters) filters = Object.assign(filters, projectReturnState.filters);
  } catch (error) {}
  if (!projectReturnState) {
    var focusedProject = new URLSearchParams(location.search).get("focus");
    if (focusedProject) projectReturnState = { id: focusedProject, scrollY: 0, filters: filters };
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function guestView() {
    var modeButton = document.getElementById("toggle-project-selection");
    if (modeButton) modeButton.hidden = true;
    sub.textContent = "Saved load designs";
    body.innerHTML =
      '<div class="dash-guest"><h2>Log in to see your projects</h2>'
      + "<p>Save any calculation as a project, organise it with tags and additional project information, and reopen it to review or edit the numbers.</p>"
      + '<button class="btn primary" id="dg-login">Log in or register</button></div>';
    body.querySelector("#dg-login").onclick = function () { window.WTAuth.open("register"); };
  }

  async function load() {
    var user = window.WTAuth && window.WTAuth.current();
    if (!user) return guestView();
    try {
      var tagsRes = await window.WTApi.listTags();
      var res = await window.WTApi.listProjects(filters);
      render(res.projects, tagsRes.tags || [], user);
    } catch (e) {
      body.innerHTML = '<div class="dash-empty">' + esc(e.message || "Could not load projects.") + "</div>";
    }
  }

  function render(projects, tags, user) {
    currentProjects = projects;
    var visibleIds = new Set(projects.map(function (p) { return String(p.id); }));
    selected.forEach(function (id) { if (!visibleIds.has(id)) selected.delete(id); });
    sub.textContent = projects.length
      ? projects.length + (projects.length === 1 ? " project" : " projects")
      : "No projects yet";

    var toolbar =
      '<div class="dash-toolbar">'
      + '<button class="btn small dash-select-btn" id="toggle-project-selection" type="button"' + (projects.length ? "" : " hidden") + '>Select</button>'
      + '<span class="dash-search"><span class="dash-search-icon" aria-hidden="true"></span><input type="search" id="f-q" placeholder="Search projects" aria-label="Search projects by name, tag or project information" value="' + esc(filters.q) + '" /></span>'
      + '<span class="lbl">Tag</span><select id="f-tag"><option value="">All</option>'
      + tags.slice(0, 6).map(function (t) { return '<option value="' + esc(t) + '"' + (t === filters.tag ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("")
      + "</select>"
      + '<span class="lbl">Sort</span><select id="f-sort">'
      + [["updated", "Recently updated"], ["created", "Newest"], ["name", "Name A–Z"]].map(function (o) {
          return '<option value="' + o[0] + '"' + (o[0] === filters.sort ? " selected" : "") + ">" + o[1] + "</option>";
        }).join("")
      + '</select></div>';

    var grid;
    if (!projects.length) {
      grid = '<div class="dash-empty">'
        + (filters.q || filters.tag ? "No projects match these filters. " : "You haven't saved any projects yet. ")
        + '<a href="index.html">Open the calculator</a> and save a design.</div>';
    } else {
      grid = '<div class="proj-grid">' + projects.map(card).join("") + "</div>";
    }
    var selectionBar = selectionMode && projects.length
      ? '<div class="dash-toolbar bulk-selection-bar"><label class="bulk-select-all"><input type="checkbox" id="select-all-projects"' + (selected.size === projects.length ? " checked" : "") + '> Select all</label><button class="bulk-selection-close" id="cancel-project-selection" type="button" aria-label="Cancel selection" title="Cancel selection">&times;</button><strong id="selected-project-count">' + selected.size + ' selected</strong><button class="btn small primary" id="export-selected-projects" type="button"' + (selected.size > 1 ? "" : " disabled") + '>Export ZIP</button><button class="btn small bulk-delete-btn" id="delete-selected-projects" type="button"' + (selected.size ? "" : " disabled") + '>Delete</button></div>'
      : "";
    body.innerHTML = (selectionMode ? selectionBar : toolbar) + grid;
    wireToolbar();
    wireCards();
    restoreProjectPosition();
  }

  function restoreProjectPosition() {
    if (!projectReturnState) return;
    var state = projectReturnState;
    projectReturnState = null;
    try { sessionStorage.removeItem(PROJECT_RETURN_KEY); } catch (error) {}
    requestAnimationFrame(function () {
      window.scrollTo(0, Number(state.scrollY) || 0);
      var card = body.querySelector('.proj-card[data-id="' + String(state.id) + '"]');
      if (card) {
        var rect = card.getBoundingClientRect();
        if (rect.top < 90 || rect.bottom > window.innerHeight - 30) card.scrollIntoView({ block: "center" });
        card.classList.add("is-returned");
        setTimeout(function () { card.classList.remove("is-returned"); }, 1200);
      }
      var message = null;
      try { message = sessionStorage.getItem("walltopia.projects.flash"); sessionStorage.removeItem("walltopia.projects.flash"); } catch (error) {}
      if (message) showProjectMessage(message);
    });
  }

  function showProjectMessage(message) {
    var toast = document.createElement("div");
    toast.className = "project-return-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add("is-visible"); });
    setTimeout(function () { toast.classList.remove("is-visible"); setTimeout(function () { toast.remove(); }, 180); }, 2200);
  }

  function card(p) {
    var snap = p.snapshot || {};
    var when = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "";
    var tagChips = (p.tags || []).slice(0, 6).map(function (t) { return '<span class="tag-chip" data-tag="' + esc(t) + '">' + esc(t) + "</span>"; }).join("");
    var propChips = (p.properties || []).slice(0, 4).map(function (pr) {
      return '<span class="tag-chip prop">' + esc(pr.key) + (pr.value ? ": " + esc(pr.value) : "") + "</span>";
    }).join("");
    var isSelected = selected.has(String(p.id));
    return '<div class="proj-card' + (isSelected ? ' is-selected' : '') + (selectionMode ? ' is-selectable' : '') + '" data-id="' + p.id + '">'
      + (selectionMode ? '<label class="project-selector" title="Select ' + esc(p.name) + '"><input type="checkbox" data-select-project="' + p.id + '"' + (isSelected ? " checked" : "") + '><span>Select project</span></label>' : '')
      + "<h3>" + esc(p.name) + "</h3>"
      + '<div class="meta">' + esc(snap.title || "") + (when ? " · updated " + when : "") + "</div>"
      + (tagChips ? '<div class="tags">' + tagChips + "</div>" : "")
      + (propChips ? '<div class="tags">' + propChips + "</div>" : "")
      + '<div class="card-actions"><a class="btn small primary" data-open-project="' + p.id + '" href="index.html?project=' + p.id + '">Open &amp; edit</a>'
      + '<button class="btn small" type="button" data-export="' + p.id + '">Export PDF</button>'
      + '<a class="btn small" href="ask-engineer.html?project=' + p.id + '">Request support</a>'
      + '<button class="btn small" data-del="' + p.id + '">Delete</button></div>'
      + "</div>";
  }

  function wireToolbar() {
    var modeButton = document.getElementById("toggle-project-selection");
    if (modeButton) modeButton.onclick = function () { switchSelectionMode(true); };
    var q = document.getElementById("f-q");
    if (q) q.oninput = function () { clearTimeout(debounce); debounce = setTimeout(function () { filters.q = q.value.trim(); load(); }, 300); };
    var tag = document.getElementById("f-tag");
    if (tag) tag.onchange = function () { filters.tag = tag.value; load(); };
    var sort = document.getElementById("f-sort");
    if (sort) sort.onchange = function () { filters.sort = sort.value; load(); };
    var selectAll = document.getElementById("select-all-projects");
    if (selectAll) selectAll.onchange = function () {
      body.querySelectorAll(".proj-card[data-id]").forEach(function (card) {
        var id = String(card.getAttribute("data-id"));
        if (selectAll.checked) selected.add(id); else selected.delete(id);
      });
      refreshSelectionUi();
    };
    var deleteSelected = document.getElementById("delete-selected-projects");
    if (deleteSelected) deleteSelected.onclick = async function () {
      var ids = Array.from(selected);
      if (!ids.length || !confirm("Delete " + ids.length + " selected project" + (ids.length === 1 ? "" : "s") + "? This cannot be undone.")) return;
      deleteSelected.disabled = true;
      deleteSelected.textContent = "Deleting…";
      var results = await Promise.allSettled(ids.map(function (id) { return window.WTApi.deleteProject(id); }));
      var failed = [];
      results.forEach(function (result, index) { if (result.status === "rejected") failed.push(ids[index]); });
      selected = new Set(failed);
      if (!failed.length) selectionMode = false;
      await load();
      if (failed.length) alert(failed.length + " project" + (failed.length === 1 ? "" : "s") + " could not be deleted. Please try again.");
    };
    var exportSelected = document.getElementById("export-selected-projects");
    if (exportSelected) exportSelected.onclick = async function () {
      var projects = currentProjects.filter(function (project) { return selected.has(String(project.id)); });
      if (projects.length < 2) return;
      exportSelected.disabled = true;
      try {
        var files = [];
        for (var i = 0; i < projects.length; i++) {
          exportSelected.textContent = "Preparing " + (i + 1) + "/" + projects.length + "…";
          files.push(await renderProjectPdf(projects[i]));
        }
        var bytes = window.WTZip.create(uniqueFileNames(files));
        var url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
        var link = document.createElement("a");
        link.href = url;
        link.download = "Walltopia Preliminary Loads - " + projects.length + " Projects.zip";
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      } catch (error) {
        alert(error.message || "The ZIP file could not be created.");
      } finally {
        exportSelected.disabled = false;
        exportSelected.textContent = "Export ZIP";
      }
    };
    var cancelSelection = document.getElementById("cancel-project-selection");
    if (cancelSelection) cancelSelection.onclick = function () { switchSelectionMode(false); };
  }

  function switchSelectionMode(nextMode) {
    if (selectionMode === nextMode) return;
    selectionMode = nextMode;
    selected.clear();
    load();
  }

  function refreshSelectionUi() {
    body.querySelectorAll(".proj-card[data-id]").forEach(function (card) {
      var id = String(card.getAttribute("data-id"));
      var isSelected = selected.has(id);
      card.classList.toggle("is-selected", isSelected);
      var box = card.querySelector("[data-select-project]");
      if (box) box.checked = isSelected;
    });
    var count = document.getElementById("selected-project-count");
    if (count) count.textContent = selected.size + " selected";
    var selectAll = document.getElementById("select-all-projects");
    if (selectAll) selectAll.checked = currentProjects.length > 0 && selected.size === currentProjects.length;
    var exportSelected = document.getElementById("export-selected-projects");
    if (exportSelected) exportSelected.disabled = selected.size < 2;
    var deleteSelected = document.getElementById("delete-selected-projects");
    if (deleteSelected) deleteSelected.disabled = selected.size === 0;
  }

  function uniqueFileNames(files) {
    var used = Object.create(null);
    return files.map(function (file) {
      var name = file.name, key = name.toLowerCase(), count = used[key] || 0;
      used[key] = count + 1;
      if (count) name = name.replace(/\.pdf$/i, " (" + (count + 1) + ").pdf");
      return { name: name, data: file.data };
    });
  }

  function renderProjectPdf(project) {
    return new Promise(function (resolve, reject) {
      var requestId = "zip-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      var frame = document.createElement("iframe"), timer;
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none";
      function finish(error, file) {
        clearTimeout(timer); window.removeEventListener("message", onMessage);
        if (frame.isConnected) frame.remove();
        if (error) reject(error); else resolve(file);
      }
      function onMessage(event) {
        if (event.origin !== location.origin || !event.data || event.data.requestId !== requestId) return;
        if (event.data.type === "wt-pdf-error") finish(new Error(event.data.message || "Could not create a project PDF."));
        if (event.data.type === "wt-pdf-ready") finish(null, { name: event.data.fileName, data: new Uint8Array(event.data.buffer) });
      }
      window.addEventListener("message", onMessage);
      timer = setTimeout(function () { finish(new Error('PDF export timed out for "' + project.name + '".')); }, 45000);
      frame.src = "index.html?project=" + encodeURIComponent(project.id) + "&export=pdf&bulk=" + encodeURIComponent(requestId) + "&ts=" + Date.now();
      document.body.appendChild(frame);
    });
  }

  function wireCards() {
    body.querySelectorAll("[data-open-project]").forEach(function (link) {
      link.addEventListener("click", function () {
        try { sessionStorage.setItem(PROJECT_RETURN_KEY, JSON.stringify({ id: link.getAttribute("data-open-project"), scrollY: window.scrollY, filters: filters })); } catch (error) {}
      });
    });
    body.querySelectorAll("[data-select-project]").forEach(function (box) {
      box.onchange = function () {
        var id = String(box.getAttribute("data-select-project"));
        if (box.checked) selected.add(id); else selected.delete(id);
        refreshSelectionUi();
      };
    });
    body.querySelectorAll(".proj-card.is-selectable").forEach(function (card) {
      card.onclick = function (event) {
        if (event.target.closest("a,button,input,label,.tag-chip")) return;
        var id = String(card.getAttribute("data-id"));
        if (selected.has(id)) selected.delete(id); else selected.add(id);
        refreshSelectionUi();
      };
    });
    body.querySelectorAll(".tag-chip[data-tag]").forEach(function (c) {
      c.onclick = function () { filters.tag = c.getAttribute("data-tag"); load(); };
    });
    body.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = async function () {
        var id = b.getAttribute("data-del");
        var card = b.closest(".proj-card");
        var name = card ? card.querySelector("h3").textContent : "this project";
        if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;
        b.disabled = true;
        try { await window.WTApi.deleteProject(id); load(); }
        catch (e) { alert(e.message || "Could not delete."); b.disabled = false; }
      };
    });
    body.querySelectorAll("[data-export]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-export");
        var frame = document.createElement("iframe");
        frame.setAttribute("aria-hidden", "true");
        frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none";
        frame.src = "index.html?project=" + encodeURIComponent(id) + "&export=pdf&v=wt13&ts=" + Date.now();
        b.disabled = true;
        b.textContent = "Preparing PDF…";
        document.body.appendChild(frame);
        var finished = false;
        function resetButton() {
          if (finished) return;
          finished = true;
          if (frame.isConnected) frame.remove();
          b.disabled = false;
          b.textContent = "Export PDF";
        }
        var watch = setInterval(function () {
          if (!frame.isConnected) {
            clearInterval(watch);
            resetButton();
          }
        }, 500);
        setTimeout(function () { clearInterval(watch); resetButton(); }, 20000);
      };
    });
  }

  window.WTAuth ? window.WTAuth.onChange(load) : null;
  // initial (auth-ui fires wtauth:change once it resolves the session; also try now)
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();
