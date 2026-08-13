import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking, Animated, PanResponder, Modal, ScrollView, Image } from "react-native";
import { C, FD, FB, PAGE_TITLE } from "../theme";
import { Segmented } from "../components/ui";
import { api } from "../api";
import pages from "../manualPages.json";

// Images are served by the backend (same host as the API), e.g. http://host:8787/manuals/...
const IMG_BASE = api.base.replace(/\/api\/?$/, "");
const pad = (n) => (n < 10 ? "0" + n : "" + n);

export default function ManualScreen({ scrollToTopRequest = 0 }) {
  const [view, setView] = useState("manual");
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding:14, paddingBottom:8 }}>
        <Text style={s.docsTitle}>Technical Documentation</Text>
        <Segmented value={view} onChange={setView} options={[{ label:"Application Manual", value:"manual" }, { label:"Attachment Details", value:"attachment" }]} />
      </View>
      {view === "manual" ? <ManualPages scrollToTopRequest={scrollToTopRequest} /> : <AttachmentView />}
    </View>
  );
}

function ManualPages({ scrollToTopRequest = 0 }) {
  const [current, setCurrent] = useState(1);
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const [zoomGestureActive, setZoomGestureActive] = useState(false);
  const manualScroll = useRef(null);
  useEffect(() => {
    if (scrollToTopRequest) manualScroll.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopRequest]);
  const page = pages[current - 1];
  const uri = `${IMG_BASE}/manuals/manual/page-${pad(current)}.png?v=final`;
  const tiles = Array.from({ length: 6 }, (_, index) => ({
    x: index % 2,
    y: Math.floor(index / 2),
    cols: 2,
    rows: 3,
    uri: `${IMG_BASE}/manuals/manual/tiles/page-${pad(current)}-${Math.floor(index / 2)}-${index % 2}.png?v=tiled`,
  }));
  const move = (direction) => setCurrent((value) => Math.max(1, Math.min(pages.length, value + direction)));
  return (
    <ScrollView ref={manualScroll} style={s.manualPane} contentContainerStyle={s.manualPaneContent} nestedScrollEnabled scrollEnabled={!zoomGestureActive}>
      <View style={s.manualHead}>
        <View style={s.sectionCopy}>
          <View style={s.sectionTitleRow}><Text style={s.sectionNumber}>01</Text><Text style={s.h2}>Application Manual</Text></View>
          <Text style={s.intro}>How to use the Walltopia Preliminary Loads Calculator, understand its inputs and results, export reports and review the technical limitations.</Text>
        </View>
      </View>

      <View style={s.manualToolbar}>
        <View style={s.manualToolbarLeft}>
          <Pressable accessibilityLabel="Select manual page" onPress={() => setPagePickerOpen(true)} style={s.pageSelect}>
            <Text style={s.pageSelectText}>Page {current}</Text><Text style={s.pageSelectChevron}>⌄</Text>
          </Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel="Download application manual PDF" onPress={() => Linking.openURL(`${IMG_BASE}/manuals/manual/walltopia-preliminary-loads-calculator-manual.pdf`)} style={s.pdfButton}>
            <Text style={s.pdfButtonText}>Download PDF</Text>
          </Pressable>
        </View>
        <Text style={s.toolbarCount}>Page {current} of {pages.length}</Text>
      </View>

      <Modal visible={pagePickerOpen} transparent animationType="fade" onRequestClose={() => setPagePickerOpen(false)}>
        <Pressable style={s.pickerBackdrop} onPress={() => setPagePickerOpen(false)}>
          <View style={s.pagePickerCard}>
            <Text style={s.pagePickerTitle}>Select page</Text>
            <ScrollView style={s.pagePickerList}>
              {pages.map((_, index) => { const pageNumber=index+1; return <Pressable key={pageNumber} onPress={() => { setCurrent(pageNumber); setPagePickerOpen(false); }} style={[s.pagePickerOption, pageNumber===current && s.pagePickerOptionActive]}><Text style={[s.pagePickerOptionText, pageNumber===current && s.pagePickerOptionTextActive]}>Page {pageNumber}</Text></Pressable>; })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <View style={s.pageStage}>
        <ZoomableImage
          uri={uri}
          tiles={tiles}
          onGestureActiveChange={setZoomGestureActive}
          accessibilityLabel={page?.text ? `Application manual page ${current}: ${page.text.slice(0, 120)}` : `Application manual page ${current}`}
        />
        <PageArrow direction="left" disabled={current === 1} onPress={() => move(-1)} />
        <PageArrow direction="right" disabled={current === pages.length} onPress={() => move(1)} />
      </View>

      <View style={s.pageControls}>
        <Pressable disabled={current === 1} onPress={() => move(-1)} style={[s.navButton, current === 1 && s.navDisabled]}>
          <Text style={s.navButtonText}>← Previous</Text>
        </Pressable>
        <Text style={s.counter}>{current} / {pages.length}</Text>
        <Pressable disabled={current === pages.length} onPress={() => move(1)} style={[s.navButton, current === pages.length && s.navDisabled]}>
          <Text style={s.navButtonText}>Next →</Text>
        </Pressable>
      </View>

    </ScrollView>
  );
}

function ZoomableImage({ uri, tiles, accessibilityLabel, maxZoom = 4, onGestureActiveChange }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(1);
  const pinchStart = useRef(null);
  const pinchBase = useRef(1);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const translation = useRef({ x: 0, y: 0 });
  const [zoomLabel, setZoomLabel] = useState(100);

  const setZoom = (next) => {
    const value = Math.max(1, Math.min(maxZoom, next));
    scaleValue.current = value;
    scale.setValue(value);
    setZoomLabel(Math.round(value * 100));
    if (value === 1) {
      translation.current = { x: 0, y: 0 };
      translateX.setValue(0);
      translateY.setValue(0);
    }
  };
  const resetZoom = () => setZoom(1);

  useEffect(resetZoom, [uri]);

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length > 1,
    onMoveShouldSetPanResponderCapture: (event, gesture) => event.nativeEvent.touches.length > 1 || (scaleValue.current > 1 && (Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8)),
    onMoveShouldSetPanResponder: (event, gesture) => event.nativeEvent.touches.length > 1 || (scaleValue.current > 1 && (Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8)),
    onPanResponderGrant: (event) => {
      onGestureActiveChange?.(true);
      const touches = event.nativeEvent.touches;
      if (touches.length > 1) {
        pinchStart.current = touchDistance(touches);
        pinchBase.current = scaleValue.current;
      } else if (touches[0]) {
        panStart.current = { x: touches[0].pageX, y: touches[0].pageY, tx: translation.current.x, ty: translation.current.y };
      }
    },
    onPanResponderMove: (event) => {
      const touches = event.nativeEvent.touches;
      if (touches.length > 1) {
        const distance = touchDistance(touches);
        if (!pinchStart.current) {
          pinchStart.current = distance;
          pinchBase.current = scaleValue.current;
        }
        const next = Math.max(1, Math.min(maxZoom, pinchBase.current * distance / pinchStart.current));
        scaleValue.current = next;
        scale.setValue(next);
      } else if (touches[0] && scaleValue.current > 1) {
        const x = panStart.current.tx + touches[0].pageX - panStart.current.x;
        const y = panStart.current.ty + touches[0].pageY - panStart.current.y;
        translation.current = { x, y };
        translateX.setValue(x);
        translateY.setValue(y);
      }
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: () => { pinchStart.current = null; setZoomLabel(Math.round(scaleValue.current * 100)); onGestureActiveChange?.(false); },
    onPanResponderTerminate: () => { pinchStart.current = null; setZoomLabel(Math.round(scaleValue.current * 100)); onGestureActiveChange?.(false); },
  })).current;

  return (
    <View style={s.zoomLayer} {...responder.panHandlers}>
      <Animated.View
        style={[s.pageImage, { transform: [{ translateX }, { translateY }, { scale }] }]}
        renderToHardwareTextureAndroid
        accessibilityLabel={accessibilityLabel}
      >
        {tiles ? tiles.map((tile) => (
          <Image
            key={tile.uri}
            source={{ uri: tile.uri }}
            style={[s.imageTile, {
              left: `${tile.x * 100 / (tile.cols || 4)}%`,
              top: `${tile.y * 100 / (tile.rows || 3)}%`,
              width: `${100.08 / (tile.cols || 4)}%`,
              height: `${100.08 / (tile.rows || 3)}%`,
            }]}
            resizeMode="stretch"
            resizeMethod="none"
            progressiveRenderingEnabled={false}
          />
        )) : (
          <Image source={{ uri }} style={s.singlePageImage} resizeMode="contain" resizeMethod="none" progressiveRenderingEnabled={false} />
        )}
      </Animated.View>
      <View style={s.zoomControls}>
        <Pressable accessibilityLabel="Zoom out" onPress={() => setZoom(scaleValue.current - 0.25)} style={s.zoomButton}><Text style={s.zoomButtonText}>−</Text></Pressable>
        <View style={s.zoomValue}><Text style={s.zoomValueText}>{zoomLabel}%</Text></View>
        <Pressable accessibilityLabel="Zoom in" onPress={() => setZoom(scaleValue.current + 0.25)} style={s.zoomButton}><Text style={s.zoomButtonText}>+</Text></Pressable>
        <Pressable accessibilityLabel="Reset zoom and position" onPress={resetZoom} style={[s.zoomButton, s.zoomResetButton]}><Text style={s.zoomResetText}>↺</Text></Pressable>
      </View>
    </View>
  );
}

