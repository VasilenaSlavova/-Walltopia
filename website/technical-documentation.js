/* Calculator application manual and attachment-detail viewer. */
(function () {
  "use strict";
  var PAGES = window.MANUAL_PAGES || [];
  var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
  var pagesRoot = document.getElementById("pages");
  var jump = document.getElementById("jump");
  var count = document.getElementById("count");
  var prev = document.getElementById("manual-prev");
  var next = document.getElementById("manual-next");
  var overlayPrev = document.getElementById("manual-overlay-prev");
  var overlayNext = document.getElementById("manual-overlay-next");
  var overlayControls = document.querySelector(".manual-page-arrows");
  var currentPage = 1;
  var manualScroll = document.getElementById("manual-scroll");
  var manualZoomValue = document.getElementById("manual-zoom-100");
  var manualScale = 1, manualFitScale = 1, manualNaturalWidth = 0, manualNaturalHeight = 0;

  PAGES.forEach(function (p) {
    var opt = document.createElement("option");
    opt.value = p.page; opt.textContent = "Page " + p.page; jump.appendChild(opt);
  });

  function isSinglePage() { return true; }
  function spreadStart(page) {
    if (isSinglePage() || page === 1) return page;
    return page % 2 === 0 ? page : page - 1;
  }
  function pageFigure(pageNumber) {
    var data = PAGES[pageNumber - 1];
    var fig = document.createElement("figure");
    fig.className = "book-page";
    fig.id = "manual-page-" + pageNumber;
    var img = document.createElement("img");
    img.src = "manuals/manual/page-" + pad(pageNumber) + ".png?v=300dpi";
    img.alt = "Application manual page " + pageNumber + (data && data.text ? ": " + data.text.slice(0, 140) : "");
    img.draggable = false;
    fig.appendChild(img);
    return fig;
  }
  function applyManualZoom() {
    var page = pagesRoot.querySelector(".book-page");
    if (!page || !manualNaturalWidth || !manualNaturalHeight) return;
    page.style.width = (manualNaturalWidth * manualScale) + "px";
    page.style.height = (manualNaturalHeight * manualScale) + "px";
    manualZoomValue.textContent = Math.round(manualScale / manualFitScale * 100) + "%";
  }
  function fitManual() {
    if (!manualNaturalWidth || !manualNaturalHeight) return;
    var availableWidth = Math.max(1, manualScroll.clientWidth - 36);
    var availableHeight = Math.max(1, manualScroll.clientHeight - 36);
    manualFitScale = Math.min(availableWidth / manualNaturalWidth, availableHeight / manualNaturalHeight);
    manualScale = manualFitScale;
    applyManualZoom();
    manualScroll.scrollLeft = 0;
    manualScroll.scrollTop = 0;
  }
  function setManualScale(next, clientX, clientY) {
    next = Math.max(manualFitScale * .25, Math.min(manualFitScale * 6, next));
    var rect = manualScroll.getBoundingClientRect();
    var offsetX = clientX == null ? manualScroll.clientWidth / 2 : clientX - rect.left;
    var offsetY = clientY == null ? manualScroll.clientHeight / 2 : clientY - rect.top;
    var pointX = manualScroll.scrollLeft + offsetX;
    var pointY = manualScroll.scrollTop + offsetY;
    var ratio = next / manualScale;
    manualScale = next;
    applyManualZoom();
    manualScroll.scrollLeft = pointX * ratio - offsetX;
    manualScroll.scrollTop = pointY * ratio - offsetY;
  }
  function prepareManualZoom() {
    var image = pagesRoot.querySelector(".book-page img");
    if (!image) return;
    function ready() {
      manualNaturalWidth = image.naturalWidth;
      manualNaturalHeight = image.naturalHeight;
      fitManual();
    }
    image.onload = ready;
    if (image.complete && image.naturalWidth) ready();
  }
  function renderBook(direction) {
    var start = spreadStart(currentPage);
    var shown = [start];
    if (!isSinglePage() && start > 1 && start + 1 <= PAGES.length) shown.push(start + 1);
    pagesRoot.innerHTML = "";
    var spread = document.createElement("div");
    spread.className = "book-spread" + (shown.length === 1 ? " is-single" : "");
    if (direction > 0) spread.classList.add("turn-forward");
    if (direction < 0) spread.classList.add("turn-backward");
    shown.forEach(function (pageNumber) { spread.appendChild(pageFigure(pageNumber)); });
    pagesRoot.appendChild(spread);
    prepareManualZoom();
    currentPage = start;
    jump.value = String(currentPage);
    count.textContent = shown.length === 2
      ? "Pages " + shown[0] + "–" + shown[1] + " of " + PAGES.length
      : "Page " + shown[0] + " of " + PAGES.length;
    prev.disabled = start <= 1;
    next.disabled = shown[shown.length - 1] >= PAGES.length;
    overlayPrev.disabled = prev.disabled;
    overlayNext.disabled = next.disabled;
    jump.dataset.previous = String(currentPage);
  }
  function move(direction) {
    var step = isSinglePage() ? 1 : (currentPage === 1 && direction > 0 ? 1 : 2);
    currentPage = Math.max(1, Math.min(PAGES.length, currentPage + direction * step));
    renderBook(direction);
  }
  prev.onclick = function () { move(-1); };
  next.onclick = function () { move(1); };
  overlayPrev.onclick = function () { move(-1); };
  overlayNext.onclick = function () { move(1); };
  document.getElementById("manual-zoom-in").onclick = function () { setManualScale(manualScale * 1.25); };
  document.getElementById("manual-zoom-out").onclick = function () { setManualScale(manualScale / 1.25); };
  document.getElementById("manual-zoom-fit").onclick = fitManual;
  document.getElementById("manual-zoom-100").onclick = fitManual;
  manualScroll.addEventListener("wheel", function (event) {
    event.preventDefault();
    setManualScale(manualScale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX, event.clientY);
  }, { passive: false });
  var manualDown = false, manualStartX, manualStartY, manualStartLeft, manualStartTop;
  manualScroll.onpointerdown = function (event) {
    event.preventDefault();
    manualDown = true;
    manualStartX = event.clientX; manualStartY = event.clientY;
    manualStartLeft = manualScroll.scrollLeft; manualStartTop = manualScroll.scrollTop;
    manualScroll.classList.add("grabbing");
    manualScroll.setPointerCapture(event.pointerId);
  };
  manualScroll.onpointermove = function (event) {
    if (!manualDown) return;
    manualScroll.scrollLeft = manualStartLeft - (event.clientX - manualStartX);
    manualScroll.scrollTop = manualStartTop - (event.clientY - manualStartY);
  };
  manualScroll.onpointerup = manualScroll.onpointercancel = function () {
    manualDown = false;
    manualScroll.classList.remove("grabbing");
  };
  jump.onchange = function () {
    var previousPage = currentPage;
    currentPage = Number(jump.value) || 1;
    renderBook(currentPage >= previousPage ? 1 : -1);
  };
  document.addEventListener("keydown", function (event) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  });
  function positionOverlayControls() {
    var rect = manualScroll.getBoundingClientRect();
    var viewportMiddle = window.innerHeight / 2;
    var isOverManual = rect.top < viewportMiddle && rect.bottom > viewportMiddle;
    overlayControls.classList.toggle("is-active", isOverManual);
    overlayControls.style.left = rect.left + "px";
    overlayControls.style.width = rect.width + "px";
  }
  window.addEventListener("scroll", positionOverlayControls, { passive: true });
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { renderBook(0); positionOverlayControls(); }, 120);
  });
  renderBook(0);
  positionOverlayControls();

  if ("IntersectionObserver" in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        document.querySelectorAll("[data-doc-link]").forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("data-doc-link") === e.target.id);
        });
      });
    }, { rootMargin: "-35% 0px -55% 0px" });
    document.querySelectorAll("[data-doc-section]").forEach(function (s) { sectionObserver.observe(s); });
  }

  var scroll = document.getElementById("scroll");
  var sheet = document.getElementById("sheet");
  var zoomValue = document.getElementById("zoom-100");
  var natW = 0, scale = 1, fitScale = 1;
  function apply() { sheet.style.width = (natW * scale) + "px"; sheet.style.height = "auto"; zoomValue.textContent = Math.round(scale / fitScale * 100) + "%"; }
  function fit() { var avail = scroll.clientWidth - 2; fitScale = Math.max(.1, (natW ? avail / natW : 1) * .89); scale = fitScale; apply(); }
  function setScale(s, cx, cy) {
    s = Math.max(fitScale * .25, Math.min(fitScale * 6, s));
    var rect = scroll.getBoundingClientRect();
    var px = (cx == null ? scroll.clientWidth / 2 : cx - rect.left) + scroll.scrollLeft;
    var py = (cy == null ? scroll.clientHeight / 2 : cy - rect.top) + scroll.scrollTop;
    var ratio = s / scale; scale = s; apply();
    scroll.scrollLeft = px * ratio - (cx == null ? scroll.clientWidth / 2 : cx - rect.left);
    scroll.scrollTop = py * ratio - (cy == null ? scroll.clientHeight / 2 : cy - rect.top);
  }
  sheet.onload = function () { natW = sheet.naturalWidth; fit(); };
  if (sheet.complete && sheet.naturalWidth) { natW = sheet.naturalWidth; fit(); }
  window.addEventListener("resize", function () { if (Math.abs(scale - fitScale) < 1e-6) fit(); });
  document.getElementById("zoom-in").onclick = function () { setScale(scale * 1.25); };
  document.getElementById("zoom-out").onclick = function () { setScale(scale / 1.25); };
  document.getElementById("zoom-reset").onclick = fit;
  document.getElementById("zoom-100").onclick = fit;
  scroll.addEventListener("wheel", function (e) { e.preventDefault(); setScale(scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY); }, { passive: false });
  var down = false, sx, sy, sl, st;
  scroll.onpointerdown = function (e) { e.preventDefault(); down = true; sx = e.clientX; sy = e.clientY; sl = scroll.scrollLeft; st = scroll.scrollTop; scroll.classList.add("grabbing"); scroll.setPointerCapture(e.pointerId); };
  scroll.onpointermove = function (e) { if (!down) return; scroll.scrollLeft = sl - (e.clientX - sx); scroll.scrollTop = st - (e.clientY - sy); };
  scroll.onpointerup = scroll.onpointercancel = function () { down = false; scroll.classList.remove("grabbing"); };
  sheet.ondragstart = function (e) { e.preventDefault(); };
})();
