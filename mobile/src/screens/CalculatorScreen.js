import { useEffect, useRef, useState } from "react";
import { ScrollView, View, Text, TextInput, Switch, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Keyboard, LayoutAnimation, findNodeHandle } from "react-native";
import { C, FD, FB, PAGE_TITLE } from "../theme";
import { Segmented, Chips, Field, SectionTitle, Card, Btn } from "../components/ui";
import { useAuth } from "../auth";
import { api } from "../api";
import * as L from "../lib/loads";
import AttachmentDiagram from "../components/AttachmentDiagram";
import SideElevationDiagram from "../components/SideElevationDiagram";
import * as SecureStore from "expo-secure-store";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { buildProjectPdfPages } from "../lib/projectPdf";
import { PDFDocument } from "pdf-lib";

const CALCULATOR_DRAFT_KEY = "walltopia-calculator-draft-v1";

const lenChip = (units) => (v) => (units === "EU" ? String(v) : String(Math.round(v * 3.28084)));

function zLevels(data, s) {
  if (s.type === "wall") {
    const w = data.walls[L.wallKey(s.height, s.levels)];
    if (w && w.lhEU) return Object.keys(w.lhEU).sort((a, b) => Number(a) - Number(b)).map((k) => w.lhEU[k]);
  }
  return [s.height];
}

