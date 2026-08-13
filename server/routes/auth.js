// Register / login / logout / me. Passwords hashed with bcrypt; session via JWT cookie.
const express = require("express");
const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const { col } = require("../db");
const { sign, setCookie, clearCookie } = require("../lib/token");
const { trim, validEmail } = require("../lib/validate");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email });

router.post("/register", async (req, res, next) => {
  try {
    const name = trim(req.body && req.body.name).slice(0, 80);
    const email = validEmail(req.body && req.body.email);
    const password = (req.body && req.body.password) || "";
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!email) return res.status(400).json({ error: "A valid email is required" });
    if (typeof password !== "string" || password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    let result;
    try {
      result = await col("users").insertOne({ name, email, passwordHash, createdAt: now });
    } catch (e) {
      if (e && e.code === 11000) return res.status(409).json({ error: "An account with this email already exists" });
      throw e;
    }
    const token = sign(result.insertedId);
    setCookie(res, token);
    res.status(201).json({ user: publicUser({ _id: result.insertedId, name, email }), token });
  } catch (e) { next(e); }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = validEmail(req.body && req.body.email);
    const password = (req.body && req.body.password) || "";
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const user = await col("users").findOne({ email });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) return res.status(401).json({ error: "Invalid email or password" }); // generic — no user enumeration

    const token = sign(user._id);
    setCookie(res, token);
    res.json({ user: publicUser(user), token });
  } catch (e) { next(e); }
});

router.post("/logout", (req, res) => {
  clearCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await col("users").findOne({ _id: new ObjectId(req.userId) });
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

module.exports = router;
