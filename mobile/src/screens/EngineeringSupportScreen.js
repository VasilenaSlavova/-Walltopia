import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, LayoutAnimation, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { useRef } from "react";
import { findNodeHandle } from "react-native";
import { useAuth } from "../auth";
import { C, FD, FB, PAGE_TITLE } from "../theme";
import { Btn } from "../components/ui";
import { COUNTRIES, DIAL_CODES } from "../lib/countries";
import { AsYouType, isValidPhoneNumber } from "libphonenumber-js";
import phoneMetadata from "libphonenumber-js/metadata.max.json";
import PHONE_RULES from "../lib/phone-rules.json";

const TOPICS = ["Result review", "Supporting structure", "Attachment method", "Special structural case", "Other"];

export default function EngineeringSupportScreen({ requireLogin, initialProjectId = "", scrollToTopRequest = 0 }) {
  const { user } = useAuth();
  const formScrollRef = useRef(null);
  const questionInputRef = useRef(null);
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const nameParts = String(user?.name || "").trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts.shift() || "");
  const [lastName, setLastName] = useState(nameParts.join(" "));
  const [email, setEmail] = useState(user?.email || "");
  const [topic, setTopic] = useState("");
  const [country, setCountry] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user) { setProjects([]); setSelectedId(""); return; }
    setLoading(true);
    api.listProjects().then((result) => {
      const list = result.projects || [];
      setProjects(list);
      setSelectedId((current) => initialProjectId || current || list[0]?.id || "");
    }).catch((error) => setStatus(error.message || "Could not load projects."))
      .finally(() => setLoading(false));
  }, [user, initialProjectId]);

  useEffect(() => { setEmail(user?.email || ""); }, [user?.email]);

  useEffect(() => {
    if (!scrollToTopRequest) return;
    Keyboard.dismiss();
    formScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopRequest]);

  const selected = useMemo(() => projects.find((project) => project.id === selectedId), [projects, selectedId]);
  const phoneLimits = (selectedCountry = country) => {
    const rule = PHONE_RULES[selectedCountry];
    if (rule) return { dialDigits: rule.dialCode.replace(/\D/g, ""), nationalDigits: rule.nationalDigits };
    const dialCode = PHONE_RULES[selectedCountry]?.dialCode || DIAL_CODES[selectedCountry] || "";
    const dialDigits = dialCode.replace(/\D/g, "");
    // NANP territories use +1 followed by a three-digit area code. Once that
    // prefix is prefilled, seven subscriber digits remain.
    if (/^1\d{3}$/.test(dialDigits)) return { dialDigits, nationalDigits: 7 };
    const countryCodes = phoneMetadata.country_calling_codes?.[dialDigits] || [];
    const nationalDigits = Math.max(0, ...countryCodes.flatMap((code) => {
      const metadata = phoneMetadata.countries?.[code];
      const mobileLengths = metadata?.[11]?.[1]?.[1];
      return Array.isArray(mobileLengths) && mobileLengths.length ? mobileLengths : (metadata?.[3] || []);
    }));
    return { dialDigits, nationalDigits };
  };
  const formatPhone = (value, selectedCountry = country) => {
    const startsWithPlus = value.charAt(0) === "+";
    let digits = value.replace(/\D/g, "");
    let dialDigits = String(DIAL_CODES[selectedCountry] || "").replace(/\D/g, "");
    if (!dialDigits && startsWithPlus) {
      dialDigits = Object.values(DIAL_CODES)
        .map((code) => code.replace(/\D/g, ""))
        .filter((code) => digits.startsWith(code))
        .sort((a, b) => b.length - a.length)[0] || "";
    }
    if (PHONE_RULES[selectedCountry]?.stripsLeadingZero && digits.startsWith(dialDigits + "0")) {
      digits = dialDigits + digits.slice(dialDigits.length + 1);
    }
    let maximumNationalLength = phoneLimits(selectedCountry).nationalDigits;
    if (selectedCountry === "Andorra" && digits.startsWith(dialDigits)) {
      const national = digits.slice(dialDigits.length);
      // Andorra: 690 numbers have 9 digits; other mobile ranges have 6.
      if (national && !"690".startsWith(national) && !national.startsWith("690")) maximumNationalLength = 6;
      if (national.length >= 3 && !national.startsWith("690")) maximumNationalLength = 6;
    }

    if (dialDigits && maximumNationalLength && digits.startsWith(dialDigits)) {
      digits = digits.slice(0, dialDigits.length + maximumNationalLength);
    } else {
      // E.164 permits no more than 15 digits in the complete international number.
      digits = digits.slice(0, 15);
    }

    if (dialDigits === "297" && digits.startsWith("297")) {
      const national = digits.slice(3, 10);
      return "+297" + (national ? " " + national.slice(0, 3) : "") + (national.length > 3 ? " " + national.slice(3) : "");
    }
    return new AsYouType().input((startsWithPlus ? "+" : "") + digits);
  };
  const phoneMaxLength = (() => {
    let { nationalDigits } = phoneLimits(country);
    if (!country || !nationalDigits) return 32;
    if (country === "Andorra") {
      const dialDigits = (PHONE_RULES[country]?.dialCode || "").replace(/\D/g, "");
      const national = phone.replace(/\D/g, "").slice(dialDigits.length);
      if (national && !"690".startsWith(national) && !national.startsWith("690")) nationalDigits = 6;
      if (national.length >= 3 && !national.startsWith("690")) nationalDigits = 6;
    }
    const dialDigits = (PHONE_RULES[country]?.dialCode || DIAL_CODES[country] || "").replace(/\D/g, "");
    const enteredDigits = phone.replace(/\D/g, "");
    if (dialDigits && enteredDigits.startsWith(dialDigits)
      && enteredDigits.length >= dialDigits.length + nationalDigits) {
      // Once the permitted number of digits is present, let the native input
      // reject another key press instead of briefly rendering and trimming it.
      return phone.length;
    }
    // Before the last permitted digit, do not constrain the formatted
    // character count: AsYouType may insert a space at the same keystroke.
    return 32;
  })();
  const selectCountry = (value) => {
    const nextCode = PHONE_RULES[value]?.dialCode || DIAL_CODES[value] || "";
    setCountry(value);
    setCountryOpen(false);
    setPhone(nextCode ? formatPhone(nextCode, value) : "");
  };

  const revealQuestionField = () => {
    setTimeout(() => {
      const handle = findNodeHandle(questionInputRef.current);
      if (!handle) return;
      // The native helper normally keeps only the caret visible. The extra
      // offset includes the complete 110 px multiline field plus breathing room.
      formScrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(handle, 142, false);
    }, Platform.OS === "ios" ? 160 : 300);
  };

  async function send() {
    if (!selected) { setStatus("Select a saved project."); return; }
    if (!firstName.trim() || !lastName.trim()) { setStatus("Enter your first and last name."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setStatus("Enter a valid contact email address."); return; }
    if (!country.trim()) { setStatus("Enter your country."); return; }
    if (phone.trim() && !isValidPhoneNumber(phone)) { setStatus("Enter a valid mobile number for the selected country."); return; }
    if (!topic) { setStatus("Select a topic."); return; }
    if (message.trim().length < 5) { setStatus("Describe what the Engineering Support team should review."); return; }
    if (!consent) { setStatus("Please confirm your consent before continuing."); return; }
    const input = selected.input || {};
    const snapshot = selected.snapshot || {};
    const body = [
      `Topic: ${topic}`,
      "Response channel: Email",
      `Contact: ${firstName.trim()} ${lastName.trim()} <${email.trim()}>`,
      `Country: ${country.trim()}`,
      `Phone: ${phone.trim() || "—"}`,
      `Marketing consent: ${marketing ? "Yes" : "No"}`,
      "",
      message.trim(),
      "",
      `Project: ${selected.name}`,
      `Calculation: ${snapshot.title || "Preliminary loads"}`,
      `Inputs: height ${input.height}, levels ${input.levels}, A ${input.span}, X ${input.overhang}, units ${input.units}`,
      `Governing column load: ${snapshot.governing != null ? snapshot.governing + " " + (snapshot.unit || "") : "not available"}`,
    ].join("\n");
    setSending(true); setStatus("");
    try {
      const result = await api.sendSupportInquiry(selected.id, body);
      const reference = result.inquiry?.id ? result.inquiry.id.slice(-8).toUpperCase() : "created";
      setStatus(`Inquiry saved · reference ${reference}. A response will be sent by email.`);
      setMessage("");
    } catch (error) {
      setStatus(error.message || "Could not send the inquiry.");
    }
    setSending(false);
  }

  if (!user) {
    return (
      <View style={s.center}>
        <Text style={s.title}>Engineering Support</Text>
        <Text style={s.centerText}>Log in to link your technical inquiry to a saved calculation.</Text>
        <Btn title="Log in" variant="primary" onPress={() => requireLogin("login")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 72 : 0}
    >
    <ScrollView
      ref={formScrollRef}
      style={s.screen}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
    >
      <Text style={s.kicker}>ENGINEERING SUPPORT</Text>
      <Text style={s.title}>Let's talk about your project</Text>
      <Text style={s.intro}>Got a technical question? Send it through the form below. Your saved calculation will be included automatically.</Text>

      <View style={s.card}>
        <Text style={s.kicker}>CONTACT FORM</Text>
        <View style={s.formSection}>
        <Text style={s.section}>Contact details</Text>
        <Text style={s.label}>First name *</Text>
        <TextInput value={firstName} onChangeText={setFirstName} style={s.input} />
        <Text style={s.label}>Last name *</Text>
        <TextInput value={lastName} onChangeText={setLastName} style={s.input} />
        <Text style={s.label}>Email *</Text>
        <TextInput value={email} onChangeText={setEmail} style={s.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" />
        <Text style={s.label}>Country *</Text>
        <Pressable onPress={() => setCountryOpen(true)} style={s.countrySelect}><Text style={[s.countryValue,!country&&{color:C.inkFaint}]}>{country||"Select or search for your country"}</Text><View style={s.countryArrowBox}><View style={s.countryArrowShape} /></View></Pressable>
        <Text style={s.label}>Phone</Text>
        <TextInput value={phone} onChangeText={(value)=>setPhone(formatPhone(value, country))} maxLength={phoneMaxLength} style={s.input} keyboardType="phone-pad" placeholder="+ Country code · Phone number" />
        </View>

        <View style={s.formSection}>
        <Text style={s.section}>Project and inquiry</Text>
        <Text style={s.label}>Saved project</Text>
        {loading ? <ActivityIndicator color={C.red} /> : projects.length ? (
          <Pressable onPress={() => setProjectOpen(true)} style={s.countrySelect} accessibilityRole="button" accessibilityLabel="Select saved project">
            <Text numberOfLines={1} style={[s.countryValue,!selected&&{color:C.inkFaint}]}>{selected?.name || "Select a saved project"}</Text>
            <View style={s.countryArrowBox}><View style={s.countryArrowShape} /></View>
          </Pressable>
        ) : <Text style={s.help}>Save a calculation first, then return here to request support.</Text>}

        <Text style={s.label}>Topic</Text>
        <View style={s.topicWrap}>{TOPICS.map((item) => (
          <Pressable key={item} onPress={() => setTopic(item)} style={[s.topic, topic === item && s.topicActive]}>
            <Text style={[s.topicText, topic === item && s.topicTextActive]}>{item}</Text>
          </Pressable>
        ))}</View>

        <Text style={s.label}>Technical question *</Text>
        <TextInput
          ref={questionInputRef}
          value={message}
          onChangeText={(value) => setMessage(value.slice(0, 2800))}
          onFocus={revealQuestionField}
          multiline
          style={[s.input, s.message]}
          placeholder="Describe the structure, the issue and what you would like the Engineering Support team to review."
        />
        <Text style={s.count}>{message.length} / 2800</Text>
        </View>

        <Consent value={consent} onChange={setConsent} text="I agree that Walltopia may use the submitted information to respond to this inquiry." />
        <Consent value={marketing} onChange={setMarketing} text="I agree to receive marketing materials from Walltopia." />
        {status ? <Text style={s.status}>{status}</Text> : null}
        <View style={s.sendButtonWrap}><Btn title={sending ? "Sending…" : "Send inquiry"} variant="primary" onPress={send} disabled={sending || !projects.length} /></View>
      </View>

      {selected ? <AttachedCalculation project={selected} /> : null}

      <View style={s.included}><Text style={s.includedTitle}>Engineering Support receives</Text>{["Calculation inputs and result snapshot","Project tags and additional project information","Your selected topic and technical question","The inquiry in the project history"].map((item)=><View key={item} style={s.includedRow}><Text style={s.bullet}>•</Text><Text style={s.includedText}>{item}</Text></View>)}</View>

      <View style={s.contact}>
        <Text style={s.contactLabel}>WALLTOPIA HEAD OFFICE</Text>
        <Pressable accessibilityRole="link" accessibilityLabel="Open Walltopia Head Office in Google Maps" onPress={() => Linking.openURL("https://www.google.com/maps/search/?api=1&query=Walltopia+111V+Tsarigradsko+Shose+Sofia")}>
          <Text style={[s.contactText,s.contactLink]}>111V Tsarigradsko Shose Blvd. · Sofia 1784, Bulgaria</Text>
        </Pressable>
        <Text style={[s.contactLabel,{marginTop:14}]}>GENERAL CONTACT</Text>
        <Pressable accessibilityRole="link" accessibilityLabel="Email Walltopia sales" onPress={() => Linking.openURL("mailto:sales@walltopia.com")}>
          <Text style={[s.contactText,s.emailLink]}>sales@walltopia.com</Text>
        </Pressable>
        <Text style={[s.contactLabel,{marginTop:14}]}>WHAT HAPPENS NEXT</Text>
        <Text style={s.contactText}>An engineer reviews the calculation and replies by email.</Text>
      </View>
      <CountryDropdown visible={countryOpen} value={country} onSelect={selectCountry} onClose={()=>setCountryOpen(false)} />
      <ProjectDropdown visible={projectOpen} projects={projects} value={selectedId} onSelect={(id)=>{setSelectedId(id);setProjectOpen(false);}} onClose={()=>setProjectOpen(false)} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function useSmoothKeyboardResize(visible) {
  useEffect(() => {
    if (!visible) return undefined;
    const animate = (event) => {
      if (Keyboard.scheduleLayoutAnimation && event?.duration) Keyboard.scheduleLayoutAnimation(event);
      else LayoutAnimation.configureNext({ duration:220, update:{ type:LayoutAnimation.Types.easeInEaseOut } });
    };
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, animate);
    const hide = Keyboard.addListener(hideEvent, animate);
    return () => { show.remove(); hide.remove(); };
  }, [visible]);
}

function CountryDropdown({ visible, value, onSelect, onClose }) {
  const [query,setQuery]=useState("");
  useSmoothKeyboardResize(visible);
  useEffect(()=>{if(visible)setQuery("");},[visible]);
  const filtered=COUNTRIES.filter((name)=>name.toLowerCase().includes(query.trim().toLowerCase()));
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><KeyboardAvoidingView style={s.keyboardArea} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={12}><Pressable style={s.countryBackdrop} onPress={onClose}><Pressable style={s.countryModal} onPress={()=>{}}><View style={s.countryHead}><Text style={s.countryTitle}>Select country</Text><Pressable onPress={onClose} style={s.countryClose}><Text style={s.countryCloseText}>×</Text></Pressable></View><TextInput autoFocus value={query} onChangeText={setQuery} style={s.countrySearch} placeholder="Search country…"/><ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="none" style={s.countryList}>{filtered.filter((name)=>PHONE_RULES[name]).map((name)=><Pressable key={name} onPress={()=>onSelect(name)} style={[s.countryOption,value===name&&s.countryOptionActive]}><Text style={[s.countryOptionText,value===name&&{color:C.red,fontFamily:FB[700]}]}>{name}</Text></Pressable>)}{!filtered.filter((name)=>PHONE_RULES[name]).length?<Text style={s.countryEmpty}>No matching country.</Text>:null}</ScrollView></Pressable></Pressable></KeyboardAvoidingView></Modal>;
}

function AttachedCalculation({ project }) {
  const input=project.input||{}, snap=project.snapshot||{};
  const fmt=(v)=>v==null?"—":String(v);
  const facts=[["Structure type",input.type==="boulder"?"Boulder wall":"Climbing wall"],["Height",fmt(input.height)+(input.units==="USA"?" ft":" m")],["Attachment",input.type==="boulder"?"Single attachment":`${fmt(input.levels)} levels`],["Column span A",fmt(input.span)],["Overhang X",fmt(input.overhang)],["Units",input.units==="USA"?"Imperial":"Metric"]];
  return <View style={s.attached}><Text style={s.kicker}>ATTACHED CALCULATION</Text><Text style={s.attachedTitle}>{project.name}</Text><View style={s.facts}>{facts.map(([label,value])=><View key={label} style={s.fact}><Text style={s.factLabel}>{label}</Text><Text style={s.factValue}>{value}</Text></View>)}<View style={s.governing}><Text style={s.factLabel}>Governing column load</Text><Text style={s.governingValue}>{snap.governing!=null?`${snap.governing} ${snap.unit||""}`:"—"}</Text></View></View></View>;
}

function Consent({ value, onChange, text }) {
  return <View style={s.consent}><Switch value={value} onValueChange={onChange} trackColor={{ true: C.red }} /><Text style={s.consentText}>{text}</Text></View>;
}

function ProjectDropdown({ visible, projects, value, onSelect, onClose }) {
  const [query, setQuery] = useState("");
  useSmoothKeyboardResize(visible);
  useEffect(() => { if (!visible) setQuery(""); }, [visible]);
  const filtered = projects.filter((project) => String(project.name || "").toLowerCase().includes(query.trim().toLowerCase()));
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><KeyboardAvoidingView style={s.keyboardArea} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={12}><Pressable style={s.countryBackdrop} onPress={onClose}><Pressable style={s.countryModal} onPress={()=>{}}><View style={s.countryHead}><Text style={s.countryTitle}>Select saved project</Text><Pressable onPress={onClose} style={s.countryClose}><Text style={s.countryCloseText}>×</Text></Pressable></View><TextInput autoFocus value={query} onChangeText={setQuery} style={s.countrySearch} placeholder="Search project…"/><ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="none" style={s.countryList}>{filtered.map((project)=><Pressable key={project.id} onPress={()=>onSelect(project.id)} style={[s.countryOption,value===project.id&&s.countryOptionActive]}><Text style={[s.countryOptionText,value===project.id&&s.projectOptionSelected]}>{project.name}</Text></Pressable>)}{!filtered.length?<Text style={s.countryEmpty}>No matching project.</Text>:null}</ScrollView></Pressable></Pressable></KeyboardAvoidingView></Modal>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: C.bg },
  centerText: { fontFamily: FB[400], fontSize: 14, lineHeight: 20, textAlign: "center", color: C.inkSoft, marginBottom: 18 },
  kicker: { fontFamily: FD[800], fontSize: 10.5, letterSpacing: 1, color: C.red, marginBottom: 5 },
  title: { ...PAGE_TITLE, marginBottom: 7 },
  intro: { fontFamily: FB[400], fontSize: 13, lineHeight: 19, color: C.inkSoft, marginBottom: 14, textAlign:"justify" },
  card: { backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderTopColor: C.red, borderTopWidth: 3, padding: 14 },
  formSection: { paddingBottom:16, marginBottom:16, borderBottomColor:C.line, borderBottomWidth:1 },
  section: { fontFamily: FD[900], fontSize: 15, color: C.ink, marginTop: 5, marginBottom: 8 },
  choice: { borderColor: C.lineStrong, borderWidth: 1, padding: 10, marginBottom: 6 },
  choiceActive: { borderColor: C.red, backgroundColor: "#fff2f3" },
  choiceText: { fontFamily: FB[600], fontSize: 13, color: C.inkSoft },
  choiceTextActive: { color: C.red },
  topicWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  topic: { borderColor: C.lineStrong, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7 },
  topicActive: { borderColor: C.red, backgroundColor: C.red },
  topicText: { fontFamily: FB[600], fontSize: 11, color: C.inkSoft },
  topicTextActive: { color: "#fff" },
  label: { fontFamily: FB[700], fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 8, marginBottom: 5 },
  input: { borderColor: C.lineStrong, borderWidth: 1, backgroundColor: "#fff", paddingHorizontal: 11, paddingVertical: 10, fontFamily: FB[400], fontSize: 14, color: C.ink },
  countrySelect: { minHeight:43, flexDirection:"row", alignItems:"center", borderColor:C.lineStrong, borderWidth:1, backgroundColor:"#fff", paddingHorizontal:11 },
  countryValue: { flex:1, color:C.ink, fontFamily:FB[400], fontSize:14 },
  countryArrowBox: { width:24, height:24, alignItems:"center", justifyContent:"center" },
  countryArrowShape: { width:8, height:8, borderRightColor:C.inkSoft, borderBottomColor:C.inkSoft, borderRightWidth:1.5, borderBottomWidth:1.5, transform:[{rotate:"45deg"},{translateY:-2}] },
  countryBackdrop: { flex:1, backgroundColor:"transparent", justifyContent:"flex-end", paddingHorizontal:18, paddingTop:24, paddingBottom:16 },
  keyboardArea: { flex:1, backgroundColor:"rgba(12,13,18,.55)" },
  countryModal: { height:"90%", minHeight:240, backgroundColor:"#fff", borderTopColor:C.red, borderTopWidth:3, padding:14, overflow:"hidden" },
  countryHead: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:10 },
  countryTitle: { color:C.ink, fontFamily:FD[900], fontSize:17 },
  countryClose: { width:34,height:34,alignItems:"center",justifyContent:"center",borderColor:C.line,borderWidth:1 },
  countryCloseText: { color:C.ink,fontFamily:FB[400],fontSize:26,lineHeight:28 },
  countrySearch: { borderColor:C.red,borderWidth:1,backgroundColor:"#fff",paddingHorizontal:11,paddingVertical:10,fontFamily:FB[400],fontSize:14,marginBottom:8 },
  countryList: { flex:1, minHeight:0, borderColor:C.line,borderWidth:1 },
  countryOption: { paddingHorizontal:11,paddingVertical:10,borderBottomColor:C.line,borderBottomWidth:1 },
  countryOptionActive: { backgroundColor:C.surface2,borderLeftColor:C.red,borderLeftWidth:3 },
  countryOptionText: { color:C.ink,fontFamily:FB[400],fontSize:13 },
  projectOptionSelected: { color:C.red,fontFamily:FB[700] },
  countryEmpty: { color:C.inkFaint,fontFamily:FB[400],fontSize:13,textAlign:"center",padding:20 },
  message: { minHeight: 110, textAlignVertical: "top" },
  count: { fontFamily: FB[400], fontSize: 10.5, color: C.inkFaint, textAlign: "right", marginTop: 3 },
  consent: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 10 },
  consentText: { flex: 1, fontFamily: FB[400], fontSize: 12, lineHeight: 17, color: C.inkSoft, textAlign:"justify" },
  status: { fontFamily: FB[600], fontSize: 12.5, lineHeight: 18, color: C.inkSoft, marginVertical: 10 },
  sendButtonWrap: { marginTop: 10 },
  help: { fontFamily: FB[400], fontSize: 13, lineHeight: 18, color: C.inkFaint, marginBottom: 8, textAlign:"justify" },
  contact: { backgroundColor: C.navy, padding: 14, marginTop: 14 },
  contactLabel: { fontFamily: FD[800], fontSize: 10, letterSpacing: 0.8, color: C.red, marginBottom: 5 },
  contactText: { fontFamily: FB[400], fontSize: 12.5, lineHeight: 18, color: "#fff", textAlign:"justify" },
  contactLink: { textDecorationLine:"none" },
  emailLink: { color:"#fff", textDecorationLine:"underline" },
  attached: { backgroundColor:C.surface, borderColor:C.line, borderWidth:1, borderTopColor:C.navy, borderTopWidth:3, padding:16, marginTop:14 },
  attachedTitle: { fontFamily:FD[900], fontSize:17, color:C.ink, marginTop:5, marginBottom:12 },
  facts: { flexDirection:"row", flexWrap:"wrap" },
  fact: { width:"50%", padding:9, borderTopColor:C.line, borderTopWidth:1 },
  factLabel: { fontFamily:FB[400], fontSize:10.5, color:C.inkFaint, marginBottom:2 },
  factValue: { fontFamily:FB[700], fontSize:12.5, color:C.ink },
  governing: { width:"100%", backgroundColor:C.surface2, borderLeftColor:C.red, borderLeftWidth:3, padding:11, marginTop:2 },
  governingValue: { color:C.red, fontFamily:FB[700], fontSize:17, marginTop:3 },
  included: { padding:17, marginTop:4 },
  includedTitle: { fontFamily:FD[800], fontSize:12, textTransform:"uppercase", letterSpacing:.5, color:C.ink, marginBottom:8 },
  includedRow: { flexDirection:"row", marginBottom:5 },
  bullet: { width:16, color:C.red, fontFamily:FB[700] },
  includedText: { flex:1, color:C.inkSoft, fontFamily:FB[400], fontSize:12.5, lineHeight:18, textAlign:"justify" },
});