export default function CalculatorScreen({ data, initialProject, onProjectChange, onExit, requireLogin, scrollToTopRequest = 0 }) {
  const { user } = useAuth();
  const [s, setS] = useState(() =>
    L.clampState(data, initialProject
      ? { ...L.initialState(), ...initialProject.input, cap: initialProject.input?.capacity ?? null }
      : L.initialState()));
  const [project, setProject] = useState(initialProject || null);
  const [resultView, setResultView] = useState("results");
  const [step, setStep] = useState(initialProject ? "results" : "inputs");
  const [diagramGestureActive, setDiagramGestureActive] = useState(false);
  const draftReady = useRef(Boolean(initialProject));
  const calculatorScroll = useRef(null);

  useEffect(() => {
    if (initialProject) return;
    let active = true;
    SecureStore.getItemAsync(CALCULATOR_DRAFT_KEY).then((raw) => {
      if (!active || !raw) return;
      const draft = JSON.parse(raw);
      if (draft && typeof draft === "object") setS(L.clampState(data, { ...L.initialState(), ...draft }));
    }).catch(() => {}).finally(() => { draftReady.current = true; });
    return () => { active = false; };
  }, [data, initialProject]);

  useEffect(() => {
    if (!draftReady.current) return;
    SecureStore.setItemAsync(CALCULATOR_DRAFT_KEY, JSON.stringify(currentInput(s))).catch(() => {});
  }, [s]);

  useEffect(() => {
    if (!scrollToTopRequest) return;
    Keyboard.dismiss();
    calculatorScroll.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopRequest]);

  useEffect(() => {
    const animate = (event) => {
      if (Keyboard.scheduleLayoutAnimation && event?.duration) Keyboard.scheduleLayoutAnimation(event);
      else LayoutAnimation.configureNext({ duration:220, update:{ type:LayoutAnimation.Types.easeInEaseOut } });
    };
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, animate);
    const hide = Keyboard.addListener(hideEvent, animate);
    return () => { show.remove(); hide.remove(); };
  }, []);

  const um = L.unitMeta(data, s.units);
  const opt = L.optionsFor(data, s);
  const update = (patch) => setS((p) => L.clampState(data, { ...p, ...patch }));
  const setUnits = (v) => setS((p) => L.clampState(data, { ...p, units: v, cap: v !== p.units ? null : p.cap }));
  const unitLbl = s.units === "EU" ? "m" : "ft";

  const have = L.hasResult(data, s);
  const gov = L.govColumnLoad(data, s);
  const vd = L.verdict(data, s);
  const rows = L.pointRows(data, s);
  const forceLevels = L.forceLevels(data, s);
  const summary = `${L.fmtLen(s.height, s.units)} · ${s.type === "wall" ? s.levels + "-lvl" : "boulder"} · A ${L.fmtLen(s.span, s.units)} · X ${L.fmtLen(s.overhang, s.units)}`;

  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={12}>
      <ScrollView ref={calculatorScroll} style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets scrollEnabled={!diagramGestureActive}>
        {step === "inputs" ? (
          <Card style={{ borderTopColor: C.red, borderTopWidth: 3 }}>
            <Text style={st.stepKicker}>Calculation inputs</Text>
            <Text style={st.inputTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>Preliminary Loads Calculator</Text>
            <Text style={st.inputIntro}>Enter the climbing-wall geometry and supporting-structure parameters to calculate preliminary attachment and column loads.</Text>
            <View style={st.inputNotice}><Text style={st.inputNoticeText}>The results are intended for preliminary assessment only and must be verified by the responsible structural engineer.</Text></View>
            <InputFields s={s} opt={opt} um={um} unitLbl={unitLbl} forceLevels={forceLevels} update={update} setUnits={setUnits} onCheck={() => {
              Keyboard.dismiss();
              setResultView("results");
              setStep("results");
              requestAnimationFrame(() => requestAnimationFrame(() => calculatorScroll.current?.scrollTo({ y:0, animated:true })));
            }} onCapacityFocus={(target)=>requestAnimationFrame(()=>{const node=findNodeHandle(target);const responder=calculatorScroll.current?.getScrollResponder?.();if(node&&responder)responder.scrollResponderScrollNativeHandleToKeyboard(node,12,true);})} />
          </Card>
        ) : (<>
        <Pressable onPress={() => setStep("inputs")} style={st.optionsBar}>
          <Text style={st.optionsIcon}>←</Text>
          <Text style={st.optionsLabel}>Edit inputs</Text>
          <Text style={st.optionsSummary} numberOfLines={1}>{summary}</Text>
        </Pressable>
        <Card style={{ borderTopColor: C.red, borderTopWidth: 3 }}>
          {!have ? (
            <Text style={{ color: C.inkFaint, textAlign: "center", paddingVertical: 40, fontFamily: FB[400] }}>No table entry for this combination.</Text>
          ) : (
            <>
              <Text style={st.title}>{L.titleFor(s)}</Text>
              <Text style={st.sub}>
                {(s.type === "wall" ? s.levels + (s.levels === 1 ? " attachment level" : " attachment levels") : "single attachment")}
                {` · A = ${L.fmtLen(s.span, s.units)} · X = ${L.fmtLen(s.overhang, s.units)} · ${um.force}${s.factored ? " · factored" : ""}`}
              </Text>

              <View style={[st.verdict, vd === "ok" ? st.vOk : vd === "bad" ? st.vBad : st.vNeutral]}>
                <Text style={[st.verdictTitle, { color: vd === "ok" ? C.ok : vd === "bad" ? C.bad : C.inkSoft }]}>
                  {vd === "neutral" ? "Governing column load" : vd === "ok" ? "✓ Applicable" : "✕ Exceeds capacity"}
                </Text>
                <Text style={[st.verdictResult, { color: vd === "ok" ? C.ok : vd === "bad" ? C.bad : C.ink }]}><Text style={st.verdictValue}>{L.fmtForce(gov, s.units)} {um.force}</Text>
                  <Text style={st.verdictResult}>{vd === "neutral" ? "  (factored)" : ` required vs ${L.fmtForce(s.cap, s.units)} ${um.force} capacity`}</Text>
                </Text>
              </View>

              {s.type === "wall" && forceLevels.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={st.forceLab}>Force level — attachment level taken at its maximum live load</Text>
                  <Chips small values={forceLevels.map((f) => f.lvl)} value={s.force} onChange={(v) => update({ force: v })}
                    label={(lvl) => { const f = forceLevels.find((x) => x.lvl === lvl); return "L" + lvl + (f && f.height ? " · " + L.fmtLen(f.height, s.units) : ""); }} />
                </View>
              )}

              <View style={st.resultTabs}>
                <Segmented
                  value={resultView}
                  onChange={setResultView}
                  options={[
                    { label: "Results", value: "results" },
                    { label: "2D Schematic", value: "diagram" },
                  ]}
                />
              </View>

              {resultView === "results" ? (
                <View>
                  <PointTable rows={rows} s={s} um={um} />
                  <CoordinateSymbols />
                  <View style={st.loadDiagramSection}>
                    <SideElevationDiagram state={s} rows={rows} heights={zLevels(data, s)} maxOverhang={Math.max(...opt.overhangs, 1)} unitMeta={um} onGestureActiveChange={setDiagramGestureActive} />
                  </View>
                  <MobileNotes s={s} um={um} />
                </View>
              ) : null}
              {resultView === "diagram" ? (
                <View>
                  <AttachmentDiagram structureType={s.type} span={s.span} overhang={s.overhang} height={s.height} zValues={zLevels(data, s)}
                    levelForces={rows.slice(s.type === "boulder" ? 1 : 2).map((r) => L.factored(r.lLL ?? r.rLL, "ll", s, um))} forceUnit={um.force}
                    initialBaseDetail={s.baseDetail || "CF-01"} initialLevelDetail={s.levelDetail || "CW-01"}
                    onSelectionChange={(selection) => setS((previous) => previous.baseDetail === selection.baseDetail && previous.levelDetail === selection.levelDetail ? previous : { ...previous, ...selection })} />
                </View>
              ) : null}
            </>
          )}
          <ProjectBar data={data} state={s} user={user} project={project} requireLogin={requireLogin}
            onSaved={(p) => { setProject(p); onProjectChange && onProjectChange(p); }}
            onExit={() => { setProject(null); onExit && onExit(); }} />
        </Card>
        </>)}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InputFields({ s, opt, um, unitLbl, forceLevels, update, setUnits, onCheck, onCapacityFocus }) {
  const capacityInput=useRef(null);
  const factoredControl=useRef(null);
  return <View style={{ marginTop: 20 }}>
    <Field label="Units"><Segmented value={s.units} onChange={setUnits} options={[{ label:"Metric (kN·m)",value:"EU" },{ label:"Imperial (lb·ft)",value:"USA" }]} /></Field>
    <Field label="Structure type" hint={s.type === "wall" ? "with protection points" : "without protection points"}><Segmented value={s.type} onChange={(v)=>update({type:v})} options={[{label:"Climbing wall",value:"wall"},{label:"Boulder wall",value:"boulder"}]} /></Field>
    <Field label="Climbing-surface height" hint={`(${unitLbl})`}><Chips values={opt.heights} value={s.height} onChange={(v)=>update({height:v})} label={lenChip(s.units)} /></Field>
    {s.type === "wall" ? <Field label="Attachment scheme" hint="(levels of attachment by height)"><Chips small values={opt.schemes} value={s.levels} onChange={(v)=>update({levels:v})} label={(v)=>v+(v===1?" level":" levels")} /></Field> : null}
    <Field label="Column span · A" hint={`(${unitLbl}, between building columns)`}><Chips values={opt.spans} value={s.span} onChange={(v)=>update({span:v})} label={lenChip(s.units)} /></Field>
    <Field label="Overhang · X" hint={`(${unitLbl}, top − bottom contour)`}><Chips values={opt.overhangs} value={s.overhang} onChange={(v)=>update({overhang:v})} label={lenChip(s.units)} /></Field>
    {s.type === "wall" && forceLevels.length > 0 ? <Field label="Live load force level" hint="(attachment level taken at its MAX live load)"><Chips small values={forceLevels.map((f)=>f.lvl)} value={s.force} onChange={(v)=>update({force:v})} label={(lvl)=>{const level=forceLevels.find((f)=>f.lvl===lvl);return `Z${lvl}${level&&level.height?` · ${L.fmtLen(level.height,s.units)}`:""}`;}} /></Field> : null}
    <View style={{ height:1, backgroundColor:C.line, marginVertical:6 }} />
    <Field label="Check against your structure" hint="(optional)"><View style={{flexDirection:"row"}}><TextInput ref={capacityInput} style={st.capInput} keyboardType="numeric" placeholder="allowable column load" value={s.cap==null?"":String(s.cap)} onFocus={()=>onCapacityFocus(factoredControl.current||capacityInput.current)} onChangeText={(t)=>update({cap:t===""?null:Number(t)})}/><View style={st.capUnit}><Text style={{color:"#fff",fontFamily:FD[700]}}>{um.force}</Text></View></View></Field>
    <Btn title="Check capacity" variant="primary" onPress={onCheck} />
    <Text style={st.capacityHint}>Horizontal load one existing column / frame can carry.</Text>
    <View ref={factoredControl} collapsable={false} style={{ flexDirection:"row",alignItems:"center",gap:10 }}><Switch value={s.factored} onValueChange={(v)=>update({factored:v})} trackColor={{true:C.red}}/><Text style={{ color:C.inkSoft,fontSize:13,fontFamily:FB[400],flex:1 }}>Show factored design values (×{um.dl} DL, ×{um.ll} LL)</Text></View>
  </View>;
}

