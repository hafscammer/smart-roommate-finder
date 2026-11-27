const r = require("express").Router(), { db, save, id, pub, live } = require("../db"), auth = require("../middleware/auth"), ai = require("../services/ai"), rt = require("../services/realtime");
r.use(auth);
const user = i => db.users.find(u => u.id === i);
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function resolveDemo(qid) { // a demo user answers a few seconds after the request
  const q = db.requests.find(x => x.id === qid); if (!q || q.status !== "pending" || !q.resolveAt) return;
  q.status = q.resolveTo; save(); rt.send(q.from, { type: q.status, by: pub(user(q.to)) });
}

r.get("/", wrap(async (req, res) => {
  const me = user(req.uid), mine = db.requests.filter(q => q.from === me.id || q.to === me.id);
  const others = [...new Set(mine.map(q => (q.from === me.id ? q.to : q.from)))].map(user);
  const E = await ai.enrich(me, others), M = new Map(others.map((o, i) => [o.id, E[i].match]));
  const view = q => { const o = user(q.from === me.id ? q.to : q.from); return { id: q.id, status: live(q), at: q.at, user: { ...pub(o), match: M.get(o.id) } }; };
  res.json({ incoming: db.requests.filter(q => q.to === me.id).map(view), outgoing: db.requests.filter(q => q.from === me.id).map(view) });
}));

r.post("/", auth.verified, wrap(async (req, res) => {
  const me = user(req.uid), to = +req.body.to, o = user(to);
  if (!o || o.id === me.id) return res.status(400).json({ error: "Choose another person." });
  if (me.blocked.includes(to) || o.blocked.includes(me.id)) return res.status(403).json({ error: "You cannot contact this person." });
  const m = (await ai.enrich(me, [o]))[0].match;
  if (m.block) return res.status(400).json({ error: "You and this person have a dealbreaker conflict." });
  const same = q => [q.from, q.to].sort().join() === [me.id, to].sort().join();
  if (db.requests.some(q => same(q) && ["pending", "accepted"].includes(live(q)))) return res.status(409).json({ error: "A request already exists." });
  const q = { id: id(), from: me.id, to, status: "pending", at: Date.now() };
  if (to < 100) { q.resolveAt = Date.now() + 4000; q.resolveTo = (m.them == null ? m.s : m.them) >= 50 ? "accepted" : "declined"; setTimeout(() => resolveDemo(q.id), 4000).unref(); } // demo users decide from THEIR side of the score
  db.requests.push(q); save(); rt.send(to, { type: "request", from: pub(me) }); res.status(201).json(q);
}));

r.post("/:id/respond", (req, res) => {
  const q = db.requests.find(x => x.id === +req.params.id);
  if (!q || q.to !== req.uid) return res.status(404).json({ error: "Request not found." });
  if (live(q) !== "pending") return res.status(409).json({ error: "This request is no longer pending." });
  if (!["accept", "decline"].includes(req.body.action)) return res.status(400).json({ error: "Invalid action." });
  q.status = req.body.action === "accept" ? "accepted" : "declined"; save(); rt.send(q.from, { type: q.status, by: pub(user(q.to)) }); res.json(q);
});
module.exports = r;
