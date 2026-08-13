import { Text, View, Pressable, StyleSheet } from "react-native";
import { C, FD, FB } from "../theme";

export function Btn({ title, onPress, variant = "default", small, disabled, style, textStyle }) {
  const bg = variant === "primary" ? C.red : variant === "ghost" ? "transparent" : C.surface;
  const fg = variant === "primary" ? "#fff" : variant === "ghost" ? C.inkSoft : C.ink;
  const border = variant === "primary" ? C.red : C.lineStrong;
  return (
    <Pressable onPress={disabled ? undefined : onPress}
      style={[{ backgroundColor: bg, borderColor: border, borderWidth: 1, paddingVertical: small ? 8 : 11, paddingHorizontal: small ? 12 : 16, opacity: disabled ? 0.55 : 1 }, style]}>
      <Text style={[{ color: fg, fontFamily: FD[800], fontSize: small ? 12 : 13, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center" }, textStyle]}>{title}</Text>
    </Pressable>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[s.segBtn, on && { backgroundColor: C.red }]}>
            <Text style={{ color: on ? "#fff" : C.inkSoft, fontFamily: FD[700], fontSize: 12.5, textAlign: "center" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chips({ values, value, onChange, label, small, uniformHeight = false }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, width: "100%" }}>
      {values.map((v) => {
        const on = v === value;
        return (
          <Pressable key={String(v)} onPress={() => onChange(v)}
            style={[s.chip, small && { paddingHorizontal: 12 }, uniformHeight && { height: 34, paddingVertical: 0, justifyContent: "center" }, on && { backgroundColor: C.red, borderColor: C.red }]}>
            <Text style={{ color: on ? "#fff" : C.ink, fontFamily: FD[700], fontSize: 13 }}>{label ? label(v) : String(v)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, hint, children }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.fieldLabel}>{label}{hint ? <Text style={s.hint}>  {hint}</Text> : null}</Text>
      {children}
    </View>
  );
}

export const SectionTitle = ({ children }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 14 }}>
    <View style={{ width: 14, height: 3, backgroundColor: C.red }} />
    <Text style={{ fontSize: 12.5, fontFamily: FD[800], textTransform: "uppercase", letterSpacing: 0.8, color: C.ink }}>{children}</Text>
  </View>
);

export const Hint = ({ children, style }) => <Text style={[s.hint, style]}>{children}</Text>;
export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;

const s = StyleSheet.create({
  seg: { flexDirection: "row", backgroundColor: C.surface2, borderColor: C.lineStrong, borderWidth: 1, padding: 3, gap: 3 },
  segBtn: { flex: 1, paddingVertical: 9, paddingHorizontal: 6 },
  chip: { minWidth: 44, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface, paddingVertical: 8, paddingHorizontal: 13, alignItems: "center" },
  fieldLabel: { fontSize: 12, fontFamily: FB[700], color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  hint: { fontSize: 11.5, fontFamily: FB[400], color: C.inkFaint, textTransform: "none", letterSpacing: 0 },
  card: { backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, padding: 18, marginBottom: 16 },
});
export { s as uiStyles };