function MobileNotes({ s, um }) {
  const code = s.type === "wall" ? um.codeWall : um.codeBoulder;
  const notes = [
    `Coefficient for dead load = ${um.dl}.`,
    `Coefficient for live load = ${um.ll}.`,
    `All loads are characteristic values and are expressed in ${um.force}. Refer to the positive directions of the coordinate system when interpreting their signs.`,
    "The application manual is an inseparable part of the load tables. For additional information, consult Walltopia.",
    `Used code: ${code}.`,
  ];
  return (
    <View style={st.notes}>
      <Text style={st.notesTitle}>Notes</Text>
      <View style={st.preliminaryBanner}>
        <View style={st.preliminaryIcon}><Text style={st.preliminaryIconText}>!</Text></View>
        <Text style={st.preliminaryText}>Preliminary loads — NOT for construction.</Text>
      </View>
      {notes.map((text, index) => (
        <View key={text} style={st.noteRow}>
          <Text style={st.noteNumber}>{index + 1}.</Text>
          <Text style={st.noteText}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

function CoordinateSymbols() {
  const items = [
    ["R", "Load on one axis of the ACS — base points and single-axis attachment points."],
    ["L", "Load on a building column / frame, with the column span A taken into account. Focus on these for the existing structure."],
    ["DL / LL", "Dead load / Live load (climber load per EN 12572)."],
    ["Z0 / Z1 / Z2 / Z3", "Vertical component at the base (Z0). Vertical distance from the base to attachment level 1 (Z1), and between consecutive attachment levels (Z2, Z3)."],
    ["X0 / X1 / X2 / X3", "Horizontal component at the base (X0) and at attachment level 1, 2, 3."],
  ];
  return (
    <View style={st.symbols}>
      <Text style={st.symbolsTitle}>Coordinate system &amp; symbols</Text>
      {items.map(([symbol, description]) => (
        <View key={symbol} style={st.symbolRow}>
          <Text style={st.symbolTerm}>{symbol}</Text>
          <Text style={st.symbolDescription}>{description}</Text>
        </View>
      ))}
    </View>
  );
}

function PointTable({ rows, s, um }) {
  const cell = (v, kind, color) => {
    const val = v == null ? "–" : L.fmtForce(L.factored(v, kind, s, um), s.units);
    return <Text style={[st.cell, { color: v == null ? C.inkFaint : color }]}>{val}</Text>;
  };
  return (
    <View style={{ marginTop: 6 }}>
      <View style={[st.trow, { borderBottomColor: C.navy, borderBottomWidth: 2 }]}>
        <Text style={[st.hPt]}>Point</Text>
        <Text style={[st.hCell, { color: C.dl }]}>R·DL</Text>
        <Text style={[st.hCell, { color: C.ll }]}>R·LL</Text>
        <Text style={[st.hCell, { color: C.dl }]}>L·DL</Text>
        <Text style={[st.hCell, { color: C.ll }]}>L·LL</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={st.trow}>
          <Text style={st.ptCell}>{r.label}</Text>
          {cell(r.rDL, "DL", C.dl)}
          {cell(r.rLL, "LL", C.ll)}
          {cell(r.lDL, "DL", C.dl)}
          {cell(r.lLL, "LL", C.ll)}
        </View>
      ))}
    </View>
  );
}

const currentInput = (s) => ({ units: s.units, type: s.type, height: s.height, levels: s.levels, overhang: s.overhang, span: s.span, force: s.force, factored: s.factored, capacity: s.cap, baseDetail: s.baseDetail || "CF-01", levelDetail: s.levelDetail || "CW-01" });

function ProjectBar({ data, state, user, project, onSaved, onExit, requireLogin }) {
  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [props, setProps] = useState([{ key: "", value: "" }]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!msg) return;
    const timer = setTimeout(() => setMsg(""), 3500);
    return () => clearTimeout(timer);
  }, [msg]);

  const openSave = (asNew) => {
    if (!user) { requireLogin(); return; }
    setName(project && !asNew ? project.name : L.titleFor(state));
    setTags(project && !asNew ? (project.tags || []).join(", ") : "");
    setProps(project && !asNew && project.properties?.length ? project.properties : [{ key: "", value: "" }]);
    setShowSave(asNew ? "saveas" : "save");
  };

  async function save() {
    if (!name.trim()) { setMsg("Enter a project name."); return; }
    setBusy(true); setMsg("");
    const payload = {
      name: name.trim(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6),
      properties: props.filter((p) => p.key.trim()).map((p) => ({ key: p.key.trim(), value: p.value.trim() })),
      input: currentInput(state), snapshot: L.snapshot(data, state),
    };
    try {
      const editing = project && showSave === "save";
      const res = editing ? await api.updateProject(project.id, payload) : await api.createProject(payload);
      setShowSave(false); onSaved(res.project);
    } catch (e) { setMsg(e.message || "Could not save."); }
    setBusy(false);
  }

  async function saveChanges() {
    if (!user || !project) return;
    setBusy(true);
    try {
      const res = await api.updateProject(project.id, { name: project.name, tags: project.tags, properties: project.properties, input: currentInput(state), snapshot: L.snapshot(data, state) });
      onSaved(res.project); setMsg("Updated.");
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  async function exportPdf() {
    if (!project || exporting) return;
    setExporting(true); setMsg("");
    try {
      const reportProject = { ...project, input: currentInput(state), snapshot: L.snapshot(data, state) };
      const pages = buildProjectPdfPages(reportProject, data);
      const portrait = await Print.printToFileAsync({ html: pages.portrait, width: 595.28, height: 841.89, base64: true });
      const landscape = await Print.printToFileAsync({ html: pages.landscape, width: 841.89, height: 595.28, base64: true });
      const merged = await PDFDocument.create();
      for (const source of [portrait, landscape]) {
        const document = await PDFDocument.load(source.base64);
        const copied = await merged.copyPages(document, [0]);
        copied.forEach((page) => merged.addPage(page));
      }
      const safeName = String(project.name || "Walltopia project").replace(/[\\/:*?"<>|]+/g, "-").trim();
      const fileUri = `${FileSystem.cacheDirectory}${safeName} - Preliminary Loads.pdf`;
      const pdfBase64 = await merged.saveAsBase64();
      await FileSystem.writeAsStringAsync(fileUri, pdfBase64, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: "application/pdf", dialogTitle: `Export ${project.name}` });
      else setMsg(`PDF created: ${fileUri}`);
    } catch (e) { setMsg("PDF export failed. Please try again."); }
    setExporting(false);
  }

  if (showSave) {
    return (
      <View style={{ marginTop: 18, backgroundColor: C.surface2, borderColor: C.line, borderWidth: 1, padding: 14 }}>
        <SectionTitle>{showSave === "saveas" ? "Save as new project" : project ? "Update project" : "Save project"}</SectionTitle>
        <Text style={st.saveLbl}>Project name</Text>
        <TextInput style={st.saveInput} value={name} onChangeText={setName} />
        <Text style={st.saveLbl}>Tags (comma separated · maximum 6)</Text>
        <TextInput style={st.saveInput} value={tags} onChangeText={setTags} placeholder="gym, EU, seismic zone 2" />
        <Text style={st.saveLbl}>Additional project information</Text>
        {props.map((p, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
            <TextInput style={[st.saveInput, { flex: 1, marginBottom: 0 }]} placeholder="Field name" value={p.key} onChangeText={(t) => setProps((a) => a.map((r, j) => (j === i ? { ...r, key: t } : r)))} />
            <TextInput style={[st.saveInput, { flex: 1.3, marginBottom: 0 }]} placeholder="Information" value={p.value} onChangeText={(t) => setProps((a) => a.map((r, j) => (j === i ? { ...r, value: t } : r)))} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove field ${i + 1}`} onPress={() => setProps((a) => a.filter((_, j) => j !== i))} style={st.removePropButton}>
              <Text style={st.removePropText}>×</Text>
            </Pressable>
          </View>
        ))}
        <Btn small title="+ Add field" onPress={() => setProps((a) => [...a, { key: "", value: "" }])} style={{ alignSelf: "flex-start", marginTop: 4 }} />
        {msg ? <Text style={{ color: C.bad, marginTop: 8, fontFamily: FB[400] }}>{msg}</Text> : null}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <Btn title={busy ? "Saving…" : "Save"} variant="primary" onPress={save} disabled={busy} style={{ flex: 1 }} />
          <Btn title="Cancel" onPress={() => setShowSave(false)} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 18, paddingTop: 14, borderTopColor: C.lineStrong, borderTopWidth: 1, borderStyle: "dashed" }}>
      {!user ? (
        <Btn small title="Save as project" variant="primary" onPress={() => requireLogin()} style={{ alignSelf:"flex-end" }} />
      ) : project ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <View style={st.editingFlag}><Text style={st.editingFlagText}>Editing · {project.name}</Text><Pressable accessibilityRole="button" accessibilityLabel="Exit editing" hitSlop={6} onPress={onExit} style={st.editingExit}><Text style={st.editingExitText}>×</Text></Pressable></View>
            <Btn small title="Save changes" variant="primary" onPress={saveChanges} disabled={busy} />
            <View style={st.projectMoreAnchor}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded:moreOpen }} onPress={() => { setMsg(""); setMoreOpen((value) => !value); }} style={st.projectMoreButton}>
                <Text style={st.projectMoreButtonText}>More</Text>
                <Text style={st.projectMoreArrow}>›</Text>
              </Pressable>
              {moreOpen ? <View style={st.projectMoreMenu}>
                <Pressable onPress={() => { setMoreOpen(false); openSave(false); }} style={st.projectMoreItem}><Text style={st.projectMoreText}>Edit details</Text></Pressable>
                <Pressable onPress={() => { setMoreOpen(false); openSave(true); }} style={st.projectMoreItem}><Text style={st.projectMoreText}>Save as new</Text></Pressable>
                <Pressable disabled={exporting} onPress={() => { setMoreOpen(false); exportPdf(); }} style={st.projectMoreItem}><Text style={[st.projectMoreText, exporting && { opacity:.55 }]}>{exporting ? "Preparing PDF…" : "Export PDF"}</Text></Pressable>
              </View> : null}
            </View>
          </View>
          {msg ? <Text style={{ color: C.ok, marginTop: 6, fontFamily: FB[400] }}>{msg}</Text> : null}
        </>
      ) : (
        <Btn small title="Save as project" variant="primary" onPress={() => openSave(false)} style={{ alignSelf:"flex-end" }} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  stepKicker: { color:C.red, fontFamily:FD[800], fontSize:10, textTransform:"uppercase", letterSpacing:.7 },
  inputTitle: { color:C.ink, fontFamily:FD[900], fontSize:23, marginTop:5 },
  capacityHint: { marginTop:6, marginBottom:16, color:C.inkFaint, fontFamily:FB[400], fontSize:11.5, lineHeight:16 },
  inputIntro: { color:C.inkSoft, fontFamily:FB[400], fontSize:12.5, lineHeight:18, marginTop:5, textAlign:"justify" },
  inputNotice: { backgroundColor:C.surface2, borderLeftColor:C.red, borderLeftWidth:3, paddingHorizontal:11, paddingVertical:9, marginTop:12 },
  inputNoticeText: { color:C.inkSoft, fontFamily:FB[600], fontSize:11.5, lineHeight:17, textAlign:"justify" },
  title: { ...PAGE_TITLE },
  sub: { fontSize: 12, fontFamily: FB[400], color: C.inkFaint, marginTop: 4, marginBottom: 12 },
  verdict: { padding: 12, borderLeftWidth: 4, marginBottom: 16 },
  verdictTitle: { fontFamily: FB[600], fontSize: 13, lineHeight: 18 },
  verdictResult: { fontFamily: FB[600], fontSize: 13, lineHeight: 18 },
  verdictValue: { fontFamily: FB[700] },
  vOk: { backgroundColor: C.okSoft, borderLeftColor: C.ok },
  vBad: { backgroundColor: C.badSoft, borderLeftColor: C.red },
  vNeutral: { backgroundColor: C.surface2, borderLeftColor: C.navy },
  forceLab: { fontSize: 11, fontFamily: FD[800], textTransform: "uppercase", letterSpacing: 0.6, color: C.inkFaint, marginBottom: 8 },
  resultTabs: { marginTop: 6, marginBottom: 10 },
  loadDiagramSection: { marginTop: 22, paddingTop: 16, borderTopColor: C.navy, borderTopWidth: 1 },
  loadDiagramKicker: { color:C.red, fontFamily:FD[800], fontSize:9.5, textTransform:"uppercase", letterSpacing:.7 },
  loadDiagramTitle: { color:C.ink, fontFamily:FD[900], fontSize:17, marginTop:4 },
  loadDiagramHint: { color:C.inkFaint, fontFamily:FB[400], fontSize:11.5, lineHeight:16, marginTop:4 },
  trow: { flexDirection: "row", alignItems: "center", borderBottomColor: C.line, borderBottomWidth: 1, paddingVertical: 9 },
  hPt: { flex: 2.4, fontSize: 10.5, fontFamily: FD[800], textTransform: "uppercase", color: C.inkFaint },
  hCell: { flex: 1, fontSize: 10.5, fontFamily: FD[800], textAlign: "right" },
  ptCell: { flex: 2.4, fontSize: 12.5, fontFamily: FB[700], color: C.ink },
  cell: { flex: 1, fontSize: 12.5, fontFamily: FB[400], textAlign: "right", fontVariant: ["tabular-nums"] },
  legend: { fontSize: 11.5, fontFamily: FB[400], color: C.inkFaint, marginTop: 12, lineHeight: 16, textAlign:"justify" },
  symbols: { marginTop: 18, paddingTop: 14, borderTopColor: C.lineStrong, borderTopWidth: 1 },
  symbolsTitle: { fontFamily: FD[800], fontSize: 11, textTransform:"uppercase", letterSpacing:.6, color:C.ink, marginBottom:8 },
  symbolRow: { marginTop: 7 },
  symbolTerm: { color:C.red, fontFamily:FB[700], fontSize:12 },
  symbolDescription: { color:C.inkSoft, fontFamily:FB[400], fontSize:12, lineHeight:17, marginTop:2, textAlign:"justify" },
  notes: { marginTop: 18, borderTopColor: C.lineStrong, borderTopWidth: 1, paddingTop: 14 },
  notesTitle: { fontFamily: FD[800], fontSize: 10, textTransform:"uppercase", letterSpacing:.7, color: C.inkFaint, marginBottom: 8 },
  preliminaryBanner: { flexDirection:"row", alignItems:"center", gap:12, backgroundColor: C.navy, borderLeftColor:C.red, borderLeftWidth:3, paddingHorizontal:14, paddingVertical:13, marginBottom: 14 },
  preliminaryIcon: { width:26, height:26, borderRadius:13, borderColor:C.red, borderWidth:1.5, alignItems:"center", justifyContent:"center" },
  preliminaryIconText: { color:C.red, fontFamily:FB[700], fontSize:15, lineHeight:17 },
  preliminaryText: { flex:1, color: "#fff", fontFamily: FB[700], fontSize: 12.5 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  noteNumber: { width: 22, fontFamily: FB[700], fontSize: 12.5, color: C.red },
  noteText: { flex: 1, fontFamily: FB[400], fontSize: 12.5, lineHeight: 18, color: C.inkSoft, textAlign:"justify" },
  notesFoot: { marginTop: 4, fontFamily: FB[400], fontSize: 11, color: C.inkFaint },
  capInput: { flex: 1, borderWidth: 1, borderColor: C.lineStrong, paddingHorizontal: 11, paddingVertical: 10, fontSize: 14, fontFamily: FB[400] },
  capUnit: { backgroundColor: C.navy, paddingHorizontal: 13, justifyContent: "center" },
  optionsBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.navy, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  optionsIcon: { color: "#fff", fontSize: 16 },
  optionsLabel: { color: "#fff", fontFamily: FD[800], fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5 },
  optionsSummary: { color: "#aab2c4", fontFamily: FB[600], fontSize: 12.5, flex: 1, textAlign: "right" },
  drawer: { position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: C.surface, borderRightColor: C.lineStrong, borderRightWidth: 1, elevation: 16, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 2, height: 0 } },
  drawerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.navy, borderTopColor: C.red, borderTopWidth: 4, paddingHorizontal: 16, paddingVertical: 14 },
  drawerTitle: { color: "#fff", fontFamily: FD[900], fontSize: 16, letterSpacing: 0.2 },
  drawerClose: { color: "#c3c8d6", fontSize: 18, fontFamily: FD[700] },
  saveLbl: { fontSize: 11.5, fontFamily: FB[700], textTransform: "uppercase", letterSpacing: 0.4, color: C.inkSoft, marginBottom: 6, marginTop: 4 },
  saveInput: { borderWidth: 1, borderColor: C.lineStrong, backgroundColor: "#fff", paddingHorizontal: 11, paddingVertical: 9, fontSize: 14, marginBottom: 10, fontFamily: FB[400] },
  removePropButton: { width: 38, minHeight: 38, alignItems: "center", justifyContent: "center", borderColor: C.lineStrong, borderWidth: 1, backgroundColor: C.surface },
  removePropText: { color: C.inkSoft, fontFamily: FB[400], fontSize: 22, lineHeight: 24 },
  projectMoreAnchor: { position:"relative", zIndex:30 },
  projectMoreButton: { height:34, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:7, paddingHorizontal:12, borderColor:C.lineStrong, borderWidth:1, backgroundColor:C.surface },
  projectMoreButtonText: { color:C.ink, fontFamily:FD[800], fontSize:12, textTransform:"uppercase", letterSpacing:.4 },
  projectMoreArrow: { color:"#000", fontFamily:FB[400], fontSize:19, lineHeight:20 },
  projectMoreMenu: { position:"absolute", left:"100%", bottom:0, width:100, marginLeft:5, borderColor:C.lineStrong, borderWidth:1, backgroundColor:C.surface, shadowColor:"#000", shadowOpacity:.14, shadowRadius:6, shadowOffset:{width:2,height:0}, elevation:8 },
  projectMoreItem: { paddingHorizontal:9, paddingVertical:10, borderBottomColor:C.line, borderBottomWidth:1 },
  projectMoreText: { color:C.ink, fontFamily:FD[800], fontSize:10.5, textTransform:"uppercase", letterSpacing:.35 },
  editingFlag: { height:34, flexDirection:"row", alignItems:"center", backgroundColor:C.navy, paddingLeft:9, borderRightWidth:1, borderRightColor:C.navy },
  editingFlagText: { color:"#fff", fontFamily:FD[800], fontSize:10.5, textTransform:"uppercase", paddingVertical:7 },
  editingExit: { width:30, alignSelf:"stretch", marginLeft:7, alignItems:"center", justifyContent:"center", borderLeftColor:"rgba(255,255,255,.22)", borderLeftWidth:1 },
  editingExitText: { color:"#fff", fontFamily:FB[400], fontSize:20, lineHeight:21 },
});
