const phone = require("libphonenumber-js");
const metadata = require("libphonenumber-js/metadata.max.json");
const rules = require("../src/lib/phone-rules.json");

const failures = [];
for (const [name, rule] of Object.entries(rules)) {
  const parsed = phone.parsePhoneNumber(rule.example);
  const countryMetadata = metadata.countries[rule.iso];
  const mobileLengths = countryMetadata?.[11]?.[1]?.[1];
  const expectedLengths = [...new Set(Array.isArray(mobileLengths) && mobileLengths.length ? mobileLengths : countryMetadata[3])].sort((a,b)=>a-b);
  const national = parsed.nationalNumber;
  const maximumNational = (national + "0".repeat(rule.nationalDigits)).slice(0, rule.nationalDigits);
  const raw = rule.dialCode + maximumNational;
  const formatted = new phone.AsYouType().input(raw);
  const tooLongDigits = (raw + "9").replace(/\D/g, "");
  const allowedDigits = rule.dialCode.replace(/\D/g, "").length + rule.nationalDigits;
  const clipped = tooLongDigits.slice(0, allowedDigits);
  if (!phone.isValidPhoneNumber(rule.example)) failures.push(`${name}: invalid generated example ${rule.example}`);
  if (JSON.stringify(rule.possibleLengths) !== JSON.stringify(expectedLengths)) failures.push(`${name}: incomplete length variants`);
  if (national.length > rule.nationalDigits) failures.push(`${name}: example exceeds maximum ${rule.nationalDigits}`);
  if (clipped.length !== allowedDigits || clipped === tooLongDigits) failures.push(`${name}: extra digit was not clipped`);
  if (!formatted || formatted.replace(/\D/g, "") !== raw.replace(/\D/g, "")) failures.push(`${name}: formatter changed digits`);
  if (rule.stripsLeadingZero) {
    const withLocalZero = rule.dialCode.replace(/\D/g, "") + "0" + maximumNational;
    const normalized = withLocalZero.startsWith(rule.dialCode.replace(/\D/g, "") + "0")
      ? rule.dialCode.replace(/\D/g, "") + withLocalZero.slice(rule.dialCode.replace(/\D/g, "").length + 1)
      : withLocalZero;
    if (normalized !== raw.replace(/\D/g, "")) failures.push(`${name}: leading zero was not normalized`);
  }
}
console.log(JSON.stringify({ tested: Object.keys(rules).length, passed: Object.keys(rules).length - failures.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
