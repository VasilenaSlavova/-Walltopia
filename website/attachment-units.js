/* Select the Standard Attachment Details asset that matches Calculator Units. */
(function () {
  "use strict";

  var DRAFT_KEY = "walltopia.calculator.draft.v1";
  var ASSETS = {
    EU: {
      pdf: "manuals/attachment/walltopia-standard-attachment-details-metric.pdf?v=20260817",
      sheet: "manuals/attachment/sheet-metric.png?v=20260817",
      label: "Metric"
    },
    USA: {
      pdf: "manuals/attachment/walltopia-standard-attachment-details-imperial.pdf?v=20260817",
      sheet: "manuals/attachment/sheet-imperial.png?v=20260817",
      label: "Imperial"
    }
  };

  function normalizeUnits(value) {
    value = String(value || "").toLowerCase();
    return value === "usa" || value === "us" || value === "imperial" ? "USA" : "EU";
  }

  function selectedUnits() {
    var queryUnits = new URLSearchParams(window.location.search).get("units");
    if (queryUnits) return normalizeUnits(queryUnits);
    if (window.WTCalculatorPayload && window.WTCalculatorPayload.input) {
      return normalizeUnits(window.WTCalculatorPayload.input.units);
    }
    try {
      var draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (draft && draft.units) return normalizeUnits(draft.units);
    } catch (error) {}
    return "EU";
  }

  function apply() {
    var units = selectedUnits();
    var asset = ASSETS[units];
    document.querySelectorAll("[data-attachment-pdf]").forEach(function (link) {
      link.href = asset.pdf;
      link.setAttribute("aria-label", "Download " + asset.label + " Standard Attachment Details PDF");
    });
    document.querySelectorAll("[data-attachment-sheet]").forEach(function (image) {
      if (image.getAttribute("src") !== asset.sheet) image.src = asset.sheet;
      image.alt = asset.label + " Standard Attachment Details drawing sheet";
    });
    document.querySelectorAll("[data-attachment-units-label]").forEach(function (label) {
      label.textContent = asset.label;
    });
    return units;
  }

  window.WTAttachmentDetails = { apply: apply, selectedUnits: selectedUnits, assets: ASSETS };
  apply();
  window.addEventListener("wtcalculatorchange", apply);
  window.addEventListener("storage", function (event) { if (event.key === DRAFT_KEY) apply(); });
})();
