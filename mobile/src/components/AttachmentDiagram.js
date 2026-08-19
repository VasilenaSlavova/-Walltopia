import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Image, Modal, Linking, Animated, PanResponder } from "react-native";
import Svg, { G, Path, Rect, Line, Circle, Polygon, Polyline, Text as SvgText, Defs, Marker, TSpan } from "react-native-svg";
import { C, FD, FB } from "../theme";
import { api } from "../api";
import * as ScreenOrientation from "expo-screen-orientation";

const IMG_BASE = api.base.replace(/\/api\/?$/, "");
const details = [
  { id: "CF-01", group: "base", slab: "solid", title: "Base connection detail 01", file: "concrete-floor-05.png" },
  { id: "CF-02", group: "base", slab: "solid", title: "Base connection detail 02", file: "concrete-floor-04.png" },
  { id: "CF-03", group: "base", slab: "hollow", title: "Base connection detail 03", file: "concrete-floor-03.png" },
  { id: "CF-04", group: "base", slab: "solid", title: "Base connection detail 04", file: "concrete-floor-02.png" },
  { id: "CF-05", group: "base", slab: "solid", title: "Base connection detail 05", file: "concrete-floor-01.png" },
  { id: "CW-01", group: "concrete", title: "Concrete wall · Detail 01", file: "concrete-wall-03.png" },
  { id: "CW-02", group: "concrete", title: "Concrete wall · Detail 02", file: "concrete-wall-02.png" },
  { id: "CW-03", group: "concrete", title: "Concrete wall · Detail 03", file: "concrete-wall-01.png" },
  { id: "SC-01", group: "steel", title: "Steel column · Detail 01", file: "steel-column-04.png" },
  { id: "SC-02", group: "steel", title: "Steel column · Detail 02", file: "steel-column-03.png" },
  { id: "SC-03", group: "steel", title: "Steel column · Detail 03", file: "steel-column-02.png" },
  { id: "SC-04", group: "steel", title: "Steel column · Detail 04", file: "steel-column-01.png" },
  { id: "MW-01", group: "masonry", title: "Masonry wall · Detail 01", file: "masonry-wall-02.png" },
  { id: "MW-02", group: "masonry", title: "Masonry wall · Detail 02", file: "masonry-wall-01.png" },
];

