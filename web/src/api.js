/* REST client for the web app. Same endpoints as mobile (see server/API.md).
   Web uses the httpOnly cookie session (credentials: "include"); no token handling needed. */
const BASE = import.meta.env.VITE_API_BASE || "/api";

export class ApiError extends Error {
  constructor(message, status) { super(message); this.name = "ApiError"; this.status = status; }
}

async function req(method, path, body) {
  // Query logging (no bodies/tokens logged — they can contain secrets).
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    console.error(`[api] ${method} ${path} -> network error`);
    throw new ApiError("Can't reach the server. Is it running?", 0);
  }
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
  // public
  loads: () => req("GET", "/loads"),
  // auth
  me: () => req("GET", "/auth/me"),
  register: (name, email, password) => req("POST", "/auth/register", { name, email, password }),
  login: (email, password) => req("POST", "/auth/login", { email, password }),
  logout: () => req("POST", "/auth/logout"),
  // projects
  listProjects: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    const s = qs.toString();
    return req("GET", "/projects" + (s ? "?" + s : ""));
  },
  listTags: () => req("GET", "/projects/meta/tags"),
  getProject: (id) => req("GET", "/projects/" + id),
  createProject: (p) => req("POST", "/projects", p),
  updateProject: (id, p) => req("PUT", "/projects/" + id, p),
  deleteProject: (id) => req("DELETE", "/projects/" + id),
  // questions
  listQuestions: (id) => req("GET", `/projects/${id}/questions`),
  askQuestion: (id, message) => req("POST", `/projects/${id}/questions`, { message }),
};
