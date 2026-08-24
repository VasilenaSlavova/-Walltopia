/* Project-linked Engineering Support inquiry page. */
(function () {
  "use strict";
  var root = document.getElementById("ask-root");
  var projects = [];
  var selected = null;
  var DIAL_CODES = {
    Afghanistan:"+93", Albania:"+355", Algeria:"+213", Andorra:"+376", Angola:"+244", Argentina:"+54", Armenia:"+374", Aruba:"+297", Australia:"+61", Austria:"+43", Azerbaijan:"+994",
    Bahamas:"+1242", Bahrain:"+973", Bangladesh:"+880", Barbados:"+1246", Belarus:"+375", Belgium:"+32", Belize:"+501", Benin:"+229", Bhutan:"+975", Bolivia:"+591", "Bosnia and Herzegovina":"+387", Botswana:"+267", Brazil:"+55", Brunei:"+673", Bulgaria:"+359", "Burkina Faso":"+226", Burundi:"+257",
    Cambodia:"+855", Cameroon:"+237", Canada:"+1", "Cape Verde":"+238", "Central African Republic":"+236", Chad:"+235", Chile:"+56", China:"+86", Colombia:"+57", Comoros:"+269", Congo:"+242", "Costa Rica":"+506", Croatia:"+385", Cuba:"+53", Cyprus:"+357", "Czech Republic":"+420", "Côte d'Ivoire":"+225",
    Denmark:"+45", Djibouti:"+253", Dominica:"+1767", "Dominican Republic":"+1809", Ecuador:"+593", Egypt:"+20", "El Salvador":"+503", Estonia:"+372", Ethiopia:"+251", Finland:"+358", France:"+33", Georgia:"+995", Germany:"+49", Ghana:"+233", Greece:"+30", Guatemala:"+502",
    "Hong Kong":"+852", Hungary:"+36", Iceland:"+354", India:"+91", Indonesia:"+62", Iran:"+98", Iraq:"+964", Ireland:"+353", Israel:"+972", Italy:"+39", Japan:"+81", Jordan:"+962", Kazakhstan:"+7", Kenya:"+254", Kosovo:"+383", Kuwait:"+965", Latvia:"+371", Lebanon:"+961", Lithuania:"+370", Luxembourg:"+352",
    Macedonia:"+389", Malaysia:"+60", Malta:"+356", Mexico:"+52", Moldova:"+373", Monaco:"+377", Montenegro:"+382", Morocco:"+212", Netherlands:"+31", "New Zealand":"+64", Nigeria:"+234", Norway:"+47", Pakistan:"+92", Palestine:"+970", Panama:"+507", Peru:"+51", Philippines:"+63", Poland:"+48", Portugal:"+351", Qatar:"+974",
    Romania:"+40", Russia:"+7", "Saudi Arabia":"+966", Serbia:"+381", Singapore:"+65", Slovakia:"+421", Slovenia:"+386", "South Africa":"+27", "South Korea":"+82", Spain:"+34", Sweden:"+46", Switzerland:"+41", Taiwan:"+886", Thailand:"+66", Tunisia:"+216", Turkey:"+90", Ukraine:"+380", "United Arab Emirates":"+971", "United Kingdom":"+44", "United States":"+1", Uruguay:"+598", Venezuela:"+58", Vietnam:"+84"
  };
  Object.assign(DIAL_CODES, {
    "Aland Islands":"+358", "American Samoa":"+1684", Anguilla:"+1264", "Antigua and Barbuda":"+1268", Aruba:"+297",
    Bermuda:"+1441", "Bonaire, Sint Eustatius and Saba":"+599", "British Indian Ocean Territory":"+246", "Cayman Islands":"+1345",
    "Christmas Island":"+61", "Cocos (Keeling) Islands":"+61", Curacao:"+599", "Falkland Islands (Malvinas)":"+500",
    "Faroe Islands":"+298", "French Guiana":"+594", "French Polynesia":"+689", Gibraltar:"+350", Greenland:"+299",
    Guadeloupe:"+590", Guam:"+1671", Guernsey:"+44", "Holy See":"+39", "Isle of Man":"+44", Jersey:"+44",
    Macao:"+853", Martinique:"+596", Mayotte:"+262", Montserrat:"+1664", "New Caledonia":"+687", Niue:"+683",
    "Norfolk Island":"+672", "Northern Mariana Islands":"+1670", Pitcairn:"+64", "Puerto Rico":"+1", Reunion:"+262",
    "Saint Barthelemy":"+590", "Saint Helena, Ascension and Tristan da Cunha":"+290", "Saint Kitts and Nevis":"+1869",
    "Saint Lucia":"+1758", "Saint Martin (French part)":"+590", "Saint Pierre and Miquelon":"+508",
    "Saint Vincent and the Grenadines":"+1784", "Sint Maarten (Dutch part)":"+1721",
    "South Georgia and the South Sandwich Islands":"+500", "Svalbard and Jan Mayen":"+47", Tokelau:"+690",
    "Turks and Caicos Islands":"+1649", "United States Minor Outlying Islands":"+1", "Virgin Islands, British":"+1284",
    "Virgin Islands, U.S.":"+1340", "Wallis and Futuna":"+681", "Western Sahara":"+212"
  });
  // Maximum national mobile-number length by international calling code.
  var MOBILE_LENGTHS = {1:10,7:10,20:10,27:9,30:10,31:11,32:9,33:9,34:9,36:9,39:10,40:9,41:9,43:13,44:10,45:8,46:9,47:8,48:9,49:11,51:9,52:10,53:8,54:11,55:11,56:9,57:10,58:10,60:10,61:9,62:12,63:10,64:10,65:8,66:9,81:10,82:10,84:9,86:11,90:10,91:10,92:10,93:9,94:9,95:10,98:10,211:9,212:9,213:9,216:8,218:9,220:7,221:9,222:8,223:8,224:9,225:10,226:8,227:8,228:8,229:10,230:8,231:9,232:8,233:9,234:10,235:8,236:8,237:9,238:7,239:7,240:9,241:8,242:9,243:9,244:9,245:9,246:7,247:5,248:7,249:9,250:9,251:9,252:9,253:8,254:9,255:9,256:9,257:8,258:9,260:9,261:9,262:9,263:9,264:9,265:9,266:8,267:8,268:8,269:7,290:5,291:7,297:7,298:6,299:6,350:8,351:9,352:9,353:9,354:9,355:9,356:8,357:8,358:10,359:9,370:8,371:8,372:8,373:8,374:8,375:9,376:9,377:9,378:8,380:9,381:10,382:8,383:8,385:9,386:8,387:9,389:8,420:9,421:9,423:9,500:5,501:7,502:8,503:8,504:8,505:8,506:8,507:8,508:9,509:8,590:9,591:8,592:7,593:9,594:9,595:9,596:9,597:7,598:8,599:8,670:8,672:6,673:7,674:7,675:8,676:7,677:7,678:7,679:7,680:7,681:6,682:5,683:7,685:10,686:8,687:6,688:7,689:8,690:7,691:7,692:7,850:10,852:8,853:8,855:9,856:10,880:10,886:9,960:7,961:8,962:9,963:9,964:10,965:8,966:9,967:9,968:8,970:9,971:9,972:9,973:8,974:8,975:8,976:8,977:10,992:9,993:8,994:9,995:9,996:9,998:9};

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>\"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmtLen(v, units) {
    if (v == null) return "—";
    return units === "USA" ? (Math.round(v * 3.28084 * 10) / 10) + " ft" : v + " m";
  }

  function guestView() {
    root.innerHTML = '<div class="dash-guest"><h2>Log in to access Engineering Support</h2>'
      + '<p>Your inquiry must be linked to a saved calculation so the support team receives the correct project context.</p>'
      + '<button class="btn primary" id="ask-login">Log in or register</button></div>';
    root.querySelector("#ask-login").onclick = function () { window.WTAuth.open("register"); };
  }

  async function load() {
    var user = window.WTAuth && window.WTAuth.current();
    if (!user) return guestView();
    root.innerHTML = '<div class="dash-empty">Loading your projects…</div>';
    try {
      var res = await window.WTApi.listProjects({ sort: "updated" });
      projects = res.projects || [];
      if (!projects.length) return emptyView();
      var requestedId = new URLSearchParams(location.search).get("project");
      selected = projects.find(function (p) { return p.id === requestedId; }) || projects[0];
      render(user);
    } catch (e) {
      root.innerHTML = '<div class="dash-empty">' + esc(e.message || "Could not load projects.") + "</div>";
    }
  }

  function emptyView() {
    root.innerHTML = '<div class="dash-empty">You need a saved calculation before sending a technical inquiry. '
      + '<a href="index.html">Open the calculator</a>, choose the inputs and save the design as a project.</div>';
  }

  function projectOptions() {
    return projects.map(function (p) {
      return '<button type="button" class="ask-country-option' + (p.id === selected.id ? ' is-selected' : '') + '" role="option" aria-selected="' + (p.id === selected.id ? 'true' : 'false') + '" data-value="' + esc(p.id) + '" data-project-name="' + esc(p.name) + '">' + esc(p.name) + "</button>";
    }).join("");
  }

  function topicOptions() {
    return ["Result review", "Supporting structure", "Attachment method", "Special structural case", "Other"].map(function (topic) {
      return '<button type="button" class="ask-dropdown-option" role="option" data-value="' + esc(topic) + '">' + esc(topic) + "</button>";
    }).join("");
  }

  function countryOptions() {
    var countries = [
      "Afghanistan", "Aland Islands", "Albania", "Algeria", "American Samoa",
      "Andorra", "Angola", "Anguilla", "Antarctica", "Antigua and Barbuda",
      "Argentina", "Armenia", "Aruba", "Australia", "Austria", "Azerbaijan",
      "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
      "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia",
      "Bonaire, Sint Eustatius and Saba", "Bosnia and Herzegovina", "Botswana",
      "Bouvet Island", "Brazil", "British Indian Ocean Territory", "Brunei",
      "Bulgaria", "Burkina Faso", "Burundi", "Côte d'Ivoire", "Cambodia",
      "Cameroon", "Canada", "Cape Verde", "Cayman Islands",
      "Central African Republic", "Chad", "Chile", "China", "Christmas Island",
      "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo", "Cook Islands",
      "Costa Rica", "Croatia", "Cuba", "Curacao", "Cyprus", "Czech Republic",
      "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor",
      "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea",
      "Estonia", "Ethiopia", "Falkland Islands (Malvinas)", "Faroe Islands",
      "Fiji", "Finland", "France", "French Guiana", "French Polynesia",
      "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germany",
      "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe",
      "Guam", "Guatemala", "Guernsey", "Guinea", "Guinea-Bissau", "Guyana",
      "Haiti", "Heard Island and McDonald Islands", "Holy See", "Honduras",
      "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
      "Ireland", "Isle of Man", "Israel", "Italy", "Jamaica", "Japan", "Jersey",
      "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait",
      "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya",
      "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Macedonia",
      "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
      "Marshall Islands", "Martinique", "Mauritania", "Mauritius", "Mayotte",
      "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro",
      "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru",
      "Nepal", "Netherlands", "New Caledonia", "New Zealand", "Nicaragua",
      "Niger", "Nigeria", "Niue", "Norfolk Island", "North Korea",
      "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau",
      "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru",
      "Philippines", "Pitcairn", "Poland", "Portugal", "Puerto Rico", "Qatar",
      "Reunion", "Romania", "Russia", "Rwanda", "Saint Barthelemy",
      "Saint Helena, Ascension and Tristan da Cunha", "Saint Kitts and Nevis",
      "Saint Lucia", "Saint Martin (French part)", "Saint Pierre and Miquelon",
      "Saint Vincent and the Grenadines", "Samoa", "San Marino",
      "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles",
      "Sierra Leone", "Singapore", "Sint Maarten (Dutch part)", "Slovakia",
      "Slovenia", "Solomon Islands", "Somalia", "South Africa",
      "South Georgia and the South Sandwich Islands", "South Korea",
      "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname",
      "Svalbard and Jan Mayen", "Swaziland", "Sweden", "Switzerland", "Syria",
      "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo",
      "Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey",
      "Turkmenistan", "Turks and Caicos Islands", "Tuvalu", "Uganda", "Ukraine",
      "United Arab Emirates", "United Kingdom", "United States",
      "United States Minor Outlying Islands", "Uruguay", "Uzbekistan", "Vanuatu",
      "Vatican City", "Venezuela", "Vietnam", "Virgin Islands, British",
      "Virgin Islands, U.S.", "Wallis and Futuna", "Western Sahara", "Yemen",
      "Zambia", "Zimbabwe"
    ];
    return countries.filter(function (country) { return window.WT_PHONE_RULES && window.WT_PHONE_RULES[country]; }).map(function (country) {
      return '<button type="button" class="ask-country-option" role="option" data-country="' + esc(country) + '">' + esc(country) + "</button>";
    }).join("");
  }

  function detailRows(p) {
    var input = p.input || {};
    var units = input.units === "USA" ? "Imperial" : "Metric";
    var facts = [
      ["Structure type", input.type === "boulder" ? "Boulder wall" : "Climbing wall"],
      ["Height", fmtLen(input.height, input.units)],
      ["Attachment", input.type === "boulder" ? "Single attachment" : ((input.levels || "—") + " levels")],
      ["Column span A", fmtLen(input.span, input.units)],
      ["Overhang X", fmtLen(input.overhang, input.units)],
      ["Units", units],
    ];
    return facts.map(function (f) { return '<div><span>' + f[0] + "</span><b>" + esc(f[1]) + "</b></div>"; }).join("");
  }

  function render(user) {
    var fullName = String(user.name || "").trim().split(/\s+/);
    var firstName = fullName.shift() || "";
    var lastName = fullName.join(" ");
    root.innerHTML = '<div class="ask-layout">'
      + '<form class="card ask-form" id="ask-form">'
      + '<span class="ask-kicker">Contact form</span>'
      + '<div class="ask-section"><h2>Contact details</h2><div class="ask-two">'
      + '<label class="ask-field"><span>First name *</span><input id="ask-first-name" type="text" value="' + esc(firstName) + '" required></label>'
      + '<label class="ask-field"><span>Last name *</span><input id="ask-last-name" type="text" value="' + esc(lastName) + '" required></label>'
      + '<label class="ask-field ask-field-wide"><span>Email *</span><input id="ask-email" type="email" value="' + esc(user.email || "") + '" required></label>'
      + '<label class="ask-field ask-country-field"><span>Country *</span>'
      + '<input id="ask-country" type="text" required autocomplete="off" placeholder="Select or search for your country" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ask-country-list">'
      + '<div class="ask-country-list" id="ask-country-list" role="listbox">' + countryOptions() + '</div></label>'
      + '<label class="ask-field"><span>Phone</span><input id="ask-phone" type="tel" inputmode="tel" placeholder="+ Country code · Phone number"></label>'
      + "</div></div>"
      + '<div class="ask-section"><h2>Project and inquiry</h2>'
      + '<label class="ask-field ask-country-field ask-project-field"><span>Saved project</span><input id="ask-project" type="text" required autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ask-project-list" value="' + esc(selected.name) + '" data-value="' + esc(selected.id) + '" data-selected-project="' + esc(selected.name) + '"><div class="ask-country-list" id="ask-project-list" role="listbox">' + projectOptions() + "</div></label>"
      + '<label class="ask-field ask-dropdown-field"><span>Topic</span><input id="ask-topic" type="text" readonly required role="combobox" aria-expanded="false" placeholder="Select a topic"><div class="ask-dropdown-list" role="listbox">' + topicOptions() + "</div></label>"
      + '<label class="ask-field"><span>Technical question *</span><textarea id="ask-message" minlength="5" maxlength="2800" required placeholder="Describe the structure, the issue and what you would like the Engineering Support team to review."></textarea><small><span id="ask-count">0</span> / 2800 characters</small></label></div>'
      + '<label class="ask-consent"><input id="ask-consent" type="checkbox" required aria-describedby="ask-consent-error"><span>I agree that Walltopia may use the submitted information to respond to this inquiry.</span></label>'
      + '<div class="ask-consent-error" id="ask-consent-error" role="alert">Please confirm your consent before continuing.</div>'
      + '<label class="ask-consent ask-marketing"><input id="ask-marketing" type="checkbox"><span>I agree to receive marketing materials from Walltopia.</span></label>'
      + '<div class="ask-actions"><button class="btn primary" id="ask-send" type="submit">Send inquiry</button><span class="save-msg" id="ask-msg" role="status"></span></div>'
      + "</form>"
      + '<aside><div class="card ask-attached"><span class="ask-kicker">Attached calculation</span><h2 id="ask-project-name">' + esc(selected.name) + '</h2><div class="ask-facts" id="ask-facts">' + detailRows(selected) + "</div>"
      + '<a class="btn small" id="ask-open-project" href="index.html?project=' + esc(selected.id) + '">Open calculation</a></div>'
      + '<div class="ask-included"><h3>Engineering Support receives</h3><ul><li>Calculation inputs and result snapshot</li><li>Project tags and additional project information</li><li>Your selected topic and technical question</li><li>The inquiry in the project history</li></ul></div></aside>'
      + '<div class="ask-contact-strip"><div><span class="ask-kicker">Walltopia head office</span><a class="ask-office-link" href="https://www.google.com/maps/search/?api=1&amp;query=Walltopia+111V+Tsarigradsko+Shose+Sofia" target="_blank" rel="noopener noreferrer">111V Tsarigradsko Shose Blvd.<br>Sofia 1784, Bulgaria</a></div><div><span class="ask-kicker">General contact</span><a href="mailto:sales@walltopia.com">sales@walltopia.com</a></div><div><span class="ask-kicker">What happens next</span><p>An engineer reviews the calculation and replies using your preferred channel.</p></div></div>'
      + "</div>";
    wire();
  }

  function wire() {
    var select = root.querySelector("#ask-project");
    var text = root.querySelector("#ask-message");
    select.addEventListener("change", function () {
      selected = projects.find(function (p) { return p.id === select.dataset.value; });
      if (!selected) return;
      root.querySelector("#ask-project-name").textContent = selected.name;
      root.querySelector("#ask-facts").innerHTML = detailRows(selected);
      root.querySelector("#ask-open-project").href = "index.html?project=" + selected.id;
      history.replaceState(null, "", "ask-engineer.html?project=" + selected.id);
    });
    var projectList = root.querySelector("#ask-project-list");
    var projectField = select.closest(".ask-project-field");
    function closeOtherMenus(currentList) {
      root.querySelectorAll(".ask-country-list.is-open, .ask-dropdown-list.is-open").forEach(function (list) {
        if (list === currentList) return;
        list.classList.remove("is-open");
        list.closest(".ask-field").classList.remove("is-menu-open");
        var input = list.closest(".ask-field").querySelector("input");
        if (input) input.setAttribute("aria-expanded", "false");
      });
    }
    function openProjectList() { closeOtherMenus(projectList); projectList.classList.add("is-open"); projectField.classList.add("is-menu-open"); select.setAttribute("aria-expanded", "true"); }
    function closeProjectList() { projectList.classList.remove("is-open"); projectField.classList.remove("is-menu-open"); select.setAttribute("aria-expanded", "false"); }
    function filterProjects() {
      var query = select.value.trim().toLowerCase();
      var exact = false;
      projectList.querySelectorAll(".ask-country-option").forEach(function (option) {
        var name = option.dataset.projectName || option.textContent;
        option.hidden = query && name.toLowerCase().indexOf(query) === -1;
        if (name.toLowerCase() === query) exact = true;
      });
      select.setCustomValidity(exact ? "" : "Please select a saved project from the list.");
      openProjectList();
    }
    select.addEventListener("focus", function () {
      if (select.value === (select.dataset.selectedProject || "")) projectList.querySelectorAll(".ask-country-option").forEach(function (option) { option.hidden = false; });
      openProjectList();
    });
    select.addEventListener("click", openProjectList);
    select.addEventListener("input", function () {
      if (select.value !== (select.dataset.selectedProject || "")) { select.dataset.value = ""; select.dataset.selectedProject = ""; }
      filterProjects();
    });
    projectList.addEventListener("click", function (event) {
      var option = event.target.closest(".ask-country-option"); if (!option) return;
      projectList.querySelectorAll(".ask-country-option").forEach(function (item) { item.classList.toggle("is-selected", item === option); item.setAttribute("aria-selected", item === option ? "true" : "false"); });
      select.value = option.dataset.projectName || option.textContent;
      select.dataset.value = option.dataset.value;
      select.dataset.selectedProject = select.value;
      select.setCustomValidity("");
      select.dispatchEvent(new Event("change", { bubbles:true }));
      closeProjectList();
    });
    document.addEventListener("pointerdown", function (event) { if (!event.target.closest(".ask-project-field")) closeProjectList(); });
    root.querySelectorAll(".ask-dropdown-field").forEach(function (field) {
      var input = field.querySelector("input");
      var list = field.querySelector(".ask-dropdown-list");
      function close() { list.classList.remove("is-open"); field.classList.remove("is-menu-open"); input.setAttribute("aria-expanded", "false"); }
      function open() {
        closeOtherMenus(list);
        list.classList.add("is-open"); field.classList.add("is-menu-open"); input.setAttribute("aria-expanded", "true");
      }
      input.addEventListener("click", function () { list.classList.contains("is-open") ? close() : open(); });
      input.addEventListener("keydown", function (event) {
        if (event.key === "Escape") close();
        if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); var first = list.querySelector(".ask-dropdown-option"); if (first) first.focus(); }
      });
      list.addEventListener("click", function (event) {
        var option = event.target.closest(".ask-dropdown-option"); if (!option) return;
        list.querySelectorAll(".ask-dropdown-option").forEach(function (item) {
          item.classList.toggle("is-selected", item === option);
          item.setAttribute("aria-selected", item === option ? "true" : "false");
        });
        input.value = option.textContent; input.dataset.value = option.dataset.value;
        input.dispatchEvent(new Event("change", { bubbles:true })); close();
      });
      document.addEventListener("pointerdown", function (event) { if (!field.contains(event.target)) close(); });
    });
    text.oninput = function () { root.querySelector("#ask-count").textContent = text.value.length; };
    var countryInput = root.querySelector("#ask-country");
    var countryList = root.querySelector("#ask-country-list");
    var countryField = countryInput.closest(".ask-country-field");
    var phoneInput = root.querySelector("#ask-phone");
    function maximumPhoneDigits(dialCode) {
      var dialDigits = String(dialCode || "").replace(/\D/g, "");
      if (!dialDigits) return 15;
      if (/^1\d{3}$/.test(dialDigits)) return dialDigits.length + 7;
      return dialDigits.length + (MOBILE_LENGTHS[dialDigits] || (15 - dialDigits.length));
    }
    function activeMaximumPhoneDigits(value) {
      var digits = String(value || "").replace(/\D/g, "");
      var selectedCountry = countryInput.dataset.selectedCountry || countryInput.value;
      var selectedRule = window.WT_PHONE_RULES && window.WT_PHONE_RULES[selectedCountry];
      var selectedCode = selectedRule ? selectedRule.dialCode : (DIAL_CODES[selectedCountry] || "");
      var selectedCodeDigits = selectedCode.replace(/\D/g, "");
      var maximumDigits = selectedCodeDigits && digits.indexOf(selectedCodeDigits) === 0
        ? selectedCodeDigits.length + (selectedRule ? selectedRule.nationalDigits : maximumPhoneDigits(selectedCode) - selectedCodeDigits.length)
        : 15;
      if (selectedCountry === "Andorra" && digits.indexOf(selectedCodeDigits) === 0) {
        var national = digits.slice(selectedCodeDigits.length);
        if ((national && "690".indexOf(national) !== 0 && national.indexOf("690") !== 0)
          || (national.length >= 3 && national.indexOf("690") !== 0)) {
          maximumDigits = selectedCodeDigits.length + 6;
        }
      }
      return maximumDigits;
    }
    phoneInput.addEventListener("beforeinput", function (event) {
      if (!event.data || !/\d/.test(event.data)) return;
      var digits = phoneInput.value.replace(/\D/g, "");
      var selectedText = phoneInput.value.slice(phoneInput.selectionStart || 0, phoneInput.selectionEnd || 0);
      var replacedDigits = selectedText.replace(/\D/g, "").length;
      var incomingDigits = event.data.replace(/\D/g, "").length;
      if (digits.length - replacedDigits + incomingDigits > activeMaximumPhoneDigits(phoneInput.value)) event.preventDefault();
    });
    phoneInput.addEventListener("input", function () {
      var startsWithPlus = phoneInput.value.charAt(0) === "+";
      var digits = phoneInput.value.replace(/\D/g, "");
      var selectedCountry = countryInput.dataset.selectedCountry || countryInput.value;
      var selectedRule = window.WT_PHONE_RULES && window.WT_PHONE_RULES[selectedCountry];
      var selectedCode = selectedRule ? selectedRule.dialCode : (DIAL_CODES[selectedCountry] || "");
      var selectedCodeDigits = selectedCode.replace(/\D/g, "");
      if (!selectedCodeDigits && startsWithPlus) {
        selectedCodeDigits = Object.keys(MOBILE_LENGTHS)
          .filter(function (code) { return digits.indexOf(code) === 0; })
          .sort(function (a, b) { return b.length - a.length; })[0] || "";
        selectedCode = selectedCodeDigits ? "+" + selectedCodeDigits : "";
      }
      if (selectedRule && selectedRule.stripsLeadingZero && digits.indexOf(selectedCodeDigits + "0") === 0) {
        digits = selectedCodeDigits + digits.slice(selectedCodeDigits.length + 1);
      }
      var maximumDigits = selectedCodeDigits && digits.indexOf(selectedCodeDigits) === 0
        ? selectedCodeDigits.length + (selectedRule ? selectedRule.nationalDigits : maximumPhoneDigits(selectedCode) - selectedCodeDigits.length)
        : 15;
      if (selectedCountry === "Andorra" && digits.indexOf(selectedCodeDigits) === 0) {
        var andorraNational = digits.slice(selectedCodeDigits.length);
        if ((andorraNational && "690".indexOf(andorraNational) !== 0 && andorraNational.indexOf("690") !== 0)
          || (andorraNational.length >= 3 && andorraNational.indexOf("690") !== 0)) {
          maximumDigits = selectedCodeDigits.length + 6;
        }
      }
      digits = digits.slice(0, maximumDigits);
      var raw = (startsWithPlus ? "+" : "") + digits;
      if (selectedCodeDigits === "297" && digits.indexOf("297") === 0) {
        var national = digits.slice(3, 10);
        phoneInput.value = "+297" + (national ? " " + national.slice(0, 3) : "") + (national.length > 3 ? " " + national.slice(3) : "");
      } else {
        phoneInput.value = window.libphonenumber ? new window.libphonenumber.AsYouType().input(raw) : raw;
      }
      if (digits.length === maximumDigits && window.libphonenumber && !window.libphonenumber.isValidPhoneNumber(phoneInput.value)) {
        phoneInput.setCustomValidity("Enter a valid mobile number for the selected country.");
      } else {
        phoneInput.setCustomValidity("");
      }
    });
    function openCountryList() {
      closeOtherMenus(countryList);
      countryList.classList.add("is-open");
      countryField.classList.add("is-menu-open");
      countryInput.setAttribute("aria-expanded", "true");
    }
    function closeCountryList() {
      countryList.classList.remove("is-open");
      countryField.classList.remove("is-menu-open");
      countryInput.setAttribute("aria-expanded", "false");
    }
    function showAllCountries() {
      countryList.querySelectorAll(".ask-country-option").forEach(function (option) { option.hidden = false; });
    }
    function filterCountries() {
      var query = countryInput.value.trim().toLowerCase();
      var exactMatch = false;
      countryList.querySelectorAll(".ask-country-option").forEach(function (option) {
        option.hidden = query && option.dataset.country.toLowerCase().indexOf(query) === -1;
        if (option.dataset.country.toLowerCase() === query) exactMatch = true;
      });
      countryInput.setCustomValidity(exactMatch ? "" : "Please select a country from the list.");
      openCountryList();
    }
    countryInput.addEventListener("focus", function () {
      if (countryInput.value === (countryInput.dataset.selectedCountry || "")) showAllCountries();
      openCountryList();
    });
    countryInput.addEventListener("click", function () {
      if (countryInput.value === (countryInput.dataset.selectedCountry || "")) showAllCountries();
      openCountryList();
    });
    countryInput.addEventListener("input", function () {
      if (countryInput.value !== (countryInput.dataset.selectedCountry || "")) countryInput.dataset.selectedCountry = "";
      filterCountries();
    });
    countryInput.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeCountryList();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        openCountryList();
        var first = countryList.querySelector(".ask-country-option:not([hidden])");
        if (first) first.focus();
      }
    });
    countryList.addEventListener("click", function (event) {
      var option = event.target.closest(".ask-country-option");
      if (!option) return;
      var nextRule = window.WT_PHONE_RULES && window.WT_PHONE_RULES[option.dataset.country];
      var nextCode = nextRule ? nextRule.dialCode : (DIAL_CODES[option.dataset.country] || "");
      countryInput.value = option.dataset.country;
      countryInput.dataset.selectedCountry = option.dataset.country;
      if (nextCode) {
        phoneInput.value = nextCode;
        phoneInput.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        phoneInput.value = "";
        phoneInput.setCustomValidity("");
      }
      countryInput.dispatchEvent(new Event("input", { bubbles: true }));
      countryInput.focus();
      closeCountryList();
    });
    countryList.addEventListener("keydown", function (event) {
      var option = event.target.closest(".ask-country-option");
      if (!option) return;
      var visible = Array.from(countryList.querySelectorAll(".ask-country-option:not([hidden])"));
      var index = visible.indexOf(option);
      if (event.key === "ArrowDown" && visible[index + 1]) { event.preventDefault(); visible[index + 1].focus(); }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (visible[index - 1]) visible[index - 1].focus(); else countryInput.focus();
      }
      if (event.key === "Escape") { closeCountryList(); countryInput.focus(); }
    });
    document.addEventListener("pointerdown", function (event) {
      if (!event.target.closest(".ask-country-field")) closeCountryList();
    });
    var consent = root.querySelector("#ask-consent");
    var consentError = root.querySelector("#ask-consent-error");
    consent.addEventListener("invalid", function (event) {
      event.preventDefault();
      consent.classList.add("is-invalid");
      consentError.classList.add("is-visible");
    });
    consent.addEventListener("change", function () {
      consent.classList.toggle("is-invalid", !consent.checked);
      consentError.classList.toggle("is-visible", !consent.checked);
    });
    root.querySelectorAll("#ask-form .ask-field [required]").forEach(function (field) {
      function updateFieldState() {
        if (!field.validity.valid) return;
        field.classList.remove("is-invalid");
      }
      field.addEventListener("invalid", function (event) {
        event.preventDefault();
        field.classList.add("is-invalid");
      });
      field.addEventListener(field.tagName === "SELECT" ? "change" : "input", updateFieldState);
    });
    root.querySelector("#ask-form").onsubmit = submit;
  }

  function projectContext(p) {
    var input = p.input || {}, snap = p.snapshot || {};
    return [
      "Project: " + p.name,
      "Calculation: " + (snap.title || "Preliminary loads"),
      "Inputs: height " + input.height + ", levels " + input.levels + ", A " + input.span + ", X " + input.overhang + ", units " + input.units
    ].join("\n");
  }

  async function submit(e) {
    e.preventDefault();
    var form = e.currentTarget;
    if (!form.reportValidity() || !selected) {
      var firstInvalid = form.querySelector(":invalid");
      if (firstInvalid) firstInvalid.focus({ preventScroll: false });
      return;
    }
    var button = root.querySelector("#ask-send"), msg = root.querySelector("#ask-msg");
    button.disabled = true; button.textContent = "Sending…"; msg.className = "save-msg"; msg.textContent = "";
    var body = [
      "Topic: " + root.querySelector("#ask-topic").value,
      "Response channel: Email",
      "Contact: " + root.querySelector("#ask-first-name").value.trim() + " " + root.querySelector("#ask-last-name").value.trim() + " <" + root.querySelector("#ask-email").value.trim() + ">",
      "Country: " + root.querySelector("#ask-country").value,
      "Phone: " + (root.querySelector("#ask-phone").value.trim() || "—"),
      "Marketing consent: " + (root.querySelector("#ask-marketing").checked ? "Yes" : "No"),
      "",
      root.querySelector("#ask-message").value.trim(),
      "",
      projectContext(selected)
    ].join("\n");
    try {
      var res = await window.WTApi.sendSupportInquiry(selected.id, body);
      msg.className = "save-msg ok";
      var reference = res.inquiry && res.inquiry.id ? res.inquiry.id.slice(-8).toUpperCase() : "created";
      msg.textContent = res.email && res.email.status === "sent"
        ? "Inquiry emailed · reference " + reference
        : "Inquiry saved · email delivery is not configured · reference " + reference;
      root.querySelector("#ask-message").value = "";
      root.querySelector("#ask-count").textContent = "0";
    } catch (err) {
      msg.className = "save-msg bad"; msg.textContent = err.message || "Could not send the inquiry.";
    }
    button.disabled = false; button.textContent = "Send inquiry";
  }

  window.WTAuth ? window.WTAuth.onChange(load) : null;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();