export default function AttachmentDiagram({ structureType = "wall", span = 6, overhang = 1, height = 12, zValues = [4, 8, 11.5], levelForces = [], forceUnit = "kN", initialBaseDetail = "CF-01", initialLevelDetail = "CW-01", onSelectionChange }) {
  const [slab, setSlab] = useState("solid");
  const [support, setSupport] = useState("concrete");
  const [base, setBase] = useState(initialBaseDetail);
  const [level, setLevel] = useState(initialLevelDetail);
  const [open, setOpen] = useState(null);
  const [largeView, setLargeView] = useState(false);
  useEffect(() => { onSelectionChange && onSelectionChange({ baseDetail: base, levelDetail: level }); }, [base, level]); // eslint-disable-line react-hooks/exhaustive-deps
  const supportTypes = structureType === "boulder"
    ? [["concrete","Solid concrete wall / column"],["steel","Steel column"],["masonry","Masonry / brick wall"]]
    : [["concrete","Solid concrete wall / column"],["steel","Steel column"]];
  useEffect(() => {
    if (structureType !== "boulder" && support === "masonry") {
      setSupport("concrete");
      setLevel("CW-01");
    }
  }, [structureType, support]);
  const levelOptions = details.filter((d) => d.group === support);
  const baseOptions = details.filter((d) => d.group === "base" && d.slab === slab);
  const baseDetail = details.find((d) => d.id === base) || baseOptions[0];
  const levelDetail = details.find((d) => d.id === level) || levelOptions[0];
  const chooseSupport = (v) => { setSupport(v); setLevel(details.find((d) => d.group === v).id); };
  const chooseSlab = (v) => { setSlab(v); setBase(details.find((d) => d.group === "base" && d.slab === v).id); };
  const hitDiagramPoint = (vx, vy) => {
    const candidates = [{ x:365, y:390, detail:{...baseDetail,title:`Base connection · ${baseDetail.title}`} }];
    const scaleZ = structureType === "boulder" ? 52 : 20;
    zValues.forEach((z,i) => { const y=390-z*scaleZ,yl=y+12,yr=y-12; [120,365,610].forEach((x) => candidates.push({x,y:yl+(yr-yl)*((x-120)/490),detail:{...levelDetail,title:`Attachment level ${i+1} · ${levelDetail.title}`}})); });
    let best=null,bestD=Infinity; candidates.forEach((p)=>{const d=Math.hypot(vx-p.x,vy-p.y);if(d<bestD){best=p;bestD=d;}}); if(best && bestD<44)setOpen(best.detail);
  };
  const openLargeView = async () => {
    setLargeView(true);
    try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); } catch (e) {}
  };
  const closeLargeView = async () => {
    setLargeView(false);
    try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); } catch (e) {}
  };
  return <View style={{ marginTop: 4 }}>
    <View style={headRow}><Text style={eyebrow}>Attachment configuration</Text><Pressable accessibilityRole="link" accessibilityLabel="Open Standard Attachment Details PDF" onPress={() => Linking.openURL(`${IMG_BASE}/manuals/attachment/standard-attachment-details.pdf`)}><Text style={docLink}>View full documentation</Text></Pressable></View>
    <View style={headingRow}><View style={headingRule}/><Text style={heading}>Select the supporting slab and attachment method</Text></View>
    <Text style={intro}>These selections filter the applicable standard details. They do not change the preliminary load values.</Text>

    <Text style={sectionLabel}>1 · Supporting slab</Text>
    <View style={segment}>{[["hollow","Hollow panel slab"],["solid","Solid concrete slab"]].map(([v,t]) => <SegmentButton key={v} active={slab === v} text={t} onPress={() => chooseSlab(v)} />)}</View>
    <View style={detailList}>{baseOptions.map((d) => <DetailRow key={d.id} detail={d} selected={baseDetail.id === d.id} select={() => setBase(d.id)} view={() => setOpen(d)} />)}</View>

    <Text style={sectionLabel}>2 · Attachment method</Text>
    <View style={segment}>{supportTypes.map(([v,t]) => <SegmentButton key={v} active={support === v} text={t} onPress={() => chooseSupport(v)} />)}</View>
    <View style={detailList}>{levelOptions.map((d) => <DetailRow key={d.id} detail={d} selected={levelDetail.id === d.id} select={() => setLevel(d.id)} view={() => setOpen(d)} />)}</View>

    <Pressable onPress={openLargeView} style={largeButton}><Text style={largeButtonText}>Open large horizontal view ↗</Text></Pressable>
    <View style={{ aspectRatio: 900 / 550, backgroundColor: C.surface2, borderColor: C.line, borderWidth: 1 }}>
      <WebAttachmentSvg structureType={structureType} span={span} overhang={overhang} height={height} zValues={zValues} levelForces={levelForces} forceUnit={forceUnit} baseDetail={baseDetail} levelDetail={levelDetail} openDetail={setOpen} />
    </View>
    <Modal visible={largeView} animationType="fade" onRequestClose={closeLargeView} supportedOrientations={["landscape-left","landscape-right"]}>
      <View style={largeScreen}>
        <View style={largeHeader}><View><Text style={largeKicker}>2D technical schematic</Text><Text style={largeHint}>Pinch to zoom · drag to pan · tap a red point</Text></View><Pressable onPress={closeLargeView} style={largeClose}><Text style={largeCloseText}>Close ×</Text></Pressable></View>
        <View style={{ flex:1, backgroundColor:C.surface2 }}><ZoomableSchematic onSchematicTap={hitDiagramPoint}><WebAttachmentSvg structureType={structureType} span={span} overhang={overhang} height={height} zValues={zValues} levelForces={levelForces} forceUnit={forceUnit} baseDetail={baseDetail} levelDetail={levelDetail} openDetail={setOpen} /></ZoomableSchematic></View>
        {open ? <View style={embeddedBackdrop}><DetailPanel detail={open} close={() => setOpen(null)} /></View> : null}
      </View>
    </Modal>
    {!largeView ? <Detail detail={open} close={() => setOpen(null)} /> : null}
  </View>;
}

