// Small input-validation helpers for trust boundaries. No external deps.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isStr = (v) => typeof v === "string";
const trim = (v) => (isStr(v) ? v.trim() : "");

function validEmail(v) {
  const e = trim(v).toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}

// tags: array of short non-empty strings, deduped, capped
function cleanTags(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const t of v) {
    const s = trim(t).slice(0, 40);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= 6) break;
  }
  return out;
}

// custom properties: array of {key, value} — flexible, MongoDB-friendly
function cleanProps(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const p of v) {
    if (!p || !isStr(p.key)) continue;
    const key = p.key.trim().slice(0, 60);
    if (!key) continue;
    const value = isStr(p.value) ? p.value.slice(0, 500) : String(p.value ?? "").slice(0, 500);
    out.push({ key, value });
    if (out.length >= 50) break;
  }
  return out;
}

// input snapshot from the calculator — stored as a flexible object, lightly bounded
function cleanInput(v) {
  if (!v || typeof v !== "object") return {};
  const allow = ["units", "type", "height", "levels", "span", "overhang", "force", "factored", "capacity"];
  const out = {};
  for (const k of allow) if (v[k] !== undefined && v[k] !== null) out[k] = v[k];
  return out;
}

module.exports = { isStr, trim, validEmail, cleanTags, cleanProps, cleanInput };
