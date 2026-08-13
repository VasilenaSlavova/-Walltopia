# mobile — React Native (Expo) app

The phone client. Calls the **same REST API** as the web app (see [`../server/API.md`](../server/API.md)),
but authenticates with a **Bearer token** stored in `expo-secure-store` (no cookies on RN).

## Run

```bash
npm install
npm start        # Expo dev server — open in Expo Go or an iOS/Android simulator
```

### Point it at your backend (important)

A phone can't reach your computer's `localhost`. Edit **`app.json` → `expo.extra.apiBase`** to a
URL the device can reach:

- **Same Wi-Fi (Expo Go on a real phone):** your machine's LAN IP — `http://192.168.x.x:8787/api`
  (find it with `ipconfig`). Make sure the backend is running and your firewall allows port 8787.
- **Android emulator:** `http://10.0.2.2:8787/api`.
- **Deployed backend:** its public `https://…/api` URL.

## Structure

```
App.js                   root: fonts, header, bottom tabs (Calculator / Projects / Manual), login modal
src/
├── api.js               REST client — Bearer token in SecureStore
├── auth.js              AuthProvider + useAuth (token persistence)
├── lib/loads.js         load-table calculation logic (identical to web/src/lib/loads.js)
├── theme.js             Walltopia brand colors + font families (FD = Montserrat, FB = Open Sans)
├── manualPages.json     per-page manual transcript (same data as web)
├── components/          ui (Btn/Segmented/Chips/Field), Header, LoginModal
└── screens/             CalculatorScreen, DashboardScreen, ManualScreen
```

## Feature parity with web

Calculator (wall/boulder, EU/US, force levels, applicability check) · register/login · save
projects with tags + custom properties · dashboard with search / tag filter / sort · open & edit ·
ask Walltopia questions about a saved project · **Manual tab**: the 20-page application manual
(images loaded from the backend, with per-page text) and the attachment-details CAD sheet
(pinch-to-zoom / pan). The calculation logic is byte-for-byte the same module as the web app.

## Typography

Uses the real Walltopia pairing — **Montserrat** (headings/labels/buttons) and **Open Sans**
(body) — via `@expo-google-fonts`. `App.js` loads the weights with `useFonts` and holds the UI
until they're ready; `theme.js` exposes them as `FD`/`FB` (RN needs a distinct family per weight).

The application header uses the official Walltopia SVG wordmark. The Manual tab needs
the backend reachable (it loads the page images by URL from the same host as the API).