function ZoomableSchematic({ children, onSchematicTap }) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(1);
  const position = useRef({ x:0, y:0 });
  const start = useRef({ px:0, py:0 });
  const pinchDistance = useRef(null);
  const pinchBase = useRef(1);
  const [label, setLabel] = useState(100);
  const layout = useRef({ width:900, height:550 });
  const tapHandler = useRef(onSchematicTap);
  tapHandler.current = onSchematicTap;
  const applyZoom = (next, updateLabel = true) => {
    const value = Math.max(1, Math.min(4, next));
    scaleValue.current = value; scale.setValue(value); if (updateLabel) setLabel(Math.round(value * 100));
    if (value === 1) { position.current={x:0,y:0}; tx.setValue(0); ty.setValue(0); }
  };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length > 1,
    onMoveShouldSetPanResponder: (e,g) => e.nativeEvent.touches.length > 1 || (scaleValue.current > 1 && (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8)),
    onStartShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length > 1,
    onMoveShouldSetPanResponderCapture: (e,g) => e.nativeEvent.touches.length > 1 || (scaleValue.current > 1 && (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8)),
    onPanResponderGrant: (e) => {
      start.current={px:position.current.x,py:position.current.y};
      const t=e.nativeEvent.touches; if(t.length>1){pinchDistance.current=Math.hypot(t[0].pageX-t[1].pageX,t[0].pageY-t[1].pageY);pinchBase.current=scaleValue.current;}
    },
    onPanResponderMove: (e, g) => {
      const t=e.nativeEvent.touches;
      if(t.length>1){const d=Math.hypot(t[0].pageX-t[1].pageX,t[0].pageY-t[1].pageY);if(!pinchDistance.current){pinchDistance.current=d;pinchBase.current=scaleValue.current;return;}applyZoom(pinchBase.current*d/pinchDistance.current,false);return;}
      if(scaleValue.current>1){const x=start.current.px+g.dx,y=start.current.py+g.dy;position.current={x,y};tx.setValue(x);ty.setValue(y);}
    },
    onPanResponderRelease:(e,g)=>{
      pinchDistance.current=null;
      setLabel(Math.round(scaleValue.current*100));
      if(tapHandler.current && Math.abs(g.dx)<12 && Math.abs(g.dy)<12){
        const w=layout.current.width,h=layout.current.height,s=scaleValue.current;
        const px=(e.nativeEvent.locationX-w/2-position.current.x)/s+w/2;
        const py=(e.nativeEvent.locationY-h/2-position.current.y)/s+h/2;
        const fit=Math.min(w/900,h/550),ox=(w-900*fit)/2,oy=(h-550*fit)/2;
        tapHandler.current((px-ox)/fit,(py-oy)/fit);
      }
    }, onPanResponderTerminate:()=>{pinchDistance.current=null;setLabel(Math.round(scaleValue.current*100));},
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  })).current;
  return <View style={{ flex:1, overflow:"hidden" }} onLayout={(e)=>{layout.current=e.nativeEvent.layout;}} {...responder.panHandlers}>
    <Animated.View style={{ width:"100%", height:"100%", transform:[{translateX:tx},{translateY:ty},{scale}] }}>{children}</Animated.View>
    <View style={zoomControls} pointerEvents="box-none"><Pressable accessibilityLabel="Zoom out" onPress={()=>applyZoom(scaleValue.current-.25)} style={zoomButton}><Text style={zoomButtonText}>−</Text></Pressable><View style={zoomValue}><Text style={zoomValueText}>{label}%</Text></View><Pressable accessibilityLabel="Zoom in" onPress={()=>applyZoom(scaleValue.current+.25)} style={zoomButton}><Text style={zoomButtonText}>+</Text></Pressable><Pressable accessibilityLabel="Reset zoom and position" onPress={()=>applyZoom(1)} style={[zoomButton, zoomResetButton]}><Text style={zoomResetText}>↺</Text></Pressable></View>
  </View>;
}

