const jwt = require("jsonwebtoken"), cfg = require("../config"), { db, settle } = require("../db");
function auth(req, res, next) {
  try {
    const p = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), cfg.jwtSecret), u = db.users.find(x => x.id === p.uid);
    if (!u || (u.tv || 0) !== (p.tv || 0)) throw new Error("stale"); // password changes invalidate older tokens
    req.uid = u.id;
  } catch (e) { return res.status(401).json({ error: "Please log in again." }); }
  settle(); next();
}
auth.verified = (req, res, next) => {
  const u = db.users.find(x => x.id === req.uid);
  if (u && !u.verified) return res.status(403).json({ error: "Please verify your email first. We sent you a link when you signed up." });
  next();
};
module.exports = auth;
