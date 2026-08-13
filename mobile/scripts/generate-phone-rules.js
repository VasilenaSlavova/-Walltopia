const fs = require("fs");
const path = require("path");
const phone = require("libphonenumber-js");
const examples = require("libphonenumber-js/examples.mobile.json");
const metadata = require("libphonenumber-js/metadata.max.json");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/countries.js"), "utf8");
const countries = source.match(/COUNTRIES = `([^`]+)`/)[1].split("|");
const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
const aliases = {
  "Aland Islands":"AX", "Antigua and Barbuda":"AG", Bolivia:"BO", "Bonaire, Sint Eustatius and Saba":"BQ",
  "Bosnia and Herzegovina":"BA", "Bouvet Island":"BV", "Cape Verde":"CV", Congo:"CG", Curacao:"CW",
  "Czech Republic":"CZ", "Côte d'Ivoire":"CI", "East Timor":"TL", "Falkland Islands (Malvinas)":"FK",
  "French Southern Territories":"TF", "Heard Island and McDonald Islands":"HM", "Holy See":"VA", "Hong Kong":"HK",
  Iran:"IR", Laos:"LA", Macao:"MO", Macedonia:"MK", Micronesia:"FM", Moldova:"MD", Myanmar:"MM",
  "North Korea":"KP", Palestine:"PS", Pitcairn:"PN", Reunion:"RE", Russia:"RU", "Saint Barthelemy":"BL",
  "Saint Helena, Ascension and Tristan da Cunha":"SH", "Saint Kitts and Nevis":"KN", "Saint Lucia":"LC",
  "Saint Martin (French part)":"MF", "Saint Pierre and Miquelon":"PM", "Saint Vincent and the Grenadines":"VC",
  "Sao Tome and Principe":"ST", "Sint Maarten (Dutch part)":"SX", "South Georgia and the South Sandwich Islands":"GS",
  "South Korea":"KR", "Svalbard and Jan Mayen":"SJ", Swaziland:"SZ", Syria:"SY", Taiwan:"TW", Tanzania:"TZ",
  "Trinidad and Tobago":"TT", Turkey:"TR", "Turks and Caicos Islands":"TC", "United States Minor Outlying Islands":"UM",
  "Vatican City":"VA", Venezuela:"VE", Vietnam:"VN", "Virgin Islands, British":"VG", "Virgin Islands, U.S.":"VI",
  "Wallis and Futuna":"WF", "Western Sahara":"EH"
};
const isoByName = new Map(phone.getCountries().map((iso) => [displayNames.of(iso), iso]));
const rules = {};
const unsupported = [];

for (const name of countries) {
  const iso = aliases[name] || isoByName.get(name);
  const example = iso && examples[iso];
  if (!iso || !example) { unsupported.push(name); continue; }
  const parsed = phone.parsePhoneNumber(example, iso);
  let stripsLeadingZero = false;
  try {
    stripsLeadingZero = phone.parsePhoneNumber("0" + example, iso).number === parsed.number;
  } catch (_) {}
  const countryMetadata = metadata.countries[iso];
  const mobileLengths = countryMetadata?.[11]?.[1]?.[1];
  const possibleLengths = Array.isArray(mobileLengths) && mobileLengths.length ? mobileLengths : countryMetadata[3];
  rules[name] = {
    iso,
    dialCode: `+${parsed.countryCallingCode}`,
    possibleLengths: [...new Set(possibleLengths)].sort((a, b) => a - b),
    nationalDigits: Math.max(...possibleLengths),
    example: parsed.formatInternational(),
    stripsLeadingZero
  };
}

const mobileTarget = path.join(__dirname, "../src/lib/phone-rules.json");
const webTarget = path.join(__dirname, "../../website/vendor/phone-rules.js");
fs.writeFileSync(mobileTarget, JSON.stringify(rules, null, 2) + "\n");
fs.writeFileSync(webTarget, "window.WT_PHONE_RULES=" + JSON.stringify(rules) + ";\n");
console.log(JSON.stringify({ total: countries.length, generated: Object.keys(rules).length, unsupported }, null, 2));
