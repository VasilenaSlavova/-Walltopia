import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { C, FD, FB, PAGE_TITLE } from "../theme";

const PRIVACY = [
  ["1. Who we are", "Walltopia Preliminary Loads is operated by Walltopia AD, UIC 204143670, with registered address at 1B Bulgaria Blvd., 5570 Letnitsa, Bulgaria. Walltopia AD is the controller of personal information processed through this application."],
  ["2. Information we process", "Depending on how you use the application, we process account information (name, email address, password hash and account creation date), project information (project name, calculator inputs, result summary, tags and additional project information), support questions and their status, and the limited technical information required to deliver and secure the service. The password itself is not stored."],
  ["3. Cookies and application storage", "Only technologies needed for login, security and interface continuity are used. The web application uses the HTTP-only wt_token cookie for up to 7 days or until logout, limited local storage for interface state, and session storage until the session ends. The mobile application stores its authentication token in the device's protected secure storage. The application does not currently use analytics, advertising or marketing cookies."],
  ["4. Accounts, saved projects and support", "An account is required to save, reopen and manage projects. Engineering Support inquiries can be submitted only through the dedicated Support page and are linked to the selected project."],
  ["5. Retention and deletion", "Saved project information remains available until the account owner deletes the project. Deleting a project also deletes its associated support inquiries. Authentication data expires according to the applicable session period; the account record remains until deleted following an approved request or applicable retention requirement."],
  ["6. External services", "The application may load fonts from Google Fonts. The service may process ordinary connection information such as the device IP address. The application does not currently include third-party analytics or advertising services."],
  ["7. Your rights", "Subject to applicable data-protection law, you may request access to, correction or deletion of your personal information, restriction of processing, data portability, or object to certain processing. We may need to verify your identity before acting on a request."],
  ["8. Contact and policy changes", "For privacy questions or requests, use Walltopia's official contact page. We may update this policy when the application, legal requirements or services change."],
];

const DISCLAIMER = [
  ["1. Purpose and permitted use", "Walltopia Preliminary Loads is a preliminary sizing and design-support tool. Its outputs assist early engineering assessment and option comparison. They are not final structural design, fabrication information or construction documentation."],
  ["2. User inputs and assumptions", "Results depend on the selected geometry, units, load case, attachment scheme and other user inputs. The user is responsible for confirming that every input and displayed assumption matches the actual project conditions."],
  ["3. Professional verification", "All results must be independently reviewed and verified by the responsible qualified structural engineer. The review must consider the complete load path, supporting structure, connections, project-specific risks and all information not represented by this preliminary calculator."],
  ["4. Manuals, standards and project requirements", "The calculator must be used together with the applicable Walltopia manuals, standard attachment details, governing design standards, local regulations and project requirements. If the calculator and an approved project document differ, the approved project-specific document governs."],
  ["5. Saved projects and exported reports", "Saving a project or exporting a PDF records a preliminary calculation state; it does not convert the result into an approved engineering deliverable. Values may become outdated when inputs, manuals, standards or project conditions change."],
  ["6. Engineering support", "When a case falls outside the available configurations, contains uncertainty or requires project-specific assessment, stop relying on the preliminary result and contact Walltopia Engineering Support from the Support tab before proceeding."],
];

export default function LegalScreen({ kind, onBack }) {
  const privacy = kind === "privacy";
  const sections = privacy ? PRIVACY : DISCLAIMER;
  return (
    <View style={s.screen}>
      <View style={s.bar}>
        <Pressable onPress={onBack} style={s.back}><Text style={s.backText}>← Back</Text></Pressable>
        <Text style={s.barTitle}>Legal Information</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.kicker}>{privacy ? "LEGAL INFORMATION" : "ENGINEERING INFORMATION"}</Text>
        <Text style={s.title}>{privacy ? "Privacy & Cookie Policy" : "Engineering Disclaimer"}</Text>
        <Text style={s.intro}>{privacy ? "What information the application processes, why it is needed and what choices are available to you." : "The intended use, assumptions and limitations of results produced by Walltopia Preliminary Loads."}</Text>
        <Text style={s.date}>Last updated: 21 July 2026</Text>
        {sections.map(([title, text]) => (
          <View key={title} style={s.section}>
            <Text style={s.heading}>{title}</Text>
            <Text style={s.body}>{text}</Text>
          </View>
        ))}
        {privacy ? (
          <View style={s.external}>
            <Text style={s.externalTitle}>Official Walltopia policies</Text>
            <Pressable onPress={() => Linking.openURL("https://walltopia.com/contact-us/")}><Text style={s.link}>Contact Walltopia</Text></Pressable>
            <Pressable onPress={() => Linking.openURL("https://walltopia.com/privacy-policy/")}><Text style={s.link}>General privacy policy</Text></Pressable>
          </View>
        ) : null}
        <Text style={s.footer}>© 2026 Walltopia AD · Preliminary sizing only — not for construction.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  bar: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderBottomColor: C.line, borderBottomWidth: 1, padding: 10 },
  back: { borderColor: C.lineStrong, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  backText: { fontFamily: FD[800], fontSize: 11, color: C.ink },
  barTitle: { flex: 1, textAlign: "center", fontFamily: FD[800], fontSize: 12, color: C.ink, paddingRight: 62 },
  content: { padding: 18, paddingBottom: 50 },
  kicker: { fontFamily: FD[800], fontSize: 10, letterSpacing: 1, color: C.red, marginBottom: 6 },
  title: { ...PAGE_TITLE, marginBottom: 7 },
  intro: { fontFamily: FB[400], fontSize: 13.5, lineHeight: 20, color: C.inkSoft, textAlign:"justify" },
  date: { fontFamily: FB[600], fontSize: 11, color: C.inkFaint, marginTop: 8, marginBottom: 18 },
  section: { borderTopColor: C.line, borderTopWidth: 1, paddingTop: 13, marginBottom: 14 },
  heading: { fontFamily: FD[900], fontSize: 16, color: C.ink, marginBottom: 6 },
  body: { fontFamily: FB[400], fontSize: 13, lineHeight: 20, color: C.inkSoft, textAlign:"justify" },
  external: { backgroundColor: C.surface2, borderLeftColor: C.red, borderLeftWidth: 3, padding: 12, marginBottom: 16 },
  externalTitle: { fontFamily: FD[800], fontSize: 12, color: C.ink, marginBottom: 7 },
  link: { fontFamily: FB[600], fontSize: 12.5, color: C.red, textDecorationLine: "underline", marginBottom: 7 },
  footer: { fontFamily: FB[400], fontSize: 10.5, lineHeight: 16, textAlign: "center", color: C.inkFaint },
});
