const r = require("express").Router(), { db, save, id, pub, connected } = require("../db"), auth = require("../middleware/auth"), ai = require("../services/ai"), rt = require("../services/realtime");
r.use(auth);
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const visible = (m, me) => (m.from === me || m.to === me) && m.at <= Date.now();
const user = i => db.users.find(u => u.id === i);

r.get("/", (req, res) => { // conversations with accepted connections
  const me = req.uid, ms = db.messages.filter(m => visible(m, me));
  const ids = [...new Set(db.requests.filter(q => q.status === "accepted" && (q.from === me || q.to === me)).map(q => (q.from === me ? q.to : q.from)))];
  res.json(ids.map(i => {
    const t = ms.filter(m => m.from === i || m.to === i), last = t[t.length - 1] || null;
    return { user: pub(user(i)), last, unread: t.filter(m => m.to === me && !m.read).length };
  }).sort((a, b) => (b.last ? b.last.at : 0) - (a.last ? a.last.at : 0)));
});
r.get("/unread", (req, res) => res.json({ n: db.messages.filter(m => visible(m, req.uid) && m.to === req.uid && !m.read).length }));

// Smart replies: classify the last incoming message and propose answers filled from your profile
r.post("/suggest", wrap(async (req, res) => res.json(await ai.suggest(String(req.body.text || "").slice(0, 500), pub(user(req.uid))))));

r.get("/:uid", (req, res) => {
  const me = req.uid, o = +req.params.uid;
  if (!connected(me, o)) return res.status(403).json({ error: "Connect with this person first." });
  const t = db.messages.filter(m => visible(m, me) && (m.from === o || m.to === o)), fresh = t.filter(m => m.to === me && !m.read);
  fresh.forEach(m => { m.read = true; }); save();
  if (fresh.length) rt.send(o, { type: "read", by: me }); // read receipt
  res.json(t);
});

r.post("/:uid", auth.verified, wrap(async (req, res) => {
  const me = req.uid, o = +req.params.uid, text = String(req.body.text || "").trim().slice(0, 1000);
  if (!connected(me, o)) return res.status(403).json({ error: "Connect with this person first." });
  if (!text) return res.status(400).json({ error: "Write a message first." });
  const mod = await ai.moderate(text); if (mod.action === "block") return res.status(400).json({ error: mod.reason });
  const m = { id: id(), from: me, to: o, text, at: Date.now() }; db.messages.push(m);
  rt.send(o, { type: "message", message: m, from: pub(user(me)) });

  save(); res.status(201).json({ ...m, warning: mod.action === "warn" ? mod.reason : undefined });
}));
module.exports = r;
