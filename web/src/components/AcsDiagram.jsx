import { useEffect, useState } from "react";
import { acsGeometry } from "../lib/acsGeometry";

// Interactive ACS geometry — redraws from the live calculator selection (A, X, height, Z levels),
// with a one-time draw-on intro and continuously flowing load arrows.
export default function AcsDiagram({ a, x, height, zValues }) {
  const [intro, setIntro] = useState(true);
  useEffect(() => { const t = setTimeout(() => setIntro(false), 2600); return () => clearTimeout(t); }, []);
  const g = acsGeometry(a, x, height, zValues);
  return (
    <div className={"acs-wrap" + (intro ? " is-intro" : "")}>
      <svg viewBox={g.viewBox} className="acs-diagram" role="img" aria-label="Interactive ACS geometry: building columns, attachment levels, overhang and loads">
        <defs>
          <marker id="acs-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 10 5 0 10Z" fill="var(--accent)" />
          </marker>
        </defs>
        <g className="acs-frame">
          <path d={g.roof} /><path d={g.ground} />
          {g.columns.map((c, i) => <rect key={i} className="acs-column" x={c.x} y={c.y} width={c.w} height={c.h} />)}
        </g>
        <polygon className="acs-contour" points={g.contourPolygon} />
        <polyline className="acs-top-contour" points={g.topContour} />
        {g.beams.map((b, i) => <line key={i} className="acs-beam" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} />)}
        {g.points.map((p, i) => <circle key={i} className="acs-point" cx={p.cx} cy={p.cy} r="6" />)}
        {g.forces.map((f, i) => (
          <g key={i}>
            <line className="acs-force" x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} markerEnd="url(#acs-arrow)" />
            <text className="acs-force-label" x={f.lx} y={f.ly}>{f.label}</text>
          </g>
        ))}
        <g className="acs-dims">
          {g.guides.map((l, i) => <line key={i} className="acs-guide" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />)}
          {g.dimLines.map((l, i) => <line key={i} className="acs-dim" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />)}
          {g.dimTexts.map((t, i) => <text key={i} className="acs-muted" x={t.x} y={t.y}>{t.t}</text>)}
          <text className="acs-muted" x={g.topContourLabel.x} y={g.topContourLabel.y}>{g.topContourLabel.t}</text>
          <text className="acs-muted" x={g.bottomContourLabel.x} y={g.bottomContourLabel.y}>{g.bottomContourLabel.t}</text>
        </g>
      </svg>
    </div>
  );
}
