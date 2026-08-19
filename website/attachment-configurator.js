/* Prototype: project-linked attachment selection + ACS point preview. */
(function () {
  "use strict";
  var root = document.getElementById("attachment-config-root");
  var DETAIL_PATH = "manuals/attachment/details/";
  var ATTACHMENT_DRAFT_KEY = "walltopia.attachment.draft.v1";
  var state = { type: "wall", slab: "solid-concrete-slab", baseDetailId: null, support: "concrete-wall", detail: null, input: { height: 12, levels: 3 }, levelForces: [], deadLevelForces: [], forceUnit: "kN", baseForceLL: null, baseForceDL: null, columnSlab: null, columnBaseDetail: null, showForces: true, selected: {}, view: { scale: 1, panX: 0, panY: 0 }, viewContext: null };
  try {
    var attachmentDraft = JSON.parse(localStorage.getItem(ATTACHMENT_DRAFT_KEY) || "null");
    if (attachmentDraft && typeof attachmentDraft === "object") {
      ["slab", "baseDetailId", "support", "detail"].forEach(function (key) {
        if (attachmentDraft[key]) state[key] = attachmentDraft[key];
      });
    }
  } catch (error) {}
  if (window.WTCalculatorPayload) {
    state.input = window.WTCalculatorPayload.input || state.input;
    state.type = state.input.type || state.type;
    state.support = state.input.columnSupportingStructure || state.support;
    state.detail = state.input.columnAttachmentDetail || null;
    state.levelForces = (window.WTCalculatorPayload.snapshot && window.WTCalculatorPayload.snapshot.levelForces) || [];
    state.deadLevelForces = (window.WTCalculatorPayload.snapshot && window.WTCalculatorPayload.snapshot.levelDeadForces) || [];
    state.baseForceLL = window.WTCalculatorPayload.snapshot ? window.WTCalculatorPayload.snapshot.baseVerticalLL : null;
    state.baseForceDL = window.WTCalculatorPayload.snapshot ? window.WTCalculatorPayload.snapshot.baseVerticalDL : null;
    state.forceUnit = (window.WTCalculatorPayload.snapshot && window.WTCalculatorPayload.snapshot.unit) || state.forceUnit;
    state.columnSlab = state.input.columnSupportingSlab || null;
    state.columnBaseDetail = state.input.columnBaseDetail || null;
    if (state.columnSlab) state.slab = state.columnSlab === "hollow" ? "hollow-panel-slab" : "solid-concrete-slab";
    if (state.columnBaseDetail) state.baseDetailId = state.columnBaseDetail;
    state.showForces = window.WTCalculatorPayload.showForces !== false;
    state.selected = window.WTCalculatorPayload.selected || {};
  }

  var details = [
    { id: "CF-01", support: "concrete-floor", slab: "solid-concrete-slab", title: "Concrete floor · Detail 01", file: "concrete-floor-01-metric.png", fileUSA: "concrete-floor-01-imperial.png", point: "base" },
    { id: "CF-02", support: "concrete-floor", slab: "solid-concrete-slab", title: "Concrete floor · Detail 02", file: "concrete-floor-02-metric.png", fileUSA: "concrete-floor-02-imperial.png", point: "base" },
    { id: "CF-03", support: "concrete-floor", slab: "hollow-panel-slab", title: "Concrete floor · Detail 03", file: "concrete-floor-03-metric.png", fileUSA: "concrete-floor-03-imperial.png", point: "base" },
    { id: "CF-04", support: "concrete-floor", slab: "solid-concrete-slab", title: "Concrete floor · Detail 04", file: "concrete-floor-04-metric.png", fileUSA: "concrete-floor-04-imperial.png", point: "base" },
    { id: "CF-05", support: "concrete-floor", slab: "solid-concrete-slab", title: "Concrete floor · Detail 05", file: "concrete-floor-05-metric.png", fileUSA: "concrete-floor-05-imperial.png", point: "base" },
    { id: "CW-01", support: "concrete-wall", title: "Concrete wall · Detail 01", file: "concrete-wall-01-metric.png", fileUSA: "concrete-wall-01-imperial.png", point: "level" },
    { id: "CW-02", support: "concrete-wall", title: "Concrete wall · Detail 02", file: "concrete-wall-02-metric.png", fileUSA: "concrete-wall-02-imperial.png", point: "level" },
    { id: "CW-03", support: "concrete-wall", title: "Concrete wall · Detail 03", file: "concrete-wall-03-metric.png", fileUSA: "concrete-wall-03-imperial.png", point: "level" },
    { id: "SC-01", support: "steel-column", title: "Steel column · Detail 01", file: "steel-column-01-metric.png", fileUSA: "steel-column-01-imperial.png", point: "level" },
    { id: "SC-02", support: "steel-column", title: "Steel column · Detail 02", file: "steel-column-02-metric.png", fileUSA: "steel-column-02-imperial.png", point: "level" },
    { id: "SC-03", support: "steel-column", title: "Steel column · Detail 03", file: "steel-column-03-metric.png", fileUSA: "steel-column-03-imperial.png", point: "level" },
    { id: "SC-04", support: "steel-column", title: "Steel column · Detail 04", file: "steel-column-04-metric.png", fileUSA: "steel-column-04-imperial.png", point: "level" },
    { id: "SB-01", support: "steel-beam", title: "Steel beam · Detail 01", file: "steel-beam-01-metric.png", fileUSA: "steel-beam-01-imperial.png", point: "level" },
    { id: "SB-02", support: "steel-beam", title: "Steel beam · Detail 02", file: "steel-beam-02-metric.png", fileUSA: "steel-beam-02-imperial.png", point: "level" },
    { id: "SB-03", support: "steel-beam", title: "Steel beam · Detail 03", file: "steel-beam-03-metric.png", fileUSA: "steel-beam-03-imperial.png", point: "level" },
    { id: "MW-01", support: "masonry-wall", title: "Masonry wall · Detail 01", file: "masonry-wall-01-metric.png", fileUSA: "masonry-wall-01-imperial.png", point: "level", boulderOnly: true },
    { id: "MW-02", support: "masonry-wall", title: "Masonry wall · Detail 02", file: "masonry-wall-02-metric.png", fileUSA: "masonry-wall-02-imperial.png", point: "level", boulderOnly: true }
  ];
  var slabLabels = { "hollow-panel-slab": "Hollow panel slab", "solid-concrete-slab": "Solid concrete slab" };
  var supportLabels = { "concrete-wall": "Solid concrete wall / column", "steel-column": "Steel column", "steel-beam": "Steel beam", "masonry-wall": "Masonry / brick wall" };
  var standardZ = {
    "8": {"1":[7.5], "2":[4.5,7.5]}, "9": {"2":[4.5,8.5]},
    "10": {"2":[5,9.5]}, "11": {"2":[5.5,10.5]},
    "12": {"2":[6,11.5], "3":[4,8,11.5]}, "13": {"3":[4.5,9,12.5]},
    "14": {"3":[4.5,9,13.5]}, "15": {"3":[5,10,14.5]}, "16": {"3":[5.5,11,15.5]}
  };

  function detailFile(d) {
    return state.input && state.input.units === "USA" && d.fileUSA ? d.fileUSA : d.file;
  }
  function detailImage(d, cls) {
    return '<img class="' + (cls || "") + '" src="' + DETAIL_PATH + detailFile(d) + '" alt="' + d.title + '" loading="lazy">';
  }
  function attachmentDocumentationHref() {
    var units = state.input && state.input.units === "USA" ? "USA" : "EU";
    return "technical-documentation.html?units=" + units + "#attachment-details";
  }
  function allowedSupports() { return state.type === "boulder" ? ["concrete-wall","steel-column","steel-beam","masonry-wall"] : ["concrete-wall","steel-column","steel-beam"]; }
  function supportDetails() { return details.filter(function (d) { return d.support === state.support && (!d.boulderOnly || state.type === "boulder"); }); }
  function floorDetails() { return details.filter(function (d) { return d.support === "concrete-floor" && d.slab === state.slab; }); }
  function baseDetail() { return floorDetails().find(function (d) { return d.id === state.baseDetailId; }) || floorDetails()[0]; }
  function selectedDetail() { return details.find(function (d) { return d.id === state.detail; }) || null; }
  function detailName(d) {
    if (d.point === "base") return "Base connection detail " + d.id.split("-")[1];
    var category = d.point === "base" ? slabLabels[d.slab] : supportLabels[d.support];
    return category + " · " + d.title.replace(/^.*·\s*/, "");
  }
  function detailChoice(d, attribute, selected) {
    return '<div class="attachment-detail-row' + (selected ? ' is-selected' : '') + '">'
      + '<button class="attachment-detail-choice" type="button" ' + attribute + '="' + d.id + '" data-preview-detail="' + d.id + '" aria-pressed="' + selected + '">'
      + '<b>' + d.id + '</b><span>' + detailName(d) + '</span>'
      + '<em data-state="' + (selected ? 'selected' : 'select') + '">' + (selected ? 'Selected' : 'Select') + '</em></button>'
      + '<button class="attachment-detail-open" type="button" data-full-detail="' + d.id + '" aria-label="Open full detail ' + d.id + '">View</button></div>';
  }

  function render() {
    hideListPreview();
    root = document.getElementById("attachment-config-root");
    if (!root) return;
    if (root.getAttribute("data-visual-only") === "true") {
      state.support = state.input.columnSupportingStructure || null;
      state.detail = state.input.columnAttachmentDetail || null;
      if (allowedSupports().indexOf(state.support) < 0) state.support = null;
      if (!selectedDetail() || selectedDetail().support !== state.support) state.detail = null;
      var visualLevels = state.type === "boulder" ? 1 : Math.max(1, Number(state.input.levels) || 1);
      root.innerHTML = '<div class="attachment-visual-layout" id="attachment-visual-layout"><div class="attachment-acs">'
        + '<div class="attachment-view-controls" aria-label="Drawing zoom controls"><button type="button" data-view-action="out" aria-label="Zoom out">−</button><span id="attachment-zoom-value">100%</span><button type="button" data-view-action="in" aria-label="Zoom in">+</button><button type="button" data-view-action="reset" aria-label="Reset view">↺</button></div>'
        + '<div class="attachment-viewport" id="attachment-viewport" aria-label="Drag to move the drawing">' + acsSvg(visualLevels) + '</div></div><div class="attachment-hover-card" id="attachment-preview" hidden></div></div>';
      wire();
      return;
    }
    if (!baseDetail() || baseDetail().slab !== state.slab) state.baseDetailId = floorDetails()[0].id;
    else state.baseDetailId = baseDetail().id;
    if (allowedSupports().indexOf(state.support) < 0) state.support = allowedSupports()[0];
    if (!selectedDetail() || selectedDetail().support !== state.support) state.detail = supportDetails()[0].id;
    try { localStorage.setItem(ATTACHMENT_DRAFT_KEY, JSON.stringify({ slab: state.slab, baseDetailId: state.baseDetailId, support: state.support, detail: state.detail })); } catch (error) {}
    var d = selectedDetail();
    var levels = state.type === "boulder" ? 1 : Math.max(1, Number(state.input.levels) || 1);
    root.innerHTML = '<section class="attachment-config">'
      + '<div class="attachment-config-head"><div><span>Attachment configuration</span><h2>Select the supporting slab and attachment method</h2><p>These selections filter the applicable standard details. They do not change the preliminary load values.</p></div>'
      + '</div>'
      + '<div class="attachment-support attachment-option-row"><div class="attachment-option-label-row"><span class="attachment-label">1 · Select the supporting slab</span><a href="' + attachmentDocumentationHref() + '">View full documentation</a></div><div class="seg" id="attachment-slab-buttons">'
      + Object.keys(slabLabels).map(function (s) { return '<button type="button" data-slab="' + s + '" aria-pressed="' + (s === state.slab) + '">' + slabLabels[s] + "</button>"; }).join("")
      + "</div></div>"
      + '<div class="attachment-support attachment-base-details"><div class="attachment-detail-list" id="attachment-floor-detail-buttons">'
      + floorDetails().map(function (item) { return detailChoice(item, "data-base-detail", item.id === state.baseDetailId); }).join("")
      + "</div></div>"
      + '<div class="attachment-support attachment-option-row"><div class="attachment-option-label-row"><span class="attachment-label">2 · Choose attachment method</span><a href="' + attachmentDocumentationHref() + '">View full documentation</a></div><div class="seg" id="attachment-support-buttons">'
      + allowedSupports().map(function (s) { return '<button type="button" data-support="' + s + '" aria-pressed="' + (s === state.support) + '">' + supportLabels[s] + "</button>"; }).join("")
      + "</div></div>"
      + '<div class="attachment-detail-list" id="attachment-detail-buttons">'
      + supportDetails().map(function (item) { return detailChoice(item, "data-detail", item.id === d.id); }).join("")
      + "</div>"
      + '<div class="attachment-visual-layout" id="attachment-visual-layout"><div class="attachment-acs">'
      + '<div class="attachment-view-controls" aria-label="Drawing zoom controls"><button type="button" data-view-action="out" aria-label="Zoom out">−</button><span id="attachment-zoom-value">100%</span><button type="button" data-view-action="in" aria-label="Zoom in">+</button><button type="button" data-view-action="reset" aria-label="Reset view">↺</button></div>'
      + '<div class="attachment-viewport" id="attachment-viewport" aria-label="Drag to move the drawing">' + acsSvg(levels) + '</div></div><div class="attachment-hover-card" id="attachment-preview" hidden></div></div>'
      + "</section>";
    wire();
  }

  // Vasi #4.1: draw the chosen supporting slab at the base of the middle column.
  // Vasi 19 Aug: the base itself is drawn as attachment point X0, exactly like
  // X1..Xn. The old green placeholder circle and its "Select the supporting slab"
  // caption sat on top of the A span dimension and smeared the drawing, so both
  // are gone -- an unselected base simply shows the X0 point with no slab under it.
  function slabGlyphSvg(cx, cy, slab) {
    if (!slab) return "";
    var w = 92, h = 16, x = cx - w / 2, y = cy - 3;
    var body = '<rect class="acs-slab-body" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>';
    var fill = "";
    if (slab === "hollow") {
      for (var k = 0; k < 5; k++) fill += '<circle class="acs-slab-core" cx="' + (x + 13 + k * 16.5) + '" cy="' + (y + h / 2) + '" r="4.4"/>';
    } else {
      var hs = "";
      for (var m = 0; m < 6; m++) hs += "M" + (x + 6 + m * 15) + " " + (y + h) + "l9 -" + h;
      fill = '<path class="acs-slab-hatch" d="' + hs + '"/>';
    }
    var label = slab === "hollow" ? "Hollow panel slab" : "Solid concrete slab";
    return '<g class="acs-slab">' + body + fill + '<title>' + label + '</title></g>';
  }

  // The X0 marker + its label, built from the same recipe as the X1..Xn markers.
  function basePointSvg(cx, cy, interactive) {
    var detail = interactive ? state.columnBaseDetail : null;
    return '<circle class="acs-column-point' + (interactive ? ' attachment-point' : '') + '"'
      + (interactive ? ' data-point="base" tabindex="0" role="button" cursor="pointer" pointer-events="all" aria-label="Base attachment point X0 detail"' : '')
      + ' cx="' + cx + '" cy="' + cy + '" r="8"><title>Attachment point X0'
      + (detail ? ' \u00b7 ' + detail : '') + '</title></circle>'
      + '<text class="acs-column-point-label" x="' + (cx + 18) + '" y="' + (cy - 20) + '">X0</text>';
  }

  // Vasi 19 Aug: show the vertical reactions at X0 next to the base point.
  function baseReactionSvg(cx, cy) {
    if (!state.showForces) return "";
    var ll = Number(state.baseForceLL), dl = Number(state.baseForceDL);
    if (!isFinite(ll) && !isFinite(dl)) return "";
    // Sit clear of the Lx1 block (anchored left of the column) and of the A span
    // dimension that runs along the ground -- that overlap is what Vasi flagged.
    var textX = cx + 90, llY = cy - 64, dlY = llY + 17, ax = cx + 16;
    var llText = "RZ0 LL" + (isFinite(ll) ? " = " + ll.toFixed(2) + " " + state.forceUnit : "");
    var dlText = "RZ0 DL" + (isFinite(dl) ? " = " + dl.toFixed(2) + " " + state.forceUnit : "");
    // Vertical reaction: down into the foundation, or up when the value is uplift.
    var negative = isFinite(ll) && ll < 0;
    var arrow = negative ? "M" + ax + " " + (cy - 12) + "v-30" : "M" + ax + " " + (cy - 42) + "v30";
    return '<path class="acs-load-arrow is-ll" d="' + arrow + '" marker-end="url(#config-arrow-ll)"><title>RZ0 LL</title></path>'
      + '<text class="acs-lx-label is-ll" x="' + textX + '" y="' + llY + '">' + llText + '</text>'
      + '<text class="acs-lx-label is-dl" x="' + textX + '" y="' + dlY + '">' + dlText + '</text>';
  }

  // Vasi 19 Aug: when a parameter gets its concrete value the matching dimension
  // label flashes red, so it is obvious what just changed. Keyed by label, so a
  // first paint (nothing to compare against) stays quiet.
  // A single input change can repaint the results more than once; hold the flag
  // open for a moment so the repaint that survives still carries the flash.
  var lastLabelText = {};
  function flashClass(key, text) {
    var entry = lastLabelText[key], now = Date.now();
    if (!entry) { lastLabelText[key] = { text: text, until: 0 }; return ""; }
    if (entry.text !== text) { entry.text = text; entry.until = now + 900; }
    return now < entry.until ? " is-value-flash" : "";
  }

  function acsSvg(levels) {
    var v = {
      a: Number(state.input.span) || 6,
      x: Number(state.input.overhang) || 1,
      height: Number(state.input.height) || 12,
      levels: levels
    };
    var byHeight = standardZ[String(v.height)] || {};
    var zValues = byHeight[String(v.levels)] || Object.values(byHeight)[0] || [];
    if (!zValues.length) {
      for (var zi = 1; zi <= v.levels; zi++) zValues.push(v.height * zi / v.levels);
    }
    var left = 120, right = 610, mid = (left + right) / 2;
    var baseY = 390;
    // Boulder walls are only 4–5 m high. A fixed climbing-wall scale made them
    // occupy a narrow strip at the bottom of the drawing. Give each structure
    // type its own visual scale while keeping all labels in real metres.
    var scaleZ = state.type === "boulder" ? 52 : 20;
    var topY = baseY - v.height * scaleZ;
    var levelYs = zValues.map(function (z) { return baseY - z * scaleZ; });
    var visualOnly = root && root.getAttribute("data-visual-only") === "true";
    var sel = state.selected || {};
    var spanText = sel.span ? 'A = ' + v.a.toFixed(1) + ' m' : 'A';
    var overhangText = sel.overhang ? 'X = ' + v.x.toFixed(1) + ' m' : 'X';
    var heightText = sel.height ? 'H = ' + v.height.toFixed(0) + ' m' : 'H';
    var hasAttachmentDetail = !!selectedDetail();
    var circles = visualOnly ? "" : '<circle class="attachment-point base-point" data-point="base" cx="' + mid + '" cy="' + baseY + '" r="8" tabindex="0" role="button" cursor="pointer" pointer-events="all" aria-label="Base attachment detail"/>';
    var beams = "", labels = "", dims = "", pointMarkers = "";
    levelYs.forEach(function (y, i) {
      // Match the roof contour slope exactly: +12 px at the left and -12 px
      // at the right across the same span, so all attachment levels are parallel.
      var yr = y - 12, yl = y + 12;
      beams += '<line class="acs-full-beam" x1="' + left + '" y1="' + yl + '" x2="' + right + '" y2="' + yr + '"/>';
      [left,mid,right].forEach(function (cx, j) {
        var cy = yl + (yr-yl) * ((cx-left)/(right-left));
        if (!visualOnly && hasAttachmentDetail) circles += '<circle class="attachment-point" data-point="level" data-level="' + (i+1) + '" cx="' + cx + '" cy="' + cy + '" r="8" tabindex="0" role="button" cursor="pointer" pointer-events="all" aria-label="Attachment level ' + (i+1) + ' detail"/>';
      });
      if (visualOnly) {
        pointMarkers += '<circle class="acs-column-point' + (hasAttachmentDetail ? ' attachment-point' : '') + '"'
          + (hasAttachmentDetail ? ' data-point="level" data-level="' + (i+1) + '" tabindex="0" role="button" cursor="pointer" pointer-events="all" aria-label="Attachment point X' + (i+1) + ' detail"' : '')
          + ' cx="' + mid + '" cy="' + y + '" r="8"><title>Attachment point X' + (i+1) + (hasAttachmentDetail ? ' · ' + selectedDetail().id : '') + '</title></circle>';
        var pointLabelY = y - (i === levelYs.length - 1 ? 22 : 12);
        pointMarkers += '<text class="acs-column-point-label" x="' + (mid+18) + '" y="' + pointLabelY + '">X' + (i+1) + '</text>';
      }
      var rawForce = state.levelForces[i], rawDeadForce = state.deadLevelForces[i];
      var force = Number(rawForce), deadForce = Number(rawDeadForce);
      var negative = isFinite(force) && force < 0, deadNegative = isFinite(deadForce) && deadForce < 0;
      var forceLabel = "Lx" + (i+1) + " LL" + (rawForce === undefined || rawForce === null || !isFinite(force) ? "" : " = " + force.toFixed(2) + " " + state.forceUnit);
      var deadForceLabel = "Lx" + (i+1) + " DL" + (rawDeadForce === undefined || rawDeadForce === null || !isFinite(deadForce) ? "" : " = " + deadForce.toFixed(2) + " " + state.forceUnit);
      // Right-align the value before the middle column and place it below the
      // force line. This also keeps the top-level label clear of the roof.
      var labelX = mid - 24;
      var lineAtLabel = yl + (yr-yl) * ((labelX-left)/(right-left));
      var labelY = lineAtLabel + 20;
      if (state.showForces) labels += '<text class="acs-lx-label is-ll" text-anchor="end" x="' + labelX + '" y="' + labelY + '">' + forceLabel + '</text>';
      if (state.showForces) labels += '<text class="acs-lx-label is-dl" text-anchor="end" x="' + labelX + '" y="' + (labelY+17) + '">' + deadForceLabel + '</text>';
      var arrowPath = negative
        ? "M" + (mid-18) + " " + (y-5) + "l-38 -22"
        : "M" + (mid+18) + " " + (y+5) + "l38 22";
      var deadArrowPath = deadNegative
        ? "M" + (mid-8) + " " + (y+14) + "l-38 -22"
        : "M" + (mid+28) + " " + (y+22) + "l38 22";
      if (state.showForces) labels += '<path class="acs-load-arrow is-ll" d="' + arrowPath + '" marker-end="url(#config-arrow-ll)"><title>Lx' + (i+1) + ' LL = ' + (isFinite(force) ? force : "—") + '</title></path>';
      if (state.showForces) labels += '<path class="acs-load-arrow is-dl" d="' + deadArrowPath + '" marker-end="url(#config-arrow-dl)"><title>Lx' + (i+1) + ' DL = ' + (isFinite(deadForce) ? deadForce : "—") + '</title></path>';
      // Dimension ticks follow the actual red points on the sloped right-hand
      // attachment line, rather than the unsloped centre-line coordinates.
      var dimY = yr;
      var lower = i === 0 ? baseY : levelYs[i-1] - 12;
      dims += '<line class="acs-dim" x1="658" y1="' + dimY + '" x2="658" y2="' + lower + '"/>';
      dims += '<line class="acs-guide" x1="640" y1="' + dimY + '" x2="670" y2="' + dimY + '"/>';
      var zText = (sel.height && (state.type === 'boulder' || sel.levels)) ? 'Z' + (i+1) + ' = ' + (i === 0 ? zValues[0] : zValues[i]-zValues[i-1]).toFixed(1) + ' m' : 'Z' + (i+1);
      dims += '<text class="acs-dim-label' + flashClass('z' + (i+1), zText) + '" x="674" y="' + ((dimY+lower)/2+4) + '">' + zText + '</text>';
    });
    var contourTop = [[150,420],[270,435],[365,410],[460,428],[585,400]];
    var shift = Math.max(18, v.x * 24);
    var contourBottom = contourTop.map(function (p,i) { return [p[0]+shift*(.35+i*.15),p[1]+48]; });
    var polygon = contourTop.concat(contourBottom.slice().reverse()).map(function (p) { return p.join(","); }).join(" ");
    var beamIndex = Math.floor((levelYs.length - 1) / 2);
    var beamTargetY = levelYs[beamIndex] + 12 + (-24) * ((470-left)/(right-left));
    var contourDimTop = contourTop[1], contourDimBottom = contourBottom[1];
    function groundY(x) { return baseY + 13 + (x - 95) * (-27 / 555); }
    var spanGap = 14;
    // Offset the extra columns to the outer quarter of each bay so they clear the
    // centred "A = ..." span labels and the Lx force labels (Vasi #5).
    var leftBayX = left + (mid - left) * 0.26, rightBayX = right - (right - mid) * 0.26;
    var slabAndColumns = visualOnly
      ? '<g class="acs-extra-columns">'
        + '<line class="acs-extra-column" x1="' + leftBayX + '" y1="' + (topY + 8) + '" x2="' + leftBayX + '" y2="' + baseY + '"/>'
        + '<line class="acs-extra-column" x1="' + rightBayX + '" y1="' + (topY + 8) + '" x2="' + rightBayX + '" y2="' + baseY + '"/></g>'
        + slabGlyphSvg(mid, baseY, state.columnSlab)
        + basePointSvg(mid, baseY, !!(state.columnSlab && state.columnBaseDetail))
        + baseReactionSvg(mid, baseY)
      : '';
    return '<svg viewBox="0 0 900 550" role="img" aria-label="Interactive ACS geometry and attachment points">'
      + '<defs><marker id="config-arrow-ll" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="acs-ll-arrowhead" d="M0 0L10 5L0 10Z"/></marker><marker id="config-arrow-dl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="acs-dl-arrowhead" d="M0 0L10 5L0 10Z"/></marker><marker id="acs-tech-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path class="acs-tech-arrowhead" d="M0 0L10 5L0 10Z"/></marker></defs>'
      + '<path class="acs-full-roof" d="M' + left + " " + (topY+12) + 'L' + right + " " + (topY-12) + '"/><path class="acs-full-ground" d="M95 ' + (baseY+13) + 'L650 ' + (baseY-14) + '"/>'
      + '<rect class="acs-full-column" x="' + (left-7) + '" y="' + (topY+12) + '" width="14" height="' + (baseY-(topY+12)+12) + '"/><rect class="acs-full-column" x="' + (mid-7) + '" y="' + topY + '" width="14" height="' + (baseY-topY) + '"/><rect class="acs-full-column" x="' + (right-7) + '" y="' + (topY-12) + '" width="14" height="' + (baseY-(topY-12)-12) + '"/>'
      + beams + pointMarkers + labels
      + '<g class="acs-callouts"><text x="18" y="205"><tspan x="18">Existing column</tspan><tspan x="18" dy="14">of the building</tspan></text><path d="M105 214L' + left + ' ' + (baseY-110) + '" marker-end="url(#acs-tech-arrow)"/>'
      + '<text x="430" y="' + (beamTargetY-42) + '">Walltopia beam</text><path d="M475 ' + (beamTargetY-35) + 'L470 ' + beamTargetY + '" marker-end="url(#acs-tech-arrow)"/></g>'
      + '<polygon class="acs-contour" points="' + polygon + '"/><polyline class="acs-top-contour" points="' + contourTop.map(function(p){return p.join(",");}).join(" ") + '"/>'
      + '<g class="acs-contour-notes"><text class="acs-contour-label" x="78" y="510"><tspan x="78">Climbing surface</tspan><tspan class="is-strong" x="78" dy="14">bottom contour</tspan></text><path d="M145 493L132 458L' + contourTop[0][0] + ' ' + contourTop[0][1] + '" marker-end="url(#acs-tech-arrow)"/>'
      + '<text class="acs-contour-label" x="650" y="510"><tspan x="650">Climbing surface</tspan><tspan class="is-strong" x="650" dy="14">top contour</tspan></text><path d="M650 493L635 470L' + contourBottom[4][0] + ' ' + contourBottom[4][1] + '" marker-end="url(#acs-tech-arrow)"/></g>'
      + '<g class="acs-span-on-wall"><line x1="' + (left+spanGap) + '" y1="' + (groundY(left+spanGap)-10) + '" x2="' + (mid-spanGap) + '" y2="' + (groundY(mid-spanGap)-10) + '" marker-start="url(#acs-tech-arrow)" marker-end="url(#acs-tech-arrow)"/><text class="' + flashClass('spanL', spanText).slice(1) + '" x="' + ((left+mid)/2) + '" y="' + (groundY((left+mid)/2)-18) + '" text-anchor="middle">' + spanText + '</text>'
      + '<line x1="' + (mid+spanGap) + '" y1="' + (groundY(mid+spanGap)-10) + '" x2="' + (right-spanGap) + '" y2="' + (groundY(right-spanGap)-10) + '" marker-start="url(#acs-tech-arrow)" marker-end="url(#acs-tech-arrow)"/><text class="' + flashClass('spanR', spanText).slice(1) + '" x="' + ((mid+right)/2) + '" y="' + (groundY((mid+right)/2)-18) + '" text-anchor="middle">' + spanText + '</text><title>A — span between columns</title></g>'
      + '<g class="acs-contour-dim"><line x1="' + contourDimTop[0] + '" y1="' + contourDimTop[1] + '" x2="' + contourDimBottom[0] + '" y2="' + contourDimBottom[1] + '" marker-start="url(#acs-tech-arrow)" marker-end="url(#acs-tech-arrow)"/><text class="' + flashClass('overhang', overhangText).slice(1) + '" x="' + (contourDimBottom[0]+14) + '" y="' + ((contourDimTop[1]+contourDimBottom[1])/2+4) + '">' + overhangText + '</text></g>'
      + dims + '<line class="acs-dim" x1="760" y1="' + (topY-12) + '" x2="760" y2="' + baseY + '"/><text class="acs-dim-label' + flashClass('height', heightText) + '" x="775" y="' + ((topY+baseY)/2) + '">' + heightText + '</text>'
      + '<g class="acs-axis" transform="translate(820 410)"><path d="M0 0V-48" marker-end="url(#acs-tech-arrow)"/><path d="M0 0L42-9" marker-end="url(#acs-tech-arrow)"/><path d="M0 0L25 32" marker-end="url(#acs-tech-arrow)"/><text x="-7" y="-55">Z</text><text x="48" y="-7">Y</text><text x="28" y="43">X</text></g>'
      + (hasAttachmentDetail ? '<text class="acs-caption" x="28" y="30">Hover, focus or click a red point to preview its attachment detail</text>' : '')
      + slabAndColumns + circles + '</svg>';
  }
  function previewHtml(d, label) {
    return '<span class="attachment-label">' + label + '</span><h3>' + d.id + " · " + d.title.split("·")[0].trim() + '</h3>' + detailImage(d, "attachment-preview-image") + '<button class="attachment-full-trigger" type="button" data-full-detail="' + d.id + '">View full detail</button>';
  }
  function ensureDetailModal() {
    var modal = document.getElementById("attachment-detail-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "attachment-detail-modal";
    modal.className = "attachment-detail-modal";
    modal.hidden = true;
    modal.innerHTML = '<div class="attachment-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="attachment-modal-title">'
      + '<button class="attachment-modal-close" type="button" aria-label="Close detail">×</button>'
      + '<span class="attachment-label">Full attachment detail</span><h2 id="attachment-modal-title"></h2>'
      + '<img class="attachment-modal-image" alt=""></div>';
    document.body.appendChild(modal);
    function close() { modal.hidden = true; document.body.classList.remove("attachment-modal-open"); }
    modal.querySelector(".attachment-modal-close").addEventListener("click", close);
    modal.addEventListener("click", function (e) { if (e.target === modal) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) close(); });
    return modal;
  }
  function openDetailModal(d) {
    var modal = ensureDetailModal();
    modal.querySelector("#attachment-modal-title").textContent = d.id + " · " + d.title.split("·")[0].trim();
    var image = modal.querySelector(".attachment-modal-image");
    image.src = DETAIL_PATH + detailFile(d);
    image.alt = d.title;
    modal.hidden = false;
    document.body.classList.add("attachment-modal-open");
    modal.querySelector(".attachment-modal-close").focus();
  }
  function ensureListPreview() {
    var preview = document.getElementById("attachment-list-preview");
    if (preview) return preview;
    preview = document.createElement("div");
    preview.id = "attachment-list-preview";
    preview.className = "attachment-list-preview";
    preview.hidden = true;
    document.body.appendChild(preview);
    return preview;
  }
  function showListPreview(d, trigger) {
    var preview = ensureListPreview();
    preview.innerHTML = '<span class="attachment-label">Detail preview</span><h3>' + d.id + ' · ' + detailName(d) + '</h3>' + detailImage(d, "attachment-preview-image");
    preview.hidden = false;
    var rect = trigger.getBoundingClientRect();
    var width = preview.offsetWidth;
    var height = preview.offsetHeight;
    var left = rect.right + 12;
    if (left + width > window.innerWidth - 12) left = rect.left - width - 12;
    preview.style.left = Math.max(12, left) + "px";
    preview.style.top = Math.max(12, Math.min(rect.top, window.innerHeight - height - 12)) + "px";
  }
  function hideListPreview() {
    var preview = document.getElementById("attachment-list-preview");
    if (preview) preview.hidden = true;
  }
  function showPoint(point, level, clientX, clientY) {
    var d = point === "base" ? baseDetail() : selectedDetail();
    var preview = root.querySelector("#attachment-preview");
    preview.addEventListener("click", function (e) {
      var trigger = e.target.closest("[data-full-detail]");
      if (!trigger) return;
      var detail = details.find(function (item) { return item.id === trigger.getAttribute("data-full-detail"); });
      if (detail) openDetailModal(detail);
    });
    var layout = root.querySelector("#attachment-visual-layout");
    preview.innerHTML = previewHtml(d, point === "base" ? "Base point" : "Attachment level " + level);
    preview.hidden = false;
    var rect = layout.getBoundingClientRect();
    var left = clientX == null ? rect.width * .56 : clientX - rect.left + 18;
    var top = clientY == null ? rect.height * .16 : clientY - rect.top + 18;
    var cardWidth = Math.min(520, rect.width - 20);
    left = Math.max(10, Math.min(left, rect.width - cardWidth - 10));
    // Keep the preview below the hovered point. Pulling it upward over middle
    // and right-column points made the popup replace their pointer cursor.
    top = Math.max(10, top);
    preview.style.left = left + "px";
    preview.style.top = top + "px";
  }
  function wire() {
    root.querySelectorAll("[data-slab]").forEach(function (b) { b.onclick = function () { state.slab = b.getAttribute("data-slab"); state.baseDetailId = null; render(); }; });
    root.querySelectorAll("[data-base-detail]").forEach(function (b) { b.onclick = function () { state.baseDetailId = b.getAttribute("data-base-detail"); render(); }; });
    root.querySelectorAll("[data-support]").forEach(function (b) { b.onclick = function () { state.support = b.getAttribute("data-support"); state.detail = null; render(); }; });
    root.querySelectorAll("[data-detail]").forEach(function (b) { b.onclick = function () { state.detail = b.getAttribute("data-detail"); render(); }; });
    root.querySelectorAll("[data-preview-detail]").forEach(function (b) {
      var show = function () {
        var detail = details.find(function (item) { return item.id === b.getAttribute("data-preview-detail"); });
        if (detail) showListPreview(detail, b);
      };
      b.addEventListener("mouseenter", show);
      b.addEventListener("focus", show);
      b.addEventListener("mouseleave", hideListPreview);
      b.addEventListener("blur", hideListPreview);
    });
    root.querySelectorAll(".attachment-detail-open").forEach(function (b) {
      b.addEventListener("click", function () {
        hideListPreview();
        var detail = details.find(function (item) { return item.id === b.getAttribute("data-full-detail"); });
        if (detail) openDetailModal(detail);
      });
    });
    var preview = root.querySelector("#attachment-preview");
    root.querySelectorAll(".attachment-point").forEach(function (p) {
      var show = function (e) { showPoint(p.getAttribute("data-point"), p.getAttribute("data-level") || "", e && e.clientX, e && e.clientY); };
      p.addEventListener("mouseenter", show);
      p.addEventListener("focus", function () { showPoint(p.getAttribute("data-point"), p.getAttribute("data-level") || ""); });
      p.addEventListener("click", show);
      p.addEventListener("mouseleave", function () { window.setTimeout(function () { if (!preview.matches(":hover")) preview.hidden = true; }, 100); });
      p.addEventListener("blur", function () { if (!preview.matches(":hover")) preview.hidden = true; });
    });
    preview.addEventListener("mouseleave", function () { preview.hidden = true; });
    wireViewport();
  }
  function wireViewport() {
    var viewport = root.querySelector("#attachment-viewport");
    var svg = viewport && viewport.querySelector("svg");
    var zoomValue = root.querySelector("#attachment-zoom-value");
    if (!viewport || !svg) return;
    var viewContext = root.getAttribute("data-visual-only") === "true" ? "results" : "configurator";
    var resetScale = viewContext === "results" ? 1.12 : 1;
    var resetPanY = viewContext === "results" ? -20 : 0;
    if (state.viewContext !== viewContext) {
      state.view = { scale: resetScale, panX: 0, panY: resetPanY };
      state.viewContext = viewContext;
    }
    function applyView() {
      var viewWidth = 900 / state.view.scale;
      var viewHeight = 550 / state.view.scale;
      var viewX = (900 - viewWidth) / 2 - state.view.panX;
      var viewY = (550 - viewHeight) / 2 - state.view.panY;
      svg.setAttribute("viewBox", [viewX, viewY, viewWidth, viewHeight].join(" "));
      if (zoomValue) zoomValue.textContent = Math.round(state.view.scale / resetScale * 100) + "%";
      viewport.classList.toggle("is-zoomed", state.view.scale > 1.001);
    }
    function setScale(next, clientX, clientY) {
      var oldScale = state.view.scale;
      next = Math.max(0.5, Math.min(3, next));
      if (clientX != null && clientY != null && next !== oldScale) {
        var rect = viewport.getBoundingClientRect();
        var ratioX = (clientX - rect.left) / rect.width;
        var ratioY = (clientY - rect.top) / rect.height;
        var oldWidth = 900 / oldScale;
        var oldHeight = 550 / oldScale;
        var oldX = (900 - oldWidth) / 2 - state.view.panX;
        var oldY = (550 - oldHeight) / 2 - state.view.panY;
        var cursorX = oldX + ratioX * oldWidth;
        var cursorY = oldY + ratioY * oldHeight;
        var newWidth = 900 / next;
        var newHeight = 550 / next;
        var newX = cursorX - ratioX * newWidth;
        var newY = cursorY - ratioY * newHeight;
        state.view.panX = (900 - newWidth) / 2 - newX;
        state.view.panY = (550 - newHeight) / 2 - newY;
      }
      state.view.scale = next;
      applyView();
    }
    root.querySelectorAll("[data-view-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var action = button.getAttribute("data-view-action");
        if (action === "in") setScale(state.view.scale + .25);
        if (action === "out") setScale(state.view.scale - .25);
        if (action === "reset") { state.view = { scale: resetScale, panX: 0, panY: resetPanY }; applyView(); }
      });
    });
    viewport.addEventListener("wheel", function (e) {
      e.preventDefault();
      setScale(state.view.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY);
    }, { passive: false });
    var drag = null;
    viewport.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest(".attachment-point")) return;
      drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, panX: state.view.panX, panY: state.view.panY };
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add("is-dragging");
      e.preventDefault();
    });
    viewport.addEventListener("pointermove", function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      var rect = viewport.getBoundingClientRect();
      state.view.panX = drag.panX + (e.clientX - drag.startX) * (900 / state.view.scale) / rect.width;
      state.view.panY = drag.panY + (e.clientY - drag.startY) * (550 / state.view.scale) / rect.height;
      applyView();
    });
    function stopDrag(e) {
      if (!drag || drag.id !== e.pointerId) return;
      drag = null;
      viewport.classList.remove("is-dragging");
    }
    viewport.addEventListener("pointerup", stopDrag);
    viewport.addEventListener("pointercancel", stopDrag);
    applyView();
  }
  window.addEventListener("wtcalculatorchange", function (e) {
    if (!e.detail || !e.detail.input) return;
    state.input = e.detail.input;
    state.type = state.input.type || "wall";
    state.support = state.input.columnSupportingStructure || state.support;
    state.detail = state.input.columnAttachmentDetail || null;
    state.levelForces = (e.detail.snapshot && e.detail.snapshot.levelForces) || [];
    state.deadLevelForces = (e.detail.snapshot && e.detail.snapshot.levelDeadForces) || [];
    state.forceUnit = (e.detail.snapshot && e.detail.snapshot.unit) || state.forceUnit;
    state.columnSlab = state.input.columnSupportingSlab || null;
    state.columnBaseDetail = state.input.columnBaseDetail || null;
    if (state.columnSlab) state.slab = state.columnSlab === "hollow" ? "hollow-panel-slab" : "solid-concrete-slab";
    if (state.columnBaseDetail) state.baseDetailId = state.columnBaseDetail;
    state.showForces = e.detail.showForces !== false;
    state.selected = e.detail.selected || {};
    render();
  });
  window.WTAttachmentConfiguratorRefresh = function (payload) {
    if (payload && payload.input) {
      state.input = payload.input;
      state.type = state.input.type || "wall";
      state.support = state.input.columnSupportingStructure || state.support;
      state.detail = state.input.columnAttachmentDetail || null;
      state.levelForces = (payload.snapshot && payload.snapshot.levelForces) || [];
      state.deadLevelForces = (payload.snapshot && payload.snapshot.levelDeadForces) || [];
      state.forceUnit = (payload.snapshot && payload.snapshot.unit) || state.forceUnit;
      state.columnSlab = state.input.columnSupportingSlab || null;
      state.columnBaseDetail = state.input.columnBaseDetail || null;
      if (state.columnSlab) state.slab = state.columnSlab === "hollow" ? "hollow-panel-slab" : "solid-concrete-slab";
      if (state.columnBaseDetail) state.baseDetailId = state.columnBaseDetail;
      state.showForces = payload.showForces !== false;
      state.selected = payload.selected || {};
    }
    render();
  };
  window.addEventListener("wtcalculatordraftreset", function () {
    try { localStorage.removeItem(ATTACHMENT_DRAFT_KEY); } catch (error) {}
    state.slab = "solid-concrete-slab";
    state.baseDetailId = null;
    state.support = "concrete-wall";
    state.detail = null;
    render();
  });
  render();
})();
