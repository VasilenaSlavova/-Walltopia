/* Direct two-page PDF export with portrait results and landscape visuals. */
(function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function selectedText(selector, fallback) {
    var el = document.querySelector(selector);
    return el ? el.textContent.trim().replace(/\s+/g, " ") : fallback;
  }

  function cleanSvg(selector, exportViewBox) {
    var source = document.querySelector(selector);
    if (!source) return "";
    var clone = source.cloneNode(true);
    clone.querySelectorAll(".acs-caption, title").forEach(function (el) { el.remove(); });
    clone.removeAttribute("style");
    // On-screen zoom and pan are implemented by changing the SVG viewBox.
    // The report must always use the full, standard drawing frame instead of
    // inheriting the user's current interactive viewport.
    if (exportViewBox) clone.setAttribute("viewBox", exportViewBox);
    return clone.outerHTML;
  }

  function propertyRows(project) {
    var rows = (project.properties || []).map(function (p) {
      return '<span class="meta-label">' + esc(p.key) + '</span><b>' + esc(p.value || "-") + "</b>";
    }).join("");
    return rows;
  }

  function capacityResult(root, kind) {
    var status = root && root.querySelector(".single-capacity-status.is-" + kind);
    if (!status) return { checked: false, ok: false, result: "Not checked", note: "No allowable capacity provided" };
    var heading = status.querySelector("strong");
    var note = status.querySelector("span");
    return {
      checked: true,
      ok: status.classList.contains("is-ok"),
      result: heading ? heading.textContent.trim() : "Evaluated",
      note: note ? note.textContent.trim() : "Capacity check completed"
    };
  }

  function tableLoads(table) {
    var rows = table ? Array.prototype.slice.call(table.querySelectorAll("tbody tr")) : [];
    function values(row) {
      return Array.prototype.slice.call(row ? row.querySelectorAll(".single-load-number") : []).map(function (cell) {
        var value = parseFloat(cell.textContent.trim().replace(/\s/g, "").replace(",", "."));
        return isNaN(value) ? 0 : value;
      });
    }
    var base = values(rows[0]).reduce(function (sum, value) { return sum + value; }, 0);
    var horizontal = rows.slice(1).reduce(function (sum, row) {
      return sum + values(row).reduce(function (rowSum, value) { return rowSum + value; }, 0);
    }, 0);
    return { vertical: Math.abs(base), horizontal: Math.abs(horizontal) };
  }

  var detailFiles = {
    "CF-01":"concrete-floor-01", "CF-02":"concrete-floor-02", "CF-03":"concrete-floor-03",
    "CW-01":"concrete-wall-01", "CW-02":"concrete-wall-02", "CW-03":"concrete-wall-03",
    "SC-01":"steel-column-01", "SC-02":"steel-column-02", "SC-03":"steel-column-03", "SC-04":"steel-column-04",
    "SB-01":"steel-beam-01", "SB-02":"steel-beam-02", "SB-03":"steel-beam-03",
    "MW-01":"masonry-wall-01", "MW-02":"masonry-wall-02"
  };

  function detailImage(code, units) {
    var stem = detailFiles[code];
    return stem ? "manuals/attachment/details/" + stem + (units === "USA" ? "-imperial.png" : "-metric.png") + "?v=wt5" : "";
  }

  function detailTitle(code) {
    var families = { CF:"Base connection detail", CW:"Solid concrete wall detail", SC:"Steel column detail", SB:"Steel beam detail", MW:"Masonry wall detail" };
    var parts = String(code || "").split("-");
    return families[parts[0]] ? families[parts[0]] + " " + parts[1] : "Attachment detail";
  }

  function hasConfigurationValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  function optionConfigurationComplete(input, key) {
    var common = ["units", "type", "height", "overhang"];
    if (input.type === "wall") common.push("levels", "force");
    var optionFields = key === "beams"
      ? ["span", "columnSupportingSlab", "columnBaseDetail", "columnSupportingStructure", "columnAttachmentDetail"]
      : ["supportingSlab", "baseDetail", "supportingStructure", "attachmentDetail"];
    var selectedFields = common.concat(key === "beams" ? ["span"] : []);
    if (input.attachmentSolution === key && input.selected && selectedFields.some(function (field) { return input.selected[field] === false; })) {
      return false;
    }
    return common.concat(optionFields).every(function (field) { return hasConfigurationValue(input[field]); });
  }

  function exportPdf(ctx) {
    ctx = ctx || {};
    var project = ctx.project || {};
    var input = ctx.input || {};
    var snapshot = ctx.snapshot || {};
    // Keep the report useful as a comparison, but never publish a partially
    // configured alternative. Each option must have all of its required
    // attachment details; Option 2 additionally requires column span A.
    var requestedOptions = ["single", "beams"].filter(function (key) {
      return optionConfigurationComplete(input, key);
    });
    if (!requestedOptions.length) {
      var incompleteMessage = "Complete at least one attachment option before exporting the PDF.";
      if (ctx.returnToParent) window.parent.postMessage({ type: "wt-pdf-error", requestId: ctx.requestId, message: incompleteMessage }, location.origin);
      else window.alert(incompleteMessage);
      return;
    }
    var optionTables = {
      single: document.querySelector('[data-result-section="single"] table.single-point-table'),
      beams: document.querySelector('[data-result-section="beams"] table.single-point-table')
    };
    var sideSvg = cleanSvg('svg[aria-label="Dynamic climbing wall side elevation"]', "0 0 420 520");
    var acsSvg = cleanSvg('svg[aria-label="Interactive ACS geometry and attachment points"]', "0 0 900 550");
    var missingReportContent = requestedOptions.some(function (key) {
      return !optionTables[key] || (key === "single" ? !sideSvg : !acsSvg);
    });
    if (missingReportContent) {
      // A requested calculator section may be hidden on screen while its table
      // and diagram are being prepared for export.
      var retries = Number(ctx.retryCount || 0);
      if (retries < 30) {
        var retryContext = Object.assign({}, ctx, { retryCount: retries + 1 });
        setTimeout(function () { exportPdf(retryContext); }, 100);
        return;
      }
      if (ctx.returnToParent) window.parent.postMessage({ type: "wt-pdf-error", requestId: ctx.requestId, message: "The report could not be prepared." }, location.origin);
      else window.alert("The report could not be prepared. Reload the calculation and try again.");
      return;
    }

    var factored = !!input.factored;
    var created = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    var projectName = project.name || snapshot.title || "Preliminary load project";
    var levels = input.type === "boulder" ? "Single attachment" : esc(input.levels) + " levels";
    var reportNo = project.id ? String(project.id).slice(-8).toUpperCase() : "DRAFT";
    var fileName = String(projectName).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "Walltopia-load-report";
    var forceLevel = input.type === "boulder" ? "Boulder load case" : "Z" + esc(input.force || 1);
    var reports = requestedOptions.map(function (key) {
      var isBeams = key === "beams";
      var table = optionTables[key].cloneNode(true);
      table.classList.add("loads");
      var loads = tableLoads(optionTables[key]);
      var baseCode = isBeams ? input.columnBaseDetail : input.baseDetail;
      var levelCode = isBeams ? input.columnAttachmentDetail : input.attachmentDetail;
      var slab = isBeams ? input.columnSupportingSlab : input.supportingSlab;
      var method = isBeams ? input.columnSupportingStructure : input.supportingStructure;
      var names = {
        "concrete-wall":"Solid concrete wall / column", "steel-column":"Steel column",
        "steel-beam":"Steel beam", "masonry-wall":"Masonry / brick wall",
        "solid":"Solid concrete slab", "hollow":"Hollow panel slab"
      };
      return {
        key: key, isBeams: isBeams, isSelected: input.attachmentSolution === key, number: isBeams ? "OPTION 2" : "OPTION 1",
        name: isBeams ? "Walltopia support beams" : "Single-point attachment",
        table: table.outerHTML, loads: loads, visual: isBeams ? acsSvg : sideSvg,
        visualClass: isBeams ? "attachment-acs" : "schematic",
        visualTitle: isBeams ? "ACS GEOMETRY AND COLUMN LOADS" : "LOAD APPLICATION - SIDE ELEVATION",
        baseCode: baseCode || "Not selected", levelCode: levelCode || "Not selected",
        slab: names[slab] || slab || "Not selected", method: names[method] || method || "Not selected",
        baseTitle: detailTitle(baseCode), levelTitle: detailTitle(levelCode),
        baseImage: detailImage(baseCode, input.units), levelImage: detailImage(levelCode, input.units)
      };
    });

    var renderFrame = null;
    var popup = window;
    if (!ctx.sameWindow) {
      renderFrame = document.createElement("iframe");
      renderFrame.setAttribute("aria-hidden", "true");
      renderFrame.style.cssText = "position:fixed;left:-10000px;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none";
      document.body.appendChild(renderFrame);
      popup = renderFrame.contentWindow;
    }

    popup.document.open();
    popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(projectName) + ' - PDF report</title>'
      + '<script src="vendor/html2canvas.min.js"><\/script><script src="vendor/jspdf.umd.min.js"><\/script>'
      + '<style>'
      + '@page reportPortrait{size:A4 portrait;margin:13mm 15mm 12mm}@page reportLandscape{size:A4 landscape;margin:9mm 11mm 8mm}'
      + '*{box-sizing:border-box}body{margin:0;color:#202331;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.page{position:relative;background:#fff}.page-one{page:reportPortrait;break-after:page;min-height:270mm}.page-two{page:reportLandscape;min-height:188mm}'
      + '.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #ec1c24;padding-bottom:5mm}.logo{font-size:28px;font-weight:900;letter-spacing:-2px}.logo i{color:#ec1c24;font-style:normal}.report-meta{text-align:right;color:#707684;font-size:10.7px;line-height:1.45}'
      + '.kicker{margin-top:8mm;color:#ec1c24;font-weight:800;font-size:10.8px}.page h1{margin:2mm 0 1mm;font-size:23px}.sub{color:#707684;font-size:11.2px}.stats{display:grid;grid-template-columns:1fr 1fr 1fr;margin-top:6mm;border:1px solid #d9dce3;background:#f4f5f7}.stat{padding:4mm 5mm}.stat+ .stat{border-left:1px solid #d9dce3}.stat small,.meta-label{display:block;color:#858b97;font-size:8.5px;text-transform:uppercase}.stat strong{display:block;margin:2mm 0;font-size:19px}'
      + '.applicability{display:flex;align-items:center;margin-top:3mm;width:100%;min-height:18mm;padding:3mm 4mm;border:1px solid #cfd3da;border-left:3px solid #707684;background:#f4f5f7}.applicability-icon{display:block;flex:0 0 8mm;font-size:21px;line-height:1;font-weight:700;color:#707684}.applicability-copy{display:block;flex:1}.applicability strong{display:block;margin:0 0 1.2mm;font-size:13.3px;line-height:1.1}.applicability span{display:block;font-size:11.2px;line-height:1.25;color:#202331}.applicability.is-ok{border-color:#b9ddc8;border-left-color:#1f8a4c;background:#e8f5ed}.applicability.is-ok .applicability-icon,.applicability.is-ok strong{color:#137a3c}.applicability.is-bad{border-color:#efc4c6;border-left-color:#c30f16;background:#fdeaeb}.applicability.is-bad .applicability-icon,.applicability.is-bad strong{color:#c30f16}'
      + 'h2{font-size:14px;margin:6mm 0 2mm}.configuration{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm 6mm;border-top:1px solid #d9dce3;border-bottom:1px solid #d9dce3;padding:4mm 0;font-size:10.7px}.configuration b{display:block;margin-top:1mm;font-size:12.7px}.props{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:4mm}'
      + '.loads{width:100%;border-collapse:collapse;font-size:10.7px}.loads th,.loads td{padding:2.4mm;border-bottom:1px solid #d9dce3;text-align:right}.loads th:first-child,.loads td:first-child{text-align:left}.loads thead{border-bottom:1.5px solid #202331}.loads th{color:#707684}.loads th:nth-child(3),.loads th:nth-child(5),.loads td:nth-child(3),.loads td:nth-child(5){color:#ec1c24}'
      + '.loads thead th:not(:first-child){font-size:0}.loads thead th:not(:first-child)>span{display:inline;font-size:10.7px}.loads .single-point-name strong,.loads .single-point-name span{display:inline}.loads .single-point-name strong{margin-right:2mm}.loads .single-load-cell strong{display:inline-flex;align-items:baseline;gap:1mm}.loads .single-load-number,.loads .single-load-unit{display:inline}'
      + '.load-option-title{margin:3.5mm 0 1.5mm;color:#202331;font-size:10.5px;letter-spacing:.2px}'
      + '.warning{margin-top:6mm;border-top:1.5px solid #ec1c24;border-bottom:1px solid #d9dce3;padding:3mm;font-size:10.2px}.warning b,.warning span{display:block}.warning span{margin-top:1.5mm;line-height:1.35}.footer{position:absolute;left:4mm;right:4mm;bottom:4mm;color:#707684;font-size:9.6px;display:flex;justify-content:space-between}'
      + '.land-head{border-bottom:1.6px solid #ec1c24;padding-bottom:3mm}.land-head h1{font-size:22px;margin:0}.land-grid{display:grid;grid-template-columns:31% 69%;height:158mm}.land-grid.is-single{display:block}.side-panel{border-right:1.6px solid #ec1c24;padding:4mm 7mm 0 0}.acs-panel{padding:4mm 0 0 7mm}.single-visual-panel{padding-top:4mm}.section-title{font-weight:800;font-size:13px}.side-svg{height:128mm;display:grid;place-items:center}.acs-svg{height:101mm;display:grid;place-items:center}.single-side-svg,.single-acs-svg{height:127mm;display:grid;place-items:center}.side-svg svg,.acs-svg svg,.single-side-svg svg,.single-acs-svg svg{width:100%;height:100%}'
      + '.schematic .side-ground{fill:none;stroke:#202331;stroke-width:2.2}.schematic .side-surface{fill:none;stroke:#2463eb;stroke-width:2.2}.schematic .side-support{stroke:#202331;stroke-width:1.5}.schematic .side-anchor{fill:#fff;stroke:#8b919d}.schematic .side-extension,.schematic .side-dimension,.schematic .side-tick,.schematic .side-hatch{fill:none;stroke:#8b919d}.schematic .side-attachment-plane{stroke:#8b919d}.schematic .side-reaction{fill:none;stroke-width:2}.schematic .side-reaction.is-ll{stroke:#ec1c24}.schematic .side-reaction.is-dl{stroke:#111}.schematic .side-reaction.is-zero{stroke:#8b919d;stroke-dasharray:3 3}.schematic .side-reaction-label{font-size:10px;font-weight:700}.schematic .side-reaction-label.is-ll{fill:#ec1c24}.schematic .side-reaction-label.is-dl{fill:#111}.schematic .side-rz0-label{font-size:10px}.schematic svg text:not(.side-reaction-label){fill:#64748b}.schematic .side-axis line{stroke:#202331;stroke-width:2}'
      + '.attachment-acs text{fill:#64748b;font:15px Arial}.attachment-acs .acs-full-roof,.attachment-acs .acs-full-ground{fill:none;stroke:#202331;stroke-width:2.5}.attachment-acs .acs-full-column{fill:#fff;stroke:#202331;stroke-width:2}.attachment-acs .acs-full-beam{stroke:#2463eb;stroke-width:4}.attachment-acs .acs-load-arrow{fill:none;stroke-width:2.5;stroke-dasharray:6 5}.attachment-acs .acs-load-arrow.is-ll{stroke:#ec1c24}.attachment-acs .acs-load-arrow.is-dl{stroke:#111}.attachment-acs .acs-lx-label{font-size:14px;font-weight:700}.attachment-acs .acs-lx-label.is-ll{fill:#ec1c24}.attachment-acs .acs-lx-label.is-dl{fill:#111}.attachment-acs .acs-negative-arrowhead{fill:#172d63}.attachment-acs .acs-tech-arrowhead{fill:#64748b}.attachment-acs .acs-contour{fill:#dbe7fb;stroke:#2463eb;stroke-width:2}.attachment-acs .acs-top-contour{fill:none;stroke:#2463eb;stroke-width:2}.attachment-acs .acs-dim,.attachment-acs .acs-callouts path,.attachment-acs .acs-span-dim line,.attachment-acs .acs-span-dim path,.attachment-acs .acs-contour-dim line,.attachment-acs .acs-contour-notes path{fill:none;stroke:#64748b;stroke-width:1.1}.attachment-acs .acs-axis path{fill:none;stroke:#202331;stroke-width:2}.attachment-acs .acs-axis text{fill:#202331;font-weight:700}.attachment-acs .attachment-point{fill:#fff;stroke:#ec1c24;stroke-width:4}'
      + '.attachment-acs .acs-support-member-outline,.attachment-acs .acs-support-member-core{fill:none;stroke-linecap:square;stroke-linejoin:miter}.attachment-acs .acs-support-member-outline{stroke:#334155;stroke-width:5}.attachment-acs .acs-support-member-core{stroke:#eef1f5;stroke-width:2.2}.attachment-acs .acs-support-brace{stroke-linecap:butt}.attachment-acs .acs-support-node{fill:#f8fafc;stroke:#334155;stroke-width:1.4}.attachment-acs .acs-support-foot{fill:none;stroke:#334155;stroke-width:1.5}'
      + '.attachment-acs .acs-base-reaction-box{fill:#fff;stroke:#c7cad0;stroke-width:1}.attachment-acs .acs-base-reaction-leader{fill:none;stroke:#94a3b8;stroke-width:1.2}.attachment-acs .acs-base-reaction{stroke-width:2.2}.attachment-acs .acs-base-reaction.is-ll{stroke:#ec1c24}.attachment-acs .acs-base-reaction.is-dl{stroke:#111}.attachment-acs .acs-base-reaction.is-zero{stroke:#94a3b8;stroke-dasharray:3 3}.attachment-acs .acs-base-reaction-label{font:700 12px monospace}.attachment-acs .acs-base-reaction-label.is-ll{fill:#ec1c24}.attachment-acs .acs-base-reaction-label.is-dl{fill:#111}.attachment-acs .acs-ll-arrowhead{fill:#ec1c24}.attachment-acs .acs-dl-arrowhead{fill:#111}'
      + '.detail-title{font-weight:800;font-size:13px;margin:0 0 2mm}.detail-cards{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.detail-card{border:1px solid #d9dce3;padding:4mm;height:29mm}.detail-card strong{display:block;color:#ec1c24;font-size:21px}.detail-card b{display:block;font-size:12.8px;margin:1mm 0}.detail-card span,.manual-ref{color:#707684;font-size:10.2px}.manual-ref{margin-top:2mm}'
      + '.option-layout{display:grid;grid-template-columns:minmax(0,58%) minmax(0,42%);gap:6mm;height:158mm;padding-top:3mm}.option-left{min-width:0;border-right:1.6px solid #ec1c24;padding-right:6mm}.option-details{min-width:0}.option-visual{height:145mm;display:grid;place-items:center;padding:3mm 0}.option-visual svg{width:100%;height:100%}.option-details .detail-title{margin:0 0 3mm}.detail-visuals{display:grid;grid-template-columns:1fr;grid-template-rows:1fr 1fr;gap:4mm;height:145mm}.detail-visual{min-height:0;overflow:hidden;border:1px solid #d9dce3;padding:3mm;display:flex;flex-direction:column}.detail-copy{flex:0 0 auto;padding-bottom:2mm;border-bottom:1px solid #eef0f3}.detail-copy strong,.detail-copy b{display:inline}.detail-copy strong{margin-right:2mm;color:#ec1c24;font-size:16px}.detail-copy b{font-size:10.5px}.detail-copy span{display:block;margin-top:1mm;color:#707684;font-size:8.5px;line-height:1.25}.detail-visual img{display:block;flex:1 1 auto;min-height:0;width:auto;height:auto;max-width:100%;max-height:52mm;margin:2mm auto 0;object-fit:contain}'
      + '@media screen{body{background:#fff}.page{margin:0;padding:13mm 15mm;overflow:hidden}.page-one{width:210mm;height:297mm}.page-two{width:297mm;height:210mm;padding:9mm 11mm}}'
      + '</style></head><body>');

    popup.document.write(reports.map(function (report, index) {
      var firstPage = index * 2 + 1;
      var secondPage = firstPage + 1;
      var unit = esc(snapshot.unit || "kN");
      var spanField = report.isBeams ? '<div><span class="meta-label">Column span A</span><b>' + esc(input.span) + ' m</b></div>' : '';
      var baseImg = report.baseImage ? '<img src="' + esc(report.baseImage) + '" alt="' + esc(report.baseCode) + '">' : '';
      var levelImg = report.levelImage ? '<img src="' + esc(report.levelImage) + '" alt="' + esc(report.levelCode) + '">' : '';
      return '<section class="page page-one"><div class="top"><div class="logo">WA<i>LL</i>TOPIA</div><div class="report-meta"><b>REPORT No.</b> PL-' + esc(reportNo) + '<br>Generated ' + esc(created) + '<br>Project export</div></div>'
        + '<div class="kicker">' + report.number + ' · ' + esc(report.name) + '</div><h1>' + esc(projectName) + '</h1>'
        + '<div class="stats"><div class="stat"><small>Compared attachment solution</small><strong>' + report.number + '</strong><small>' + (report.isSelected ? 'Selected solution' : 'Alternative solution') + ' · ' + esc(report.name) + '</small></div>'
        + '<div class="stat"><small>Vertical load at base point X0</small><strong>' + report.loads.vertical.toFixed(2) + ' ' + unit + '</strong><small>Calculated load</small></div>'
        + '<div class="stat"><small>Total horizontal load on one column</small><strong>' + report.loads.horizontal.toFixed(2) + ' ' + unit + '</strong><small>Calculated load</small></div></div>'
        + '<h2>SELECTED CONFIGURATION</h2><div class="configuration">'
        + '<div><span class="meta-label">Structure type</span><b>' + (input.type === "boulder" ? "Boulder wall" : "Climbing wall") + '</b></div>'
        + '<div><span class="meta-label">Height</span><b>' + esc(input.height) + ' m</b></div><div><span class="meta-label">Attachment scheme</span><b>' + levels + '</b></div>'
        + '<div><span class="meta-label">Units</span><b>' + (input.units === "US" ? "Imperial" : "Metric") + '</b></div>' + spanField
        + '<div><span class="meta-label">Overhang X</span><b>' + esc(input.overhang) + ' m</b></div><div><span class="meta-label">Values</span><b>' + (factored ? "Factored" : "Characteristic") + '</b></div>'
        + '<div><span class="meta-label">Standard</span><b>EN 12572-1</b></div><div class="props">' + propertyRows(project) + '</div></div>'
        + '<h2>LOADS AT SELECTED FORCE LEVEL · ' + forceLevel + '</h2>' + report.table
        + '<div class="warning"><b>PRELIMINARY LOADS - NOT FOR CONSTRUCTION.</b><span>All calculated values and selected attachment details must be reviewed and verified by the responsible structural engineer before use. The application manual is an inseparable part of this report.</span></div>'
        + '<div class="footer"><span>Prepared through Walltopia Preliminary Loads Calculator</span><span>Page ' + firstPage + '</span></div></section>'
        + '<section class="page page-two"><div class="land-head"><h1>' + report.number + ' · ' + esc(report.name) + '</h1><div class="sub">' + esc(input.height) + ' m wall | ' + (report.isBeams ? 'A = ' + esc(input.span) + ' m | ' : '') + 'X = ' + esc(input.overhang) + ' m | ' + levels + ' | selected force level ' + forceLevel + '</div></div>'
        + '<div class="option-layout"><div class="option-left"><div class="section-title">' + report.visualTitle + '</div><div class="option-visual ' + report.visualClass + '">' + report.visual + '</div></div>'
        + '<div class="option-details"><div class="detail-title">SELECTED ATTACHMENT DETAILS</div><div class="detail-visuals">'
        + '<div class="detail-visual"><div class="detail-copy"><strong>' + esc(report.baseCode) + '</strong><b>' + esc(report.baseTitle) + '</b><span>Supporting slab: ' + esc(report.slab) + '</span></div>' + baseImg + '</div>'
        + '<div class="detail-visual"><div class="detail-copy"><strong>' + esc(report.levelCode) + '</strong><b>' + esc(report.levelTitle) + '</b><span>Method: ' + esc(report.method) + '</span></div>' + levelImg + '</div></div></div></div>'
        + '<div class="manual-ref">Detail drawings reproduced from the Standard Attachment Details documentation.</div>'
        + '<div class="footer"><span>Prepared through Walltopia Preliminary Loads Calculator</span><span>Page ' + secondPage + '</span></div></section>';
    }).join(""));

    popup.document.write('<script>window.addEventListener("load",async function(){'
      + 'try{'
      + 'var opts={scale:2.4,backgroundColor:"#ffffff",useCORS:true,logging:false};'
      + 'var pages=Array.from(document.querySelectorAll(".page"));var PDF=window.jspdf.jsPDF;var pdf=null;'
      + 'for(var i=0;i<pages.length;i++){var landscape=pages[i].classList.contains("page-two");var canvas=await html2canvas(pages[i],opts);if(!pdf)pdf=new PDF({orientation:landscape?"landscape":"portrait",unit:"mm",format:"a4",compress:true});else pdf.addPage("a4",landscape?"landscape":"portrait");pdf.addImage(canvas.toDataURL("image/jpeg",0.97),"JPEG",0,0,landscape?297:210,landscape?210:297,undefined,"FAST");}'
      + (ctx.returnToParent
        ? 'window.parent.postMessage({type:"wt-pdf-ready",requestId:' + JSON.stringify(ctx.requestId || "") + ',fileName:' + JSON.stringify(fileName + " - Preliminary Loads.pdf").replace(/</g, "\\u003c") + ',buffer:pdf.output("arraybuffer")},location.origin);'
        : 'pdf.save(' + JSON.stringify(fileName + " - Preliminary Loads.pdf").replace(/</g, "\\u003c") + ');')
      + 'document.body.innerHTML="<div style=\\"font:600 16px Arial;padding:32px\\">PDF exported successfully. You can close this tab.</div>";'
      + 'if(window.frameElement){setTimeout(function(){window.frameElement.remove()},1500);}'
      + '}catch(error){' + (ctx.returnToParent ? 'window.parent.postMessage({type:"wt-pdf-error",requestId:' + JSON.stringify(ctx.requestId || "") + ',message:String(error&&error.message||"Could not create PDF.")},location.origin);' : '') + 'document.body.innerHTML="<div style=\\"font:16px Arial;padding:32px;color:#b00020\\">PDF export failed. Please return to the project and try again.</div>";console.error(error);}'
      + '});<\/script></body></html>');
    popup.document.close();
  }

  window.WTExportPdf = exportPdf;
})();
