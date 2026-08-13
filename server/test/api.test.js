// End-to-end API test over loopback with the in-memory DB stand-in. No network/DNS needed.
// Run: node test/api.test.js
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-least-24-characters-long-xxxx";
process.env.NODE_ENV = "test";

const assert = require("assert");
const db = require("../db");
const { makeFakeDb } = require("./fakeDb");
db.__setDbForTest(makeFakeDb());

const app = require("../server");

let base, cookie = "";
function jar(res) {
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of set) { const m = c.match(/^wt_token=([^;]*)/); if (m) cookie = m[1] ? "wt_token=" + m[1] : ""; }
}
async function call(method, path, body, withCookie = true) {
  const headers = { "Content-Type": "application/json" };
  if (withCookie && cookie) headers.Cookie = cookie;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  jar(res);
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

(async () => {
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  let pass = 0;
  const ok = (cond, label) => { assert(cond, label); console.log("  ok -", label); pass++; };

  try {
    // health
    ok((await call("GET", "/api/health")).json.ok === true, "health ok");

    // register validation
    ok((await call("POST", "/api/auth/register", { name: "A", email: "bad", password: "short" })).status === 400, "register rejects bad email");
    ok((await call("POST", "/api/auth/register", { name: "A", email: "a@b.com", password: "short" })).status === 400, "register rejects short password");

    // register
    let r = await call("POST", "/api/auth/register", { name: "Vasi", email: "Vasi@Example.com", password: "supersecret1" });
    ok(r.status === 201 && r.json.user.email === "vasi@example.com", "register creates user (email lowercased)");
    ok(!!cookie, "register sets auth cookie");

    // me
    ok((await call("GET", "/api/auth/me")).json.user.name === "Vasi", "me returns current user");
    ok((await call("GET", "/api/auth/me", null, false)).status === 401, "me is 401 without cookie");

    // duplicate email
    ok((await call("POST", "/api/auth/register", { name: "X", email: "vasi@example.com", password: "anotherpass1" })).status === 409, "duplicate email -> 409");

    // login
    ok((await call("POST", "/api/auth/login", { email: "vasi@example.com", password: "wrong" })).status === 401, "wrong password -> 401");
    r = await call("POST", "/api/auth/login", { email: "vasi@example.com", password: "supersecret1" });
    ok(r.status === 200 && r.json.user.email === "vasi@example.com", "login succeeds");
    ok(typeof r.json.token === "string" && r.json.token.length > 20, "login returns a bearer token (for mobile)");
    const bearer = r.json.token;

    // public loads endpoint (no auth needed)
    const loads = await fetch(base + "/api/loads");
    const loadsJson = await loads.json();
    ok(loads.status === 200 && Object.keys(loadsJson.walls).length === 11 && loadsJson.boulder.rows.length === 70, "GET /api/loads returns tables");

    // Bearer-token auth (mobile path): works with NO cookie, header only
    const bres = await fetch(base + "/api/auth/me", { headers: { Authorization: "Bearer " + bearer } });
    ok(bres.status === 200 && (await bres.json()).user.email === "vasi@example.com", "Bearer token authenticates (mobile)");
    const bbad = await fetch(base + "/api/projects", { headers: { Authorization: "Bearer not-a-real-token" } });
    ok(bbad.status === 401, "invalid Bearer token -> 401");

    // projects require auth
    ok((await call("GET", "/api/projects", null, false)).status === 401, "projects list needs auth");

    // create project
    const payload = {
      name: "Gym A — 12m wall",
      tags: ["gym", "eu", "gym"], // dupe should collapse
      properties: [{ key: "Client", value: "Acme" }, { key: "City", value: "Sofia" }],
      input: { units: "EU", type: "wall", height: 12, levels: 3, span: 6, overhang: 1, force: 1 },
      snapshot: { title: "Climbing wall 12 m", unit: "kN", governing: 14.01, verdict: "neutral" },
    };
    r = await call("POST", "/api/projects", payload);
    ok(r.status === 201 && r.json.project.id, "create project");
    const pid = r.json.project.id;
    ok(r.json.project.tags.length === 2, "tags deduped");
    ok(r.json.project.properties.length === 2, "custom properties stored");

    // list + filters
    ok((await call("GET", "/api/projects")).json.projects.length === 1, "list returns project");
    ok((await call("GET", "/api/projects?tag=gym")).json.projects.length === 1, "filter by tag matches");
    ok((await call("GET", "/api/projects?tag=nope")).json.projects.length === 0, "filter by missing tag empty");
    ok((await call("GET", "/api/projects?q=acme")).json.projects.length === 1, "text search hits custom property");
    ok((await call("GET", "/api/projects/meta/tags")).json.tags.join(",") === "eu,gym", "distinct tags for filter UI");

    // get one
    ok((await call("GET", "/api/projects/" + pid)).json.project.name === "Gym A — 12m wall", "get project by id");
    ok((await call("GET", "/api/projects/deadbeef")).status === 400, "bad id -> 400");

    // update
    r = await call("PUT", "/api/projects/" + pid, { ...payload, name: "Gym A — revised", tags: ["gym"] });
    ok(r.status === 200 && r.json.project.name === "Gym A — revised", "update project");

    // question (auth-gated, project-owned)
    ok((await call("POST", "/api/projects/" + pid + "/support-inquiries", { message: "hi" })).status === 400, "short support inquiry rejected");
    ok((await call("POST", "/api/projects/" + pid + "/support-inquiries", { message: "Please review this project-specific calculation." })).status === 201, "post support inquiry");

    // ownership isolation: a second user cannot see the first user's project
    cookie = "";
    await call("POST", "/api/auth/register", { name: "Bob", email: "bob@example.com", password: "supersecret1" });
    ok((await call("GET", "/api/projects")).json.projects.length === 0, "second user sees no projects (isolation)");
    ok((await call("GET", "/api/projects/" + pid)).status === 404, "second user cannot read others' project");
    ok((await call("POST", "/api/projects/" + pid + "/support-inquiries", { message: "Unauthorised project inquiry" })).status === 404, "second user cannot submit support for another user's project");

    // delete (as owner)
    cookie = "";
    await call("POST", "/api/auth/login", { email: "vasi@example.com", password: "supersecret1" });
    ok((await call("DELETE", "/api/projects/" + pid)).json.ok === true, "delete project");
    ok((await call("GET", "/api/projects/" + pid)).status === 404, "deleted project gone");

    // logout
    ok((await call("POST", "/api/auth/logout")).json.ok === true, "logout");

    console.log("\nALL " + pass + " CHECKS PASSED");
  } catch (e) {
    console.error("\nFAILED:", e.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
})();
