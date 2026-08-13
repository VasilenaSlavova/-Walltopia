// Projects CRUD (per-user) with tags, custom properties, and filters. Auth required.
const express = require("express");
const { ObjectId } = require("mongodb");
const { col } = require("../db");
const { trim, isStr, cleanTags, cleanProps, cleanInput } = require("../lib/validate");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

const oid = (id) => { try { return new ObjectId(id); } catch { return null; } };

function cleanSnapshot(v) {
  if (!v || typeof v !== "object") return {};
  const out = {};
  if (isStr(v.title)) out.title = v.title.slice(0, 120);
  if (isStr(v.summary)) out.summary = v.summary.slice(0, 200);
  if (isStr(v.unit)) out.unit = v.unit.slice(0, 8);
  if (typeof v.governing === "number" && isFinite(v.governing)) out.governing = v.governing;
  if (isStr(v.verdict)) out.verdict = v.verdict.slice(0, 24);
  return out;
}

function projectFromBody(body, userId) {
  return {
    userId,
    name: trim(body.name).slice(0, 120) || "Untitled project",
    tags: cleanTags(body.tags),
    properties: cleanProps(body.properties),
    input: cleanInput(body.input),
    snapshot: cleanSnapshot(body.snapshot),
  };
}
const publicProject = (p) => ({
  id: String(p._id), name: p.name, tags: p.tags || [], properties: p.properties || [],
  input: p.input || {}, snapshot: p.snapshot || {}, createdAt: p.createdAt, updatedAt: p.updatedAt,
});

// list, with filters: ?tag=&q=&sort=updated|created|name
router.get("/", async (req, res, next) => {
  try {
    const userId = new ObjectId(req.userId);
    const query = { userId };
    const tag = trim(req.query.tag);
    if (tag) query.tags = tag;
    let items = await col("projects").find(query).toArray();

    const q = trim(req.query.q).toLowerCase();
    if (q) {
      items = items.filter((p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        (p.properties || []).some((pr) => (pr.key + " " + pr.value).toLowerCase().includes(q))
      );
    }
    const sort = trim(req.query.sort) || "updated";
    items.sort((a, b) =>
      sort === "name" ? (a.name || "").localeCompare(b.name || "")
      : sort === "created" ? new Date(b.createdAt) - new Date(a.createdAt)
      : new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    res.json({ projects: items.map(publicProject) });
  } catch (e) { next(e); }
});

// distinct tags for the filter UI
router.get("/meta/tags", async (req, res, next) => {
  try {
    const tags = await col("projects").distinct("tags", { userId: new ObjectId(req.userId) });
    res.json({ tags: tags.filter(Boolean).sort() });
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const now = new Date();
    const doc = { ...projectFromBody(req.body || {}, new ObjectId(req.userId)), createdAt: now, updatedAt: now };
    const r = await col("projects").insertOne(doc);
    res.status(201).json({ project: publicProject({ ...doc, _id: r.insertedId }) });
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    if (!id) return res.status(400).json({ error: "Bad project id" });
    const p = await col("projects").findOne({ _id: id, userId: new ObjectId(req.userId) });
    if (!p) return res.status(404).json({ error: "Project not found" });
    res.json({ project: publicProject(p) });
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    if (!id) return res.status(400).json({ error: "Bad project id" });
    const userId = new ObjectId(req.userId);
    const set = { ...projectFromBody(req.body || {}, userId), updatedAt: new Date() };
    delete set.userId; // never reassign ownership
    const r = await col("projects").updateOne({ _id: id, userId }, { $set: set });
    if (!r.matchedCount) return res.status(404).json({ error: "Project not found" });
    const p = await col("projects").findOne({ _id: id, userId });
    res.json({ project: publicProject(p) });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    if (!id) return res.status(400).json({ error: "Bad project id" });
    const r = await col("projects").deleteOne({ _id: id, userId: new ObjectId(req.userId) });
    if (!r.deletedCount) return res.status(404).json({ error: "Project not found" });
    await col("questions").deleteMany({ projectId: id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
