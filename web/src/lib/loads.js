/* Framework-agnostic Walltopia load-table logic (shared by web + mobile).
   Pure functions over the load tables { meta, walls, boulder } from GET /api/loads.
   A calculator "state" is: { units, type, height, levels, span, overhang, force, factored, cap }. */

export function initialState() {
  return { units: "EU", type: "wall", height: 12, levels: 3, span: 6, overhang: 1, force: 1, factored: false, cap: null };
}

const uniq = (a) => a.filter((v, i) => a.indexOf(v) === i);
const num = (a, b) => a - b;
export const wallKey = (h, lv) => "W_" + h + "_" + lv;

// per-height available attachment schemes, sorted heights, boulder heights
export function derive(data) {
  const wallSchemes = {};
  Object.keys(data.walls).forEach((k) => {
    const w = data.walls[k];
    (wallSchemes[w.height] = wallSchemes[w.height] || []).push(w.levels);
  });
  Object.keys(wallSchemes).forEach((h) => wallSchemes[h].sort(num));
  const wallHeights = Object.keys(wallSchemes).map(Number).sort(num);
  const boulderHeights = uniq(data.boulder.rows.map((r) => r.z)).sort(num);
  return { wallSchemes, wallHeights, boulderHeights };
}

export function optionsFor(data, s) {
  const d = derive(data);
  if (s.type === "boulder") {
    return {
      heights: d.boulderHeights,
      spans: uniq(data.boulder.rows.map((r) => r.a)).sort(num),
      overhangs: uniq(data.boulder.rows.map((r) => r.x)).sort(num),
      schemes: [],
    };
  }
  const w = data.walls[wallKey(s.height, s.levels)];
  return {
    heights: d.wallHeights,
    schemes: d.wallSchemes[s.height] || [],
    spans: w ? uniq(w.rows.map((r) => r.a)).sort(num) : [],
    overhangs: w ? uniq(w.rows.map((r) => r.x)).sort(num) : [],
  };
}

// returns a NEW, valid state (immutable) — snaps invalid selections to sensible defaults
export function clampState(data, prev) {
  const d = derive(data);
  const s = { ...prev };
  if (s.type === "wall") {
    if (d.wallHeights.indexOf(s.height) < 0) s.height = d.wallHeights.indexOf(12) >= 0 ? 12 : d.wallHeights[0];
    const sch = d.wallSchemes[s.height] || [];
    if (sch.indexOf(s.levels) < 0) s.levels = sch[sch.length - 1];
  } else {
    if (d.boulderHeights.indexOf(s.height) < 0) s.height = d.boulderHeights[0];
  }
  const opt = optionsFor(data, s);
  if (opt.spans.indexOf(s.span) < 0) s.span = opt.spans.indexOf(6) >= 0 ? 6 : opt.spans[0];
  if (opt.overhangs.indexOf(s.overhang) < 0) s.overhang = opt.overhangs.indexOf(1) >= 0 ? 1 : opt.overhangs[0];
  if (s.type === "wall") {
    const rows = wallRows(data, s);
    if (!rows.some((r) => r.lvl === s.force)) s.force = rows.length ? rows[0].lvl : 1;
  }
  return s;
}

export const unitMeta = (data, units) => data.meta.units[units];

export function fmtForce(v, units) {
  if (v === null || v === undefined || isNaN(v)) return "–";
  return Number(v).toFixed(units === "EU" ? 2 : 1);
}
export function fmtLen(v, units) {
  return units === "EU" ? v + " m" : Math.round(v * 3.28084 * 10) / 10 + " ft";
}

export function wallRows(data, s) {
  const w = data.walls[wallKey(s.height, s.levels)];
  if (!w) return [];
  return w.rows.filter((r) => r.a === s.span && r.x === s.overhang).sort((a, b) => a.lvl - b.lvl);
}
export function boulderRow(data, s) {
  return data.boulder.rows.find((r) => r.z === s.height && r.a === s.span && r.x === s.overhang);
}
export function hasResult(data, s) {
  return s.type === "boulder" ? !!boulderRow(data, s) : wallRows(data, s).length > 0;
}

export function pick(row, key, units) {
  const src = units === "EU" ? row.eu : row.us;
  return src ? src[key] : undefined;
}
export function factored(v, kind, s, um) {
  if (v === null || v === undefined) return v;
  if (!s.factored) return v;
  return v * (kind === "DL" ? um.dl : um.ll);
}

// worst-case factored horizontal load on a building column across all force levels
export function govColumnLoad(data, s) {
  const um = unitMeta(data, s.units);
  let worst = 0;
  const consider = (dl, ll) => {
    if (dl === undefined && ll === undefined) return;
    const val = Math.abs((dl || 0) * um.dl + (ll || 0) * um.ll);
    if (val > worst) worst = val;
  };
  if (s.type === "boulder") {
    const b = boulderRow(data, s);
    if (b) consider(pick(b, "LX1DL", s.units), pick(b, "LX1LL", s.units));
    return worst;
  }
  const w = data.walls[wallKey(s.height, s.levels)];
  wallRows(data, s).forEach((r) => {
    for (let lv = 1; lv <= w.levels; lv++) consider(pick(r, "LX" + lv + "DL", s.units), pick(r, "LX" + lv + "LL", s.units));
  });
  return worst;
}

// verdict for the capacity check: 'ok' | 'bad' | 'neutral'
export function verdict(data, s) {
  if (s.cap === null || isNaN(s.cap)) return "neutral";
  return govColumnLoad(data, s) <= s.cap ? "ok" : "bad";
}

export function forceLevels(data, s) {
  if (s.type !== "wall") return [];
  const w = data.walls[wallKey(s.height, s.levels)];
  return wallRows(data, s).map((r) => ({ lvl: r.lvl, height: w.lhEU && w.lhEU[r.lvl] }));
}

// structured point-load rows for the current selection/force level
export function pointRows(data, s) {
  const mk = (label, rKey, lKey, row) => ({
    label,
    rDL: rKey ? pick(row, rKey + "DL", s.units) : undefined,
    rLL: rKey ? pick(row, rKey + "LL", s.units) : undefined,
    lDL: lKey ? pick(row, lKey + "DL", s.units) : undefined,
    lLL: lKey ? pick(row, lKey + "LL", s.units) : undefined,
  });
  if (s.type === "boulder") {
    const b = boulderRow(data, s);
    if (!b) return [];
    return [mk("Base — vertical (Z)", "RZ0", null, b), mk("Attachment — horizontal (X)", "RX1", "LX1", b)];
  }
  const rows = wallRows(data, s);
  const w = data.walls[wallKey(s.height, s.levels)];
  const row = rows.find((r) => r.lvl === s.force) || rows[0];
  if (!row) return [];
  const out = [mk("Base — vertical (Z)", "RZ0", null, row), mk("Base — horizontal (X)", "RX0", null, row)];
  for (let lv = 1; lv <= w.levels; lv++) {
    const h = w.lhEU && w.lhEU[lv];
    out.push(mk("Level " + lv + (h ? " · " + fmtLen(h, s.units) : ""), "RX" + lv, "LX" + lv, row));
  }
  return out;
}

export function titleFor(s) {
  return (s.type === "wall" ? "Climbing wall " : "Boulder wall ") + fmtLen(s.height, s.units);
}

export function snapshot(data, s) {
  const um = unitMeta(data, s.units);
  return { title: titleFor(s), unit: um.force, governing: Math.round(govColumnLoad(data, s) * 100) / 100, verdict: verdict(data, s) };
}
