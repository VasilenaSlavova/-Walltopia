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

async function deliverInquiryEmail({ inquiryId, reference, project, message, createdAt, user }) {
  let email;
  try {
    email = await sendInquiryEmail({
      reference,
      projectName: project.name,
      message,
      createdAt,
      contactName: user.name,
      replyTo: user.email,
    });
  } catch (error) {
    email = { status: "failed", error: error.message };
  }
  try {
    await col("questions").updateOne(
      { _id: inquiryId },
      { $set: {
        emailStatus: email.status,
        emailMessageId: email.messageId || null,
        emailError: email.status === "failed" ? String(email.error || "Email delivery failed").slice(0, 500) : null,
      } }
    );
  } catch (error) {
    console.error("Could not update inquiry email status", error);
  }
}

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
    const requestId = trim(req.body && req.body.requestId);
    if (message.length < 5) return res.status(400).json({ error: "Please enter your inquiry (at least 5 characters)" });
    if (message.length > 4000) return res.status(400).json({ error: "Inquiry is too long (max 4000 characters)" });
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return res.status(400).json({ error: "Invalid inquiry request ID" });

    const doc = {
      projectId: project._id,
      userId: new ObjectId(req.userId),
      requestId,
      projectName: project.name,
      message: message.slice(0, 4000),
      status: "open",
      emailStatus: "queued",
      createdAt: new Date(),
    };
    const filter = { userId: doc.userId, projectId: doc.projectId, requestId };
    const r = await col("questions").updateOne(filter, { $setOnInsert: doc }, { upsert: true });
    const inquiry = r.upsertedCount
      ? { ...doc, _id: r.upsertedId }
      : await col("questions").findOne(filter);
    const reference = String(inquiry._id).slice(-8).toUpperCase();
    if (!r.upsertedCount) {
      return res.status(200).json({ inquiry: publicQ(inquiry), email: { status: inquiry.emailStatus || "queued" }, duplicate: true });
    }
    res.status(201).json({ inquiry: publicQ(inquiry), email: { status: "queued" }, duplicate: false });
    void deliverInquiryEmail({
      inquiryId: inquiry._id,
      reference,
      project,
      message: doc.message,
      createdAt: doc.createdAt,
      user,
    });
  } catch (e) { next(e); }
});

module.exports = router;
