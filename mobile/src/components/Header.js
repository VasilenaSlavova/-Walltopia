import { View, Text, Pressable, StyleSheet } from "react-native";
import { C, FD } from "../theme";
import { useAuth } from "../auth";
import WalltopiaLogo from "./WalltopiaLogo";

export default function Header({ onLoginPress, onLegalPress, topInset = 0 }) {
  const { user, logout } = useAuth();
  return (
    <View style={[s.bar, { paddingTop: 12 + topInset }]}>
      <View style={s.brand}>
        <WalltopiaLogo width={150} height={20} />
        <Text style={s.tag}>PRELIMINARY <Text style={s.tagAccent}>LOADS</Text></Text>
      </View>
      <View style={s.actions}>
        <Pressable accessibilityLabel="More information" onPress={onLegalPress} style={({ pressed }) => [s.legalButton, pressed && s.legalButtonPressed]}>
          <View style={s.dots}><View style={s.dot} /><View style={s.dot} /><View style={s.dot} /></View>
        </Pressable>
        {user ? (
          <Pressable style={s.userWrap} onPress={logout}>
            <View style={s.avatar}><Text style={s.avatarText}>{(user.name || "?").trim().charAt(0).toUpperCase()}</Text></View>
            <Text style={s.logout}>Log out</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onLoginPress} style={s.login}><Text style={s.loginText}>Log in</Text></Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: C.navy, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { width:150, alignItems:"center" },
  actions: { flexDirection: "row", alignItems: "center", gap: 9 },
  legalButton: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  legalButtonPressed: { backgroundColor: "rgba(255,255,255,.08)" },
  dots: { height: 16, alignItems: "center", justifyContent: "space-between" },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#b8becc" },
  tag: { width:"100%", color: "#fff", fontSize: 10, fontFamily: FD[800], letterSpacing: 1.2, marginTop: 1, textAlign:"center" },
  tagAccent: { color: C.red },
  userWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 26, height: 26, backgroundColor: C.red, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontFamily: FD[800], fontSize: 12 },
  logout: { color: "#c3c8d6", fontFamily: FD[700], fontSize: 12, textTransform: "uppercase" },
  login: { borderColor: "#454a5e", borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  loginText: { color: "#dfe3ec", fontFamily: FD[700], fontSize: 12, textTransform: "uppercase" },
});
