// Walltopia loads — API + static host.
// Serves the ../website frontend and mounts the /api routes. One origin, no CORS in the common case.
require("dotenv").config();
const path = require("path");
const os = require("os");
const express = require("express");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { connect, isConnected } = require("./db");

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());

// CORS for cross-origin browser clients (Vite dev server, a separately hosted web app).
// Mobile (React Native) uses Bearer tokens and isn't subject to CORS.
const devOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const origins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
const allowOrigins = origins.length ? origins : (process.env.NODE_ENV !== "production" ? devOrigins : []);
if (allowOrigins.length) {
  app.use((req, res, next) => {
    const o = req.headers.origin;
    if (o && allowOrigins.includes(o)) {
      res.header("Access-Control-Allow-Origin", o);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
}

// Brute-force protection on auth endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

// Disable HTTP keep-alive for the API. React Native's Android HTTP stack (OkHttp) can reuse a
// pooled connection that Node has just closed, which silently loses concurrent requests/responses
// (server answers but the phone never receives it). Closing the connection per response forces a
// fresh socket each time and avoids the race. (Static assets keep keep-alive — browsers are fine.)
app.use("/api", (req, res, next) => { res.set("Connection", "close"); next(); });

// Log every query that reaches the backend: arrival, then method, path, response status code,
// duration, and (on failure) the error message. Request bodies and success payloads are NOT
// logged — they can contain passwords / auth tokens.
app.use("/api", (req, res, next) => {
  const start = Date.now();
  console.log(`[api] <-   ${req.method} ${req.originalUrl}`);
  let payload;
  const json = res.json.bind(res);
  res.json = (body) => { payload = body; return json(body); };
  res.on("finish", () => {
    const ms = Date.now() - start;
    const code = res.statusCode;
    const level = code >= 500 ? "ERR " : code >= 400 ? "WARN" : "OK  ";
    const err = code >= 400 && payload && payload.error ? " — " + payload.error : "";
    console.log(`[api] ${level} ${req.method} ${req.originalUrl} -> ${code} (${ms}ms)${err}`);
  });
  next();
});

app.get("/api/health", (req, res) => res.json({ ok: true, db: isConnected() }));

// Public: load tables — no DB needed, so it's mounted before the DB guard (works even if Atlas is down).
app.use("/api/loads", require("./routes/loads"));

// Degrade gracefully: if the DB never connected, return 503 (not a crash) on data routes.
app.use("/api", (req, res, next) => {
  if (!isConnected()) return res.status(503).json({ error: "Database unavailable — try again shortly" });
  next();
});

app.use("/api/auth", authLimiter, require("./routes/auth"));
// Engineering Support inquiries are nested under a project.
app.use("/api/projects/:projectId/support-inquiries", require("./routes/questions"));
app.use("/api/projects", require("./routes/projects"));

// JSON 404 for unknown API routes (before static, so /api/* never falls through to the SPA)
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Static frontend: the developed website/ version is the canonical desktop
// site. It contains the current calculator, engineering visualisations,
// Technical Documentation and Engineering Support pages. The separate React
// build is not served at the root because it is an older parallel prototype.
const legacyDir = path.join(__dirname, "..", "website");
app.use(express.static(legacyDir, { extensions: ["html"] }));
// Non-API browser routes fall back to the canonical calculator page.
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(legacyDir, "index.html")));

// Central error handler — logs detail server-side, returns a safe message
app.use((err, req, res, next) => {
  console.error("[error]", err && err.message ? err.message : err);
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 8787;

async function start() {
  // Start serving the frontend immediately. Database-backed API routes already
  // return 503 until MongoDB connects, so a slow Atlas connection must not make
  // the entire local website appear offline.
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] http://localhost:${PORT}`);
    const lan = [];
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const ni of nets[name] || []) {
        if (ni.family === "IPv4" && !ni.internal) lan.push(ni.address);
      }
    }
    if (lan.length) {
      console.log("[server] reachable from your phone at:");
      lan.forEach((ip) => console.log(`           http://${ip}:${PORT}   (set mobile app.json extra.apiBase to http://${ip}:${PORT}/api)`));
      console.log("[server] if the phone can't connect: allow port " + PORT + " through Windows Firewall (see below), and confirm the phone is on the same Wi-Fi.");
    }
  });

  try {
    await connect();
    console.log("[db] connected to", process.env.DB_NAME || "walltopia");
  } catch (e) {
    console.error("[db] connection failed:", e.message);
    if (/querySrv|ESERVFAIL|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/.test(String(e.message))) {
      console.error("      This is a DNS problem (the mongodb+srv:// SRV lookup), NOT the Atlas IP allow-list.");
      console.error("      Fixes, easiest first:");
      console.error("        1) Test it:  nslookup -type=SRV _mongodb._tcp.cluster0.gufvthn.mongodb.net");
      console.error("        2) Set DNS_SERVERS=8.8.8.8,1.1.1.1 in server/.env (uses public DNS), or change your");
      console.error("           network adapter's DNS to 8.8.8.8 / 1.1.1.1, then restart.");
      console.error("        3) Or use the STANDARD (non-SRV) string from Atlas: Connect → Drivers → pick an older");
      console.error("           driver version to reveal the mongodb://host1,host2,host3/... string, and put it in .env.");
      console.error("        4) Corporate network / VPN? Try a different network (e.g. phone hotspot) to confirm.");
    } else {
      console.error("      Check MONGODB_URI in server/.env and that your IP is allowed in Atlas → Network Access.");
    }
    // Keep serving the static site + return 503 on DB-backed routes rather than crashing.
  }
}

if (require.main === module) start();

module.exports = app;
