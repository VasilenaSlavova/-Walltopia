import { useEffect, useRef, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, Alert, StyleSheet } from "react-native";
import { C, FD, FB, PAGE_TITLE } from "../theme";
import { Btn, Chips, Card } from "../components/ui";
import { useAuth } from "../auth";
import { api } from "../api";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { buildProjectPdfPages } from "../lib/projectPdf";
import { createZip, bytesToBase64 } from "../lib/zip";
import * as FileSystem from "expo-file-system/legacy";
import { PDFDocument } from "pdf-lib";

export default function DashboardScreen({ data, onOpen, onSupport, requireLogin, scrollToTopRequest = 0 }) {
  const { user, ready } = useAuth();
  const [projects, setProjects] = useState([]);
  const [hasAnyProjects, setHasAnyProjects] = useState(false);
  const [tags, setTags] = useState([]);
  const [filters, setFilters] = useState({ q: "", tag: "", sort: "updated" });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [exportingSelected, setExportingSelected] = useState(false);
  const debounce = useRef();
  const dashboardScroll = useRef(null);

  useEffect(() => {
    if (scrollToTopRequest) dashboardScroll.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopRequest]);

  async function load(f = filters) {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [t, p] = await Promise.all([api.listTags(), api.listProjects(f)]);
      const nextProjects = p.projects || [];
      if (!f.q && !f.tag) setHasAnyProjects(nextProjects.length > 0);
      setTags((t.tags || []).slice(0, 6)); setProjects(nextProjects);
      setSelected((current) => current.filter((id) => nextProjects.some((project) => project.id === id)));
    } catch (e) { setProjects([]); }
    setLoading(false);
  }
  useEffect(() => { if (ready) load(); }, [user, ready]); // eslint-disable-line

  const setQ = (q) => { setFilters((f) => ({ ...f, q })); clearTimeout(debounce.current); debounce.current = setTimeout(() => load({ ...filters, q }), 300); };
  const setTag = (tag) => { const f = { ...filters, tag: filters.tag === tag ? "" : tag }; setFilters(f); load(f); };
  const setSort = (sort) => { const f = { ...filters, sort }; setFilters(f); load(f); };

  const del = (p) => Alert.alert("Delete project", `Delete "${p.name}"? This cannot be undone.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => { try { await api.deleteProject(p.id); load(); } catch (e) { Alert.alert("Error", e.message); } } },
  ]);
  const toggleSelected = (id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const toggleAll = () => setSelected((current) => current.length === projects.length ? [] : projects.map((project) => project.id));
  const deleteSelected = () => {
    if (!selected.length) return;
    Alert.alert("Delete selected projects", `Delete ${selected.length} selected project${selected.length === 1 ? "" : "s"}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setDeletingSelected(true);
        const ids = [...selected];
        const results = await Promise.allSettled(ids.map((id) => api.deleteProject(id)));
        const failed = ids.filter((id, index) => results[index].status === "rejected");
        setSelected(failed);
        if (!failed.length) setSelectionMode(false);
        await load();
        setDeletingSelected(false);
        if (failed.length) Alert.alert("Could not delete all projects", `${failed.length} project${failed.length === 1 ? "" : "s"} could not be deleted. Please try again.`);
      } },
    ]);
  };
  const createProjectPdf = async (project) => {
      const pages=buildProjectPdfPages(project,data);
      const portrait=await Print.printToFileAsync({html:pages.portrait,width:595.28,height:841.89,base64:true});
      const landscape=await Print.printToFileAsync({html:pages.landscape,width:841.89,height:595.28,base64:true});
      const merged=await PDFDocument.create();
      for(const source of [portrait,landscape]){
        const document=await PDFDocument.load(source.base64);
        // Each HTML fragment represents exactly one report sheet. Android's
        // print engine may append a blank page because the portrait template
        // retains its print page-break rule, so merge only the actual sheet.
        const copied=await merged.copyPages(document,[0]);
        copied.forEach((page)=>merged.addPage(page));
      }
      return merged.save();
  };
  const exportPdf = async (project) => {
    try {
      const bytes=await createProjectPdf(project);
      const safeName=String(project.name||"Walltopia project").replace(/[\\/:*?"<>|]+/g,"-").trim();
      const fileUri=`${FileSystem.cacheDirectory}${safeName} - Preliminary Loads.pdf`;
      await FileSystem.writeAsStringAsync(fileUri,bytesToBase64(bytes),{encoding:FileSystem.EncodingType.Base64});
      if(await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri,{mimeType:"application/pdf",dialogTitle:`Export ${project.name}`}); else Alert.alert("PDF created",fileUri);
    } catch(e){Alert.alert("Export failed",e.message||"Could not create the PDF.");}
  };
  const exportSelectedZip = async () => {
    if (selected.length < 2 || exportingSelected) return;
    setExportingSelected(true);
    try {
      const chosen=projects.filter((project)=>selected.includes(project.id));
      const used=new Map(),files=[];
      for(const project of chosen){
        const bytes=await createProjectPdf(project);
        const base=String(project.name||"Walltopia project").replace(/[\\/:*?"<>|]+/g,"-").trim()||"Walltopia project";
        const count=(used.get(base.toLowerCase())||0)+1;used.set(base.toLowerCase(),count);
        files.push({name:`${base}${count>1?` (${count})`:""} - Preliminary Loads.pdf`,data:bytes});
      }
      const zip=createZip(files);
      const fileUri=`${FileSystem.cacheDirectory}Walltopia Preliminary Loads - ${chosen.length} Projects.zip`;
      await FileSystem.writeAsStringAsync(fileUri,bytesToBase64(zip),{encoding:FileSystem.EncodingType.Base64});
      if(await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri,{mimeType:"application/zip",dialogTitle:"Export selected projects"});
      else Alert.alert("ZIP created",fileUri);
    }catch(e){Alert.alert("Export failed",e.message||"Could not create the ZIP file.");}
    finally{setExportingSelected(false);}
  };

  if (ready && !user) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 20, justifyContent: "center" }}>
        <Card style={{ borderTopColor: C.red, borderTopWidth: 3, alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontFamily: FD[900], fontSize: 22, marginBottom: 8, textAlign: "center" }}>Log in to see your projects</Text>
          <Text style={{ color: C.inkSoft, textAlign: "center", marginBottom: 20, fontFamily: FB[400] }}>Save calculations, organise them with tags and additional project information, and reopen them to review or edit.</Text>
          <Btn title="Log in or register" variant="primary" onPress={() => requireLogin("register")} />
        </Card>
      </View>
    );
  }

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
    <ScrollView ref={dashboardScroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <View style={s.pageHeading}>
        <Text style={[PAGE_TITLE,{ flex:1 }]}>My Projects</Text>
      </View>
      <Text style={{ color: C.inkFaint, marginBottom: 16, fontFamily: FB[400] }}>{loading ? "Loading…" : projects.length ? `${projects.length} project${projects.length === 1 ? "" : "s"}` : "No projects yet"}</Text>

      {selectionMode ? (
        <View style={s.bulkBar}>
          <View style={s.bulkMetaRow}>
            <Pressable onPress={toggleAll} style={s.selectAllButton}>
              <View style={[s.checkbox, selected.length === projects.length && s.checkboxActive]}><Text style={s.checkmark}>{selected.length === projects.length ? "✓" : ""}</Text></View>
              <Text style={s.selectAllText} numberOfLines={1}>Select all</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel selection" onPress={() => { setSelectionMode(false); setSelected([]); }} style={s.bulkClose}><Text style={s.bulkCloseText}>×</Text></Pressable>
            <Text style={s.selectedCount}>{selected.length} selected</Text>
          </View>
          <View style={s.bulkActions}>
            <Btn small variant="primary" title={exportingSelected ? "Preparing…" : "Export ZIP"} onPress={exportSelectedZip} disabled={selected.length < 2 || deletingSelected || exportingSelected} />
            <Btn small title={deletingSelected ? "Deleting…" : "Delete"} style={s.bulkDeleteButton} textStyle={s.bulkDeleteText} onPress={deleteSelected} disabled={!selected.length || deletingSelected || exportingSelected} />
          </View>
        </View>
      ) : (
        <View style={s.filterBar}>
        <View style={s.searchRow}>
          {hasAnyProjects ? <Btn small title="Select" style={s.selectModeButton} onPress={() => { if (!projects.length) return; setSelectionMode(true); setSelected([]); }} /> : null}
          <View style={s.searchBox}>
            <View style={s.searchIcon} pointerEvents="none"><View style={s.searchIconCircle}/><View style={s.searchIconHandle}/></View>
            <TextInput
              style={s.searchInput}
              placeholder="Search projects"
              placeholderTextColor={C.inkFaint}
              value={filters.q}
              onChangeText={setQ}
              returnKeyType="search"
              accessibilityLabel="Search projects by name, tag or project information"
            />
            {filters.q ? <Pressable accessibilityRole="button" accessibilityLabel="Clear project search" hitSlop={8} onPress={() => setQ("")} style={s.searchClear}><Text style={s.searchClearText}>×</Text></Pressable> : null}
          </View>
        </View>
        {tags.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            <Text style={s.flabel}>Tag</Text>
            <Chips small uniformHeight values={["All", ...tags]} value={filters.tag === "" ? "All" : filters.tag} onChange={(t) => setTag(t === "All" ? "" : t)} />
          </View>
        )}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.flabel}>Sort</Text>
          <Chips small uniformHeight values={["updated", "created", "name"]} value={filters.sort} onChange={setSort}
            label={(v) => ({ updated: "Recently updated", created: "Newest", name: "Name A–Z" }[v])} />
        </View>
        </View>)}

      {!loading && projects.length === 0 ? (
        <Text style={{ color: C.inkFaint, textAlign: "center", padding: 30, fontFamily: FB[400] }}>
          {filters.q || filters.tag ? "No projects match these filters." : "You haven't saved any projects yet — save one from the calculator."}
        </Text>
      ) : (
        projects.map((p) => <ProjectCard key={p.id} p={p} selectionMode={selectionMode} selected={selected.includes(p.id)} onSelect={() => toggleSelected(p.id)} onOpen={() => onOpen(p)} onExport={() => exportPdf(p)} onSupport={() => onSupport(p)} onDelete={() => del(p)} onTag={setTag} />)
      )}
    </ScrollView>
    </View>
  );
}

