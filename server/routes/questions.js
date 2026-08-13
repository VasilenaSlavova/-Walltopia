// Engineering Support inquiry for a specific project. Auth required; project must belong to the user.
const express = require("express");
const { ObjectId } = require("mongodb");
const { col } = require("../db");
const { trim } = require("../lib/validate");
const requireAuth = require("../middleware/requireAuth");
const { sendInquiryEmail } = require("../lib/mailer");

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

const oid = (id) => { try { return new ObjectId(id); } catch { return null; } };
const publicQ = (q) => ({ id: String(q._id), message: q.message, createdAt: q.createdAt, status: q.status || "open" });

async function ownedProject(req) {
  const id = oid(req.params.projectId);
  if (!id) return null;
  return col("projects").findOne({ _id: id, userId: new ObjectId(req.userId) });
}

router.post("/", async (req, res, next) => {
  try {
    const project = await ownedProject(req);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const user = await col("users").findOne({ _id: new ObjectId(req.userId) });
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const message = trim(req.body && req.body.message);
    if (message.length < 5) return res.status(400).json({ error: "Please enter your inquiry (at least 5 characters)" });
    if (message.length > 4000) return res.status(400).json({ error: "Inquiry is too long (max 4000 characters)" });

    const doc = {
      projectId: project._id,
      userId: new ObjectId(req.userId),
      projectName: project.name,
      message: message.slice(0, 4000),
      status: "open",
      createdAt: new Date(),
    };
    const r = await col("questions").insertOne(doc);
    const reference = String(r.insertedId).slice(-8).toUpperCase();
    let email = { status: "not_configured" };
    try {
      email = await sendInquiryEmail({
        reference,
        projectName: project.name,
        message: doc.message,
        createdAt: doc.createdAt,
        contactName: user.name,
        replyTo: user.email,
      });
    } catch (error) {
      email = { status: "failed", error: error.message };
    }
    await col("questions").updateOne(
      { _id: r.insertedId },
      { $set: { emailStatus: email.status, emailMessageId: email.messageId || null } }
    );
    res.status(201).json({ inquiry: publicQ({ ...doc, _id: r.insertedId }), email });
  } catch (e) { next(e); }
});

module.exports = router;
