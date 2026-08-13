import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLoads } from "../lib/useLoads";
import { useAuth } from "../auth";
import { api } from "../api";
import * as L from "../lib/loads";
import { Seg, Chips } from "../components/Controls";
import ProjectBar from "../components/ProjectBar";
import AcsDiagram from "../components/AcsDiagram";

function zLevels(data, s) {
  if (s.type === "wall") {
    const w = data.walls[L.wallKey(s.height, s.levels)];
    if (w && w.lhEU) return Object.keys(w.lhEU).sort((a, b) => Number(a) - Number(b)).map((k) => w.lhEU[k]);
  }
  return [s.height]; // boulder: single attachment near the top
}

const lenChip = (units) => (v) => (units === "EU" ? v : Math.round(v * 3.28084));

function Cell({ v, kind, s, um, cls }) {
  if (v === undefined || v === null) return <td className="num" style={{ color: "var(--ink-faint)" }}>–</td>;
  return <td className={"num " + cls}>{L.fmtForce(L.factored(v, kind, s, um), s.units)}</td>;
}

export default function Calculator() {
  const { data } = useLoads();
  const { requireAuth, ready } = useAuth();
  const [s, setS] = useState(L.initialState());
  const [project, setProject] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project");

  useEffect(() => { if (data) setS((prev) => L.clampState(data, prev)); }, [data]);

  // lock background scroll while the options drawer is open (phone widths)
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  useEffect(() => {
    if (!projectId || !data || !ready) return; // wait for the session check before deciding to prompt login
    let cancelled = false;
    (async () => {
      try {
        await requireAuth("login");
        const { project: p } = await api.getProject(projectId);
        if (cancelled) return;
        setProject(p);
        setS(L.clampState(data, { ...L.initialState(), ...p.input, cap: p.input?.capacity ?? null }));
      } catch (e) { /* cancelled or not found */ }
    })();
    return () => { cancelled = true; };
  }, [data, projectId, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <main className="layout"><section className="card results"><div className="empty">Loading load tables…</div></section></main>;

  const um = L.unitMeta(data, s.units);
  const opt = L.optionsFor(data, s);
  const update = (patch) => setS((prev) => L.clampState(data, { ...prev, ...patch }));
  const setUnits = (v) => setS((prev) => L.clampState(data, { ...prev, units: v, cap: v !== prev.units ? null : prev.cap }));

  const have = L.hasResult(data, s);
  const gov = L.govColumnLoad(data, s);
  const vd = L.verdict(data, s);
  const rows = L.pointRows(data, s);
  const forceLevels = L.forceLevels(data, s);
  const unitLbl = s.units === "EU" ? "m" : "ft";

  const exitEditing = () => { setProject(null); setParams({}, { replace: true }); };
  const onSaved = (p) => { setProject(p); setParams({ project: p.id }, { replace: true }); };
  const closeDrawer = () => setDrawerOpen(false);
  const summary = `${L.fmtLen(s.height, s.units)} · ${s.type === "wall" ? s.levels + "-lvl" : "boulder"} · A ${L.fmtLen(s.span, s.units)} · X ${L.fmtLen(s.overhang, s.units)}`;

  return (
    <main className={"layout" + (drawerOpen ? " drawer-open" : "")}>
      {/* Options opener — only visible on phone-width screens */}
      <button type="button" className="options-opener" onClick={() => setDrawerOpen(true)}>
        <span className="oo-icon">☰</span>
        <span className="oo-label">Options</span>
        <span className="oo-summary">{summary}</span>
      </button>
      <div className="drawer-backdrop" onClick={closeDrawer} />

      {/* INPUTS (sidebar on desktop, left flyout on phones) */}
      <section className="card panel" aria-label="Inputs">
        <button type="button" className="drawer-close" aria-label="Close options" onClick={closeDrawer}>&times;</button>
        <h2>Your inputs</h2>

        <div className="field">
          <label>Units</label>
          <Seg value={s.units} onChange={setUnits}
            options={[{ label: "Metric (kN · m)", value: "EU" }, { label: "Imperial (lb · ft)", value: "USA" }]} />
        </div>

        <div className="field">
          <label>Structure type</label>
          <Seg value={s.type} onChange={(v) => update({ type: v })}
            options={[{ label: "Climbing wall", value: "wall" }, { label: "Boulder wall", value: "boulder" }]} />
          <div className="hint">{s.type === "wall" ? "With protection points · " + um.codeWall : "Without protection points · " + um.codeBoulder}</div>
        </div>

        <div className="field">
          <label>Climbing-surface height <span className="hint">({unitLbl})</span></label>
          <Chips values={opt.heights} value={s.height} onChange={(v) => update({ height: v })} label={lenChip(s.units)} />
        </div>

        {s.type === "wall" && (
          <div className="field">
            <label>Attachment scheme <span className="hint">(levels of attachment by height)</span></label>
            <Chips small values={opt.schemes} value={s.levels} onChange={(v) => update({ levels: v })}
              label={(v) => v + (v === 1 ? " level" : " levels")} />
          </div>
        )}

        <div className="field">
          <label>Column span · A <span className="hint">({unitLbl}, between building columns)</span></label>
          <Chips values={opt.spans} value={s.span} onChange={(v) => update({ span: v })} label={lenChip(s.units)} />
        </div>

        <div className="field">
          <label>Overhang · X <span className="hint">({unitLbl}, top − bottom contour)</span></label>
          <Chips values={opt.overhangs} value={s.overhang} onChange={(v) => update({ overhang: v })} label={lenChip(s.units)} />
        </div>

        <div className="divider" />

        <div className="field" style={{ marginBottom: 10 }}>
          <label>Check against your structure <span className="hint">(optional)</span></label>
          <div className="caprow">
            <input type="number" inputMode="decimal" placeholder="allowable column load" min="0" step="any"
              value={s.cap ?? ""} onChange={(e) => update({ cap: e.target.value === "" ? null : Number(e.target.value) })} />
            <div className="unit">{um.force}</div>
          </div>
          <div className="hint" style={{ marginTop: 7 }}>Horizontal load one existing column / frame can carry.</div>
        </div>

        <label className="toggle-line">
          <input type="checkbox" checked={s.factored} onChange={(e) => update({ factored: e.target.checked })} />
          Show factored design values&nbsp;<span className="hint">(×{um.dl} DL, ×{um.ll} LL)</span>
        </label>

        <button type="button" className="btn primary drawer-done" onClick={closeDrawer}>Done</button>
      </section>

      {/* RESULTS */}
      <section className="card results" aria-live="polite">
        <ProjectBar data={data} state={s} project={project} onSaved={onSaved} onExit={exitEditing} />

        {!have ? (
          <div className="empty">No table entry for this combination.</div>
        ) : (
          <>
            <div className="results-head">
              <div>
                <p className="title">{L.titleFor(s)}</p>
                <p className="sub">
                  {(s.type === "wall" ? s.levels + (s.levels === 1 ? " attachment level" : " attachment levels") : "single attachment")}
                  {" · span A = " + L.fmtLen(s.span, s.units) + " · overhang X = " + L.fmtLen(s.overhang, s.units)}
                  {" · characteristic values in " + um.force + (s.factored ? " · factored" : "")}
                </p>
              </div>
              <div className="spacer" />
              {vd === "neutral" ? (
                <div className="verdict neutral"><span className="ico">▤</span>
                  <div>Governing column load<br /><span className="big">{L.fmtForce(gov, s.units)} {um.force}</span>{" "}
                    <span style={{ color: "var(--ink-faint)" }}>(factored)</span></div>
                </div>
              ) : (
                <div className={"verdict " + vd}><span className="ico">{vd === "ok" ? "✓" : "✕"}</span>
                  <div>{vd === "ok" ? "Applicable" : "Exceeds capacity"}<br />
                    <span className="big">{L.fmtForce(gov, s.units)} {um.force}</span>{" "}
                    required vs {L.fmtForce(s.cap, s.units)} {um.force} capacity</div>
                </div>
              )}
            </div>

            {s.type === "wall" && forceLevels.length > 0 && (
              <div className="forcebar">
                <div className="lab">Force level — attachment level taken at its maximum live load</div>
                <Chips small values={forceLevels.map((f) => f.lvl)} value={s.force} onChange={(v) => update({ force: v })}
                  label={(lvl) => { const f = forceLevels.find((x) => x.lvl === lvl); return "Level " + lvl + (f && f.height ? " · " + L.fmtLen(f.height, s.units) : ""); }} />
              </div>
            )}

            <div className="scroller">
              <table className="loads">
                <thead><tr>
                  <th className="pt">Attachment point</th>
                  <th><div className="colhdr grp-dl">R · DL<small>on 1 ACS axis</small></div></th>
                  <th><div className="colhdr grp-ll">R · LL<small>on 1 ACS axis</small></div></th>
                  <th><div className="colhdr grp-dl">L · DL<small>on building column</small></div></th>
                  <th><div className="colhdr grp-ll">L · LL<small>on building column</small></div></th>
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="pt">{r.label}</td>
                      <Cell v={r.rDL} kind="DL" s={s} um={um} cls="grp-dl" />
                      <Cell v={r.rLL} kind="LL" s={s} um={um} cls="grp-ll" />
                      <Cell v={r.lDL} kind="DL" s={s} um={um} cls="grp-dl" />
                      <Cell v={r.lLL} kind="LL" s={s} um={um} cls="grp-ll" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AcsDiagram a={s.span} x={s.overhang} height={s.height} zValues={zLevels(data, s)} />
            <Legend units={s.units} />
            <Notes data={data} s={s} um={um} />
          </>
        )}
      </section>
    </main>
  );
}

function Legend() {
  return (
    <div className="legend" style={{ gridTemplateColumns: "1fr" }}>
      <div>
        <h3>Coordinate system &amp; symbols</h3>
        <dl>
          <dt>R</dt><dd>Load on one axis of the ACS — base points and single-axis attachment points.</dd>
          <dt>L</dt><dd>Load on a building column / frame, with the column span A taken into account. Focus on these for the existing structure.</dd>
          <dt>Z0</dt><dd>Vertical component at the base.</dd>
          <dt>X0 / X1 / X2 / X3</dt><dd>Horizontal component at the base (X0) and at attachment level 1, 2, 3.</dd>
          <dt>DL / LL</dt><dd>Dead load / Live load (climber load per EN 12572).</dd>
        </dl>
      </div>
    </div>
  );
}

function Notes({ data, s, um }) {
  const code = s.type === "wall" ? um.codeWall : um.codeBoulder;
  return (
    <div className="notes">
      <h3>Notes</h3>
      <div className="preliminary-banner"><strong>Preliminary loads — NOT for construction.</strong></div>
      <ol>
        <li>Coefficient for dead load = <b>{um.dl}</b>.</li>
        <li>Coefficient for live load = <b>{um.ll}</b>.</li>
        <li>All loads are characteristic values and are expressed in <b>{um.force}</b>. Refer to the positive directions of the coordinate system when interpreting their signs.</li>
        <li>The application manual is an inseparable part of the load tables. For additional information, consult Walltopia.</li>
        <li className="code">Used code: {code}.</li>
      </ol>
    </div>
  );
}
