(function () {
  "use strict";

  var nav = document.querySelector(".policy-nav");
  if (!nav) return;

  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  var items = links.map(function (link) {
    return { link: link, section: document.getElementById(link.hash.slice(1)) };
  }).filter(function (item) { return item.section; });

  function activate(id) {
    items.forEach(function (item) {
      var active = item.section.id === id;
      item.link.classList.toggle("is-active", active);
      item.section.classList.toggle("is-active", active);
      if (active) item.link.setAttribute("aria-current", "location");
      else item.link.removeAttribute("aria-current");
    });
  }

  links.forEach(function (link) {
    link.addEventListener("click", function (event) {
      var id = link.hash.slice(1);
      var section = document.getElementById(id);
      var heading = section && section.querySelector("h2");
      if (!section || !heading) return;

      event.preventDefault();
      activate(id);
      window.history.replaceState(null, "", link.hash);

      var masthead = document.querySelector(".masthead");
      var visibleTop = (masthead ? masthead.getBoundingClientRect().bottom : 0) + 12;
      var visibleBottom = window.innerHeight - 20;
      var headingBox = heading.getBoundingClientRect();

      if (headingBox.top < visibleTop || headingBox.bottom > visibleBottom) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  var initial = window.location.hash.slice(1);
  if (initial && document.getElementById(initial)) activate(initial);
}());
