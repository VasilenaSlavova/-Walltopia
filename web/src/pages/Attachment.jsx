import { useEffect, useRef, useState } from "react";

export default function Attachment() {
  const scrollRef = useRef(null);
  const imgRef = useRef(null);
  const natW = useRef(0);
  const fitScale = useRef(1);
  const drag = useRef({ down: false });
  const [pct, setPct] = useState(100);

  const applyWidth = (scale) => { if (imgRef.current && natW.current) imgRef.current.style.width = natW.current * scale + "px"; };

  const fit = () => {
    const sc = scrollRef.current; if (!sc || !natW.current) return;
    const f = (sc.clientWidth - 2) / natW.current;
    fitScale.current = f; applyWidth(f); setPct(Math.round(f * 100));
  };
  const setScale = (s, cx, cy) => {
    const sc = scrollRef.current; if (!sc) return;
    s = Math.max(fitScale.current * 0.5, Math.min(6, s));
    const rect = sc.getBoundingClientRect();
    const ax = cx == null ? sc.clientWidth / 2 : cx - rect.left;
    const ay = cy == null ? sc.clientHeight / 2 : cy - rect.top;
    const px = ax + sc.scrollLeft, py = ay + sc.scrollTop;
    const prev = pct / 100, ratio = s / prev;
    applyWidth(s); setPct(Math.round(s * 100));
    sc.scrollLeft = px * ratio - ax; sc.scrollTop = py * ratio - ay;
  };

  useEffect(() => {
    const onResize = () => { if (Math.abs(pct / 100 - fitScale.current) < 1e-6) fit(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }); // eslint-disable-line

  const onImgLoad = () => { natW.current = imgRef.current.naturalWidth; fit(); };
  const onWheel = (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setScale((pct / 100) * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY); };
  const onPointerDown = (e) => {
    drag.current = { down: true, sx: e.clientX, sy: e.clientY, sl: scrollRef.current.scrollLeft, st: scrollRef.current.scrollTop };
    scrollRef.current.classList.add("grabbing"); scrollRef.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current.down) return;
    scrollRef.current.scrollLeft = drag.current.sl - (e.clientX - drag.current.sx);
    scrollRef.current.scrollTop = drag.current.st - (e.clientY - drag.current.sy);
  };
  const endDrag = () => { drag.current.down = false; scrollRef.current && scrollRef.current.classList.remove("grabbing"); };

  return (
    <main className="reader">
      <div className="reader-intro">
        <h2>Standard attachment details</h2>
        <p>Typical fixing details for anchoring the climbing structure to <strong>concrete floor</strong>, <strong>concrete wall</strong>,
          <strong> steel column</strong> and <strong>masonry wall</strong> substrates (threaded rods, Hilti HIT-HY chemical anchors, box bolts,
          grade 8.8 bolts). Preliminary — confirm every fixing against the acting standard and the existing structure. Scroll to pan; use the zoom controls or ctrl/⌘-scroll to inspect.</p>
      </div>

      <div className="cadwrap">
        <div className="cadtools">
          <div className="grp">
            <button onClick={() => setScale(pct / 100 / 1.25)} aria-label="Zoom out">−</button>
            <button onClick={fit}>Fit width</button>
            <button onClick={() => setScale((pct / 100) * 1.25)} aria-label="Zoom in">+</button>
            <button onClick={() => setScale(1)}>100%</button>
          </div>
          <a href="/manuals/attachment/sheet.png" download style={{ textDecoration: "none" }}><button type="button">Download sheet</button></a>
          <span className="info">{pct}%</span>
        </div>
        <div className="cadscroll" ref={scrollRef} onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <img ref={imgRef} src="/manuals/attachment/sheet.png" onLoad={onImgLoad}
            alt="Standard attachment details drawing sheet: fixing details for concrete floor, concrete wall, steel column and masonry wall substrates." />
        </div>
      </div>
    </main>
  );
}
