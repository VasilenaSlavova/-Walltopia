import { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated, PanResponder } from "react-native";
import Svg, { G, Line, Path, Polygon, Text as SvgText } from "react-native-svg";
import { C, FD, FB } from "../theme";
import * as L from "../lib/loads";

const W = 420;
const H = 520;

export default function SideElevationDiagram({ state, rows, heights, maxOverhang, unitMeta, onGestureActiveChange }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(1);
  const position = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const pinchDistance = useRef(null);
  const pinchBase = useRef(1);
  const [zoomLabel, setZoomLabel] = useState(100);
  const wallHeight = Number(state.height) || 12;
  const overhang = Number(state.overhang) || 0;
  const groundY = 470;
  const topY = 55;
  const baseX = 225;
  const planeX = 142;
  const overhangPx = Math.max(0, 115 * overhang / Math.max(maxOverhang || 1, 1));
  const topX = baseX + overhangPx;
  const levelRows = rows.slice(state.type === "boulder" ? 1 : 2);
  const baseVertical = rows[0] || {};
  const baseHorizontal = state.type === "wall" ? (rows[1] || {}) : {};
  const displayHeights = state.type === "wall" ? heights : [wallHeight];
  const fmt = (v) => L.fmtForce(L.factored(v ?? 0, "LL", state, unitMeta), state.units);
  const dim = (m) => state.units === "EU" ? `${Math.round(m * 1000)} mm` : `${(m * 3.28084).toFixed(1)} ft`;
  const xAt = (z) => baseX + overhangPx * z / wallHeight;
  const yAt = (z) => groundY - 415 * z / wallHeight;
  const surfaceAngle = Math.atan2(topY - groundY, topX - baseX) * 180 / Math.PI;
  const applyZoom = (next, updateLabel = true) => {
    const value = Math.max(.5, Math.min(4, next));
    scaleValue.current = value;
    scale.setValue(value);
    if (updateLabel) setZoomLabel(Math.round(value * 100));
    if (value === 1) {
      position.current = { x: 0, y: 0 };
      translateX.setValue(0);
      translateY.setValue(0);
    }
  };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length > 1 || scaleValue.current > 1,
    onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.touches.length > 1 || (scaleValue.current > 1 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2)),
    onStartShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length > 1 || scaleValue.current > 1,
    onMoveShouldSetPanResponderCapture: (e, g) => e.nativeEvent.touches.length > 1 || (scaleValue.current > 1 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2)),
    onPanResponderGrant: (e) => {
      onGestureActiveChange?.(true);
      dragStart.current = { ...position.current };
      const touches = e.nativeEvent.touches;
      if (touches.length > 1) {
        pinchDistance.current = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        pinchBase.current = scaleValue.current;
      }
    },
    onPanResponderMove: (e, g) => {
      const touches = e.nativeEvent.touches;
      if (touches.length > 1) {
        const distance = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        if (!pinchDistance.current) { pinchDistance.current = distance; pinchBase.current = scaleValue.current; return; }
        applyZoom(pinchBase.current * distance / pinchDistance.current, false);
        return;
      }
      if (scaleValue.current > 1) {
        const next = { x: dragStart.current.x + g.dx, y: dragStart.current.y + g.dy };
        position.current = next;
        translateX.setValue(next.x);
        translateY.setValue(next.y);
      }
    },
    onPanResponderRelease: () => { pinchDistance.current = null; setZoomLabel(Math.round(scaleValue.current * 100)); onGestureActiveChange?.(false); },
    onPanResponderTerminate: () => { pinchDistance.current = null; setZoomLabel(Math.round(scaleValue.current * 100)); onGestureActiveChange?.(false); },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  })).current;

  const forceArrow = (x1, x2, y, negative) => {
    const color = negative ? "#172d63" : C.red;
    const direction = x2 > x1 ? 1 : -1;
    return <G><Line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="2"/><Polygon points={`${x2},${y} ${x2-direction*11},${y-6} ${x2-direction*11},${y+6}`} fill={color}/></G>;
  };

  return (
    <View style={st.component}>
      <View style={st.header}>
        <Text style={st.kicker}>Load application</Text>
        <Text style={st.title}>Side elevation and reaction forces</Text>
        <View style={st.hintRow}>
          <Text style={st.hint}>The diagram follows the selected geometry and displays the current live-load reactions.</Text>
          <View style={st.toolbar}>
            <Pressable accessibilityLabel="Zoom out" hitSlop={8} style={st.tool} onPress={() => applyZoom(scaleValue.current - .25)}><Text style={st.toolText}>−</Text></Pressable>
            <Pressable accessibilityLabel="Reset zoom to 100 percent" hitSlop={8} onPress={() => applyZoom(1)}><Text style={st.percent}>{zoomLabel}%</Text></Pressable>
            <Pressable accessibilityLabel="Zoom in" hitSlop={8} style={st.tool} onPress={() => applyZoom(scaleValue.current + .25)}><Text style={st.toolText}>+</Text></Pressable>
            <Pressable accessibilityLabel="Reset zoom and position" hitSlop={8} style={st.tool} onPress={() => applyZoom(1)}><Text style={st.toolText}>↺</Text></Pressable>
          </View>
        </View>
      </View>
      <View style={st.wrap} {...responder.panHandlers}>
      <Animated.View style={[st.canvas, { transform: [{ translateX }, { translateY }, { scale }] }]}> 
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Line x1="15" y1={groundY} x2="390" y2={groundY} stroke="#252938" strokeWidth="2" />
        <Path d={`M205 ${groundY}l-8 10m14-10l-8 10m14-10l-8 10m14-10l-8 10`} stroke="#89909d" />
        <Line x1={planeX} y1={topY} x2={planeX} y2={groundY} stroke="#a8adb8" strokeWidth="1.3" />
        <Line x1={baseX} y1={groundY} x2={topX} y2={topY} stroke="#2463eb" strokeWidth="3" />

        {displayHeights.map((z, i) => {
          const n = i + 1;
          const x = xAt(z);
          const y = yAt(z);
          const dx = planeX - i * 18;
          const value = L.factored(levelRows[i]?.rLL ?? 0, "LL", state, unitMeta);
          const negative = value < 0;
          return <G key={`${z}-${i}`}>
            <Line x1={planeX} y1={y} x2={x} y2={y} stroke="#343947" strokeWidth="1.4" />
            <Path d={`M${planeX} ${y-9}v18l10-9z`} fill="#fff" stroke="#9197a3" />
            {forceArrow(negative ? 105 : 18, negative ? 18 : 105, y, negative)}
            <SvgText x="53" y={y-11} textAnchor="middle" fill={negative ? "#172d63" : C.red} fontSize="8" fontWeight="700">{`RX${n} = ${fmt(levelRows[i]?.rLL)} ${unitMeta.force}`}</SvgText>
            <Line x1={dx} y1={y} x2={planeX} y2={y} stroke="#aeb3bd" />
            <Line x1={dx} y1={groundY} x2={dx} y2={y} stroke="#9298a5" />
            <Path d={`M${dx-5} ${groundY+5}l10-10M${dx-5} ${y+5}l10-10`} stroke="#9298a5" />
            <SvgText x={dx-8} y={(groundY+y)/2} textAnchor="middle" fill="#596171" fontSize="8" transform={`rotate(-90 ${dx-8} ${(groundY+y)/2})`}>{`H${n} = ${dim(z)}`}</SvgText>
          </G>;
        })}

        <Line x1={planeX} y1={topY} x2={planeX} y2="30" stroke="#aeb3bd" />
        <Line x1={topX} y1={topY} x2={topX} y2="30" stroke="#aeb3bd" />
        <Line x1={planeX} y1="30" x2={topX} y2="30" stroke="#9298a5" />
        <Path d={`M${planeX-5} 35l10-10M${topX-5} 35l10-10`} stroke="#9298a5" />
        <SvgText x={(planeX+topX)/2} y="20" textAnchor="middle" fill="#6d7482" fontSize="8">{`X = ${dim(overhang)} (overhang)`}</SvgText>

        <Line x1={topX} y1={topY} x2="350" y2={topY} stroke="#aeb3bd" />
        <Line x1="350" y1={groundY} x2="350" y2={topY} stroke="#9298a5" />
        <Path d={`M345 ${groundY+5}l10-10M345 ${topY+5}l10-10`} stroke="#9298a5" />
        <SvgText x="365" y={(groundY+topY)/2} textAnchor="middle" fill="#596171" fontSize="9" transform={`rotate(-90 365 ${(groundY+topY)/2})`}>{`Climbing wall height = ${dim(wallHeight)}`}</SvgText>
        <SvgText x={(baseX+topX)/2+15} y={(groundY+topY)/2} textAnchor="middle" fill="#596171" fontSize="9" transform={`rotate(${surfaceAngle} ${(baseX+topX)/2+15} ${(groundY+topY)/2})`}>Climbing surface</SvgText>

        {state.type === "wall" ? (() => { const v=L.factored(baseHorizontal.rLL??0,"LL",state,unitMeta); return <G>{forceArrow(v<0?265:188,v<0?188:265,470,v<0)}<SvgText x="226" y="494" textAnchor="middle" fill={v<0?"#172d63":C.red} fontSize="8" fontWeight="700">{`RX0 = ${fmt(baseHorizontal.rLL)} ${unitMeta.force}`}</SvgText></G>; })() : null}
        {(() => { const v=L.factored(baseVertical.rLL??0,"LL",state,unitMeta); const neg=v<0; const y1=neg?405:452,y2=neg?452:405,color=neg?"#172d63":C.red; return <G><Line x1="205" y1={y1} x2="205" y2={y2} stroke={color} strokeWidth="2"/><Polygon points={`205,${y2} 199,${y2+(neg?-11:11)} 211,${y2+(neg?-11:11)}`} fill={color}/><SvgText x="205" y="392" textAnchor="middle" fill={color} fontSize="8" fontWeight="700">{`RZ0 = ${fmt(baseVertical.rLL)} ${unitMeta.force}`}</SvgText></G>; })()}

        <Line x1="26" y1="468" x2="26" y2="420" stroke="#111827" strokeWidth="2"/><Polygon points="26,414 20,426 32,426" fill="#111827"/>
        <Line x1="26" y1="468" x2="80" y2="468" stroke="#111827" strokeWidth="2"/><Polygon points="86,468 74,462 74,474" fill="#111827"/>
        <SvgText x="5" y="420" fontSize="11" fill="#111827">+Z</SvgText><SvgText x="65" y="488" fontSize="11" fill="#111827">+X</SvgText>
      </Svg>
      </Animated.View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  component: { marginTop: 10 },
  header: { marginBottom: 8 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  kicker: { color: C.red, fontFamily: FD[800], fontSize: 9, textTransform: "uppercase", letterSpacing: .6 },
  title: { color: C.ink, fontFamily: FD[900], fontSize: 15, marginTop: 3 },
  hint: { flex: 1, color: C.inkFaint, fontFamily: FB[400], fontSize: 10, lineHeight: 14, textAlign: "justify" },
  wrap: { borderWidth: 1, borderColor: C.lineStrong, backgroundColor: "#f7f8fa", overflow: "hidden", aspectRatio: W / H },
  canvas: { width: "100%", height: "100%" },
  toolbar: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: C.lineStrong },
  tool: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  toolText: { color: C.navy, fontFamily: FD[800], fontSize: 16 },
  percent: { minWidth: 42, textAlign: "center", color: C.navy, fontFamily: FB[700], fontSize: 9 },
});
