/* Pure geometry for the interactive ACS diagram, shared by web + mobile.
   Given the standard opening A, overhang X, wall height, and the attachment-level Z heights,
   returns SVG primitives (viewBox 0 0 900 560). Ported from interactive-acs-standard-z.html. */
export function acsGeometry(a, x, height, zValues) {
  const left = 118;
  const width = 350 + (a - 4) * 62;
  const right = left + width;
  const mid = left + width / 2;
  const baseY = 428, scaleZ = 25;
  const wallTopY = baseY - height * scaleZ;
  const columnTopY = wallTopY - 22;
  const levels = zValues.map((z) => baseY - z * scaleZ);

  const roof = `M${left} ${columnTopY + 24}L${right} ${columnTopY}`;
  const ground = `M${left - 30} ${baseY + 12}L${right + 45} ${baseY - 8}`;

  const columns = [left, mid, right].map((cx, i) => {
    const yTop = columnTopY + (i === 0 ? 24 : i === 1 ? 12 : 0);
    return { x: cx - 7, y: yTop, w: 14, h: baseY - yTop };
  });

  const beams = [], points = [], forces = [];
  levels.forEach((y, i) => {
    const yr = y - 12, yl = y + 12;
    beams.push({ x1: left, y1: yl, x2: right, y2: yr });
    [left, mid, right].forEach((cx, j) => {
      const cy = yl + (yr - yl) * ((cx - left) / (right - left));
      points.push({ cx, cy });
      if (j === 1) forces.push({ x1: cx - 8, y1: cy + 2, x2: cx - 52, y2: cy + 20, lx: cx - 80, ly: cy - 3, label: "Lx" + (i + 1) });
    });
  });

  const overhangPx = x * 24;
  const topContour = [
    [left + 10, baseY + 42], [left + width * 0.28, baseY + 55], [left + width * 0.48, baseY + 30],
    [left + width * 0.70, baseY + 47], [right - 10, baseY + 12],
  ];
  const bottomContour = topContour.map((p, i) => [p[0] + overhangPx * (0.35 + i * 0.16), p[1] + 42]);
  const contourPolygon = topContour.concat([...bottomContour].reverse());

  // dimension lines + labels
  const dimLines = [];
  const dimTexts = [];
  const guides = [];
  dimLines.push({ x1: left, y1: baseY + 118, x2: right, y2: baseY + 118 });
  dimTexts.push({ x: mid - 62, y: baseY + 108, t: "A = " + a.toFixed(1) + " m" });
  dimLines.push({ x1: topContour[3][0], y1: topContour[3][1], x2: bottomContour[3][0], y2: bottomContour[3][1] });
  dimTexts.push({ x: bottomContour[3][0] + 10, y: bottomContour[3][1] - 10, t: "X = " + x.toFixed(1) + " m" });
  levels.forEach((y, i) => {
    dimLines.push({ x1: right + 42, y1: y, x2: right + 42, y2: baseY });
    dimTexts.push({ x: right + 53, y: (y + baseY) / 2, t: "Z" + (i + 1) + " = " + zValues[i].toFixed(1) + " m" });
    guides.push({ x1: right, y1: y, x2: right + 52, y2: y });
  });
  dimLines.push({ x1: right + 122, y1: wallTopY, x2: right + 122, y2: baseY });
  guides.push({ x1: right, y1: wallTopY, x2: right + 132, y2: wallTopY });
  dimTexts.push({ x: right + 134, y: (wallTopY + baseY) / 2, t: "H = " + height.toFixed(0) + " m" });

  const asStr = (pts) => pts.map((p) => p.join(",")).join(" ");
  return {
    viewBox: "0 0 900 560",
    roof, ground, columns, beams, points, forces,
    contourPolygon: asStr(contourPolygon),
    topContour: asStr(topContour),
    topContourLabel: { x: right - 35, y: baseY + 2, t: "top contour" },
    bottomContourLabel: { x: right + overhangPx * 0.9 - 25, y: baseY + 86, t: "bottom contour" },
    dimLines, dimTexts, guides,
  };
}
