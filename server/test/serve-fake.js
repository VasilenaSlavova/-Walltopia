// Dev server backed by the in-memory DB stand-in (no MongoDB/DNS needed).
// For local UI testing only — data resets on restart. Real runs use `npm start` + Atlas.
process.env.JWT_SECRET = process.env.JWT_SECRET || "dev-fake-secret-at-least-24-characters-long";
process.env.NODE_ENV = "development";
const db = require("../db");
const { makeFakeDb } = require("./fakeDb");
db.__setDbForTest(makeFakeDb());

const app = require("../server");
const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log("[serve-fake] in-memory server on http://localhost:" + PORT));
