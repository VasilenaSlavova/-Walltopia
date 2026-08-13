// JWT sign/verify + cookie helpers. Secret comes from env (never hardcode).
const jwt = require("jsonwebtoken");

const COOKIE = "wt_token";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 24) throw new Error("JWT_SECRET missing or too short (see server/.env)");
  return s;
}

const sign = (userId) => jwt.sign({ uid: String(userId) }, secret(), { expiresIn: "7d" });

function verify(token) {
  try {
    return jwt.verify(token, secret()).uid;
  } catch {
    return null;
  }
}

function setCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

const clearCookie = (res) => res.clearCookie(COOKIE, { path: "/" });

module.exports = { COOKIE, sign, verify, setCookie, clearCookie };
