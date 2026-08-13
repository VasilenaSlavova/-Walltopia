/* REST client for mobile. Same endpoints as web (see server/API.md), but auth is a
   Bearer token stored in SecureStore (no cookies on React Native). */
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// Where the phone reaches the API. Override in app.json -> expo.extra.apiBase (LAN IP or deployed URL).
const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || Constants.manifest2?.extra || {};
const BASE = extra.apiBase || "http://localhost:8787/api";
const REQUEST_TIMEOUT_MS = 15000;
const TOKEN_KEY = "wt_token";

// Visible in the Metro console on app start so you can confirm which URL the app will call.
console.log("[api] base URL:", BASE);

let token = null;
export async function loadToken() { token = await SecureStore.getItemAsync(TOKEN_KEY); return token; }
async function setToken(t) { token = t || null; if (t) await SecureStore.setItemAsync(TOKEN_KEY, t); else await SecureStore.deleteItemAsync(TOKEN_KEY); }

export class ApiError extends Error {
  constructor(message, status) { super(message); this.name = "ApiError"; this.status = status; }
}

async function req(method, path, body) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  // Query logging (no bodies/tokens logged — they can contain secrets). Shows in the Metro console.
  console.log(`[api] -> ${method} ${path}  (${BASE})`);

  // Abort if the request hangs, so the UI never gets stuck on "Please wait…".
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
  } catch (e) {
    clearTimeout(timer);
    const timedOut = e && e.name === "AbortError";
    console.error(`[api] ${method} ${path} -> ${timedOut ? "timed out" : "network error"}  (${BASE})`);
    throw new ApiError(
      timedOut
        ? `Request timed out — the app can't reach ${BASE}. Check the IP in app.json, that the phone is on the same Wi-Fi, and that the server + firewall allow port 8787.`
        : `Can't reach the server at ${BASE}. Is it running and reachable from your phone?`,
      0
    );
  }
  clearTimeout(timer);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    console.warn(`[api] ${method} ${path} -> ${res.status}${data && data.error ? " " + data.error : ""}`);
    throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status);
  }
  console.log(`[api] ${method} ${path} -> ${res.status}`);
  return data;
}

export const api = {
  base: BASE,
  loads: () => req("GET", "/loads"),
  me: () => req("GET", "/auth/me"),
  register: async (name, email, password) => { const r = await req("POST", "/auth/register", { name, email, password }); await setToken(r.token); return r; },
  login: async (email, password) => { const r = await req("POST", "/auth/login", { email, password }); await setToken(r.token); return r; },
  logout: async () => { try { await req("POST", "/auth/logout"); } catch (e) {} await setToken(null); },
  listProjects: (params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    return req("GET", "/projects" + (qs ? "?" + qs : ""));
  },
  listTags: () => req("GET", "/projects/meta/tags"),
  getProject: (id) => req("GET", "/projects/" + id),
  createProject: (p) => req("POST", "/projects", p),
  updateProject: (id, p) => req("PUT", "/projects/" + id, p),
  deleteProject: (id) => req("DELETE", "/projects/" + id),
  sendSupportInquiry: (id, message) => req("POST", `/projects/${id}/support-inquiries`, { message }),
};
