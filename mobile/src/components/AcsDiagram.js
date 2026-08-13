import { useEffect, useRef, useState } from "react";
import { Animated, View, Dimensions, Text, Pressable } from "react-native";
import Svg, { G, Path, Rect, Line, Circle, Polygon, Polyline, Text as SvgText } from "react-native-svg";
import { C, FD, FB } from "../theme";
import { acsGeometry } from "../lib/acsGeometry";
import * as L from "../lib/loads";

const AnimatedLine = Animated.createAnimatedComponent(Line);

// small filled triangle at the arrow tip, oriented along the force direction
function arrowHead(x1, y1, x2, y2, size = 10) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const bx = x2 - ux * size, by = y2 - uy * size, h = size * 0.55;
  return `${x2},${y2} ${bx + px * h},${by + py * h} ${bx - px * h},${by - py * h}`;
}

export default function AcsDiagram({ a, x, height, zValues, rows = [], state, unitMeta }) {
  const g = acsGeometry(a, x, height, zValues);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const flow = useRef(new Animated.Value(0)).current;
  const intro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.timing(flow, { toValue: 1, duration: 1200, easing: (t) => t, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line

  const dashOffset = flow.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const win = Dimensions.get("window").width;
  const w = win - 64; // card + wrapper padding
  const h = (w * 560) / 900;
  const detailRow = selectedLevel == null ? null : rows[(state?.type === "boulder" ? 1 : 2) + selectedLevel];
  const value = (v, kind) => v == null ? "–" : `${L.fmtForce(L.factored(v, kind, state, unitMeta), state.units)} ${unitMeta.force}`;

  return (
    <Animated.View style={{ opacity: intro, transform: [{ scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }], backgroundColor: C.surface2, borderColor: C.line, borderWidth: 1, borderTopColor: C.red, borderTopWidth: 3, padding: 8, marginTop: 16 }}>
      <View style={{ width: w, height: h, alignSelf: "center" }}>
        <Svg width={w} height={h} viewBox="0 0 900 560">
          {/* frame */}
          <G>
            <Path d={g.roof} fill="none" stroke={C.ink} strokeWidth={2.4} strokeLinecap="round" />
            <Path d={g.ground} fill="none" stroke={C.ink} strokeWidth={2.4} strokeLinecap="round" />
            {g.columns.map((c, i) => (
              <Rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} fill="rgba(44,46,61,0.06)" stroke={C.ink} strokeWidth={2} />
            ))}
          </G>
          {/* overhang contour */}
          <Polygon points={g.contourPolygon} fill="rgba(236,28,36,0.08)" stroke={C.inkFaint} strokeWidth={2} />
          <Polyline points={g.topContour} fill="none" stroke={C.inkFaint} strokeWidth={1.5} strokeDasharray="6 6" />
          {/* beams + attachment points */}
          {g.beams.map((b, i) => <Line key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke={C.navy} strokeWidth={4} strokeLinecap="round" />)}
          {g.points.map((p, i) => {
            const level = Math.floor(i / 3);
            const active = selectedLevel === level;
            return <G key={i} onPress={() => setSelectedLevel(level)} accessibilityRole="button" accessibilityLabel={`Show loads for attachment level ${level + 1}`}>
              <Circle cx={p.cx} cy={p.cy} r={18} fill="transparent" />
              <Circle cx={p.cx} cy={p.cy} r={active ? 9 : 6} fill={active ? C.red : "#fff"} stroke={C.red} strokeWidth={3} />
            </G>;
          })}
          {/* flowing load arrows */}
          {g.forces.map((f, i) => (
            <G key={i}>
              <AnimatedLine x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={C.red} strokeWidth={3} strokeDasharray="8 7" strokeDashoffset={dashOffset} />
              <Polygon points={arrowHead(f.x1, f.y1, f.x2, f.y2)} fill={C.red} />
              <SvgText x={f.lx} y={f.ly} fill={C.ink} fontFamily={FB[700]} fontSize={15}>{f.label}</SvgText>
            </G>
          ))}
          {/* dimensions */}
          {g.guides.map((l, i) => <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={C.lineStrong} strokeWidth={1} strokeDasharray="5 6" />)}
          {g.dimLines.map((l, i) => <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={C.inkFaint} strokeWidth={1.4} />)}
          {g.dimTexts.map((t, i) => <SvgText key={i} x={t.x} y={t.y} fill={C.inkFaint} fontFamily={FB[400]} fontSize={14}>{t.t}</SvgText>)}
          <SvgText x={g.topContourLabel.x} y={g.topContourLabel.y} fill={C.inkFaint} fontFamily={FB[400]} fontSize={13}>{g.topContourLabel.t}</SvgText>
          <SvgText x={g.bottomContourLabel.x} y={g.bottomContourLabel.y} fill={C.inkFaint} fontFamily={FB[400]} fontSize={13}>{g.bottomContourLabel.t}</SvgText>
        </Svg>
      </View>
      {detailRow ? (
        <View style={{ marginTop: 8, backgroundColor: "#fff", borderColor: C.lineStrong, borderWidth: 1, borderTopColor: C.red, borderTopWidth: 3, padding: 11 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.red, fontFamily: FD[800], fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Selected point</Text>
              <Text style={{ color: C.ink, fontFamily: FD[800], fontSize: 14, marginTop: 2 }}>{detailRow.label}</Text>
            </View>
            <Pressable accessibilityLabel="Close point details" onPress={() => setSelectedLevel(null)} style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center", borderColor: C.line, borderWidth: 1 }}><Text style={{ color: C.ink, fontSize: 22, lineHeight: 24 }}>×</Text></Pressable>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <LoadValue label="R · DL" value={value(detailRow.rDL, "dl")} />
            <LoadValue label="R · LL" value={value(detailRow.rLL, "ll")} />
            <LoadValue label="L · DL" value={value(detailRow.lDL, "dl")} />
            <LoadValue label="L · LL" value={value(detailRow.lLL, "ll")} />
          </View>
        </View>
      ) : <Text style={{ color: C.inkFaint, fontFamily: FB[400], fontSize: 11, textAlign: "center", marginTop: 8 }}>Tap a red point to view its load details.</Text>}
    </Animated.View>
  );
}

function LoadValue({ label, value }) {
  return <View style={{ flexGrow: 1, flexBasis: "46%", backgroundColor: C.surface2, padding: 8 }}><Text style={{ color: C.inkFaint, fontFamily: FD[800], fontSize: 9 }}>{label}</Text><Text style={{ color: C.ink, fontFamily: FB[700], fontSize: 12, marginTop: 2, fontVariant: ["tabular-nums"] }}>{value}</Text></View>;
}