function WebAttachmentSvg({ structureType, span, overhang, height, zValues, levelForces, forceUnit, baseDetail, levelDetail, openDetail }) {
  const left = 120, right = 610, mid = 365, baseY = 390;
  const scaleZ = structureType === "boulder" ? 52 : 20;
  const topY = baseY - height * scaleZ;
  const levelYs = zValues.map((z) => baseY - z * scaleZ);
  const contourTop = [[150,420],[270,435],[365,410],[460,428],[585,400]];
  const shift = Math.max(18, overhang * 24);
  const contourBottom = contourTop.map((p,i) => [p[0] + shift * (.35 + i * .15), p[1] + 48]);
  const polygon = contourTop.concat([...contourBottom].reverse()).map((p) => p.join(",")).join(" ");
  const topLine = contourTop.map((p) => p.join(",")).join(" ");
  const beamIndex = Math.floor((levelYs.length - 1) / 2);
  const beamTargetY = (levelYs[beamIndex] || baseY) + 12 + (-24) * ((470-left)/(right-left));
  const groundY = (x) => baseY + 13 + (x - 95) * (-27 / 555);
  const spanGap = 14;
  return <Svg width="100%" height="100%" viewBox="0 0 900 550" accessibilityLabel="Interactive ACS geometry and attachment points">
    <Defs>
      <Marker id="loadArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><Path d="M0 0L10 5L0 10Z" fill={C.red}/></Marker>
      <Marker id="negativeArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><Path d="M0 0L10 5L0 10Z" fill={C.navy}/></Marker>
      <Marker id="techArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><Path d="M0 0L10 5L0 10Z" fill={C.inkFaint}/></Marker>
    </Defs>
    <Path d={`M${left} ${topY+12}L${right} ${topY-12}`} fill="none" stroke={C.ink} strokeWidth="2.5"/>
    <Path d={`M95 ${baseY+13}L650 ${baseY-14}`} fill="none" stroke={C.ink} strokeWidth="2.5"/>
    <Rect x={left-7} y={topY+12} width="14" height={baseY-(topY+12)+12} fill="#fff" stroke={C.ink} strokeWidth="2"/>
    <Rect x={mid-7} y={topY} width="14" height={baseY-topY} fill="#fff" stroke={C.ink} strokeWidth="2"/>
    <Rect x={right-7} y={topY-12} width="14" height={baseY-(topY-12)-12} fill="#fff" stroke={C.ink} strokeWidth="2"/>
    {levelYs.map((y,i) => {
      const yr = y-12, yl = y+12;
      const raw = Number(levelForces[i]);
      const hasForce = Number.isFinite(raw);
      const negative = hasForce && raw < 0;
      const labelX = mid-24;
      const labelY = yl + (yr-yl) * ((labelX-left)/(right-left)) + 20;
      const arrow = negative ? `M${mid-18} ${y-5}l-38 -22` : `M${mid+18} ${y+5}l38 22`;
      const lower = i === 0 ? baseY : levelYs[i-1]-12;
      return <G key={i}>
        <Line x1={left} y1={yl} x2={right} y2={yr} stroke={C.blue || "#2463eb"} strokeWidth="4"/>
        <SvgText x={labelX} y={labelY} textAnchor="end" fill={negative ? C.navy : C.red} fontFamily={FB[700]} fontSize="14">{`Lx${i+1}${hasForce ? ` = ${raw.toFixed(2)} ${forceUnit}` : ""}`}</SvgText>
        <Path d={arrow} fill="none" stroke={negative ? C.navy : C.red} strokeWidth="2.5" strokeDasharray="6 5" markerEnd={negative ? "url(#negativeArrow)" : "url(#loadArrow)"}/>
        <Line x1="658" y1={yr} x2="658" y2={lower} stroke={C.inkFaint} strokeWidth="1.1"/>
        <Line x1="640" y1={yr} x2="670" y2={yr} stroke={C.inkFaint} strokeWidth="1.1"/>
        <SvgText x="674" y={(yr+lower)/2+4} fill={C.inkFaint} fontFamily={FB[400]} fontSize="10">{`Z${i+1} = ${(i === 0 ? zValues[0] : zValues[i]-zValues[i-1]).toFixed(1)} m`}</SvgText>
        {[left,mid,right].map((cx,j) => { const cy=yl+(yr-yl)*((cx-left)/(right-left)); const show=() => openDetail({...levelDetail,title:`Attachment level ${i+1} · ${levelDetail.title}`}); return <G key={cx} onPress={show}><Circle cx={cx} cy={cy} r="30" fill="rgba(255,255,255,0.001)" onPress={show}/><Circle cx={cx} cy={cy} r="8" fill="#fff" stroke={C.red} strokeWidth="4" onPress={show}/></G>; })}
      </G>;
    })}
    <G><SvgText x="18" y="205" fill={C.inkFaint} fontFamily={FB[400]} fontSize="10"><TSpan x="18">Existing column</TSpan><TSpan x="18" dy="14">of the building</TSpan></SvgText><Path d={`M105 214L${left} ${baseY-110}`} fill="none" stroke={C.inkFaint} strokeWidth="1.1" markerEnd="url(#techArrow)"/>
      <SvgText x="430" y={beamTargetY-42} fill={C.inkFaint} fontFamily={FB[400]} fontSize="10">Walltopia beam</SvgText><Path d={`M475 ${beamTargetY-35}L470 ${beamTargetY}`} fill="none" stroke={C.inkFaint} strokeWidth="1.1" markerEnd="url(#techArrow)"/></G>
    <Polygon points={polygon} fill="#dbe7fb" stroke="#2463eb" strokeWidth="2"/><Polyline points={topLine} fill="none" stroke="#2463eb" strokeWidth="2"/>
    <SvgText x="78" y="510" fill={C.inkFaint} fontFamily={FB[400]} fontSize="10"><TSpan x="78">Climbing surface</TSpan><TSpan x="78" dy="14" fill={C.navy} fontWeight="800">bottom contour</TSpan></SvgText><Path d={`M145 493L132 458L${contourTop[0][0]} ${contourTop[0][1]}`} fill="none" stroke={C.inkFaint} strokeWidth="1.1" markerEnd="url(#techArrow)"/>
    <SvgText x="650" y="510" fill={C.inkFaint} fontFamily={FB[400]} fontSize="10"><TSpan x="650">Climbing surface</TSpan><TSpan x="650" dy="14" fill={C.navy} fontWeight="800">top contour</TSpan></SvgText><Path d={`M650 493L635 470L${contourBottom[4][0]} ${contourBottom[4][1]}`} fill="none" stroke={C.inkFaint} strokeWidth="1.1" markerEnd="url(#techArrow)"/>
    {[[left+spanGap,mid-spanGap],[mid+spanGap,right-spanGap]].map(([x1,x2],i) => <G key={i}><Line x1={x1} y1={groundY(x1)-10} x2={x2} y2={groundY(x2)-10} stroke={C.inkFaint} strokeWidth="1.1" markerStart="url(#techArrow)" markerEnd="url(#techArrow)"/><SvgText x={(x1+x2)/2} y={groundY((x1+x2)/2)-18} textAnchor="middle" fill={C.inkFaint} fontFamily={FB[400]} fontSize="9">{`A = ${span.toFixed(1)} m`}</SvgText></G>)}
    <Line x1={contourTop[1][0]} y1={contourTop[1][1]} x2={contourBottom[1][0]} y2={contourBottom[1][1]} stroke={C.inkFaint} strokeWidth="1.1" markerStart="url(#techArrow)" markerEnd="url(#techArrow)"/><SvgText x={contourBottom[1][0]+14} y={(contourTop[1][1]+contourBottom[1][1])/2+4} fill={C.inkFaint} fontFamily={FB[400]} fontSize="10">{`X = ${overhang.toFixed(1)} m`}</SvgText>
    <Line x1="760" y1={topY-12} x2="760" y2={baseY} stroke={C.inkFaint} strokeWidth="1.1"/><SvgText x="775" y={(topY+baseY)/2} fill={C.inkFaint} fontFamily={FB[400]} fontSize="10">{`H = ${height.toFixed(0)} m`}</SvgText>
    <G transform="translate(820 410)"><Path d="M0 0V-48M0 0L42-9M0 0L25 32" fill="none" stroke={C.navy} strokeWidth="2"/><SvgText x="-7" y="-55" fill={C.navy} fontFamily={FB[700]} fontSize="10">Z</SvgText><SvgText x="48" y="-7" fill={C.navy} fontFamily={FB[700]} fontSize="10">Y</SvgText><SvgText x="28" y="43" fill={C.navy} fontFamily={FB[700]} fontSize="10">X</SvgText></G>
    <SvgText x="28" y="30" fill={C.inkFaint} fontFamily={FB[400]} fontSize="10">Tap a red point to preview its attachment detail</SvgText>
    <G onPress={() => openDetail({...baseDetail,title:`Base connection · ${baseDetail.title}`})}><Circle cx={mid} cy={baseY} r="32" fill="rgba(255,255,255,0.001)" onPress={() => openDetail({...baseDetail,title:`Base connection · ${baseDetail.title}`})}/><Circle cx={mid} cy={baseY} r="8" fill="#fff" stroke={C.red} strokeWidth="4" onPress={() => openDetail({...baseDetail,title:`Base connection · ${baseDetail.title}`})}/></G>
  </Svg>;
}

