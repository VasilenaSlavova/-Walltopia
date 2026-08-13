// Walltopia brand tokens for React Native.
export const C = {
  red: "#EC1C24",
  redDark: "#C30F16",
  navy: "#212331",
  navy2: "#2C2E3D",
  ink: "#16181F",
  inkSoft: "#454955",
  inkFaint: "#878D99",
  line: "#E2E4E8",
  lineStrong: "#C7CAD0",
  bg: "#ECEEF1",
  surface: "#FFFFFF",
  surface2: "#F4F5F7",
  ok: "#1F7A43",
  okSoft: "#E6F4EC",
  bad: "#C30F16",
  badSoft: "#FDEAEB",
  dl: "#2C2E3D",
  ll: "#EC1C24",
  white: "#FFFFFF",
};

// Google Fonts variants (loaded in App.js via @expo-google-fonts). RN needs a distinct
// font family per weight — Android ignores fontWeight when a custom fontFamily is set — so we
// reference the exact variant instead of a numeric weight.
export const FD = { 700: "Montserrat_700Bold", 800: "Montserrat_800ExtraBold", 900: "Montserrat_900Black" }; // display
export const FB = { 400: "OpenSans_400Regular", 600: "OpenSans_600SemiBold", 700: "OpenSans_700Bold" };      // body
export const PAGE_TITLE = { fontFamily: FD[900], fontSize: 20, lineHeight: 25, letterSpacing: -0.4, color: C.ink };
