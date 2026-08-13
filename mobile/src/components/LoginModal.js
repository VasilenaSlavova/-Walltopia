import { useState } from "react";
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { C, FD, FB } from "../theme";
import { Btn } from "./ui";
import { useAuth } from "../auth";

export default function LoginModal({ visible, onClose, initialMode = "login" }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reg = mode === "register";

  async function submit() {
    setError(""); setBusy(true);
    try {
      if (reg) await register(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
      setName(""); setEmail(""); setPassword("");
      onClose();
    } catch (e) { setError(e.message || "Something went wrong"); }
    setBusy(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.tabs}>
            {["login", "register"].map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} style={[s.tab, mode === m && { borderBottomColor: C.red }]}>
                <Text style={[s.tabText, mode === m && { color: C.ink }]}>{m === "login" ? "Log in" : "Register"}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.title}>{reg ? "Create your account" : "Welcome back"}</Text>
          {reg && <Labeled label="Name"><TextInput style={s.input} value={name} onChangeText={setName} autoCapitalize="words" /></Labeled>}
          <Labeled label="Email"><TextInput style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /></Labeled>
          <Labeled label="Password"><TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry /></Labeled>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Btn title={busy ? "Please wait…" : reg ? "Create account" : "Log in"} variant="primary" onPress={submit} disabled={busy} style={{ marginTop: 6 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const Labeled = ({ label, children }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={s.lbl}>{label}</Text>
    {children}
  </View>
);

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,13,18,0.6)", justifyContent: "center", padding: 22 },
  card: { backgroundColor: "#fff", borderTopColor: C.red, borderTopWidth: 4, padding: 24 },
  tabs: { flexDirection: "row", borderBottomColor: C.line, borderBottomWidth: 1, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderBottomWidth: 3, borderBottomColor: "transparent", alignItems: "center" },
  tabText: { fontFamily: FD[800], fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, color: C.inkFaint },
  title: { fontFamily: FD[900], fontSize: 20, marginBottom: 16, color: C.ink },
  lbl: { fontSize: 12, fontFamily: FB[700], color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.lineStrong, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.ink, fontFamily: FB[400] },
  error: { backgroundColor: C.badSoft, color: C.bad, borderLeftColor: C.red, borderLeftWidth: 3, padding: 9, fontSize: 13, marginBottom: 12, fontFamily: FB[400] },
});