function SegmentButton({ active, text, onPress }) { return <Pressable onPress={onPress} style={[segButton, active && segButtonActive]}><Text style={[segText, active && { color:"#fff" }]}>{text}</Text></Pressable>; }
function DetailRow({ detail, selected, select, view }) { return <View style={[detailRow, selected && { borderColor:C.red, borderWidth:2 }]}><Pressable onPress={select} style={{ flex:1, flexDirection:"row", alignItems:"center", gap:8, padding:9 }}><Text style={detailId}>{detail.id}</Text><Text numberOfLines={1} style={detailName}>{detail.title}</Text>{selected ? <Text style={selectedText}>Selected</Text> : null}</Pressable><Pressable onPress={view} style={viewButton}><Text style={viewText}>View</Text></Pressable></View>; }
function DetailPanel({ detail, close }) {
  const [ratio,setRatio]=useState(1.45);
  return <View style={[detailViewer,{aspectRatio:ratio}]}>
    <ZoomableDetailImage uri={`${IMG_BASE}/manuals/attachment/details/${detail.file}?v=final`} onRatio={setRatio} />
    <Pressable accessibilityLabel="Close detail" onPress={close} style={detailClose}><Text style={detailCloseText}>×</Text></Pressable>
  </View>;
}
function ZoomableDetailImage({ uri, onRatio }) {
  const scale=useRef(new Animated.Value(1)).current,tx=useRef(new Animated.Value(0)).current,ty=useRef(new Animated.Value(0)).current;
  const scaleValue=useRef(1),pinchStart=useRef(null),pinchBase=useRef(1),panStart=useRef({x:0,y:0,tx:0,ty:0}),translation=useRef({x:0,y:0});
  const reset=()=>{scaleValue.current=1;scale.setValue(1);translation.current={x:0,y:0};tx.setValue(0);ty.setValue(0);};
  useEffect(reset,[uri]);
  const responder=useRef(PanResponder.create({
    onStartShouldSetPanResponder:(event)=>event.nativeEvent.touches.length>1||scaleValue.current>1,
    onStartShouldSetPanResponderCapture:(event)=>event.nativeEvent.touches.length>1||scaleValue.current>1,
    onMoveShouldSetPanResponderCapture:(event,gesture)=>event.nativeEvent.touches.length>1||(scaleValue.current>1&&(Math.abs(gesture.dx)>2||Math.abs(gesture.dy)>2)),
    onMoveShouldSetPanResponder:(event,gesture)=>event.nativeEvent.touches.length>1||(scaleValue.current>1&&(Math.abs(gesture.dx)>2||Math.abs(gesture.dy)>2)),
    onPanResponderGrant:(event)=>{const touches=event.nativeEvent.touches;if(touches.length>1){pinchStart.current=Math.hypot(touches[0].pageX-touches[1].pageX,touches[0].pageY-touches[1].pageY);pinchBase.current=scaleValue.current;}else if(touches[0]){panStart.current={x:touches[0].pageX,y:touches[0].pageY,tx:translation.current.x,ty:translation.current.y};}},
    onPanResponderMove:(event)=>{const touches=event.nativeEvent.touches;if(touches.length>1){const distance=Math.hypot(touches[0].pageX-touches[1].pageX,touches[0].pageY-touches[1].pageY);if(!pinchStart.current){pinchStart.current=distance;pinchBase.current=scaleValue.current;}const next=Math.max(1,Math.min(6,pinchBase.current*distance/pinchStart.current));scaleValue.current=next;scale.setValue(next);}else if(touches[0]&&scaleValue.current>1){const x=panStart.current.tx+touches[0].pageX-panStart.current.x,y=panStart.current.ty+touches[0].pageY-panStart.current.y;translation.current={x,y};tx.setValue(x);ty.setValue(y);}},
    onPanResponderTerminationRequest:()=>false,
    onPanResponderRelease:()=>{pinchStart.current=null;},
    onPanResponderTerminate:()=>{pinchStart.current=null;},
  })).current;
  return <View style={detailImageStage} {...responder.panHandlers}><Animated.Image source={{uri}} renderToHardwareTextureAndroid onLoad={(e)=>{const source=e.nativeEvent.source||{};if(source.width&&source.height)onRatio(Math.max(.75,Math.min(2.6,source.width/source.height)));}} resizeMode="contain" style={[detailImage,{transform:[{translateX:tx},{translateY:ty},{scale}]}]} /></View>;
}
function Detail({ detail, close }) { if (!detail) return null; return <Modal visible transparent animationType="fade" onRequestClose={close}><View style={detailModal}><DetailPanel detail={detail} close={close}/></View></Modal>; }
const headRow = { flexDirection:"row", alignItems:"center", justifyContent:"space-between", gap:8 };
const eyebrow = { color:C.red, fontFamily:FD[800], fontSize:9, textTransform:"uppercase", letterSpacing:.7 };
const headingRow = { flexDirection:"row", alignItems:"flex-start", gap:8, marginTop:6 };
const headingRule = { width:13, height:3, marginTop:8, backgroundColor:C.red };
const heading = { flex:1, color:C.ink, fontFamily:FD[900], fontSize:16, textTransform:"uppercase", lineHeight:20 };
const docLink = { color:C.red, fontFamily:FB[700], fontSize:9, textDecorationLine:"underline" };
const intro = { color:C.inkSoft, fontFamily:FB[400], fontSize:11, lineHeight:16, marginTop:8, marginBottom:3, textAlign:"justify" };
const sectionLabel = { color:C.red, fontFamily:FD[800], fontSize:9, textTransform:"uppercase", letterSpacing:.6, marginTop:16, marginBottom:8 };
const segment = { flexDirection:"row", padding:3, borderColor:C.lineStrong, borderWidth:1, backgroundColor:C.surface2 };
const segButton = { flex:1, minHeight:38, alignItems:"center", justifyContent:"center", paddingHorizontal:6 };
const segButtonActive = { backgroundColor:C.red };
const segText = { color:C.ink, fontFamily:FD[800], fontSize:9, textAlign:"center" };
const detailList = { marginTop:8, gap:6 };
const detailRow = { flexDirection:"row", minHeight:42, borderColor:C.lineStrong, borderWidth:1, backgroundColor:"#fff" };
const detailId = { color:C.red, fontFamily:FB[700], fontSize:9 };
const detailName = { flex:1, color:C.inkSoft, fontFamily:FB[400], fontSize:10 };
const selectedText = { color:C.red, fontFamily:FD[800], fontSize:7, textTransform:"uppercase" };
const viewButton = { width:46, alignItems:"center", justifyContent:"center", borderLeftColor:C.line, borderLeftWidth:1, backgroundColor:C.surface2 };
const viewText = { color:C.red, fontFamily:FD[800], fontSize:8, textTransform:"uppercase" };
const largeButton = { alignSelf:"flex-end", marginTop:14, paddingHorizontal:12, paddingVertical:10, backgroundColor:C.navy };
const largeButtonText = { color:"#fff", fontFamily:FD[800], fontSize:10, textTransform:"uppercase", letterSpacing:.35 };
const largeScreen = { flex:1, backgroundColor:"#fff", padding:10 };
const largeHeader = { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingBottom:8 };
const largeKicker = { color:C.ink, fontFamily:FD[900], fontSize:15, textTransform:"uppercase" };
const largeHint = { color:C.inkFaint, fontFamily:FB[400], fontSize:10, marginTop:2 };
const largeClose = { paddingHorizontal:14, paddingVertical:9, backgroundColor:C.red };
const largeCloseText = { color:"#fff", fontFamily:FD[800], fontSize:10, textTransform:"uppercase" };
const embeddedBackdrop = { position:"absolute", top:0, right:0, bottom:0, left:0, backgroundColor:"rgba(20,25,34,.72)", alignItems:"center", justifyContent:"center", padding:12 };
const detailModal = { flex:1, backgroundColor:"rgba(20,25,34,.72)", alignItems:"center", justifyContent:"center", padding:16 };
const detailViewer = { width:"92%", maxWidth:900, maxHeight:"86%", backgroundColor:"#fff", borderTopColor:C.red, borderTopWidth:3, overflow:"hidden", elevation:8 };
const detailImageStage = { flex:1, overflow:"hidden" };
const detailImage = { width:"100%", height:"100%", backgroundColor:"#fff" };
const detailClose = { position:"absolute", zIndex:5, top:14, right:14, width:40, height:40, alignItems:"center", justifyContent:"center", backgroundColor:"rgba(255,255,255,.94)", borderColor:C.lineStrong, borderWidth:1, elevation:4 };
const detailCloseText = { width:40, height:40, color:C.ink, fontFamily:FB[400], fontSize:28, lineHeight:38, textAlign:"center", textAlignVertical:"center", includeFontPadding:false, transform:[{translateY:-1}] };
const zoomControls = { position:"absolute", top:8, right:8, flexDirection:"row", alignItems:"center", backgroundColor:"rgba(255,255,255,.94)", borderColor:C.lineStrong, borderWidth:1 };
const zoomButton = { width:34, height:32, alignItems:"center", justifyContent:"center" };
const zoomButtonText = { color:C.ink, fontFamily:FB[600], fontSize:20, lineHeight:22 };
const zoomValue = { width:50, height:32, alignItems:"center", justifyContent:"center", borderLeftColor:C.line, borderRightColor:C.line, borderLeftWidth:1, borderRightWidth:1 };
const zoomValueText = { color:C.inkSoft, fontFamily:FD[800], fontSize:9 };
const zoomResetButton = { borderLeftColor:C.line, borderLeftWidth:1 };
const zoomResetText = { color:C.ink, fontFamily:FB[600], fontSize:18, lineHeight:20 };
