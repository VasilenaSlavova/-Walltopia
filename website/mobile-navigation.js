(function () {
  "use strict";
  var masthead = document.querySelector(".masthead");
  var wrap = masthead && masthead.querySelector(".wrap");
  var nav = wrap && wrap.querySelector(".topnav");
  if (!wrap || !nav) return;
  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "mobile-nav-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "primary-navigation");
  toggle.innerHTML = '<span>Menu</span><span class="mobile-nav-toggle__icon" aria-hidden="true"></span>';
  nav.id = nav.id || "primary-navigation";
  wrap.insertBefore(toggle, nav);
  function closeMenu() {
    masthead.classList.remove("is-mobile-nav-open");
    toggle.setAttribute("aria-expanded", "false");
  }
  toggle.addEventListener("click", function () {
    var open = masthead.classList.toggle("is-mobile-nav-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", function (event) { if (event.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeMenu(); });
  // Must match the CSS breakpoint that turns .topnav back into a row (782 px).
  // At 520 the panel was being closed while the toggle was still the only way to
  // reach the navigation, so the menu shut itself on any resize between the two.
  window.addEventListener("resize", function () { if (window.innerWidth > 782) closeMenu(); });
})();
