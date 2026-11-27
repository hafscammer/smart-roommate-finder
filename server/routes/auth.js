const r = require("express").Router(), bcrypt = require("bcryptjs"), jwt = require("jsonwebtoken"), crypto = require("crypto");
const cfg = require("../config"), { db, save, id, self } = require("../db"), auth = require("../middleware/auth"), mailer = require("../services/mailer"), limit = require("../services/limiter");
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const tok = u => jwt.sign({ uid: u.id, tv: u.tv || 0 }, cfg.jwtSecret, { expiresIn: cfg.tokenTtl });
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const bad = (res, c, m) => res.status(c).json({ error: m });
const pwOk = pw => pw.length >= 8 && /[a-z]/i.test(pw) && /\d/.test(pw);
const ip = req => req.ip || (req.socket && req.socket.remoteAddress) || "x";
const newToken = (u, field, ttl) => { const t = crypto.randomBytes(24).toString("hex"); u[field + "Hash"] = sha(t); u[field + "Exp"] = Date.now() + ttl; save(); return t; };
const sendVerify = u => { const t = newToken(u, "verify", 24 * 3600e3), link = `${cfg.appUrl}/#verify/${t}`; return mailer.send({ to: u.email, subject: "Verify your RoomieMatch email", link, text: `Welcome to RoomieMatch! Confirm your email: ${link}\n(The link expires in 24 hours.)` }); };

r.post("/signup", wrap(async (req, res) => {
  if (!limit("signup:" + ip(req), 10, 3600e3)) return bad(res, 429, "Too many sign-ups from this network. Try again later.");
  const name = String(req.body.name || "").trim(), email = String(req.body.email || "").trim().toLowerCase(), pw = String(req.body.password || "");
  if (name.length < 2) return bad(res, 400, "Enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 400, "Enter a valid email address.");
  if (!pwOk(pw)) return bad(res, 400, "Password needs 8+ characters with a letter and a number.");
  if (db.users.some(u => u.email === email)) return bad(res, 409, "That email is already registered. Log in instead.");
  const u = { id: id(), email, passHash: bcrypt.hashSync(pw, 10), name, age: 22, city: "", area: "", anchor: "", min: 100, max: 300, sleep: 3, clean: 3, guests: 3, noise: 3,
    smoke: 0, pets: 0, nosmoke: 0, nopets: 0, role: "seeker", type: "room", beds: 1, furn: 0, bio: "", profession: "", photo: "", w: { sleep: 3, clean: 3, guests: 2, noise: 2 },
    saved: [], blocked: [], movein: "", stay: "6", done: 0, verified: 0, tv: 0, fails: 0, lockUntil: 0 };
  db.users.push(u);
  [3, 6].forEach(from => db.requests.push({ id: id(), from, to: u.id, status: "pending", at: Date.now() })); // demo incoming requests
  const mail = await sendVerify(u); save();
  res.status(201).json({ token: tok(u), user: self(u), ...mail });
}));

r.post("/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase(), u = db.users.find(x => x.email === email);
  if (!limit("login:" + ip(req) + email, 15, 15 * 60e3)) return bad(res, 429, "Too many attempts. Try again in a few minutes.");
  if (u && u.lockUntil > Date.now()) return bad(res, 423, "Too many failed attempts. Try again in a few minutes.");
  if (!u || !bcrypt.compareSync(String(req.body.password || ""), u.passHash)) {
    if (u && ++u.fails >= cfg.maxAttempts) { u.fails = 0; u.lockUntil = Date.now() + cfg.lockMs; }
    save(); return bad(res, 401, "Invalid email or password.");
  }
  u.fails = 0; save(); res.json({ token: tok(u), user: self(u) });
});

r.post("/verify", (req, res) => {
  const h = sha(String(req.body.token || "")), u = db.users.find(x => x.verifyHash && x.verifyHash === h && x.verifyExp > Date.now());
  if (!u) return bad(res, 400, "This verification link is invalid or has expired.");
  u.verified = 1; u.verifyHash = ""; u.verifyExp = 0; save(); res.json({ ok: true });
});
r.post("/resend", auth, wrap(async (req, res) => {
  const u = db.users.find(x => x.id === req.uid); if (u.verified) return res.json({ ok: true, already: true });
  if (!limit("resend:" + u.id, 3, 3600e3)) return bad(res, 429, "Please wait a while before requesting another email.");
  res.json({ ok: true, ...(await sendVerify(u)) });
}));

r.post("/forgot", wrap(async (req, res) => { // always answers the same so it cannot be used to discover accounts
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!limit("forgot:" + ip(req) + email, 5, 3600e3)) return bad(res, 429, "Too many requests. Try again later.");
  const u = db.users.find(x => x.email === email); let extra = {};
  if (u && u.id >= 100) { const t = newToken(u, "reset", 3600e3), link = `${cfg.appUrl}/#reset/${t}`; extra = await mailer.send({ to: u.email, subject: "Reset your RoomieMatch password", link, text: `Reset your password: ${link}\n(The link expires in 1 hour. If you did not ask for this, ignore this email.)` }); }
  res.json({ ok: true, ...extra });
}));
r.post("/reset", (req, res) => {
  const pw = String(req.body.password || ""), h = sha(String(req.body.token || "")), u = db.users.find(x => x.resetHash && x.resetHash === h && x.resetExp > Date.now());
  if (!u) return bad(res, 400, "This reset link is invalid or has expired.");
  if (!pwOk(pw)) return bad(res, 400, "Password needs 8+ characters with a letter and a number.");
  u.passHash = bcrypt.hashSync(pw, 10); u.tv = (u.tv || 0) + 1; u.resetHash = ""; u.resetExp = 0; u.fails = 0; u.lockUntil = 0; u.verified = 1; // a working e-mail link proves ownership
  save(); res.json({ ok: true });
});

r.get("/me", auth, (req, res) => res.json(self(db.users.find(u => u.id === req.uid))));
module.exports = r;