function ProjectCard({ p, selectionMode, selected, onSelect, onOpen, onExport, onSupport, onDelete, onTag }) {
  const snap = p.snapshot || {};
  const when = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "";
  return (
    <Pressable disabled={!selectionMode} onPress={onSelect}>
    <Card style={[{ borderTopColor: C.red, borderTopWidth: 3 }, selected && s.selectedCard]}>
      <View style={s.cardHeading}>
        <Text style={{ flex:1, fontFamily: FD[800], fontSize: 16 }}>{p.name}</Text>
        {selectionMode ? <Pressable onPress={onSelect} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`Select ${p.name}`} style={[s.checkbox, selected && s.checkboxActive]}><Text style={s.checkmark}>{selected ? "✓" : ""}</Text></Pressable> : null}
      </View>
      <Text style={{ color: C.inkFaint, fontSize: 12, marginTop: 2, fontFamily: FB[400] }}>{snap.title || ""}{when ? " · updated " + when : ""}</Text>
      {typeof snap.governing === "number" && (
        <View style={{ backgroundColor: C.surface2, padding: 8, marginTop: 8 }}>
          <Text style={{ color: C.inkSoft, fontSize: 12.5, fontFamily: FB[400] }}>Governing column load <Text style={{ color: C.red, fontFamily: FB[700] }}>{snap.governing} {snap.unit || ""}</Text></Text>
          {snap.verdict && snap.verdict !== "neutral" ? <Text style={[s.projectStatus, snap.verdict === "ok" ? s.statusApplicable : s.statusExceeded]}>{snap.verdict === "ok" ? "✔ APPLICABLE" : "✖ EXCEEDS CAPACITY"}</Text> : null}
        </View>
      )}
      {(p.tags || []).length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {p.tags.slice(0, 6).map((t) => (
            <Pressable key={t} onPress={() => onTag(t)}><Text style={s.tagChip}>{t}</Text></Pressable>
          ))}
        </View>
      )}
      {(p.properties || []).length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {p.properties.slice(0, 4).map((pr, i) => <Text key={i} style={s.propChip}>{pr.key}{pr.value ? ": " + pr.value : ""}</Text>)}
        </View>
      )}
      {!selectionMode ? <View style={{ gap: 8, marginTop: 12 }}>
        <View style={{ flexDirection:"row", gap:8 }}>
          <Btn small title="Open & edit" variant="primary" onPress={onOpen} style={{ flex:1, minWidth:0 }} />
          <Btn small title="Export PDF" onPress={onExport} style={{ flex:1, minWidth:0 }} />
        </View>
        <View style={{ flexDirection:"row", gap:8 }}>
          <Btn small title="Request support" onPress={onSupport} style={{ flex:1, minWidth:0 }} />
          <Btn small title="Delete" onPress={onDelete} />
        </View>
      </View> : null}
    </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  searchRow: { flexDirection:"row", alignItems:"center", gap:8, marginBottom:10 },
  searchBox: { flex:1, minWidth:0, height:34, flexDirection:"row", alignItems:"center", paddingLeft:12, borderWidth:1, borderColor:C.lineStrong, backgroundColor:C.surface2 },
  searchInput: { flex:1, height:"100%", paddingHorizontal:10, paddingVertical:0, color:C.ink, fontSize:14, fontFamily:FB[400] },
  searchIcon: { position:"relative", width:16, height:18 },
  searchIconCircle: { position:"absolute", left:1, top:1, width:11, height:11, borderWidth:1.5, borderColor:C.inkSoft, borderRadius:6 },
  searchIconHandle: { position:"absolute", left:11, top:12, width:6, height:1.5, backgroundColor:C.inkSoft, transform:[{rotate:"45deg"}] },
  searchClear: { width:40, height:"100%", alignItems:"center", justifyContent:"center", borderLeftWidth:1, borderLeftColor:C.line },
  searchClearText: { color:C.inkSoft, fontFamily:FB[400], fontSize:22, lineHeight:24 },
  pageHeading: { flexDirection:"row", alignItems:"center", gap:10 },
  filterBar: { marginBottom:16, padding:10, backgroundColor:C.surface, borderColor:C.line, borderWidth:1, borderTopColor:C.navy, borderTopWidth:3 },
  flabel: { fontSize: 11, fontFamily: FD[800], textTransform: "uppercase", letterSpacing: 0.5, color: C.inkFaint, marginBottom: 6 },
  tagChip: { backgroundColor: C.navy, color: "#fff", fontSize: 10.5, fontFamily: FD[700], textTransform: "uppercase", paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  propChip: { backgroundColor: C.surface2, borderColor: C.lineStrong, borderWidth: 1, color: C.inkSoft, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden", fontFamily: FB[600] },
  bulkBar: { gap:8, padding:10, marginBottom:16, backgroundColor:C.surface2, borderColor:C.lineStrong, borderWidth:1, borderTopColor:C.red, borderTopWidth:3 },
  bulkMetaRow: { flexDirection:"row", alignItems:"center", gap:8 },
  bulkActions: { flexDirection:"row", justifyContent:"flex-start", alignItems:"center", gap:8 },
  selectModeButton: { width:105, height:34, paddingVertical:0, justifyContent:"center" },
  selectAllButton: { width:105, flexDirection:"row", alignItems:"center", gap:7 },
  bulkClose: { width:28, height:28, alignItems:"center", justifyContent:"center" },
  bulkCloseText: { color:C.inkSoft, fontSize:26, lineHeight:28, fontFamily:FB[400] },
  selectAllText: { color:C.inkSoft, fontFamily:FD[800], fontSize:12, letterSpacing:.4, textTransform:"uppercase" },
  selectedCount: { flex:1, color:C.inkFaint, fontFamily:FB[400], fontSize:11.5 },
  bulkDeleteButton: { borderColor:C.red, backgroundColor:"#fff" },
  bulkDeleteText: { color:C.red },
  checkbox: { width:20, height:20, borderColor:C.lineStrong, borderWidth:1.5, backgroundColor:"#fff", alignItems:"center", justifyContent:"center" },
  checkboxActive: { borderColor:C.red, backgroundColor:C.red },
  checkmark: { color:"#fff", fontFamily:FB[700], fontSize:13, lineHeight:16 },
  selectedCard: { borderColor:C.red, borderWidth:3, borderTopWidth:3 },
  cardHeading: { flexDirection:"row", alignItems:"center", gap:10 },
  projectStatus: { marginTop:4, fontSize:10.5 },
  statusApplicable: { color:C.inkSoft, fontFamily:FD[700] },
  statusExceeded: { color:C.inkSoft, fontFamily:FD[800] },
});
