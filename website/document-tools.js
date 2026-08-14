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

  function cleanSvg(selector) {
    var source = document.querySelector(selector);
    if (!source) return "";
    var clone = source.cloneNode(true);
    clone.querySelectorAll(".acs-caption, title").forEach(function (el) { el.remove(); });
    clone.removeAttribute("style");
    return clone.outerHTML;
  }

  function propertyRows(project) {
    var rows = (project.properties || []).map(function (p) {
      return '<span class="meta-label">' + esc(p.key) + '</span><b>' + esc(p.value || "-") + "</b>";
    }).join("");
    return rows;
  }

  function exportPdf(ctx) {
    ctx = ctx || {};
    var project = ctx.project || {};
    var input = ctx.input || {};
    var snapshot = ctx.snapshot || {};
    var loadTables = Array.prototype.slice.call(document.querySelectorAll(".single-point-table"));
    if (!loadTables.length) {
      var legacyLoadTable = document.querySelector("table.loads");
      if (legacyLoadTable) loadTables.push(legacyLoadTable);
    }
    var sideSvg = cleanSvg('svg[aria-label="Dynamic climbing wall side elevation"]');
    var acsSvg = cleanSvg('svg[aria-label="Interactive ACS geometry and attachment points"]');
    if (!loadTables.length || !sideSvg || !acsSvg) {
      // Wait briefly for the result table and both SVG diagrams to render.
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

    var loadTablesHtml = loadTables.map(function (table, index) {
      var clone = table.cloneNode(true);
      clone.classList.add("loads");
      var label = index === 0 ? "OPTION 1 — LOADS AT ACS ATTACHMENT POINTS" : "OPTION 2 — LOADS ON BUILDING COLUMNS";
      return '<h3 class="load-option-title">' + label + '</h3>' + clone.outerHTML;
    }).join("");
    var baseCode = selectedText('[data-single-detail][aria-pressed="true"] b, [data-base-detail][aria-pressed="true"] b', "Not selected");
    var levelCode = selectedText('[data-column-attachment-detail][aria-pressed="true"] b, [data-single-attachment-detail][aria-pressed="true"] b, [data-detail][aria-pressed="true"] b', "Not selected");
    var slab = selectedText('[data-single-slab][aria-pressed="true"], [data-slab][aria-pressed="true"]', "Not selected");
    var method = selectedText('[data-column-support][aria-pressed="true"], [data-single-support][aria-pressed="true"], [data-support][aria-pressed="true"]', "Not selected");
    var factored = !!input.factored;
    var hasCapacity = input.capacity !== null && input.capacity !== undefined && input.capacity !== "" && !isNaN(Number(input.capacity));
    var capacityText = hasCapacity ? Number(input.capacity) + " " + (snapshot.unit || "kN") : "Not provided";
    var applicability = snapshot.verdict === "ok" ? "Applicable"
      : snapshot.verdict === "bad" ? "Not applicable" : "Not evaluated";
    var applicabilityClass = snapshot.verdict === "ok" ? "is-ok"
      : snapshot.verdict === "bad" ? "is-bad" : "is-neutral";
    var requiredText = Number(snapshot.governing).toFixed(2) + " " + (snapshot.unit || "kN");
    var formattedCapacityText = hasCapacity ? Number(input.capacity).toFixed(2) + " " + (snapshot.unit || "kN") : "capacity not provided";
    var applicabilityNote = hasCapacity
      ? requiredText + " required vs " + formattedCapacityText + " capacity"
      : requiredText + " required; enter allowable capacity";
    var applicabilityIcon = snapshot.verdict === "ok" ? "&#10003;" : snapshot.verdict === "bad" ? "&#10005;" : "?";
    var created = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    var projectName = project.name || snapshot.title || "Preliminary load project";
    var levels = input.type === "boulder" ? "Single attachment" : esc(input.levels) + " levels";
    var reportNo = project.id ? String(project.id).slice(-8).toUpperCase() : "DRAFT";
    var fileName = String(projectName).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "Walltopia-load-report";

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
      + '.load-option-title{margin:3.5mm 0 1.5mm;color:#202331;font-size:10.5px;letter-spacing:.2px}'
      + '.warning{margin-top:6mm;border-top:1.5px solid #ec1c24;border-bottom:1px solid #d9dce3;padding:3mm;font-size:10.2px}.footer{position:absolute;left:4mm;right:4mm;bottom:4mm;color:#707684;font-size:9.6px;display:flex;justify-content:space-between}'
      + '.land-head{border-bottom:1.6px solid #ec1c24;padding-bottom:3mm}.land-head h1{font-size:22px;margin:0}.land-grid{display:grid;grid-template-columns:31% 69%;height:158mm}.side-panel{border-right:1.6px solid #ec1c24;padding:4mm 7mm 0 0}.acs-panel{padding:4mm 0 0 7mm}.section-title{font-weight:800;font-size:13px}.side-svg{height:128mm;display:grid;place-items:center}.acs-svg{height:101mm;display:grid;place-items:center}.side-svg svg{width:100%;height:100%}.acs-svg svg{width:100%;height:100%}'
      + '.schematic .side-ground{fill:none;stroke:#202331;stroke-width:2.2}.schematic .side-surface{fill:none;stroke:#2463eb;stroke-width:2.2}.schematic .side-support{stroke:#202331;stroke-width:1.5}.schematic .side-anchor{fill:#fff;stroke:#8b919d}.schematic .side-extension,.schematic .side-dimension,.schematic .side-tick,.schematic .side-hatch{fill:none;stroke:#8b919d}.schematic .side-attachment-plane{stroke:#8b919d}.schematic .side-reaction{stroke:#ec1c24;stroke-width:2}.schematic .side-reaction.is-negative{stroke:#172d63}.schematic .side-reaction-label{fill:#ec1c24;font-size:11.8px;font-weight:700}.schematic .side-reaction-label.is-negative{fill:#172d63}.schematic svg text:not(.side-reaction-label){fill:#64748b}.schematic .side-axis line{stroke:#202331;stroke-width:2}'
      + '.attachment-acs text{fill:#64748b;font:15px Arial}.attachment-acs .acs-full-roof,.attachment-acs .acs-full-ground{fill:none;stroke:#202331;stroke-width:2.5}.attachment-acs .acs-full-column{fill:#fff;stroke:#202331;stroke-width:2}.attachment-acs .acs-full-beam{stroke:#2463eb;stroke-width:4}.attachment-acs .acs-load-arrow{fill:none;stroke:#ec1c24;stroke-width:2.5;stroke-dasharray:6 5}.attachment-acs .acs-lx-label{fill:#ec1c24;font-size:14px;font-weight:700}.attachment-acs .acs-lx-label.is-negative{fill:#172d63}.attachment-acs .acs-negative-arrowhead{fill:#172d63}.attachment-acs .acs-tech-arrowhead{fill:#64748b}.attachment-acs .acs-contour{fill:#dbe7fb;stroke:#2463eb;stroke-width:2}.attachment-acs .acs-top-contour{fill:none;stroke:#2463eb;stroke-width:2}.attachment-acs .acs-dim,.attachment-acs .acs-callouts path,.attachment-acs .acs-span-dim line,.attachment-acs .acs-span-dim path,.attachment-acs .acs-contour-dim line,.attachment-acs .acs-contour-notes path{fill:none;stroke:#64748b;stroke-width:1.1}.attachment-acs .acs-axis path{fill:none;stroke:#202331;stroke-width:2}.attachment-acs .acs-axis text{fill:#202331;font-weight:700}.attachment-acs .attachment-point{fill:#fff;stroke:#ec1c24;stroke-width:4}'
      + '.detail-title{font-weight:800;font-size:13px;margin:0 0 2mm}.detail-cards{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.detail-card{border:1px solid #d9dce3;padding:4mm;height:29mm}.detail-card strong{display:block;color:#ec1c24;font-size:21px}.detail-card b{display:block;font-size:12.8px;margin:1mm 0}.detail-card span,.manual-ref{color:#707684;font-size:10.2px}.manual-ref{margin-top:2mm}'
      + '@media screen{body{background:#fff}.page{margin:0;padding:13mm 15mm;overflow:hidden}.page-one{width:210mm;height:297mm}.page-two{width:297mm;height:210mm;padding:9mm 11mm}}'
      + '</style></head><body>');

    popup.document.write('<section class="page page-one"><div class="top"><div class="logo">WA<i>LL</i>TOPIA</div><div class="report-meta"><b>REPORT No.</b> PL-' + esc(reportNo) + '<br>Generated ' + esc(created) + '<br>Project export</div></div>'
      + '<div class="kicker">PRELIMINARY DESIGN</div><h1>' + esc(projectName) + '</h1>'
      + '<div class="stats"><div class="stat"><small>Governing column load</small><strong>' + esc(snapshot.governing) + ' ' + esc(snapshot.unit || "kN") + '</strong><small>' + (factored ? "Factored design value" : "Characteristic value") + '</small></div>'
      + '<div class="stat"><small>Allowable column load</small><strong>' + esc(capacityText) + '</strong><small>' + (hasCapacity ? "User-provided capacity" : "No capacity check applied") + '</small></div>'
      + '<div class="stat"><small>Governing level</small><strong>RX' + esc(input.force || 1) + '</strong><small>Selected live-load force level</small></div></div>'
      + '<div class="applicability ' + applicabilityClass + '"><div class="applicability-icon">' + applicabilityIcon + '</div><div class="applicability-copy"><strong>' + applicability + '</strong><span>' + esc(applicabilityNote) + '</span></div></div>'
      + '<h2>SELECTED CONFIGURATION</h2><div class="configuration">'
      + '<div><span class="meta-label">Structure type</span><b>' + (input.type === "boulder" ? "Boulder wall" : "Climbing wall") + '</b></div>'
      + '<div><span class="meta-label">Height</span><b>' + esc(input.height) + ' m</b></div><div><span class="meta-label">Attachment scheme</span><b>' + levels + '</b></div>'
      + '<div><span class="meta-label">Units</span><b>' + (input.units === "US" ? "Imperial" : "Metric") + '</b></div><div><span class="meta-label">Column span A</span><b>' + esc(input.span) + ' m</b></div>'
      + '<div><span class="meta-label">Overhang X</span><b>' + esc(input.overhang) + ' m</b></div><div><span class="meta-label">Values</span><b>' + (factored ? "Factored" : "Characteristic") + '</b></div>'
      + '<div><span class="meta-label">Standard</span><b>EN 12572-1</b></div><div class="props">' + propertyRows(project) + '</div></div>'
      + '<h2>LOADS AT SELECTED FORCE LEVEL</h2>' + loadTablesHtml
      + '<div class="warning"><b>PRELIMINARY LOADS — NOT FOR CONSTRUCTION.</b> All calculated values and selected attachment details must be reviewed and verified by the responsible structural engineer before use. The application manual is an inseparable part of this report.</div>'
      + '<div class="footer"><span>Prepared through Walltopia Preliminary Loads Calculator</span><span>Page 1</span></div></section>');

    popup.document.write('<section class="page page-two"><div class="land-head"><h1>CONFIGURATION VISUALS AND SELECTED DETAILS</h1><div class="sub">' + esc(input.height) + ' m wall | A = ' + esc(input.span) + ' m | X = ' + esc(input.overhang) + ' m | ' + levels + ' | print-ready overview</div></div>'
      + '<div class="land-grid"><div class="side-panel"><div class="section-title">LOAD APPLICATION - SIDE ELEVATION</div><div class="side-svg schematic">' + sideSvg + '</div></div>'
      + '<div class="acs-panel"><div class="section-title">ACS GEOMETRY AND COLUMN LOADS</div><div class="acs-svg attachment-acs">' + acsSvg + '</div><div class="detail-title">SELECTED ATTACHMENT DETAILS</div>'
      + '<div class="detail-cards"><div class="detail-card"><strong>' + esc(baseCode) + '</strong><b>Base connection</b><span>Supporting slab: ' + esc(slab.toLowerCase()) + '</span></div>'
      + '<div class="detail-card"><strong>' + esc(levelCode) + '</strong><b>Attachment levels</b><span>Method: ' + esc(method.toLowerCase()) + '</span></div></div>'
      + '<div class="manual-ref">See Standard Attachment Details manual for the complete technical drawings.</div></div></div>'
      + '<div class="footer"><span>Prepared through Walltopia Preliminary Loads Calculator</span><span>Page 2</span></div></section>');

    popup.document.write('<script>window.addEventListener("load",async function(){'
      + 'try{'
      + 'var opts={scale:2.4,backgroundColor:"#ffffff",useCORS:true,logging:false};'
      + 'var p1=await html2canvas(document.querySelector(".page-one"),opts);'
      + 'var p2=await html2canvas(document.querySelector(".page-two"),opts);'
      + 'var PDF=window.jspdf.jsPDF;var pdf=new PDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});'
      + 'pdf.addImage(p1.toDataURL("image/jpeg",0.97),"JPEG",0,0,210,297,undefined,"FAST");'
      + 'pdf.addPage("a4","landscape");pdf.addImage(p2.toDataURL("image/jpeg",0.97),"JPEG",0,0,297,210,undefined,"FAST");'
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
