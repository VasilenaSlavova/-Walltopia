(function () {
  "use strict";

  var STORAGE_KEY = "walltopia_cookie_consent";

  function saveChoice(choice) {
    try { localStorage.setItem(STORAGE_KEY, choice); } catch (error) {}
    document.documentElement.dataset.cookieConsent = choice;
  }

  function init() {
    var savedChoice = null;
    try { savedChoice = localStorage.getItem(STORAGE_KEY); } catch (error) {}
    if (savedChoice === "accepted" || savedChoice === "essential") {
      document.documentElement.dataset.cookieConsent = savedChoice;
      return;
    }

    var banner = document.createElement("section");
    banner.className = "cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "false");
    banner.setAttribute("aria-labelledby", "cookie-title");
    banner.innerHTML =
      '<div class="cookie-banner__content">' +
        '<div class="cookie-banner__copy">' +
          '<span class="cookie-banner__eyebrow">Your privacy</span>' +
          '<h2 id="cookie-title">We use cookies</h2>' +
          '<p>We use essential storage to keep the website working and, with your permission, optional cookies to improve your experience.</p>' +
        '</div>' +
        '<div class="cookie-banner__actions">' +
          '<button class="btn cookie-essential" type="button">Decline</button>' +
          '<button class="btn primary cookie-accept" type="button">Accept all</button>' +
        '</div>' +
      '</div>';

    function close(choice) {
      saveChoice(choice);
      banner.classList.add("is-closing");
      window.setTimeout(function () { banner.remove(); }, 180);
    }

    banner.querySelector(".cookie-essential").addEventListener("click", function () { close("essential"); });
    banner.querySelector(".cookie-accept").addEventListener("click", function () { close("accepted"); });
    document.body.appendChild(banner);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
