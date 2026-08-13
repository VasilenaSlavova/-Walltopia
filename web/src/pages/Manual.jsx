import { useState } from "react";
import pages from "../manualPages.json";
import { Link } from "react-router-dom";

const pad = (n) => (n < 10 ? "0" + n : "" + n);

export default function Manual() {
  const [showText, setShowText] = useState(true);
  const jump = (e) => { const el = document.getElementById(e.target.value); if (el) el.scrollIntoView({ behavior: "smooth" }); };

  return (
    <main className="reader">
      <div className="reader-intro">
        <h2>Manual for applying Walltopia preliminary loads on existing structures</h2>
        <p>Worked example, coordinate-system definitions, and the special cases for corner and end columns.
          Preliminary loads — <strong>not for construction</strong>. This manual is an inseparable part of the load tables used by the <Link to="/">Load Calculator</Link>.</p>
      </div>

      <div className="subbar">
        <div className="grp">
          <label htmlFor="jump">Go to page</label>
          <select id="jump" onChange={jump} defaultValue="">
            <option value="" disabled>Page…</option>
            {pages.map((p) => <option key={p.page} value={"p" + p.page}>Page {p.page}</option>)}
          </select>
        </div>
        <button className="tgl" aria-pressed={showText} onClick={() => setShowText((v) => !v)}>{showText ? "Transcripts on" : "Transcripts off"}</button>
        <a className="dl" href="/manuals/manual/page-01.png" download><button className="tgl" type="button">Download images</button></a>
        <span className="count">{pages.length} pages</span>
      </div>

      <div className={showText ? "" : "hide-transcripts"}>
        {pages.map((p) => (
          <figure className="page-figure" id={"p" + p.page} key={p.page}>
            <div className="pnum">Page {p.page} of {pages.length}</div>
            <img src={`/manuals/manual/page-${pad(p.page)}.png`} loading={p.page <= 2 ? "eager" : "lazy"}
              alt={"Manual page " + p.page + (p.text ? ": " + p.text.slice(0, 140) : "")} />
            {p.text && (
              <details>
                <summary>Page text (transcript)</summary>
                <div className="transcript">{p.text}</div>
              </details>
            )}
          </figure>
        ))}
      </div>
    </main>
  );
}
