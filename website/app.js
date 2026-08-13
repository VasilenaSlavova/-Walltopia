/* Walltopia preliminary-loads applicability tool.
   Reads window.WALLTOPIA_LOADS (from data.js) and drives a faithful reproduction
   of the Excel lookup: pick units, structure type, height/scheme, span A and
   overhang X -> read characteristic loads on ACS axis (R) and building columns (L),
   dead (DL) + live (LL). Optional factoring and a capacity pass/fail check. */
(function () {
  "use strict";
  var DATA = window.WALLTOPIA_LOADS;
  if (!DATA) { document.getElementById("result-root").innerHTML =
      '<div class="empty">Could not load data.js.</div>'; return; }

  // ---- state ----
  var S = { units: "EU", type: "wall", height: null, levels: null,
            span: null, overhang: null, force: null, factored: false, cap: null };
  var selectedInputs = { units: false, type: false, height: false, levels: false, span: false, overhang: false, force: false };
  var CALCULATOR_DRAFT_KEY = "walltopia.calculator.draft.v1";
  var schematicView = { scale: 1, panX: 0, panY: 0 };

  // ---- derive option sets ----
  // wall height -> sorted list of available schemes (levels)
  var wallSchemes = {};        // { 8:[1,2], 9:[2], 12:[2,3], ... }
  Object.keys(DATA.walls).forEach(function (k) {
    var w = DATA.walls[k];
    (wallSchemes[w.height] = wallSchemes[w.height] || []).push(w.levels);
  });
  Object.keys(wallSchemes).forEach(function (h) { wallSchemes[h].sort(function (a, b) { return a - b; }); });
  var wallHeights = Object.keys(wallSchemes).map(Number).sort(function (a, b) { return a - b; });
  var boulderHeights = uniq(DATA.boulder.rows.map(function (r) { return r.z; })).sort(num);

  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function num(a, b) { return a - b; }

  function wallKey(h, lv) { return "W_" + h + "_" + lv; }

  function optionsFor() {
    // returns {heights, spans, overhangs} for current type + selection
    if (S.type === "boulder") {
      var rows = DATA.boulder.rows.filter(function (r) { return r.z === S.height; });
      return { heights: boulderHeights,
               spans: uniq(DATA.boulder.rows.map(function (r) { return r.a; })).sort(num),
               overhangs: uniq(DATA.boulder.rows.map(function (r) { return r.x; })).sort(num) };
    }
    var w = DATA.walls[wallKey(S.height, S.levels)];
    var spans = w ? uniq(w.rows.map(function (r) { return r.a; })).sort(num) : [];
    var over = w ? uniq(w.rows.map(function (r) { return r.x; })).sort(num) : [];
    return { heights: wallHeights, spans: spans, overhangs: over };
  }

  // ---- unit-aware formatting ----
  function U() { return DATA.meta.units[S.units]; }
  function fmtForce(v) {
    if (v === null || v === undefined) return "–";
    var d = S.units === "EU" ? 2 : 1;
    var s = Number(v).toFixed(d);
    return s.replace(/\.?0+$/, function (m) { return m.indexOf(".") === 0 ? "" : m; }) === "" ? s : s;
  }
  function fmtLen(v) { return S.units === "EU" ? v + " m" : (Math.round(v * 3.28084 * 10) / 10) + " ft"; }

  // ---- record lookup ----
  function wallRows() { // rows for current wall + span + overhang, keyed by level
    var w = DATA.walls[wallKey(S.height, S.levels)];
    if (!w) return [];
    return w.rows.filter(function (r) { return r.a === S.span && r.x === S.overhang; })
                 .sort(function (a, b) { return a.lvl - b.lvl; });
  }
  function boulderRow() {
    return DATA.boulder.rows.filter(function (r) {
      return r.z === S.height && r.a === S.span && r.x === S.overhang; })[0];
  }

  // ============ RENDER CONTROLS ============
  function seg(elId, items, cur, onPick) {
    var el = document.getElementById(elId);
    el.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = it.label;
      b.setAttribute("aria-pressed", String(it.value === cur));
      b.onclick = function () { onPick(it.value); };
      el.appendChild(b);
    });
  }
  function chips(elId, values, cur, onPick, labelFn) {
    var el = document.getElementById(elId);
    el.innerHTML = "";
    values.forEach(function (v) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = labelFn ? labelFn(v) : v;
      b.setAttribute("aria-pressed", String(v === cur));
      b.onclick = function () { onPick(v); };
      el.appendChild(b);
    });
  }

  function renderControls() {
    var u = U();
    // units + type
    seg("seg-units", [
      { label: "Metric (kN · m)", value: "EU" },
      { label: "Imperial (lb · ft)", value: "USA" }
    ], selectedInputs.units ? S.units : null, function (v) {
      selectedInputs.units = true;
      if (v !== S.units) { S.cap = null; var ci = document.getElementById("cap-input"); if (ci) ci.value = ""; }
      S.units = v; clampAndRender();
    });

    seg("seg-type", [
      { label: "Climbing wall", value: "wall" },
      { label: "Boulder wall", value: "boulder" }
    ], selectedInputs.type ? S.type : null, function (v) {
      S.type = v;
      selectedInputs.type = true;
      onTypeChange();
    });

    document.getElementById("type-hint").textContent = S.type === "wall"
      ? "With protection points · " + u.codeWall
      : "Without protection points · " + u.codeBoulder;

    // heights
    var heights = S.type === "wall" ? wallHeights : boulderHeights;
    document.getElementById("lbl-height").innerHTML =
      "Climbing-surface height <span class=\"hint\">(" + (S.units === "EU" ? "m" : "ft") + ")</span>";
    chips("chips-height", heights, selectedInputs.height ? S.height : null, function (v) {
      S.height = v;
      selectedInputs.height = true;
      if (S.type === "wall") {
        var sch = wallSchemes[v];
        if (sch.indexOf(S.levels) < 0) S.levels = sch[sch.length - 1];
      }
      clampAndRender();
    }, function (v) { return S.units === "EU" ? v : (Math.round(v * 3.28084)); });

    // scheme (levels) — only for walls with >1 option
    var schemeField = document.getElementById("field-scheme");
    if (S.type === "wall") {
      var schemes = wallSchemes[S.height] || [];
      schemeField.style.display = "";
      chips("chips-scheme", schemes, selectedInputs.levels ? S.levels : null, function (v) { S.levels = v; selectedInputs.levels = true; clampAndRender(); },
        function (v) { return v + (v === 1 ? " level" : " levels"); });
      // when only one scheme, keep it visible but it acts as a static badge
    } else {
      schemeField.style.display = "none";
    }

    var opt = optionsFor();
    document.getElementById("lbl-span").innerHTML =
      "Column span · A <span class=\"hint\">(" + (S.units === "EU" ? "m" : "ft") + ", between building columns)</span>";
    chips("chips-span", opt.spans, selectedInputs.span ? S.span : null, function (v) { S.span = v; selectedInputs.span = true; clampAndRender(); },
      function (v) { return S.units === "EU" ? v : Math.round(v * 3.28084); });

    document.getElementById("lbl-overhang").innerHTML =
      "Overhang · X <span class=\"hint\">(" + (S.units === "EU" ? "m" : "ft") + ", top − bottom contour)</span>";
    chips("chips-overhang", opt.overhangs, selectedInputs.overhang ? S.overhang : null, function (v) { S.overhang = v; selectedInputs.overhang = true; clampAndRender(); },
      function (v) { return S.units === "EU" ? v : Math.round(v * 3.28084); });

    // The governing live-load level is an input choice, so it belongs with
    // the geometry controls rather than above the results table.
    var forceField = document.getElementById("field-force-level");
    if (S.type === "wall") {
      var forceRows = wallRows();
      if (S.force === null || !forceRows.some(function (r) { return r.lvl === S.force; })) {
        S.force = forceRows.length ? forceRows[0].lvl : 1;
        selectedInputs.force = false;
      }
      var forceWall = DATA.walls[wallKey(S.height, S.levels)];
      forceField.style.display = "";
      chips("chips-force-input", forceRows.map(function (r) { return r.lvl; }), selectedInputs.force ? S.force : null,
        function (v) { S.force = v; selectedInputs.force = true; clampAndRender(); },
        function (v) {
          var h = forceWall && forceWall.lhEU && forceWall.lhEU[v];
          return "Max Z" + v + (h ? " · " + fmtLen(h) : "");
        });
    } else {
      forceField.style.display = "none";
    }

    // capacity + factored
    document.getElementById("cap-unit").textContent = u.force;
    document.getElementById("factored-hint").textContent =
      "(×" + u.dl + " DL, ×" + u.ll + " LL)";
  }

  function onTypeChange() {
    if (S.type === "wall") {
      if (wallHeights.indexOf(S.height) < 0) { S.height = 12; selectedInputs.height = false; }
      var sch = wallSchemes[S.height];
      if (sch.indexOf(S.levels) < 0) { S.levels = sch[sch.length - 1]; selectedInputs.levels = false; }
    } else {
      if (boulderHeights.indexOf(S.height) < 0) { S.height = boulderHeights[0]; selectedInputs.height = false; }
    }
    clampAndRender();
  }

  function clampAndRender() {
    var opt = optionsFor();
    if (opt.spans.indexOf(S.span) < 0) {
      S.span = opt.spans.includes(6) ? 6 : opt.spans[0];
      selectedInputs.span = false;
    }
    if (opt.overhangs.indexOf(S.overhang) < 0) {
      S.overhang = opt.overhangs.includes(1) ? 1 : opt.overhangs[0];
      selectedInputs.overhang = false;
    }
    renderControls();
    renderResults();
  }

  // ============ RENDER RESULTS ============
  // Component metadata: label + which axis + point.
  function ptLabelWall(lvl, lh) {
    var h = lh && lh[lvl] !== undefined ? lh[lvl] : null;
    return "Level " + lvl + (h !== null ? " · " + fmtLen(h) : "");
  }

  function factor(v, kind) { // kind 'DL'|'LL'
    if (v === null || v === undefined) return v;
    if (!S.factored) return v;
    var u = U();
    return v * (kind === "DL" ? u.dl : u.ll);
  }

  function cell(v, kind, cls) {
    return '<td class="num ' + (cls || "") + '">' + fmtForce(factor(v, kind)) + "</td>";
  }

  function govColumnLoad() {
    // worst-case factored horizontal load on a building column across all force levels.
    // For each scenario row and each level's L column: DL always + LL (concurrent in that row).
    var u = U(), worst = 0, detail = null;
    function consider(dl, ll, tag) {
      if (dl === undefined && ll === undefined) return;
      var val = Math.abs((dl || 0) * u.dl + (ll || 0) * u.ll);
      if (val > worst) { worst = val; detail = tag; }
    }
    if (S.type === "boulder") {
      var b = boulderRow();
      if (b) consider(b.eu.LX1DL !== undefined ? pick(b, "LX1DL") : undefined,
                       pick(b, "LX1LL"), "column");
      return { value: worst, detail: detail };
    }
    var rows = wallRows(), w = DATA.walls[wallKey(S.height, S.levels)];
    rows.forEach(function (r) {
      for (var lv = 1; lv <= w.levels; lv++) {
        consider(pick(r, "LX" + lv + "DL"), pick(r, "LX" + lv + "LL"),
                 "Level " + lv + " (max at L" + r.lvl + ")");
      }
    });
    return { value: worst, detail: detail };
  }

  function pick(row, key) {
    var src = S.units === "EU" ? row.eu : row.us;
    return src ? src[key] : undefined;
  }

  function renderResults() {
    var root = document.getElementById("result-root");
    var ready = selectedInputs.units && selectedInputs.type && selectedInputs.height && selectedInputs.span && selectedInputs.overhang
      && (S.type === "boulder" || (selectedInputs.levels && selectedInputs.force));
    if (!ready) {
      root.innerHTML = '<div class="empty">Select the calculator inputs to view the results.</div>';
      window.WTCalculatorPayload = null;
      return;
    }
    var u = U();
    var have = S.type === "boulder" ? !!boulderRow() : wallRows().length > 0;
    if (!have) { root.innerHTML = '<div class="empty">No table entry for this combination.</div>'; return; }

    var heightLbl = fmtLen(S.height);
    var schemeLbl = S.type === "wall" ? (S.levels + (S.levels === 1 ? " attachment level" : " attachment levels")) : "single attachment";
    var title = (S.type === "wall" ? "Climbing wall " : "Boulder wall ") + heightLbl;
    var sub = schemeLbl + " · span A = " + fmtLen(S.span) + " · overhang X = " + fmtLen(S.overhang)
            + " · characteristic values in " + u.force + (S.factored ? " · factored" : "");

    var html = '<div class="results-reveal"><div class="results-head">'
      + '<div><p class="title">' + title + '</p><p class="sub">' + sub + '</p></div>'
      + '</div><div class="results-verdict-row">' + verdictHtml() + "</div>";

    var resultsTable = S.type === "boulder" ? boulderTable() : wallResults();
    html += '<div class="results-visual-grid"><div class="results-table">' + resultsTable + legendHtml()
      + '</div>' + schematicPanelHtml() + '</div>';

    html += '<div id="attachment-config-root"></div>' + notesHtml() + '</div>';
    root.innerHTML = html;
    wireSchematicView();
    var calculatorPayload = { input: currentInput(), snapshot: currentSnapshot() };
    window.WTCalculatorPayload = calculatorPayload;
    window.dispatchEvent(new CustomEvent("wtcalculatorchange", { detail: calculatorPayload }));
    try { localStorage.setItem(CALCULATOR_DRAFT_KEY, JSON.stringify(currentInput())); } catch (error) {}
  }

  function verdictHtml() {
    var gov = govColumnLoad(), u = U();
    if (S.cap === null || isNaN(S.cap)) {
      return "";
    }
    var ok = gov.value <= S.cap;
    return '<div class="verdict ' + (ok ? "ok" : "bad") + '">'
      + '<span class="ico">' + (ok ? "✓" : "✕") + '</span>'
      + "<div>" + (ok ? "Applicable" : "Exceeds capacity")
      + '<br><span class="big">' + fmtForce(gov.value) + " " + u.force + "</span> "
      + "required vs " + fmtForce(S.cap) + " " + u.force + " capacity</div></div>";
  }

  // wall: force-level selector + point-load table for the selected governing level
  function wallResults() {
    var rows = wallRows(), w = DATA.walls[wallKey(S.height, S.levels)];
    if (S.force === null || !rows.some(function (r) { return r.lvl === S.force; }))
      S.force = rows.length ? rows[0].lvl : 1;
    var row = rows.filter(function (r) { return r.lvl === S.force; })[0];
    return pointTable(row, w);
  }

  function grouptags() {
    return '<span class="grouptag tag-dl">Dead load</span> &nbsp; <span class="grouptag tag-ll">Live load</span>';
  }

  function pointTable(row, w) {
    // Points: Base Z (R only), Base X (R only), then each level (R at level + L at column)
    var rowsHtml = "";
    // base vertical
    rowsHtml += trPoint("Base — vertical (Z)", "RZ0", null, row);
    rowsHtml += trPoint("Base — horizontal (X)", "RX0", null, row);
    for (var lv = 1; lv <= w.levels; lv++) {
      var h = w.lhEU && w.lhEU[lv];
      rowsHtml += trPoint("RX" + lv + (h ? " · " + fmtLen(h) : ""), "RX" + lv, "LX" + lv, row);
    }
    return tableShell(rowsHtml);
  }

  function tableShell(rowsHtml) {
    return '<div class="scroller"><table class="loads">'
      + "<thead><tr>"
      + '<th class="pt">Attachment point</th>'
      + '<th><div class="colhdr grp-dl">R · DL<small>on 1 ACS axis</small></div></th>'
      + '<th><div class="colhdr grp-ll">R · LL<small>on 1 ACS axis</small></div></th>'
      + '<th><div class="colhdr grp-dl">L · DL<small>on building column</small></div></th>'
      + '<th><div class="colhdr grp-ll">L · LL<small>on building column</small></div></th>'
      + "</tr></thead><tbody>" + rowsHtml + "</tbody></table></div>";
  }

  function trPoint(label, rKey, lKey, row) {
    var rdl = rKey ? pick(row, rKey + "DL") : undefined;
    var rll = rKey ? pick(row, rKey + "LL") : undefined;
    var ldl = lKey ? pick(row, lKey + "DL") : undefined;
    var lll = lKey ? pick(row, lKey + "LL") : undefined;
    return "<tr><td class=\"pt\">" + label + "</td>"
      + cellOrDash(rdl, "DL", "grp-dl")
      + cellOrDash(rll, "LL", "grp-ll")
      + cellOrDash(ldl, "DL", "grp-dl")
      + cellOrDash(lll, "LL", "grp-ll") + "</tr>";
  }

  function cellOrDash(v, kind, cls) {
    if (v === undefined || v === null) return '<td class="num" style="color:var(--ink-faint)">–</td>';
    return cell(v, kind, cls);
  }

  function boulderTable() {
    var b = boulderRow();
    var rowsHtml = trPoint("Base — vertical (Z)", "RZ0", null, b)
      + trPoint("Attachment — horizontal (X)", "RX1", "LX1", b);
    return tableShell(rowsHtml);
  }

  function legendHtml() {
    return '<div class="legend">'
      + '<div><h3>Coordinate system &amp; symbols</h3><dl>'
      + "<dt>R</dt><dd>Load on one axis of the ACS — base points and single-axis attachment points.</dd>"
      + "<dt>L</dt><dd>Load on a building column / frame, with the column span A taken into account. Focus on these for the existing structure.</dd>"
      + "<dt>DL / LL</dt><dd>Dead load / Live load (climber load per EN 12572).</dd>"
      + "<dt>Z0 / Z1 / Z2 / Z3</dt><dd>Vertical component at the base (Z0). Vertical distance from the base to attachment level 1 (Z1), and between consecutive attachment levels (Z2, Z3).</dd>"
      + "<dt>X0 / X1 / X2 / X3</dt><dd>Horizontal component at the base (X0) and at attachment level 1, 2, 3.</dd>"
      + "</dl></div></div>";
  }

  function schematicPanelHtml() {
    return '<div class="schematic schematic-interactive">'
      + '<div class="schematic-view-controls" aria-label="Drawing zoom controls">'
      + '<button type="button" data-schematic-action="out" aria-label="Zoom out">−</button>'
      + '<span id="schematic-zoom-value">100%</span>'
      + '<button type="button" data-schematic-action="in" aria-label="Zoom in">+</button>'
      + '<button type="button" data-schematic-action="reset" aria-label="Reset view">↺</button></div>'
      + '<div class="schematic-viewport" id="schematic-viewport" aria-label="Drag to move the drawing">'
      + schematicSvg() + '</div></div>';
  }

  function wireSchematicView() {
    var viewport = document.getElementById("schematic-viewport");
    var svg = viewport && viewport.querySelector("svg");
    var zoomValue = document.getElementById("schematic-zoom-value");
    if (!viewport || !svg) return;
    var drawingCenterX = 197.5;
    var drawingCenterY = 257;
    function applyView() {
      var viewWidth = 420 / schematicView.scale;
      var viewHeight = 520 / schematicView.scale;
      // Centre on the visible drawing bounds rather than the nominal viewBox.
      var viewX = drawingCenterX - viewWidth / 2 - schematicView.panX;
      var viewY = drawingCenterY - viewHeight / 2 - schematicView.panY;
      svg.setAttribute("viewBox", [viewX, viewY, viewWidth, viewHeight].join(" "));
      zoomValue.textContent = Math.round(schematicView.scale * 100) + "%";
    }
    function setScale(next, clientX, clientY) {
      var oldScale = schematicView.scale;
      next = Math.max(.5, Math.min(3, next));
      if (clientX != null && clientY != null && next !== oldScale) {
        var rect = viewport.getBoundingClientRect();
        var ratioX = (clientX - rect.left) / rect.width;
        var ratioY = (clientY - rect.top) / rect.height;
        var oldWidth = 420 / oldScale;
        var oldHeight = 520 / oldScale;
        var oldX = drawingCenterX - oldWidth / 2 - schematicView.panX;
        var oldY = drawingCenterY - oldHeight / 2 - schematicView.panY;
        var cursorX = oldX + ratioX * oldWidth;
        var cursorY = oldY + ratioY * oldHeight;
        var newWidth = 420 / next;
        var newHeight = 520 / next;
        var newX = cursorX - ratioX * newWidth;
        var newY = cursorY - ratioY * newHeight;
        schematicView.panX = drawingCenterX - newWidth / 2 - newX;
        schematicView.panY = drawingCenterY - newHeight / 2 - newY;
      }
      schematicView.scale = next;
      applyView();
    }
    document.querySelectorAll("[data-schematic-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var action = button.getAttribute("data-schematic-action");
        if (action === "in") setScale(schematicView.scale + .25);
        if (action === "out") setScale(schematicView.scale - .25);
        if (action === "reset") { schematicView = { scale: 1, panX: 0, panY: 0 }; applyView(); }
      });
    });
    viewport.addEventListener("wheel", function (event) {
      event.preventDefault();
      setScale(schematicView.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX, event.clientY);
    }, { passive: false });
    var drag = null;
    viewport.addEventListener("pointerdown", function (event) {
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: schematicView.panX, panY: schematicView.panY };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-dragging");
      event.preventDefault();
    });
    viewport.addEventListener("pointermove", function (event) {
      if (!drag || drag.id !== event.pointerId) return;
      var rect = viewport.getBoundingClientRect();
      schematicView.panX = drag.panX + (event.clientX - drag.x) * (420 / schematicView.scale) / rect.width;
      schematicView.panY = drag.panY + (event.clientY - drag.y) * (520 / schematicView.scale) / rect.height;
      applyView();
    });
    function stopDrag(event) {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      viewport.classList.remove("is-dragging");
    }
    viewport.addEventListener("pointerup", stopDrag);
    viewport.addEventListener("pointercancel", stopDrag);
    applyView();
  }

  function schematicSvg() {
    var wallHeight = Number(S.height) || 12;
    var overhang = Number(S.overhang) || 0;
    var groundY = 470, topY = 55, drawingHeight = groundY - topY;
    var baseX = 225;
    var attachmentPlaneX = 142;
    var forceCutX = 105;
    // Keep a fixed viewBox and map every available X value linearly into the
    // same horizontal drawing range, so the diagram never changes scale.
    var overhangOptions = optionsFor().overhangs;
    var maxOverhang = Math.max.apply(null, overhangOptions.concat([1]));
    var overhangPx = Math.max(0, 115 * overhang / maxOverhang);
    var topX = baseX + overhangPx;
    var wallDimX = 350;
    var svgWidth = 420;
    var groundEndX = 390;
    var surfaceDx = topX - baseX, surfaceDy = topY - groundY;
    var surfaceLength = Math.sqrt(surfaceDx * surfaceDx + surfaceDy * surfaceDy);
    var surfaceAngle = Math.atan2(surfaceDy, surfaceDx) * 180 / Math.PI;
    var surfaceLabelX = (baseX + topX) / 2 + (-surfaceDy / surfaceLength) * 14;
    var surfaceLabelY = (groundY + topY) / 2 + (surfaceDx / surfaceLength) * 14;
    var heights = [];
    if (S.type === "wall") {
      var wall = DATA.walls[wallKey(S.height, S.levels)];
      for (var level = 1; level <= S.levels; level++) heights.push(Number(wall.lhEU[level]));
    } else {
      heights.push(wallHeight);
    }
    function xAt(z) { return baseX + overhangPx * z / wallHeight; }
    function yAt(z) { return groundY - drawingHeight * z / wallHeight; }
    function dimValue(m) {
      return S.units === "EU" ? Math.round(m * 1000) + " mm" : (m * 3.28084).toFixed(1) + " ft";
    }
    var scenarioRow;
    if (S.type === "boulder") scenarioRow = boulderRow();
    else {
      var scenarioRows = wallRows();
      scenarioRow = scenarioRows.filter(function (r) { return r.lvl === S.force; })[0] || scenarioRows[0];
    }
    function reaction(key) {
      var ll = scenarioRow ? factor(pick(scenarioRow, key + "LL"), "LL") : 0;
      var dl = scenarioRow ? factor(pick(scenarioRow, key + "DL"), "DL") : 0;
      return { ll: Number(ll || 0), dl: Number(dl || 0) };
    }
    function reactionText(key, value) { return key + " = " + fmtForce(value) + " " + U().force; }
    var attachments = "", forces = "", heightDims = "";
    function horizontalReaction(key, value, y, kind, labelY) {
      var negative = value < 0, zero = Math.abs(value) < .000001;
      var start = negative ? forceCutX : 40, end = negative ? 40 : forceCutX;
      return '<line class="side-reaction is-' + kind + (zero ? ' is-zero' : '') + '" x1="' + start + '" y1="' + y + '" x2="' + end + '" y2="' + y + '"' + (zero ? '' : ' marker-end="url(#side-force-' + kind + ')"') + '><title>' + key + ' · ' + kind.toUpperCase() + ' = ' + fmtForce(value) + ' ' + U().force + '</title></line><text class="side-reaction-label is-' + kind + '" x="53" y="' + labelY + '" text-anchor="middle">' + key + ' ' + kind.toUpperCase() + ' = ' + fmtForce(value) + ' ' + U().force + '</text>';
    }
    heights.forEach(function (z, i) {
      var n = i + 1, x = xAt(z), y = yAt(z), dimX = 142 - i * 18;
      var rx = reaction("RX" + n);
      attachments += '<line class="side-support" x1="' + attachmentPlaneX + '" y1="' + y + '" x2="' + x + '" y2="' + y + '"/><path class="side-anchor" d="M' + attachmentPlaneX + ' ' + (y-9) + 'v18l10-9z"/>';
      forces += horizontalReaction('RX' + n, rx.ll, y - 8, 'll', y - 15)
        + horizontalReaction('RX' + n, rx.dl, y + 8, 'dl', y + 22);
      heightDims += '<line class="side-extension" x1="' + dimX + '" y1="' + y + '" x2="' + attachmentPlaneX + '" y2="' + y + '"/><line class="side-dimension" x1="' + dimX + '" y1="' + groundY + '" x2="' + dimX + '" y2="' + y + '"/><path class="side-tick" d="M' + (dimX-5) + ' ' + (groundY+5) + 'l10-10M' + (dimX-5) + ' ' + (y+5) + 'l10-10"/><text class="side-dim-label" x="' + (dimX-8) + '" y="' + ((groundY+y)/2) + '" text-anchor="middle" transform="rotate(-90 ' + (dimX-8) + ' ' + ((groundY+y)/2) + ')">H' + n + ' = ' + dimValue(z) + '</text>';
    });
    var rx0 = reaction("RX0"), rz0 = reaction("RZ0");
    function baseHorizontal(value, y, kind, labelY) {
      var negative = value < 0, zero = Math.abs(value) < .000001;
      var surfaceXAtArrow = baseX + (topX - baseX) * (groundY - y) / drawingHeight;
      var tipGap = 7;
      var tip = negative ? surfaceXAtArrow + tipGap : surfaceXAtArrow - tipGap;
      var start = negative ? tip + 60 : tip - 60, end = tip;
      return '<line class="side-reaction is-' + kind + (zero ? ' is-zero' : '') + '" x1="' + start + '" y1="' + y + '" x2="' + end + '" y2="' + y + '"' + (zero ? '' : ' marker-end="url(#side-force-' + kind + ')"') + '/><text class="side-reaction-label is-' + kind + '" x="270" y="' + labelY + '" text-anchor="start">RX0 ' + kind.toUpperCase() + ' = ' + fmtForce(value) + ' ' + U().force + '</text>';
    }
    function baseVertical(value, x, kind, labelY) {
      var negative = value < 0, zero = Math.abs(value) < .000001;
      var start = negative ? 392 : 452, end = negative ? 452 : 392;
      return '<line class="side-reaction is-' + kind + (zero ? ' is-zero' : '') + '" x1="' + x + '" y1="' + start + '" x2="' + x + '" y2="' + end + '"' + (zero ? '' : ' marker-end="url(#side-force-' + kind + ')"') + '/><text class="side-reaction-label side-rz0-label is-' + kind + '" x="226" y="' + labelY + '" text-anchor="end">RZ0 ' + kind.toUpperCase() + ' = ' + fmtForce(value) + ' ' + U().force + '</text>';
    }
    return '<svg viewBox="0 0 ' + svgWidth + ' 520" role="img" aria-label="Dynamic climbing wall side elevation">'
      + '<defs><marker id="side-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="currentColor" stroke-width="1.5"/></marker><marker id="side-force-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z"/></marker><marker id="side-force-ll" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#ec1c24"/></marker><marker id="side-force-dl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#111111"/></marker></defs>'
      + '<line class="side-ground" x1="15" y1="' + groundY + '" x2="' + groundEndX + '" y2="' + groundY + '"/><path class="side-hatch" d="M205 ' + groundY + 'l-8 10m14-10l-8 10m14-10l-8 10m14-10l-8 10"/>'
      + '<line class="side-attachment-plane" x1="' + attachmentPlaneX + '" y1="' + topY + '" x2="' + attachmentPlaneX + '" y2="' + groundY + '"/>'
      + '<line class="side-surface" x1="' + baseX + '" y1="' + groundY + '" x2="' + topX + '" y2="' + topY + '"/>'
      + attachments + forces + heightDims
      + '<line class="side-extension" x1="' + attachmentPlaneX + '" y1="' + topY + '" x2="' + attachmentPlaneX + '" y2="30"/><line class="side-extension" x1="' + topX + '" y1="' + topY + '" x2="' + topX + '" y2="30"/><line class="side-dimension" x1="' + attachmentPlaneX + '" y1="30" x2="' + topX + '" y2="30"/><path class="side-tick" d="M' + (attachmentPlaneX-5) + ' 35l10-10M' + (topX-5) + ' 35l10-10"/><text class="side-overhang-label" x="' + ((attachmentPlaneX+topX)/2) + '" y="20" text-anchor="middle">X = ' + dimValue(overhang) + ' (overhang)</text>'
      + '<line class="side-extension" x1="' + topX + '" y1="' + topY + '" x2="' + wallDimX + '" y2="' + topY + '"/><line class="side-dimension" x1="' + wallDimX + '" y1="' + groundY + '" x2="' + wallDimX + '" y2="' + topY + '"/><path class="side-tick" d="M' + (wallDimX-5) + ' ' + (groundY+5) + 'l10-10M' + (wallDimX-5) + ' ' + (topY+5) + 'l10-10"/><text class="side-wall-height" x="' + (wallDimX+15) + '" y="' + ((groundY+topY)/2) + '" text-anchor="middle" transform="rotate(-90 ' + (wallDimX+15) + ' ' + ((groundY+topY)/2) + ')">Climbing wall height = ' + dimValue(wallHeight) + '</text>'
      + '<text class="side-surface-label" x="' + surfaceLabelX + '" y="' + surfaceLabelY + '" text-anchor="middle" transform="rotate(' + surfaceAngle + ' ' + surfaceLabelX + ' ' + surfaceLabelY + ')">Climbing surface</text>'
      + baseHorizontal(rx0.ll, 446, 'll', 488) + baseHorizontal(rx0.dl, 462, 'dl', 504)
      + baseVertical(rz0.ll, 197, 'll', 340) + baseVertical(rz0.dl, 213, 'dl', 354)
      + '<g class="side-axis"><line x1="26" y1="468" x2="26" y2="420" marker-end="url(#side-force-arrow)"/><line x1="26" y1="468" x2="80" y2="468" marker-end="url(#side-force-arrow)"/><text x="5" y="420">+Z</text><text x="65" y="488">+X</text></g>'
      + "</svg>";
  }

  function notesHtml() {
    var u = U();
    var code = S.type === "wall" ? u.codeWall : u.codeBoulder;
    return '<div class="notes">'
      + '<h3>Notes</h3>'
      + '<div class="preliminary-banner"><strong>Preliminary loads — NOT for construction.</strong></div>'
      + '<ol>'
      + '<li>Coefficient for dead load = <b>' + u.dl + '</b>.</li>'
      + '<li>Coefficient for live load = <b>' + u.ll + '</b>.</li>'
      + '<li>All loads are characteristic values and are expressed in <b>' + u.force + '</b>. Refer to the positive directions of the coordinate system when interpreting their signs.</li>'
      + '<li>The application manual is an inseparable part of the load tables. For additional information, consult Walltopia.</li>'
      + '<li><span class="code">Used code: ' + code + '.</span></li>'
      + '</ol></div>';
  }

  // ============ projects: save / load ============
  var P = null; // currently loaded/edited project { id, name, tags, properties }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function currentInput() {
    return { units: S.units, type: S.type, height: S.height, levels: S.levels,
      overhang: S.overhang, span: S.span, force: S.force, factored: S.factored, capacity: S.cap };
  }
  function applyInput(inp) {
    if (!inp) return;
    ["units", "type", "height", "levels", "overhang", "span", "force", "factored"].forEach(function (k) {
      if (inp[k] !== undefined && inp[k] !== null) S[k] = inp[k];
    });
    S.cap = (inp.capacity !== undefined && inp.capacity !== null) ? inp.capacity : null;
    var capacityInput = document.getElementById("cap-input");
    var factoredInput = document.getElementById("chk-factored");
    if (capacityInput) capacityInput.value = S.cap === null ? "" : S.cap;
    if (factoredInput) factoredInput.checked = !!S.factored;
    selectedInputs.units = selectedInputs.type = selectedInputs.height = selectedInputs.span = selectedInputs.overhang = true;
    selectedInputs.levels = S.type === "wall";
    selectedInputs.force = S.type === "wall";
  }
  function currentSnapshot() {
    var u = U(), gov = govColumnLoad();
    var verdict = (S.cap === null || isNaN(S.cap)) ? "neutral" : (gov.value <= S.cap ? "ok" : "bad");
    var title = (S.type === "wall" ? "Climbing wall " : "Boulder wall ") + fmtLen(S.height);
    var levelForces = [], levelDeadForces = [];
    if (S.type === "boulder") {
      var boulder = boulderRow();
      if (boulder) { levelForces.push(pick(boulder, "LX1LL")); levelDeadForces.push(pick(boulder, "LX1DL")); }
    } else {
      var rows = wallRows();
      var selected = rows.filter(function (row) { return row.lvl === S.force; })[0] || rows[0];
      if (selected) {
        for (var level = 1; level <= S.levels; level++) {
          levelForces.push(pick(selected, "LX" + level + "LL"));
          levelDeadForces.push(pick(selected, "LX" + level + "DL"));
        }
      }
    }
    return { title: title, unit: u.force, governing: Math.round(gov.value * 100) / 100, verdict: verdict, levelForces: levelForces, levelDeadForces: levelDeadForces };
  }

  var projectRoot = function () { return document.getElementById("project-root"); };

  // leave the editing context: keep the current inputs, but detach from the saved project
  function exitEditing() {
    P = null;
    history.replaceState(null, "", "index.html");
    renderProjectBar();
  }

  function renderProjectBar() {
    var root = projectRoot();
    if (!root) return;
    var user = window.WTAuth && window.WTAuth.current();
    if (!user) {
      root.innerHTML =
        '<div class="proj-actions"><button class="btn primary small" id="pb-login">Save as project</button>'
        + '<span class="hint">Log in to save this design, add tags and additional project information.</span></div>';
      root.querySelector("#pb-login").onclick = function () {
        window.WTAuth.requireAuth("register").then(function () { openSavePanel(); }).catch(function () {});
      };
      return;
    }
    var html = '<div class="proj-actions">';
    if (P) {
      html += '<span class="editing-flag"><span>Editing · ' + esc(P.name) + '</span><button type="button" id="pb-exit" aria-label="Exit editing" title="Exit editing">&times;</button></span>';
      html += '<button class="btn primary small" id="pb-update">Save changes</button>';
      html += '<div class="project-more"><button class="btn small" id="pb-more" type="button" aria-expanded="false">More &#9656;</button>';
      html += '<div class="project-more-menu" id="pb-more-menu" hidden><button type="button" id="pb-details">Edit details</button><button type="button" id="pb-saveas">Save as new</button><button type="button" id="pb-export">Export PDF</button></div></div>';
    } else {
      html += '<button class="btn primary small" id="pb-save">Save as project</button>';
      html += '<span class="hint">Save this design with tags and additional project information.</span>';
    }
    html += "</div>";
    root.innerHTML = html;
    if (P) {
      root.querySelector("#pb-exit").onclick = exitEditing;
      root.querySelector("#pb-update").onclick = function () { doSave("update"); };
      root.querySelector("#pb-more").onclick = function () {
        var menu = root.querySelector("#pb-more-menu");
        var opening = menu.hidden;
        menu.hidden = !opening;
        this.setAttribute("aria-expanded", String(opening));
        this.innerHTML = opening ? "More &#9666;" : "More &#9656;";
      };
      root.querySelector("#pb-details").onclick = function () { openSavePanel(false); };
      root.querySelector("#pb-saveas").onclick = function () { openSavePanel(true); };
      root.querySelector("#pb-export").onclick = function () {
        if (window.WTExportPdf) window.WTExportPdf({ project: P, input: currentInput(), snapshot: currentSnapshot() });
      };
    } else {
      root.querySelector("#pb-save").onclick = function () { openSavePanel(); };
    }
  }

  function openSavePanel(asNew) {
    var root = projectRoot();
    var name = (P && !asNew) ? P.name : (currentSnapshot().title + (S.type === "wall" ? " · " + S.levels + "-level" : ""));
    var tags = (P && !asNew) ? (P.tags || []).join(", ") : "";
    var props = (P && !asNew) ? (P.properties || []) : [];
    var html = '<div class="save-panel"><h3>' + (asNew ? "Save as new project" : (P ? "Update project" : "Save project")) + "</h3>"
      + '<div class="row"><label class="lbl">Project name</label><input type="text" id="sp-name" value="' + esc(name) + '" /></div>'
      + '<div class="row"><label class="lbl">Tags <span class="hint" style="font-weight:400">(comma separated · maximum 6)</span></label>'
      + '<input type="text" id="sp-tags" value="' + esc(tags) + '" placeholder="gym, EU, seismic zone 2" /></div>'
      + '<div class="row"><label class="lbl">Additional project information</label><div class="prop-rows" id="sp-props"></div>'
      + '<button class="btn small" id="sp-addprop" type="button" style="margin-top:8px">+ Add field</button></div>'
      + '<div class="buttons"><button class="btn primary" id="sp-save">' + (asNew ? "Create copy" : (P ? "Save changes" : "Save project")) + "</button>"
      + '<button class="btn" id="sp-cancel">Cancel</button></div>'
      + '<div class="save-msg" id="sp-msg"></div></div>';
    root.innerHTML = html;
    var propWrap = root.querySelector("#sp-props");
    function addRow(k, v) {
      var row = document.createElement("div");
      row.className = "prop-row";
      row.innerHTML = '<input placeholder="Field name" value="' + esc(k || "") + '" /><input placeholder="Information" value="' + esc(v || "") + '" /><button type="button" title="Remove">&times;</button>';
      row.querySelector("button").onclick = function () { row.remove(); };
      propWrap.appendChild(row);
    }
    (props.length ? props : [{ key: "", value: "" }]).forEach(function (p) { addRow(p.key, p.value); });
    root.querySelector("#sp-addprop").onclick = function () { addRow("", ""); };
    root.querySelector("#sp-cancel").onclick = renderProjectBar;
    root.querySelector("#sp-save").onclick = function () { doSave(asNew ? "create" : (P ? "update" : "create")); };
  }

  function collectSaveForm() {
    var root = projectRoot();
    var name = root.querySelector("#sp-name").value.trim();
    var tags = root.querySelector("#sp-tags").value.split(",").map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 6);
    var properties = [];
    root.querySelectorAll("#sp-props .prop-row").forEach(function (r) {
      var inputs = r.querySelectorAll("input");
      var k = inputs[0].value.trim();
      if (k) properties.push({ key: k, value: inputs[1].value.trim() });
    });
    return { name: name, tags: tags, properties: properties, input: currentInput(), snapshot: currentSnapshot() };
  }

  async function doSave(mode) {
    var root = projectRoot();
    var msg = root.querySelector("#sp-msg");
    var payload;
    if (mode === "update" && !document.getElementById("sp-name")) {
      // "Save changes" pressed directly on the bar — keep existing name/tags/props, update numbers
      payload = { name: P.name, tags: P.tags, properties: P.properties, input: currentInput(), snapshot: currentSnapshot() };
    } else {
      payload = collectSaveForm();
      if (!payload.name) { if (msg) { msg.className = "save-msg bad"; msg.textContent = "Please enter a project name."; } return; }
    }
    var btn = root.querySelector("#sp-save"); if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
    try {
      var res = (mode === "update" && P)
        ? await window.WTApi.updateProject(P.id, payload)
        : await window.WTApi.createProject(payload);
      P = res.project;
      history.replaceState(null, "", "index.html?project=" + P.id);
      renderProjectBar();
      flash(mode === "update" ? "Project updated." : "Project saved.");
    } catch (e) {
      if (msg) { msg.className = "save-msg bad"; msg.textContent = e.message || "Could not save."; }
      if (btn) { btn.disabled = false; btn.textContent = "Save"; }
    }
  }

  function flash(text) {
    var root = projectRoot();
    var m = document.createElement("div");
    m.className = "save-msg ok"; m.textContent = text;
    var bar = root.querySelector(".proj-actions"); if (bar) bar.appendChild(m);
    setTimeout(function () { m.remove(); }, 3500);
  }

  async function maybeLoadProjectFromUrl() {
    var id = new URLSearchParams(location.search).get("project");
    if (!id) return;
    try {
      if (window.WTAuth.ready) await window.WTAuth.ready; // wait for the initial session check
      await window.WTAuth.requireAuth("login");
      var res = await window.WTApi.getProject(id);
      P = res.project;
      applyInput(P.input);
      clampAndRender();
      renderProjectBar();
      if (new URLSearchParams(location.search).get("export") === "pdf") {
        var bulkRequestId = new URLSearchParams(location.search).get("bulk");
        setTimeout(function () {
          if (window.WTExportPdf) {
            window.WTExportPdf({
              project: P,
              input: currentInput(),
              snapshot: currentSnapshot(),
              sameWindow: true,
              returnToParent: !!bulkRequestId,
              requestId: bulkRequestId || ""
            });
          }
        }, 250);
      }
    } catch (e) { /* cancelled or not found — leave calculator as-is */ }
  }

  // ---- init ----
  S.height = 12; S.levels = 3; S.span = 6; S.overhang = 1; S.force = 1;
  if (!new URLSearchParams(location.search).get("project")) {
    try {
      var savedDraft = JSON.parse(localStorage.getItem(CALCULATOR_DRAFT_KEY) || "null");
      if (savedDraft && typeof savedDraft === "object") applyInput(savedDraft);
    } catch (error) {}
  }
  document.getElementById("cap-input").addEventListener("input", function (e) {
    S.cap = null;
    e.target.closest(".caprow").classList.remove("is-applied");
    var hint = document.getElementById("cap-hint");
    hint.classList.remove("is-applied");
    hint.textContent = e.target.value.trim() === ""
      ? "Horizontal load one existing column / frame can carry."
      : "Press Check capacity or Enter to show the result.";
    renderResults();
  });
  function applyCapacity() {
    var input = document.getElementById("cap-input");
    var value = input.value.trim();
    if (value === "" || !isFinite(Number(value)) || Number(value) < 0) return;
    S.cap = Number(value);
    renderResults();
    input.closest(".caprow").classList.add("is-applied");
    var hint = document.getElementById("cap-hint");
    hint.classList.remove("is-applied");
    hint.textContent = "Horizontal load one existing column / frame can carry.";
    input.blur();
    var verdict = document.querySelector(".results-verdict-row .verdict");
    if (verdict) verdict.classList.add("is-confirmed");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  document.getElementById("cap-input").addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    applyCapacity();
  });
  document.getElementById("cap-submit").addEventListener("click", applyCapacity);
  document.getElementById("chk-factored").addEventListener("change", function (e) {
    S.factored = e.target.checked; renderResults();
  });
  document.getElementById("reset-calculator").addEventListener("click", function () {
    S.units = "EU";
    S.type = "wall";
    S.height = 12;
    S.levels = 3;
    S.span = 6;
    S.overhang = 1;
    S.force = 1;
    S.factored = false;
    S.cap = null;
    Object.keys(selectedInputs).forEach(function (key) { selectedInputs[key] = false; });
    schematicView = { scale: 1, panX: 0, panY: 0 };

    var capInput = document.getElementById("cap-input");
    capInput.value = "";
    capInput.closest(".caprow").classList.remove("is-applied");
    document.getElementById("chk-factored").checked = false;
    var capHint = document.getElementById("cap-hint");
    capHint.classList.remove("is-applied");
    capHint.textContent = "Horizontal load one existing column / frame can carry.";
    try { localStorage.removeItem(CALCULATOR_DRAFT_KEY); } catch (error) {}
    clampAndRender();
    document.querySelector(".panel").scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  clampAndRender();

  // projects: react to login/logout, then attempt to load a shared/opened project
  if (window.WTAuth) {
    window.WTAuth.onChange(function (user) {
      if (!user) P = null; // logged out — drop the editing context so guests can't hit protected actions
      renderProjectBar();
    });
    renderProjectBar();
    maybeLoadProjectFromUrl();
  }
})();
