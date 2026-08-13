import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Keyboard, StyleSheet, Modal } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts, Montserrat_700Bold, Montserrat_800ExtraBold, Montserrat_900Black } from "@expo-google-fonts/montserrat";
import { OpenSans_400Regular, OpenSans_600SemiBold, OpenSans_700Bold } from "@expo-google-fonts/open-sans";
import { C, FD, FB } from "./src/theme";
import { AuthProvider } from "./src/auth";
import { api } from "./src/api";
import Header from "./src/components/Header";
import LoginModal from "./src/components/LoginModal";
import CalculatorScreen from "./src/screens/CalculatorScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import ManualScreen from "./src/screens/ManualScreen";
import EngineeringSupportScreen from "./src/screens/EngineeringSupportScreen";
import LegalScreen from "./src/screens/LegalScreen";

function Root() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Montserrat_700Bold, Montserrat_800ExtraBold, Montserrat_900Black,
    OpenSans_400Regular, OpenSans_600SemiBold, OpenSans_700Bold,
  });
  const [data, setData] = useState(null);
  const [dataErr, setDataErr] = useState(null);
  const [tab, setTab] = useState("calc");
  const [editingProject, setEditingProject] = useState(null);
  const [login, setLogin] = useState({ visible: false, mode: "login" });
  const [legalMenu, setLegalMenu] = useState(false);
  const [legalDocument, setLegalDocument] = useState(null);
  const [supportProjectId, setSupportProjectId] = useState("");
  const [calculatorTopRequest, setCalculatorTopRequest] = useState(0);
  const [projectsTopRequest, setProjectsTopRequest] = useState(0);
  const [docsTopRequest, setDocsTopRequest] = useState(0);
  const [supportTopRequest, setSupportTopRequest] = useState(0);

  useEffect(() => { api.loads().then(setData).catch((e) => setDataErr(e)); }, []);

  // Don't render font-styled UI until the fonts are ready (avoids missing text on first paint).
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: C.navy }}>
        <StatusBar style="light" />
        <View style={st.center}><ActivityIndicator color={C.red} size="large" /></View>
      </View>
    );
  }

  const requireLogin = (mode = "login") => setLogin({ visible: true, mode });
  const openProject = (p) => { setEditingProject(p); setTab("calc"); };
  const requestSupport = (p) => { setSupportProjectId(p.id); setTab("support"); };
  const openTab = (nextTab) => {
    if (nextTab !== tab) Keyboard.dismiss();
    if (nextTab === tab && !legalDocument) {
      if (nextTab === "calc") setCalculatorTopRequest((value) => value + 1);
      if (nextTab === "projects") setProjectsTopRequest((value) => value + 1);
      if (nextTab === "manual") setDocsTopRequest((value) => value + 1);
      if (nextTab === "support") setSupportTopRequest((value) => value + 1);
    }
    setLegalDocument(null);
    setLegalMenu(false);
    setTab(nextTab);
  };

  let content;
  if (legalDocument) {
    content = <LegalScreen kind={legalDocument} onBack={() => setLegalDocument(null)} />;
  } else if (dataErr) {
    content = (
      <View style={st.center}>
        <Text style={{ fontFamily: FD[800], fontSize: 16, color: C.ink, marginBottom: 8 }}>Can't reach the server</Text>
        <Text style={{ color: C.inkSoft, textAlign: "center", paddingHorizontal: 30, fontFamily: FB[400] }}>{dataErr.message}</Text>
        <Text style={{ color: C.inkFaint, textAlign: "center", marginTop: 12, paddingHorizontal: 30, fontSize: 12, fontFamily: FB[400] }}>Set the API URL in app.json → expo.extra.apiBase to a URL your phone can reach ({api.base}).</Text>
      </View>
    );
  } else if (!data) {
    content = <View style={st.center}><ActivityIndicator color={C.red} size="large" /><Text style={{ color: C.inkFaint, marginTop: 12, fontFamily: FB[400] }}>Loading load tables…</Text></View>;
  } else {
    content = (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, display: tab === "calc" ? "flex" : "none" }}>
          <CalculatorScreen key={editingProject?.id || "new"} data={data} initialProject={editingProject}
            onProjectChange={setEditingProject} onExit={() => setEditingProject(null)} requireLogin={requireLogin}
            scrollToTopRequest={calculatorTopRequest} />
        </View>
        {tab === "projects" ? <DashboardScreen data={data} onOpen={openProject} onSupport={requestSupport} requireLogin={requireLogin} scrollToTopRequest={projectsTopRequest} /> : null}
        {tab === "support" ? <EngineeringSupportScreen requireLogin={requireLogin} initialProjectId={supportProjectId} scrollToTopRequest={supportTopRequest} /> : null}
        {tab === "manual" ? <ManualScreen scrollToTopRequest={docsTopRequest} /> : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <Header topInset={insets.top} onLoginPress={() => requireLogin("login")} onLegalPress={() => setLegalMenu(true)} />
      <View style={{ flex: 1 }}>{content}</View>
      <View style={[st.tabbar, { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}> 
        <TabButton label="Calculator" active={!legalDocument && tab === "calc"} onPress={() => openTab("calc")} />
        <Text style={st.tabSeparator}>|</Text>
        <TabButton label="Projects" active={!legalDocument && tab === "projects"} onPress={() => openTab("projects")} />
        <Text style={st.tabSeparator}>|</Text>
        <TabButton label="Docs" active={!legalDocument && tab === "manual"} onPress={() => openTab("manual")} />
        <Text style={st.tabSeparator}>|</Text>
        <TabButton label="Support" active={!legalDocument && tab === "support"} onPress={() => openTab("support")} />
      </View>
      <LoginModal visible={login.visible} initialMode={login.mode} onClose={() => setLogin((l) => ({ ...l, visible: false }))} />
      <Modal transparent visible={legalMenu} animationType="fade" onRequestClose={() => setLegalMenu(false)}>
        <Pressable style={st.legalBackdrop} onPress={() => setLegalMenu(false)}>
          <View style={st.legalMenu}>
            <Text style={st.legalKicker}>LEGAL INFORMATION</Text>
            <Pressable style={st.legalItem} onPress={() => { setLegalMenu(false); setLegalDocument("privacy"); }}>
              <Text style={st.legalItemTitle}>Privacy &amp; Cookies</Text>
              <Text style={st.legalItemHint}>Data, storage and your choices</Text>
            </Pressable>
            <Pressable style={st.legalItem} onPress={() => { setLegalMenu(false); setLegalDocument("disclaimer"); }}>
              <Text style={st.legalItemTitle}>Engineering Disclaimer</Text>
              <Text style={st.legalItemHint}>Calculator scope and limitations</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function TabButton({ label, active, onPress }) {
  return (
    <Pressable style={st.tab} onPress={onPress}>
      <View style={{ height: 3, alignSelf: "stretch", backgroundColor: active ? C.red : "transparent" }} />
      <Text style={[st.tabLabel, active && { color: C.ink }]}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  tabbar: {
    width: "100%", flexDirection: "row", alignItems: "stretch", justifyContent: "center",
    backgroundColor: "#fff", borderTopColor: C.lineStrong, borderTopWidth: 1,
    zIndex: 20, elevation: 14,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 11,
    shadowOffset: { width: 0, height: -4 },
  },
  tab: { flexGrow: 0, flexShrink: 0, alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 7 },
  tabLabel: { paddingVertical: 12, fontFamily: FD[800], fontSize: 11.5, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.35, color: C.inkFaint },
  tabSeparator: { alignSelf: "center", color: C.lineStrong, fontFamily: FB[400], fontSize: 13, marginTop: 3 },
  legalBackdrop: { flex: 1, backgroundColor: "rgba(12,13,18,.42)", alignItems: "flex-end", paddingTop: 76, paddingRight: 14 },
  legalMenu: { width: 275, backgroundColor: C.surface, borderColor: C.lineStrong, borderWidth: 1, borderTopColor: C.red, borderTopWidth: 3, padding: 12, elevation: 16, shadowColor: "#000", shadowOpacity: .22, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  legalKicker: { fontFamily: FD[800], fontSize: 9.5, letterSpacing: .9, color: C.red, marginBottom: 7 },
  legalItem: { paddingVertical: 10, borderTopColor: C.line, borderTopWidth: 1 },
  legalItemTitle: { fontFamily: FD[800], fontSize: 13, color: C.ink },
  legalItemHint: { fontFamily: FB[400], fontSize: 11, color: C.inkFaint, marginTop: 2 },
});
