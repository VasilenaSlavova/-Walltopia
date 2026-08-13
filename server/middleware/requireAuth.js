// Verifies the JWT and attaches req.userId. Accepts the token from either an
// `Authorization: Bearer <token>` header (mobile) or the httpOnly cookie (web). 401 otherwise.
const { COOKIE, verify } = require("../lib/token");

function tokenFrom(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return (req.cookies && req.cookies[COOKIE]) || null;
}

module.exports = function requireAuth(req, res, next) {
  const uid = verify(tokenFrom(req));
  if (!uid) return res.status(401).json({ error: "Not authenticated" });
  req.userId = uid;
  next();
};
