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
            span: null, overhang: null, force: null, factored: false, cap: null,
            baseCapacity: null, sideCapacity: null, columnCapacities: {}, attachmentSolution: "single",
            // The two attachment options are a decision, not a default: the results stay
            // closed until one is picked, so nobody reads Option 1 thinking it is "the"
            // answer. Saved projects arrive with the choice already made.
            solutionPicked: false };
  var selectedInputs = { units: false, type: false, height: false, levels: false, span: false, overhang: false, force: false };
  var singlePointSelection = { slab: null, detail: null, support: null, attachmentDetail: null };
  var columnPointSelection = { support: null, attachmentDetail: null };
  var CALCULATOR_DRAFT_KEY = "walltopia.calculator.draft.v1";
  var schematicView = { scale: 1, panX: 0, panY: 0 };
  var mobileResultsWasReady = false;
  var mobileResultsAutoScrollEnabled = false;

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
      b.onclick = function () { mobileResultsAutoScrollEnabled = true; onPick(it.value); };
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
      b.onclick = function () { mobileResultsAutoScrollEnabled = true; onPick(v); };
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
      if (v !== S.units) {
        S.cap = null;
        S.baseCapacity = null;
        S.sideCapacity = null;
        S.columnCapacities = {};
      }
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
      document.querySelectorAll("#chips-force-input button").forEach(function (button, index) {
        var level = forceRows[index].lvl;
        var height = forceWall && forceWall.lhEU && forceWall.lhEU[level];
        button.innerHTML = '<span class="force-label-main">Max Z' + level + '</span>'
          + (height ? '<span class="force-label-length">' + fmtLen(height) + '</span>' : '');
      });
    } else {
      forceField.style.display = "none";
    }

    // factored values
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

  function selectedScenarioRow() {
    if (S.type === "boulder") return boulderRow();
    var rows = wallRows();
    return rows.filter(function (row) { return row.lvl === S.force; })[0] || rows[0];
  }

  function singlePointValues() {
    var row = selectedScenarioRow();
    function value(key, kind) { return row ? factor(pick(row, key), kind) : 0; }
    var values = {
      RZ0DL: value("RZ0DL", "DL"), RZ0LL: value("RZ0LL", "LL"),
      RX1DL: value("RX1DL", "DL"), RX1LL: value("RX1LL", "LL"),
      RX2DL: value("RX2DL", "DL"), RX2LL: value("RX2LL", "LL"),
      RX3DL: value("RX3DL", "DL"), RX3LL: value("RX3LL", "LL")
    };
    if (S.type === "wall") {
      values.RX0DL = value("RX0DL", "DL");
      values.RX0LL = value("RX0LL", "LL");
    }
    return values;
  }

  function governingRZ0() {
    var row = selectedScenarioRow();
    var governing = { value: 0, signedValue: 0, scenario: null };
    if (row) {
      var dl = factor(pick(row, "RZ0DL"), "DL") || 0;
      var ll = factor(pick(row, "RZ0LL"), "LL") || 0;
      var combined = dl + ll;
      governing.value = Math.abs(combined);
      governing.signedValue = combined;
      governing.scenario = S.type === "wall" ? "Selected force level Z" + row.lvl : "Boulder load case";
    }
    return governing;
  }

  function totalHorizontalReaction() {
    var row=selectedScenarioRow(), total=0;
    if (row) {
      for (var level=1;level<=columnLevelCount();level++) {
        total+=(factor(pick(row,"RX"+level+"DL"),"DL")||0)+(factor(pick(row,"RX"+level+"LL"),"LL")||0);
      }
    }
    return { value:Math.abs(total), signedValue:total, scenario:row?(S.type==="wall"?"Selected force level Z"+row.lvl:"Boulder load case"):null };
  }

  function singlePointTableHtml(values) {
    var rows = [
      { point: "RZ0", dl: "RZ0DL", ll: "RZ0LL", description: "Base point · vertical" }
    ];
    if (S.type === "wall") rows.push({ point: "RX0", dl: "RX0DL", ll: "RX0LL", description: "Base point · horizontal" });
    var levelCount = S.type === "wall" ? Number(S.levels || 0) : 1;
    var wall = S.type === "wall" ? DATA.walls[wallKey(S.height, S.levels)] : null;
    for (var level = 1; level <= levelCount; level++) {
      var levelHeight = wall && wall.lhEU && wall.lhEU[level] !== undefined ? " · " + fmtLen(wall.lhEU[level]) : "";
      rows.push({
        point: "RX" + level,
        dl: "RX" + level + "DL",
        ll: "RX" + level + "LL",
        description: "Side point X" + level + levelHeight
      });
    }
    function loadCell(key, kind) {
      return '<td class="single-load-cell ' + (kind === "LL" ? 'is-ll' : 'is-dl') + '"><strong><span class="single-load-number">' + fmtForce(values[key]) + '</span><span class="single-load-unit">' + U().force + '</span></strong></td>';
    }
    return '<div class="single-point-table-wrap"><table class="single-point-table"><thead><tr><th>Attachment point</th><th>DL<span>Dead load</span></th><th class="is-ll">LL<span>Live load</span></th></tr></thead><tbody>'
      + rows.map(function (row) {
          return '<tr><th scope="row" class="single-point-name"><strong>' + row.point + '</strong><span>' + row.description + '</span></th>' + loadCell(row.dl, "DL") + loadCell(row.ll, "LL") + '</tr>';
        }).join("") + '</tbody></table></div>';
  }

  function columnLevelCount() { return S.type === "wall" ? Number(S.levels || 0) : 1; }

  function columnPointValues() {
    var row = selectedScenarioRow(), values = {};
    for (var level = 1; level <= columnLevelCount(); level++) {
      values["LX" + level + "DL"] = row ? factor(pick(row, "LX" + level + "DL"), "DL") : 0;
      values["LX" + level + "LL"] = row ? factor(pick(row, "LX" + level + "LL"), "LL") : 0;
    }
    return values;
  }

  function governingLX(level) {
    var row = selectedScenarioRow();
    var governing = { value:0, signedValue:0, scenario:null };
    if (row) {
      var dl = factor(pick(row, "LX" + level + "DL"), "DL") || 0;
      var ll = factor(pick(row, "LX" + level + "LL"), "LL") || 0;
      var combined = dl + ll;
      governing.value = Math.abs(combined);
      governing.signedValue = combined;
      governing.scenario = S.type === "wall" ? "Selected force level Z" + row.lvl : "Boulder load case";
    }
    return governing;
  }

  function totalColumnHorizontalReaction() {
    var row = selectedScenarioRow(), total = 0;
    if (row) {
      for (var level = 1; level <= columnLevelCount(); level++) {
        total += (factor(pick(row, "LX" + level + "DL"), "DL") || 0)
          + (factor(pick(row, "LX" + level + "LL"), "LL") || 0);
      }
    }
    return {
      value: Math.abs(total),
      signedValue: total,
      scenario: row ? (S.type === "wall" ? "Selected force level Z" + row.lvl : "Boulder load case") : null
    };
  }

  function columnPointTableHtml(values) {
    var rows = [], wall = S.type === "wall" ? DATA.walls[wallKey(S.height, S.levels)] : null;
    for (var level = 1; level <= columnLevelCount(); level++) {
      var levelHeight = wall && wall.lhEU && wall.lhEU[level] !== undefined ? " · " + fmtLen(wall.lhEU[level]) : "";
      rows.push({ point:"LX" + level, dl:"LX" + level + "DL", ll:"LX" + level + "LL", description:"Building column at X" + level + levelHeight });
    }
    function loadCell(key, kind) {
      return '<td class="single-load-cell ' + (kind === "LL" ? 'is-ll' : 'is-dl') + '"><strong><span class="single-load-number">' + fmtForce(values[key]) + '</span><span class="single-load-unit">' + U().force + '</span></strong></td>';
    }
    return '<div class="single-point-table-wrap column-point-table-wrap"><table class="single-point-table"><thead><tr><th>Column point</th><th>DL<span>Dead load</span></th><th class="is-ll">LL<span>Live load</span></th></tr></thead><tbody>'
      + rows.map(function (row) { return '<tr><th scope="row" class="single-point-name"><strong>' + row.point + '</strong><span>' + row.description + '</span></th>' + loadCell(row.dl,"DL") + loadCell(row.ll,"LL") + '</tr>'; }).join("")
      + '</tbody></table></div>';
  }

  function attachmentDocumentationHref() {
    return "technical-documentation.html?units=" + (S.units === "USA" ? "USA" : "EU") + "#attachment-details";
  }

  function singlePointConditionsHtml() {
    var slab = singlePointSelection.slab;
    var details = slab === "hollow" ? ["CF-03"] : slab === "solid" ? ["CF-01","CF-02"] : [];
    var detailNames = { "CF-01": "Base connection detail 01", "CF-02": "Base connection detail 02", "CF-03": "Base connection detail 03" };
    var support = singlePointSelection.support;
    var supports = S.type === "boulder" ? ["concrete-wall","steel-beam","masonry-wall"] : ["concrete-wall","steel-beam"];
    if (supports.indexOf(support) < 0) {
      support = null;
      singlePointSelection.support = null;
      singlePointSelection.attachmentDetail = null;
    }
    var supportLabels = { "concrete-wall": "Solid concrete wall", "steel-beam": "Steel beam", "masonry-wall": "Masonry / brick wall" };
    var supportDetails = support === "concrete-wall" ? ["CW-01","CW-03"] : support === "steel-beam" ? ["SB-01","SB-02","SB-03"] : support === "masonry-wall" ? ["MW-01","MW-02"] : [];
    return '<section class="single-conditions"><div class="single-section-label single-section-label-with-link">1 · Select the supporting slab<a href="' + attachmentDocumentationHref() + '">View full documentation</a></div>'
      + '<div class="seg single-slab-options"><button type="button" data-single-slab="hollow" aria-pressed="' + (slab === "hollow") + '">Hollow panel slab</button><button type="button" data-single-slab="solid" aria-pressed="' + (slab === "solid") + '">Solid concrete slab</button></div>'
      + (details.length ? '<div class="attachment-detail-list single-detail-list">' + details.map(function (code) {
          var selected = singlePointSelection.detail === code;
          return '<div class="attachment-detail-row' + (selected ? ' is-selected' : '') + '"><button class="attachment-detail-choice" type="button" data-single-detail="' + code + '" data-single-preview="' + code + '" aria-pressed="' + selected + '"><b>' + code + '</b><span>' + detailNames[code] + '</span>' + '<em data-state="' + (selected ? 'selected' : 'select') + '">' + (selected ? 'Selected' : 'Select') + '</em>' + '</button><button class="attachment-detail-open" type="button" data-single-view="' + code + '" aria-label="Open full detail ' + code + '">View</button></div>';
        }).join("") + '</div>' : '')
      + '<div class="single-attachment-method"><div class="single-section-label">2 · Choose attachment method</div><div class="seg single-attachment-method-options">'
      + supports.map(function (item) { return '<button type="button" data-single-support="' + item + '" aria-pressed="' + (support === item) + '">' + supportLabels[item] + '</button>'; }).join("") + '</div>'
      + (supportDetails.length ? '<div class="attachment-detail-list single-detail-list single-support-detail-list">' + supportDetails.map(function (code) {
          var selected = singlePointSelection.attachmentDetail === code;
          return '<div class="attachment-detail-row' + (selected ? ' is-selected' : '') + '"><button class="attachment-detail-choice" type="button" data-single-attachment-detail="' + code + '" data-single-preview="' + code + '" aria-pressed="' + selected + '"><b>' + code + '</b><span>' + singleDetailMeta[code].title + '</span>' + '<em data-state="' + (selected ? 'selected' : 'select') + '">' + (selected ? 'Selected' : 'Select') + '</em>' + '</button><button class="attachment-detail-open" type="button" data-single-view="' + code + '" aria-label="Open full detail ' + code + '">View</button></div>';
        }).join("") + '</div>' : '')
      + '</div>'
      + '</section>';
  }

  var singleDetailMeta = {
    "CF-01": { title: "Base connection detail 01", fileEU: "concrete-floor-01-metric.png", fileUSA: "concrete-floor-01-imperial.png" },
    "CF-02": { title: "Base connection detail 02", fileEU: "concrete-floor-02-metric.png", fileUSA: "concrete-floor-02-imperial.png" },
    "CF-03": { title: "Base connection detail 03", fileEU: "concrete-floor-03-metric.png", fileUSA: "concrete-floor-03-imperial.png" },
    "CW-01": { title: "Solid concrete wall · Detail 01", fileEU: "concrete-wall-01-metric.png", fileUSA: "concrete-wall-01-imperial.png" },
    "CW-02": { title: "Solid concrete wall · Detail 02", fileEU: "concrete-wall-02-metric.png", fileUSA: "concrete-wall-02-imperial.png" },
    "CW-03": { title: "Solid concrete wall · Detail 03", fileEU: "concrete-wall-03-metric.png", fileUSA: "concrete-wall-03-imperial.png" },
    "SC-01": { title: "Steel column · Detail 01", fileEU: "steel-column-01-metric.png", fileUSA: "steel-column-01-imperial.png" },
    "SC-02": { title: "Steel column · Detail 02", fileEU: "steel-column-02-metric.png", fileUSA: "steel-column-02-imperial.png" },
    "SC-03": { title: "Steel column · Detail 03", fileEU: "steel-column-03-metric.png", fileUSA: "steel-column-03-imperial.png" },
    "SC-04": { title: "Steel column · Detail 04", fileEU: "steel-column-04-metric.png", fileUSA: "steel-column-04-imperial.png" },
    "SB-01": { title: "Steel beam · Detail 01", fileEU: "steel-beam-01-metric.png", fileUSA: "steel-beam-01-imperial.png" },
    "SB-02": { title: "Steel beam · Detail 02", fileEU: "steel-beam-02-metric.png", fileUSA: "steel-beam-02-imperial.png" },
    "SB-03": { title: "Steel beam · Detail 03", fileEU: "steel-beam-03-metric.png", fileUSA: "steel-beam-03-imperial.png" },
    "MW-01": { title: "Masonry / brick wall · Detail 01", fileEU: "masonry-wall-01-metric.png", fileUSA: "masonry-wall-01-imperial.png" },
    "MW-02": { title: "Masonry / brick wall · Detail 02", fileEU: "masonry-wall-02-metric.png", fileUSA: "masonry-wall-02-imperial.png" }
  };
  function singleDetailImagePath(code) {
    var meta = singleDetailMeta[code];
    var file = S.units === "USA" && meta.fileUSA ? meta.fileUSA : (meta.fileEU || meta.file);
    return "manuals/attachment/details/" + file + "?v=wt5";
  }
  function closeSingleDetailPreview() {
    var preview = document.getElementById("single-detail-preview");
    if (preview) preview.hidden = true;
  }
  function showSingleDetailPreview(code, trigger) {
    var meta = singleDetailMeta[code];
    if (!meta) return;
    var preview = document.getElementById("single-detail-preview");
    if (!preview) {
      preview = document.createElement("div");
      preview.id = "single-detail-preview";
      preview.className = "attachment-list-preview";
      preview.hidden = true;
      document.body.appendChild(preview);
    }
    var previewTitle = trigger.closest(".column-conditions") && code === "CW-02" ? "Solid concrete column · Detail 02" : meta.title;
    preview.innerHTML = '<span class="attachment-label">Detail preview</span><h3>' + code + ' · ' + previewTitle + '</h3><img class="attachment-preview-image" src="' + singleDetailImagePath(code) + '" alt="' + code + ' ' + previewTitle + '">';
    preview.hidden = false;
    var rect = trigger.getBoundingClientRect();
    if (trigger.closest(".column-conditions")) {
      var resultRect = document.getElementById("result-root").getBoundingClientRect();
      var centeredLeft = resultRect.left + (resultRect.width - preview.offsetWidth) / 2;
      preview.style.left = Math.max(12, Math.min(centeredLeft, window.innerWidth - preview.offsetWidth - 12)) + "px";
      var below = rect.bottom + 8;
      preview.style.top = Math.max(12, Math.min(below, window.innerHeight - preview.offsetHeight - 12)) + "px";
      return;
    }
    var left = rect.right + 12;
    if (left + preview.offsetWidth > window.innerWidth - 12) left = rect.left - preview.offsetWidth - 12;
    preview.style.left = Math.max(12, left) + "px";
    preview.style.top = Math.max(12, Math.min(rect.top, window.innerHeight - preview.offsetHeight - 12)) + "px";
  }
  function openSingleDetailModal(code) {
    var meta = singleDetailMeta[code];
    if (!meta) return;
    var modal = document.getElementById("single-detail-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "single-detail-modal";
      modal.className = "attachment-detail-modal";
      modal.hidden = true;
      modal.innerHTML = '<div class="attachment-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="single-detail-modal-title"><button class="attachment-modal-close" type="button" aria-label="Close detail">×</button><span class="attachment-label">Full attachment detail</span><h2 id="single-detail-modal-title"></h2><img class="attachment-modal-image" alt=""></div>';
      document.body.appendChild(modal);
      var close = function () { modal.hidden = true; document.body.classList.remove("attachment-modal-open"); };
      modal.querySelector(".attachment-modal-close").addEventListener("click", close);
      modal.addEventListener("click", function (event) { if (event.target === modal) close(); });
      document.addEventListener("keydown", function (event) { if (event.key === "Escape" && !modal.hidden) close(); });
    }
    modal.querySelector("#single-detail-modal-title").textContent = code + " · " + meta.title;
    var image = modal.querySelector(".attachment-modal-image");
    image.src = singleDetailImagePath(code);
    image.alt = code + " " + meta.title;
    modal.hidden = false;
    document.body.classList.add("attachment-modal-open");
    modal.querySelector(".attachment-modal-close").focus();
  }

  function singleCapacityHtml() {
    var horizontal=totalHorizontalReaction(), horizontalChecked=S.sideCapacity!==null&&!isNaN(S.sideCapacity), horizontalOk=horizontalChecked&&horizontal.value<=S.sideCapacity;
    var baseGoverning=governingRZ0(), baseChecked=S.baseCapacity!==null, baseOk=baseChecked&&baseGoverning.value<=S.baseCapacity;
    var statuses="";
    if (baseChecked) statuses+='<div class="single-capacity-status ' + (baseOk?'is-ok':'is-bad') + '"><strong>' + (baseOk?'Applicable':'Exceeds capacity') + '</strong><span>Required vertical reaction at base point X0: ' + fmtForce(baseGoverning.value) + ' ' + U().force + (baseGoverning.scenario?' · '+baseGoverning.scenario:'') + '</span></div>';
    if (horizontalChecked) statuses+='<div class="single-capacity-status ' + (horizontalOk?'is-ok':'is-bad') + '"><strong>' + (horizontalOk?'Applicable':'Exceeds capacity') + '</strong><span>Total horizontal load on one column: ' + fmtForce(horizontal.value) + ' ' + U().force + ' · Σ(RXi DL + RXi LL)' + (horizontal.scenario?' · '+horizontal.scenario:'') + '</span></div>';
    return '<section class="single-capacity"><div class="single-section-label">Check capacity <span>(optional)</span></div>'
      + '<div class="single-capacity-fields">'
      + '<label><span>Allowable vertical reaction at base point (X0)</span><div class="caprow"><input id="base-capacity-input" type="number" inputmode="decimal" min="0" step="any" value="' + (S.baseCapacity===null?'':S.baseCapacity) + '" placeholder="Base load capacity"><div class="unit">' + U().force + '</div></div></label>'
      + '<label><span>Allowable total horizontal load</span><div class="caprow"><input id="side-capacity-input" type="number" inputmode="decimal" min="0" step="any" value="' + (horizontalChecked?S.sideCapacity:'') + '" placeholder="Side load capacity"><div class="unit">' + U().force + '</div></div></label>'
      + '<button class="cap-check-btn" id="single-capacity-submit" type="button">Check capacity</button></div>' + statuses + '</section>';
  }

  function columnPointConditionsHtml() {
    var support = columnPointSelection.support;
    var supports = S.type === "boulder" ? ["concrete-wall","steel-column","masonry-wall"] : ["concrete-wall","steel-column"];
    if (supports.indexOf(support) < 0) { support=null; columnPointSelection.support=null; columnPointSelection.attachmentDetail=null; }
    var labels = { "concrete-wall":"Solid concrete column", "steel-column":"Steel column", "steel-beam":"Steel beam", "masonry-wall":"Masonry / brick wall" };
    var details = support === "concrete-wall" ? ["CW-02"] : support === "steel-column" ? ["SC-01","SC-02","SC-03","SC-04"] : support === "masonry-wall" ? ["MW-01","MW-02"] : [];
    if (details.indexOf(columnPointSelection.attachmentDetail) < 0) columnPointSelection.attachmentDetail = null;
    return '<section class="single-conditions column-conditions"><div class="single-section-label single-section-label-with-link">Choose attachment method<a href="' + attachmentDocumentationHref() + '">View full documentation</a></div><div class="seg single-attachment-method-options' + (supports.length > 2 ? ' is-two-row' : '') + '">'
      + supports.map(function (item) { return '<button type="button" data-column-support="' + item + '" aria-pressed="' + (support === item) + '">' + labels[item] + '</button>'; }).join("") + '</div>'
      + (details.length ? '<div class="attachment-detail-list single-detail-list">' + details.map(function (code) {
          var selected=columnPointSelection.attachmentDetail===code;
          var title = code === "CW-02" ? "Solid concrete column · Detail 02" : singleDetailMeta[code].title;
          return '<div class="attachment-detail-row' + (selected?' is-selected':'') + '"><button class="attachment-detail-choice" type="button" data-column-attachment-detail="' + code + '" data-single-preview="' + code + '" aria-pressed="' + selected + '"><b>' + code + '</b><span>' + title + '</span>' + '<em data-state="' + (selected ? 'selected' : 'select') + '">' + (selected ? 'Selected' : 'Select') + '</em>' + '</button><button class="attachment-detail-open" type="button" data-single-view="' + code + '" aria-label="Open full detail ' + code + '">View</button></div>';
        }).join("") + '</div>' : '') + '</section>';
  }

  function columnSchematicHtml() {
    var values = columnPointValues(), count = columnLevelCount();
    var methodLabels = { "concrete-wall":"Solid concrete wall / column", "steel-column":"Steel column", "steel-beam":"Steel beam", "masonry-wall":"Masonry / brick wall" };
    var method = columnPointSelection.support ? methodLabels[columnPointSelection.support] : "Select an attachment method";
    var detail = columnPointSelection.attachmentDetail ? " · " + columnPointSelection.attachmentDetail : "";
    var rows = "", top = 54, bottom = 342, columnX = 250;
    function arrow(level, kind, value, y, offset) {
      var zero = Math.abs(value) < .000001, negative = value < 0;
      var start = negative ? columnX + 10 : columnX - 105;
      var end = negative ? columnX + 105 : columnX - 10;
      return '<line class="column-load-arrow is-' + kind.toLowerCase() + (zero ? ' is-zero' : '') + '" x1="' + start + '" y1="' + (y+offset) + '" x2="' + end + '" y2="' + (y+offset) + '"' + (zero ? '' : ' marker-end="url(#column-arrow-' + kind.toLowerCase() + ')"') + '/>'
        + '<text class="column-load-label is-' + kind.toLowerCase() + '" x="' + (negative ? columnX+112 : columnX-112) + '" y="' + (y+offset-5) + '" text-anchor="' + (negative ? 'start' : 'end') + '">LX' + level + ' ' + kind + ' = ' + fmtForce(value) + ' ' + U().force + '</text>';
    }
    for (var level=1; level<=count; level++) {
      var y = count === 1 ? (top+bottom)/2 : bottom-(level-1)*(bottom-top)/(count-1);
      rows += '<line class="column-level-line" x1="' + (columnX-22) + '" y1="' + y + '" x2="' + (columnX+22) + '" y2="' + y + '"/>'
        + '<circle class="column-detail-point' + (columnPointSelection.attachmentDetail ? '' : ' is-hidden') + '" cx="' + columnX + '" cy="' + y + '" r="7"><title>LX' + level + (columnPointSelection.attachmentDetail ? ' · '+columnPointSelection.attachmentDetail : '') + '</title></circle>'
        + '<text class="column-point-label" x="' + (columnX+34) + '" y="' + (y+4) + '">LX' + level + '</text>'
        + arrow(level,"LL",Number(values["LX"+level+"LL"]||0),y,-8)
        + arrow(level,"DL",Number(values["LX"+level+"DL"]||0),y,8);
    }
    return '<div class="column-schematic" id="column-schematic"><div class="column-schematic-head"><span>Building-column load visualization</span><strong>' + method + detail + '</strong></div>'
      + '<svg viewBox="0 0 500 390" role="img" aria-label="Loads acting at the corresponding building-column points"><defs>'
      + '<marker id="column-arrow-ll" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#ec1c24"/></marker>'
      + '<marker id="column-arrow-dl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#111"/></marker></defs>'
      + '<line class="column-structure" x1="' + columnX + '" y1="35" x2="' + columnX + '" y2="355"/><line class="column-ground" x1="195" y1="355" x2="305" y2="355"/>'
      + rows + '<text class="column-axis-label" x="250" y="380" text-anchor="middle">Existing building column / frame</text></svg></div>';
  }

  function refreshColumnVisualization() {
    var current = document.getElementById("column-schematic");
    if (!current) return;
    var holder = document.createElement("div");
    holder.innerHTML = columnSchematicHtml();
    current.replaceWith(holder.firstElementChild);
  }

  function columnCapacityHtml() {
    var capacity = S.columnCapacities.total;
    var required = totalColumnHorizontalReaction();
    var checked = capacity !== undefined && capacity !== null && !isNaN(capacity);
    var ok = checked && required.value <= Number(capacity);
    var status = checked ? '<div class="single-capacity-status ' + (ok?'is-ok':'is-bad') + '"><strong>' + (ok?'Applicable':'Exceeds capacity') + '</strong><span>Required horizontal load: ' + fmtForce(required.value) + ' ' + U().force + ' · Σ(LXi DL + LXi LL)' + (required.scenario?' · '+required.scenario:'') + '</span></div>' : '';
    return '<section class="single-capacity column-capacity"><div class="single-section-label">Check capacity <span>(optional)</span></div><div class="column-capacity-controls"><div class="column-capacity-fields"><label><span>Allowable horizontal load</span><div class="caprow"><input id="column-capacity-input" type="number" inputmode="decimal" min="0" step="any" value="' + (checked?capacity:'') + '" placeholder="Side load capacity"><div class="unit">' + U().force + '</div></div></label></div><button class="cap-check-btn column-capacity-submit" id="column-capacity-submit" type="button">Check capacity</button></div>' + status + '</section>';
  }

  function refreshSingleCapacity() {
    var current=document.querySelector(".single-point-section:not(.column-point-section) .single-capacity");
    if (!current) return;
    var holder=document.createElement("div");
    holder.innerHTML=singleCapacityHtml();
    var replacement=holder.firstElementChild;
    current.replaceWith(replacement);
    wireSingleCapacityControls(replacement);
    try { localStorage.setItem(CALCULATOR_DRAFT_KEY, JSON.stringify(currentInput())); } catch (error) {}
  }

  function wireSingleCapacityControls(root) {
    if (!root) return;
    var submit=root.querySelector("#single-capacity-submit");
    if (submit) submit.addEventListener("click",function () {
      var base=root.querySelector("#base-capacity-input"), side=root.querySelector("#side-capacity-input");
      var baseRaw=base?base.value.trim():"", sideRaw=side?side.value.trim():"";
      if (baseRaw!=="" && (!isFinite(Number(baseRaw)) || Number(baseRaw)<0)) return;
      if (sideRaw!=="" && (!isFinite(Number(sideRaw)) || Number(sideRaw)<0)) return;
      if (baseRaw!=="") S.baseCapacity=Number(baseRaw);
      if (sideRaw!=="") S.sideCapacity=Number(sideRaw);
      refreshSingleCapacity();
    });
  }

  function refreshSingleConditions() {
    var current = document.querySelector(".single-conditions");
    if (!current) return;
    var holder = document.createElement("div");
    holder.innerHTML = singlePointConditionsHtml();
    current.replaceWith(holder.firstElementChild);
    wireSingleConditionControls();
    try { localStorage.setItem(CALCULATOR_DRAFT_KEY, JSON.stringify(currentInput())); } catch (error) {}
  }

  function wireDetailControls(root) {
    root.querySelectorAll("[data-single-preview]").forEach(function (button) {
      var show = function () { showSingleDetailPreview(button.getAttribute("data-single-preview"), button); };
      button.addEventListener("mouseenter", show); button.addEventListener("focus", show);
      button.addEventListener("mouseleave", closeSingleDetailPreview); button.addEventListener("blur", closeSingleDetailPreview);
    });
    root.querySelectorAll("[data-single-view]").forEach(function (button) { button.addEventListener("click", function () { closeSingleDetailPreview(); openSingleDetailModal(button.getAttribute("data-single-view")); }); });
  }

  function wireSingleConditionControls() {
    var root = document.querySelector(".single-point-section:not(.column-point-section)") || document;
    root.querySelectorAll("[data-single-slab]").forEach(function (button) { button.addEventListener("click", function () {
      singlePointSelection.slab = button.getAttribute("data-single-slab");
      singlePointSelection.detail = null;
      refreshSingleConditions();
      refreshSchematicBasePoint();
    }); });
    root.querySelectorAll("[data-single-detail]").forEach(function (button) { button.addEventListener("click", function () { singlePointSelection.detail = button.getAttribute("data-single-detail"); refreshSingleConditions(); refreshSchematicBasePoint(); }); });
    root.querySelectorAll("[data-single-support]").forEach(function (button) { button.addEventListener("click", function () { singlePointSelection.support = button.getAttribute("data-single-support"); singlePointSelection.attachmentDetail = null; refreshSingleConditions(); refreshSchematicAttachmentPoints(); }); });
    root.querySelectorAll("[data-single-attachment-detail]").forEach(function (button) { button.addEventListener("click", function () { singlePointSelection.attachmentDetail = button.getAttribute("data-single-attachment-detail"); refreshSingleConditions(); refreshSchematicAttachmentPoints(); }); });
    wireDetailControls(root);
  }

  function refreshColumnConditions() {
    var current = document.querySelector(".column-conditions");
    if (!current) return;
    var holder = document.createElement("div");
    holder.innerHTML = columnPointConditionsHtml();
    var replacement = holder.firstElementChild;
    current.replaceWith(replacement);
    wireColumnConditionControls(replacement);
    if (window.WTAttachmentConfiguratorRefresh) {
      window.WTAttachmentConfiguratorRefresh({ input: currentInput(), snapshot: currentSnapshot() });
    }
    try { localStorage.setItem(CALCULATOR_DRAFT_KEY, JSON.stringify(currentInput())); } catch (error) {}
  }

  function wireColumnConditionControls(root) {
    root = root || document;
    root.querySelectorAll("[data-column-support]").forEach(function (button) { button.addEventListener("click", function () {
      columnPointSelection.support = button.getAttribute("data-column-support");
      columnPointSelection.attachmentDetail = null;
      refreshColumnConditions();
      refreshColumnVisualization();
    }); });
    root.querySelectorAll("[data-column-attachment-detail]").forEach(function (button) { button.addEventListener("click", function () {
      columnPointSelection.attachmentDetail = button.getAttribute("data-column-attachment-detail");
      refreshColumnConditions();
      refreshColumnVisualization();
    }); });
    wireDetailControls(root);
  }

  function wireSinglePointControls() {
    wireResultOptionTabs();
    wireSingleConditionControls();
    wireColumnConditionControls(document.querySelector(".column-conditions") || document);
    wireSingleCapacityControls(document.querySelector(".single-point-section:not(.column-point-section) .single-capacity"));
    var columnSubmit=document.getElementById("column-capacity-submit");
    if (columnSubmit) columnSubmit.addEventListener("click",function () {
      var input=document.getElementById("column-capacity-input");
      var raw=input?input.value.trim():"";
      if (raw==="" || !isFinite(Number(raw)) || Number(raw)<0) return;
      S.columnCapacities={ total:Number(raw) };
      renderResults();
    });
  }

  function wireResultOptionTabs() {
    document.querySelectorAll("[data-result-option]").forEach(function (button) {
      button.addEventListener("click", function () {
        var wasPicked = S.solutionPicked;
        S.attachmentSolution = button.getAttribute("data-result-option");
        S.solutionPicked = true;
        // Before the first pick the two sections are not in the document at all,
        // so there is nothing to toggle: re-render to build them. Afterwards the
        // in-place toggle keeps scroll position and the schematic's zoom state.
        if (!wasPicked) { renderResults(); return; }
        document.querySelectorAll("[data-result-option]").forEach(function (item) {
          var active=item.getAttribute("data-result-option")===S.attachmentSolution;
          item.setAttribute("aria-selected",String(active));
          item.setAttribute("tabindex",active?"0":"-1");
        });
        document.querySelectorAll("[data-result-section]").forEach(function (section) {
          section.hidden=section.getAttribute("data-result-section")!==S.attachmentSolution;
        });
        try { localStorage.setItem(CALCULATOR_DRAFT_KEY,JSON.stringify(currentInput())); } catch (error) {}
      });
    });
  }

  function renderResults() {
    var root = document.getElementById("result-root");
    var ready = selectedInputs.units && selectedInputs.type && selectedInputs.height && selectedInputs.span && selectedInputs.overhang
      && (S.type === "boulder" || (selectedInputs.levels && selectedInputs.force));
    var shouldAutoScroll = ready && !mobileResultsWasReady && mobileResultsAutoScrollEnabled && window.innerWidth <= 960;
    mobileResultsWasReady = ready;
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

    var values = singlePointValues();
    var columnValues = columnPointValues();
    var picked = !!S.solutionPicked;
    var prompt = picked ? '' :
      '<p class="result-solution-prompt">Choose one of the two attachment solutions above to see the loads,'
      + ' the attachment details and the capacity check.</p>';
    var html = '<div class="results-reveal"><div class="results-head">'
      + '<div><p class="title">' + title + '</p><p class="sub">' + sub + '</p></div>'
      + '</div><div class="result-solution-tabs" role="tablist" aria-label="Choose attachment solution">'
      + '<button type="button" role="tab" data-result-option="single" aria-selected="' + (picked && S.attachmentSolution==="single") + '" tabindex="' + (!picked || S.attachmentSolution==="single"?'0':'-1') + '"><span>OPTION 1:</span> Single-point attachment</button>'
      + '<button type="button" role="tab" data-result-option="beams" aria-selected="' + (picked && S.attachmentSolution==="beams") + '" tabindex="' + (picked && S.attachmentSolution==="beams"?'0':'-1') + '"><span>OPTION 2:</span> Walltopia support beams</button></div>'
      + prompt
      + '<section class="single-point-section" data-result-section="single"' + (picked && S.attachmentSolution==="single"?'':' hidden') + '><div class="single-point-heading"><div><h2>Direct Single-Point Attachment</h2><p>The climbing wall is connected directly to the existing structure at individual attachment points.</p></div></div>'
      + '<div class="single-point-grid' + (Number(S.levels) >= 3 ? ' is-three-levels' : '') + '"><div class="single-point-left">' + singlePointTableHtml(values) + singlePointConditionsHtml() + '</div>' + schematicPanelHtml() + '</div>'
      + singleCapacityHtml() + notesHtml() + '</section>'
      + '<section class="single-point-section column-point-section" data-result-section="beams"' + (picked && S.attachmentSolution==="beams"?'':' hidden') + '><div class="single-point-heading"><div><h2>Walltopia Support Beams Between Building Columns</h2><p>Walltopia support beams are added between the existing building columns, and the climbing wall is attached to the beams.</p></div></div>'
      + '<div class="column-point-body">' + columnPointTableHtml(columnValues) + columnPointConditionsHtml() + '<div id="attachment-config-root" data-visual-only="true"></div></div>'
      + columnCapacityHtml() + notesHtml() + '</section></div>';
    root.innerHTML = html;
    wireSchematicView();
    wireSinglePointControls();
    var calculatorPayload = { input: currentInput(), snapshot: currentSnapshot() };
    window.WTCalculatorPayload = calculatorPayload;
    window.dispatchEvent(new CustomEvent("wtcalculatorchange", { detail: calculatorPayload }));
    try { localStorage.setItem(CALCULATOR_DRAFT_KEY, JSON.stringify(currentInput())); } catch (error) {}
    if (shouldAutoScroll) {
      mobileResultsAutoScrollEnabled = false;
      window.requestAnimationFrame(function () {
        var header = document.querySelector(".masthead");
        var headerOffset = header ? header.getBoundingClientRect().height : 0;
        var targetTop = root.getBoundingClientRect().top + window.scrollY - headerOffset - 12;
        window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      });
    }
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
      + schematicSvg() + '</div><div class="attachment-hover-card side-base-detail-preview" id="side-base-detail-preview" hidden></div></div>';
  }

  function refreshSchematicBasePoint() {
    var point = document.getElementById("side-base-detail-point");
    if (!point) return;
    var visible = !!singlePointSelection.detail;
    point.classList.toggle("is-hidden", !visible);
    point.setAttribute("tabindex", visible ? "0" : "-1");
    point.setAttribute("aria-label", singlePointSelection.detail ? "Preview base detail " + singlePointSelection.detail : "Select an applicable base detail");
    if (!visible) hideSchematicBasePreview();
  }
  function refreshSchematicAttachmentPoints() {
    var visible = !!singlePointSelection.attachmentDetail;
    document.querySelectorAll(".side-attachment-detail-point").forEach(function (point) {
      point.classList.toggle("is-hidden", !visible);
      point.setAttribute("tabindex", visible ? "0" : "-1");
      point.setAttribute("aria-label", visible ? (singlePointSelection.attachmentDetail ? "Preview attachment detail " + singlePointSelection.attachmentDetail + " at X" + point.getAttribute("data-side-level") : "Select an applicable attachment detail for X" + point.getAttribute("data-side-level")) : "Select an attachment method");
    });
    if (!visible) hideSchematicBasePreview();
  }
  function showSchematicBasePreview() {
    var preview = document.getElementById("side-base-detail-preview");
    if (!preview || !singlePointSelection.detail) return;
    var code = singlePointSelection.detail;
    if (!code) {
      preview.innerHTML = '<span class="attachment-label">Base point</span><h3>Select an attachment detail</h3><p>Choose one of the applicable CF details to preview it here.</p>';
    } else {
      preview.innerHTML = '<h3>' + code + ' · Base connection detail</h3><img class="attachment-preview-image" src="' + singleDetailImagePath(code) + '" alt="' + code + ' base connection detail"><button class="attachment-full-trigger" type="button" data-side-base-view="' + code + '">View full detail</button>';
      preview.querySelector("[data-side-base-view]").addEventListener("click", function () { openSingleDetailModal(code); });
    }
    preview.hidden = false;
  }
  function hideSchematicBasePreview() {
    var preview = document.getElementById("side-base-detail-preview");
    if (preview) preview.hidden = true;
  }
  function showSchematicAttachmentPreview(level) {
    var preview = document.getElementById("side-base-detail-preview");
    var code = singlePointSelection.attachmentDetail;
    var meta = singleDetailMeta[code];
    if (!preview || !singlePointSelection.attachmentDetail) return;
    if (!meta) {
      preview.innerHTML = '<span class="attachment-label">Attachment point X' + level + '</span><h3>Select an attachment detail</h3><p>Choose one of the applicable details to preview it here.</p>';
    } else {
      preview.innerHTML = '<h3>X' + level + ' · ' + code + ' · ' + meta.title + '</h3><img class="attachment-preview-image" src="' + singleDetailImagePath(code) + '" alt="' + code + ' ' + meta.title + '"><button class="attachment-full-trigger" type="button" data-side-level-view="' + code + '">View full detail</button>';
      preview.querySelector("[data-side-level-view]").addEventListener("click", function () { openSingleDetailModal(code); });
    }
    preview.hidden = false;
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
    var basePoint = document.getElementById("side-base-detail-point");
    var basePreview = document.getElementById("side-base-detail-preview");
    if (basePoint) {
      basePoint.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
      basePoint.addEventListener("mouseenter", showSchematicBasePreview);
      basePoint.addEventListener("focus", showSchematicBasePreview);
      basePoint.addEventListener("mouseleave", function () { window.setTimeout(function () { if (!basePreview || !basePreview.matches(":hover")) hideSchematicBasePreview(); }, 100); });
      basePoint.addEventListener("blur", function () { if (!basePreview || !basePreview.matches(":hover")) hideSchematicBasePreview(); });
    }
    if (basePreview) basePreview.addEventListener("mouseleave", hideSchematicBasePreview);
    document.querySelectorAll(".side-attachment-detail-point").forEach(function (point) {
      var show = function () { showSchematicAttachmentPreview(point.getAttribute("data-side-level")); };
      point.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
      point.addEventListener("mouseenter", show);
      point.addEventListener("focus", show);
      point.addEventListener("click", show);
      point.addEventListener("mouseleave", function () { window.setTimeout(function () { if (!basePreview || !basePreview.matches(":hover")) hideSchematicBasePreview(); }, 100); });
      point.addEventListener("blur", function () { if (!basePreview || !basePreview.matches(":hover")) hideSchematicBasePreview(); });
    });
    refreshSchematicBasePoint();
    refreshSchematicAttachmentPoints();
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
    var attachments = "", attachmentPoints = "", attachmentPointLabels = "", forces = "", heightDims = "";
    function horizontalReaction(key, value, y, kind, labelY) {
      var negative = value < 0, zero = Math.abs(value) < .000001;
      var start = negative ? forceCutX : 40, end = negative ? 40 : forceCutX;
      return '<line class="side-reaction is-' + kind + (zero ? ' is-zero' : '') + '" x1="' + start + '" y1="' + y + '" x2="' + end + '" y2="' + y + '"' + (zero ? '' : ' marker-end="url(#side-force-' + kind + ')"') + '><title>' + key + ' · ' + kind.toUpperCase() + ' = ' + fmtForce(value) + ' ' + U().force + '</title></line><text class="side-reaction-label is-' + kind + '" x="53" y="' + labelY + '" text-anchor="middle">' + key + ' ' + kind.toUpperCase() + ' = ' + fmtForce(value) + ' ' + U().force + '</text>';
    }
    heights.forEach(function (z, i) {
      var n = i + 1, x = xAt(z), y = yAt(z), dimX = 142 - i * 18;
      var rx = reaction("RX" + n);
      attachments += '<line class="side-support" x1="' + attachmentPlaneX + '" y1="' + y + '" x2="' + x + '" y2="' + y + '"/><path class="side-anchor" d="M' + attachmentPlaneX + ' ' + (y-9) + 'v18l10-9z"/>';
      attachmentPoints += '<circle class="side-attachment-detail-point' + (singlePointSelection.attachmentDetail ? '' : ' is-hidden') + '" data-side-level="' + n + '" cx="' + attachmentPlaneX + '" cy="' + y + '" r="7" tabindex="' + (singlePointSelection.attachmentDetail ? '0' : '-1') + '" role="button"><title>Attachment point X' + n + '</title></circle>';
      attachmentPointLabels += '<text class="side-point-label" x="' + (attachmentPlaneX + 12) + '" y="' + (y - 11) + '">X' + n + '</text>';
      forces += horizontalReaction('RX' + n, rx.ll, y - 8, 'll', y - 15)
        + horizontalReaction('RX' + n, rx.dl, y + 8, 'dl', y + 22);
      heightDims += '<line class="side-extension" x1="' + dimX + '" y1="' + y + '" x2="' + attachmentPlaneX + '" y2="' + y + '"/><line class="side-dimension" x1="' + dimX + '" y1="' + groundY + '" x2="' + dimX + '" y2="' + y + '"/><path class="side-tick" d="M' + (dimX-5) + ' ' + (groundY+5) + 'l10-10M' + (dimX-5) + ' ' + (y+5) + 'l10-10"/><text class="side-dim-label" x="' + (dimX-8) + '" y="' + ((groundY+y)/2) + '" text-anchor="middle" transform="rotate(-90 ' + (dimX-8) + ' ' + ((groundY+y)/2) + ')">Z' + n + ' = ' + dimValue(z) + '</text>';
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
      var start = negative ? 376 : 436, end = negative ? 436 : 376;
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
      + (S.type === "wall" ? baseHorizontal(rx0.ll, 446, 'll', 488) + baseHorizontal(rx0.dl, 462, 'dl', 504) : "")
      + baseVertical(rz0.ll, 197, 'll', 340) + baseVertical(rz0.dl, 213, 'dl', 354)
      + '<g class="side-axis"><line x1="26" y1="468" x2="26" y2="420" marker-end="url(#side-force-arrow)"/><line x1="26" y1="468" x2="80" y2="468" marker-end="url(#side-force-arrow)"/><text x="5" y="420">+Z</text><text x="65" y="488">+X</text></g>'
      + attachmentPointLabels
      + '<text class="side-point-label" x="' + (baseX - 12) + '" y="' + (groundY - 13) + '" text-anchor="end">X0</text>'
      + attachmentPoints
      + '<circle id="side-base-detail-point" class="side-base-detail-point' + (singlePointSelection.detail ? '' : ' is-hidden') + '" cx="' + baseX + '" cy="' + groundY + '" r="7" tabindex="' + (singlePointSelection.detail ? '0' : '-1') + '" role="button"><title>Base attachment detail</title></circle>'
      + "</svg>";
  }

  function notesHtml() {
    var u = U();
    var code = S.type === "wall" ? u.codeWall : u.codeBoulder;
    return '<div class="notes">'
      + '<div class="preliminary-banner"><strong>Preliminary loads — NOT for construction.</strong></div>'
      + '<ol>'
      + '<li>Coefficient for dead load = <b>' + u.dl + '</b>.</li>'
      + '<li>Coefficient for live load = <b>' + u.ll + '</b>.</li>'
      + '<li>All loads are ' + (S.factored ? 'factored values' : 'characteristic values') + ' and are expressed in <b>' + u.force + '</b>. Refer to the positive directions of the coordinate system when interpreting their signs.</li>'
      + '<li>The application manual is an inseparable part of the load tables. For additional information, consult Walltopia.</li>'
      + '<li><span class="code">Used code: ' + code + '.</span></li>'
      + '</ol></div>';
  }

  // ============ projects: save / load ============
  var P = null; // currently loaded/edited project { id, name, tags, properties }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function currentInput() {
    return { units: S.units, type: S.type, height: S.height, levels: S.levels,
      overhang: S.overhang, span: S.span, force: S.force, factored: S.factored,
      capacity: S.cap, baseCapacity: S.baseCapacity, sideCapacity: S.sideCapacity,
      columnCapacities: S.columnCapacities,
      attachmentSolution: S.attachmentSolution, solutionPicked: S.solutionPicked,
      supportingSlab: singlePointSelection.slab, baseDetail: singlePointSelection.detail,
      supportingStructure: singlePointSelection.support, attachmentDetail: singlePointSelection.attachmentDetail,
      columnSupportingStructure: columnPointSelection.support, columnAttachmentDetail: columnPointSelection.attachmentDetail };
  }
  function applyInput(inp) {
    if (!inp) return;
    ["units", "type", "height", "levels", "overhang", "span", "force", "factored"].forEach(function (k) {
      if (inp[k] !== undefined && inp[k] !== null) S[k] = inp[k];
    });
    S.cap = (inp.capacity !== undefined && inp.capacity !== null) ? inp.capacity : null;
    S.baseCapacity = inp.baseCapacity !== undefined && inp.baseCapacity !== null ? Number(inp.baseCapacity) : null;
    S.sideCapacity = inp.sideCapacity !== undefined && inp.sideCapacity !== null ? Number(inp.sideCapacity) : null;
    S.columnCapacities = inp.columnCapacities && typeof inp.columnCapacities === "object" ? inp.columnCapacities : {};
    S.attachmentSolution = inp.attachmentSolution === "beams" ? "beams" : "single";
    // A restored draft or project already carries a decision; only a fresh
    // calculator starts with the results closed.
    S.solutionPicked = !!inp.solutionPicked;
    if (inp.supportingSlab) singlePointSelection.slab = inp.supportingSlab;
    if (inp.baseDetail) singlePointSelection.detail = inp.baseDetail;
    if (inp.supportingStructure) singlePointSelection.support = inp.supportingStructure;
    if (inp.attachmentDetail) singlePointSelection.attachmentDetail = inp.attachmentDetail;
    if (inp.columnSupportingStructure) columnPointSelection.support = inp.columnSupportingStructure;
    if (inp.columnAttachmentDetail) columnPointSelection.attachmentDetail = inp.columnAttachmentDetail;
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
    var hasCapacityCheck = false, allCapacityChecksPass = true;
    if (S.baseCapacity !== null) {
      hasCapacityCheck = true;
      if (governingRZ0().value > S.baseCapacity) allCapacityChecksPass = false;
    }
    if (S.sideCapacity !== null) {
      hasCapacityCheck=true;
      if (totalHorizontalReaction().value>Number(S.sideCapacity)) allCapacityChecksPass=false;
    }
    var columnCapacity = S.columnCapacities.total;
    if (columnCapacity !== undefined && columnCapacity !== null && !isNaN(columnCapacity)) {
      hasCapacityCheck = true;
      if (totalColumnHorizontalReaction().value > Number(columnCapacity)) allCapacityChecksPass = false;
    }
    var verdict = !hasCapacityCheck ? "neutral" : (allCapacityChecksPass ? "ok" : "bad");
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
    if (P) {
      location.href = "dashboard.html?focus=" + encodeURIComponent(P.id);
      return;
    }
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
    }
    html += "</div>";
    root.innerHTML = html;
    if (P) {
      root.querySelector("#pb-exit").onclick = exitEditing;
      root.querySelector("#pb-update").onclick = function () { doSave("update", true); };
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
        var moreMenu = root.querySelector("#pb-more-menu");
        var moreButton = root.querySelector("#pb-more");
        if (moreMenu) moreMenu.hidden = true;
        if (moreButton) {
          moreButton.setAttribute("aria-expanded", "false");
          moreButton.innerHTML = "More &#9656;";
        }
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

  async function doSave(mode, returnToProjects) {
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
      if (mode === "update" && returnToProjects) {
        try { sessionStorage.setItem("walltopia.projects.flash", "Project updated"); } catch (error) {}
        location.href = "dashboard.html?focus=" + encodeURIComponent(P.id);
        return;
      }
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
      // Opening a saved project is not entering a new calculation: the design was
      // already decided when it was saved, so the results open straight away. The
      // server also drops `solutionPicked` (it is not in the stored-input
      // whitelist), so it cannot be recovered from the record itself.
      S.solutionPicked = true;
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
  document.getElementById("chk-factored").addEventListener("change", function (e) {
    S.factored = e.target.checked; renderResults();
  });
  function resetCalculator(scrollToTop) {
    S.units = "EU";
    S.type = "wall";
    S.height = 12;
    S.levels = 3;
    S.span = 6;
    S.overhang = 1;
    S.force = 1;
    S.factored = false;
    S.cap = null;
    S.baseCapacity = null;
    S.sideCapacity = null;
    S.columnCapacities = {};
    S.attachmentSolution = "single";
    S.solutionPicked = false;
    singlePointSelection = { slab: null, detail: null, support: null, attachmentDetail: null };
    columnPointSelection = { support: null, attachmentDetail: null };
    Object.keys(selectedInputs).forEach(function (key) { selectedInputs[key] = false; });
    schematicView = { scale: 1, panX: 0, panY: 0 };
    P = null;

    document.getElementById("chk-factored").checked = false;
    history.replaceState(null, "", "index.html");
    clampAndRender();
    try { localStorage.removeItem(CALCULATOR_DRAFT_KEY); } catch (error) {}
    if (scrollToTop) {
      document.querySelector(".panel").scrollTo({ top: 0, behavior: "smooth" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  document.getElementById("reset-calculator").addEventListener("click", function () {
    resetCalculator(true);
  });
  clampAndRender();

  // projects: react to login/logout, then attempt to load a shared/opened project
  if (window.WTAuth) {
    window.WTAuth.onChange(function (user) {
      if (!user) P = null; // logged out — drop the editing context so guests can't hit protected actions
      renderProjectBar();
    });
    window.addEventListener("wtauth:logout", function () { resetCalculator(true); });
    renderProjectBar();
    maybeLoadProjectFromUrl();
  }
})();