function touchDistance(touches) {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function PageArrow({ direction, disabled, onPress }) {
  if (disabled) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === "left" ? "Previous manual page" : "Next manual page"}
      onPress={onPress}
      style={({ pressed }) => [s.pageArrow, direction === "left" ? s.arrowLeft : s.arrowRight, pressed && s.arrowPressed]}
    >
      <Text style={s.pageArrowText}>{direction === "left" ? "‹" : "›"}</Text>
    </Pressable>
  );
}

function AttachmentView() {
  const tiles = Array.from({ length: 12 }, (_, index) => ({
    x: index % 4,
    y: Math.floor(index / 4),
    cols: 4,
    rows: 3,
    uri: `${IMG_BASE}/manuals/attachment/tiles/sheet-${Math.floor(index / 4)}-${index % 4}.png?v=600zoom`,
  }));
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.cadtools}>
        <View style={s.manualHead}>
          <View style={s.sectionCopy}>
            <View style={s.sectionTitleRow}><Text style={s.sectionNumber}>02</Text><Text style={s.cadTitle}>Standard Attachment Details</Text></View>
            <Text style={s.cadHint}>Typical fixing details for concrete floor, concrete wall, steel column and masonry wall substrates. Confirm every fixing against the acting standard and existing structure.</Text>
          </View>
        </View>
      </View>
      <View style={[s.manualToolbar, s.attachmentToolbar]}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Download standard attachment details PDF"
          onPress={() => Linking.openURL(`${IMG_BASE}/manuals/attachment/standard-attachment-details.pdf`)}
          style={s.pdfButton}
        >
          <Text style={s.pdfButtonText}>Download PDF</Text>
        </Pressable>
        <Text style={s.toolbarCount}>Pinch to zoom · drag to pan</Text>
      </View>
      <View style={s.attachmentStage}>
        <ZoomableImage tiles={tiles} maxZoom={6} accessibilityLabel="Standard attachment details drawing" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  docsTitle: { ...PAGE_TITLE, marginBottom: 10 },
  manualPane: { flex: 1 },
  manualPaneContent: { paddingHorizontal: 14, paddingBottom: 28 },
  manualHead: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 14, paddingBottom: 10 },
  sectionCopy: { flex: 1 },
  sectionTitleRow: { flexDirection: "row", alignItems: "baseline", gap: 9 },
  sectionNumber: { fontFamily: FB[700], fontSize: 10, color: C.red },
  h2: { fontFamily: FD[900], fontSize: 19, letterSpacing: -0.4, color: C.ink },
  intro: { fontFamily: FB[400], fontSize: 12, lineHeight: 18, color: "#555b68", textAlign: "left", borderLeftColor: C.red, borderLeftWidth: 2, paddingLeft: 10, paddingVertical: 3, marginTop: 9 },
  pageMeta: { fontFamily: FB[400], fontSize: 10.5, color: C.inkFaint, marginTop: 6 },
  manualToolbar: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", gap:8, padding:8, marginBottom:8, backgroundColor:C.surface2, borderColor:C.line, borderWidth:1 },
  attachmentToolbar: { marginHorizontal:14 },
  manualToolbarLeft: { flexDirection:"row", alignItems:"center", gap:8 },
  pageSelect: { minWidth:82, height:34, flexDirection:"row", alignItems:"center", justifyContent:"space-between", gap:8, borderColor:C.lineStrong, borderWidth:1, backgroundColor:C.surface, paddingHorizontal:10 },
  pageSelectText: { fontFamily:FD[800], fontSize:10.5, color:C.ink },
  pageSelectChevron: { fontFamily:FB[700], fontSize:16, color:C.ink, marginTop:-4 },
  pdfButton: { height:34, justifyContent:"center", borderColor:C.lineStrong, borderWidth:1, backgroundColor:C.surface, paddingHorizontal:12 },
  pdfButtonText: { fontFamily: FD[800], fontSize: 10.5, color: C.ink },
  toolbarCount: { fontFamily:FB[700], fontSize:10, color:C.inkSoft },
  pickerBackdrop: { flex:1, backgroundColor:"rgba(20,25,34,.55)", alignItems:"center", justifyContent:"center", padding:24 },
  pagePickerCard: { width:"100%", maxWidth:320, maxHeight:"72%", backgroundColor:C.surface, borderTopColor:C.red, borderTopWidth:3, padding:12 },
  pagePickerTitle: { fontFamily:FD[900], fontSize:15, color:C.ink, marginBottom:8 },
  pagePickerList: { borderColor:C.line, borderWidth:1 },
  pagePickerOption: { paddingHorizontal:12, paddingVertical:11, borderBottomColor:C.line, borderBottomWidth:1 },
  pagePickerOptionActive: { backgroundColor:C.red },
  pagePickerOptionText: { fontFamily:FB[600], fontSize:12, color:C.ink },
  pagePickerOptionTextActive: { color:"#fff", fontFamily:FB[700] },
  pageStage: { width: "100%", aspectRatio: 210 / 297, alignSelf: "center", position: "relative", alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: "#e7e9ec", borderColor: C.line, borderWidth: 1 },
  zoomLayer: { width: "100%", height: "100%", position: "relative", overflow: "hidden" },
  pageImage: { width: "100%", height: "100%", backgroundColor: "#fff" },
  singlePageImage: { width:"100%", height:"100%" },
  imageTile: { position:"absolute", width:"25.05%", height:"33.38%" },
  zoomControls: { position: "absolute", left: 10, right: 10, bottom: 8, flexDirection: "row", justifyContent: "center", alignItems: "center", pointerEvents: "box-none" },
  zoomButton: { width: 38, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.94)", borderColor: C.lineStrong, borderWidth: 1 },
  zoomButtonText: { fontFamily: FB[600], fontSize: 22, lineHeight: 24, color: C.ink },
  zoomValue: { minWidth: 58, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.94)", borderTopColor: C.lineStrong, borderBottomColor: C.lineStrong, borderTopWidth: 1, borderBottomWidth: 1 },
  zoomValueText: { fontFamily: FD[800], fontSize: 11, color: C.inkSoft },
  zoomResetButton: { borderLeftWidth: 0 },
  zoomResetText: { fontFamily: FB[600], fontSize: 19, lineHeight: 21, color: C.ink },
  pageArrow: { position: "absolute", top: "50%", width: 42, height: 54, marginTop: -27, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.9)", borderColor: "rgba(20,25,34,.22)", borderWidth: 1, borderRadius: 4 },
  arrowLeft: { left: 8 },
  arrowRight: { right: 8 },
  arrowPressed: { backgroundColor: "#fff", transform: [{ scale: 0.93 }] },
  pageArrowText: { fontFamily: FB[400], fontSize: 38, lineHeight: 42, color: C.ink },
  pageControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 9 },
  navButton: { minWidth: 104, alignItems: "center", backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 10 },
  navDisabled: { opacity: 0.35 },
  navButtonText: { fontFamily: FD[800], fontSize: 11, color: C.ink },
  counter: { fontFamily: FD[800], fontSize: 11, color: C.inkFaint },
  cadtools: { paddingHorizontal: 14, paddingTop: 0, paddingBottom: 0, backgroundColor: C.bg },
  cadTitle: { fontFamily: FD[900], fontSize: 19, letterSpacing: -0.4, color: C.ink },
  cadHint: { fontFamily: FB[400], fontSize: 12, lineHeight: 18, color: "#555b68", marginTop: 9, paddingLeft: 10, paddingVertical: 3, borderLeftColor: C.red, borderLeftWidth: 2, textAlign: "left" },
  attachmentStage: { flex: 1, position: "relative", overflow: "hidden", marginHorizontal: 14, marginBottom: 10, backgroundColor: "#e7e9ec", borderColor: C.line, borderWidth: 1 },
});
