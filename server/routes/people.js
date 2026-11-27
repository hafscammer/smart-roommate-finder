const r = require("express").Router(), { db, save, id, pub, self, live, pair } = require("../db"), auth = require("../middleware/auth"), ai = require("../services/ai");
const photos = require("../services/photos"), places = require("../services/places");
r.use(auth);
const clamp = (v, a, b, d) => Math.min(b, Math.max(a, +v || d)), find = i => db.users.find(u => String(u.id) === String(i));
const hidden = (me, o) => me.blocked.includes(o.id) || o.blocked.includes(me.id);
const rel = (me, o) => { const x = db.requests.filter(k => pair(k, me.id, o.id)).pop(); if (!x) return ""; const s = live(x); return s === "pending" ? (x.from === me.id ? "pending-out" : "pending-in") : s; };
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const decorate = async (me, L) => { const E = await ai.enrich(me, L); return L.map((o, i) => ({ ...pub(o), tags: [...new Set([o.profession, ...E[i].tags].filter(Boolean))].slice(0, 2), persona: E[i].persona || "", match: E[i].match, rel: rel(me, o), saved: me.saved.includes(o.id), feedback: (db.feedback.find(f => f.by === me.id && f.target === o.id) || {}).value || "" })); };
const rk = o => (o.match.rank != null ? o.match.rank : o.match.s);
const SORT = { match: (a, b) => rk(b) - rk(a), budget: (a, b) => a.min - b.min, new: (a, b) => b.id - a.id };
const nf = res => res.status(404).json({ error: "Profile not found." });
const verdict = (p, u) => { const ask = ((+u.min || 0) + (+u.max || 0)) / 2; return !ask ? "" : ask < p.low * 0.9 ? "below" : ask > p.high * 1.1 ? "above" : "fair"; };

// Ranked list. Filters: city, max, type, beds, furn, role, saved. Sort: match, budget, new
r.get("/", wrap(async (req, res) => {
  const me = find(req.uid), q = req.query, city = String(q.city || "").toLowerCase();
  const L = db.users.filter(o => o.id !== me.id && !hidden(me, o))
    .filter(o => !city || o.city.toLowerCase().includes(city))
    .filter(o => !q.max || o.min <= +q.max)
    .filter(o => !q.type || o.type === q.type)
    .filter(o => !q.beds || (+q.beds >= 3 ? o.beds >= 3 : o.beds === +q.beds))
    .filter(o => !q.furn || o.furn === 1)
    .filter(o => !q.role || o.role === q.role)
    .filter(o => !q.saved || me.saved.includes(o.id));
  res.json((await decorate(me, L)).sort(SORT[q.sort] || SORT.match));
}));

r.put("/me", wrap(async (req, res) => {
  const u = find(req.uid), b = req.body || {};
  if (typeof b.bio === "string" && b.bio.trim()) { // safety classifier runs before anything is changed
    const m = await ai.moderate(b.bio);
    if (m.action !== "allow") return res.status(400).json({ error: m.label === "contact" ? "Please remove phone numbers, e-mails and social handles from your description. Chat inside RoomieMatch first." : "Your description contains content that is not allowed." });
  }
  if (typeof b.photo === "string") {
    if (b.photo === "") await photos.remove(u);
    else { const err = await photos.save(u, b.photo); if (err) return res.status(400).json({ error: err }); }
  }
  ["name", "city", "bio"].forEach(k => { if (typeof b[k] === "string") u[k] = b[k].trim().slice(0, k === "bio" ? 500 : 60); });
  ["min", "max"].forEach(k => { if (isFinite(b[k]) && b[k] !== "") u[k] = Math.max(0, +b[k]); });
  if (isFinite(b.age) && b.age !== "") u.age = clamp(b.age, 18, 99, 22);
  if (isFinite(b.beds)) u.beds = clamp(b.beds, 1, 10, 1);
  ["sleep", "clean", "guests", "noise"].forEach(k => { if (b[k] != null) u[k] = clamp(b[k], 1, 5, 3); if (b.w && b.w[k] != null) u.w[k] = clamp(b.w[k], 1, 5, 3); });
  ["smoke", "pets", "nosmoke", "nopets", "furn", "wfh", "veg"].forEach(k => { if (b[k] != null) u[k] = b[k] ? 1 : 0; });
  if (["host", "seeker"].includes(b.role)) u.role = b.role;
  if (["room", "flat", "house", "studio"].includes(b.type)) u.type = b.type;
  if (typeof b.movein === "string" && (b.movein === "" || /^\d{4}-\d{2}-\d{2}$/.test(b.movein))) u.movein = b.movein;
  if (["3", "6", "12"].includes(String(b.stay))) u.stay = String(b.stay);
  if (typeof b.profession === "string") u.profession = b.profession.trim().slice(0, 40);
  ["area", "anchor"].forEach(k => { if (typeof b[k] === "string" && places.valid(b[k])) u[k] = b[k]; });
  u.done = 1; save(); res.json(self(u));
}));

r.post("/tags", wrap(async (req, res) => res.json(await ai.tagsFor(req.body || {}))));
r.post("/extract", wrap(async (req, res) => res.json(await ai.extract(String(req.body.bio || "").slice(0, 1000)))));
r.post("/price", wrap(async (req, res) => { // AI price check for the profile wizard
  const b = req.body || {}, p = await ai.rent({ city: String(b.city || ""), type: b.type, beds: +b.beds || 1, furn: b.furn ? 1 : 0, area: places.valid(b.area) ? b.area : "" });
  res.json({ ...p, verdict: verdict(p, b) });
}));

r.get("/:id/similar", wrap(async (req, res) => { // "People like them"
  const me = find(req.uid), o = find(+req.params.id); if (!o || hidden(me, o)) return nf(res);
  const pool = db.users.filter(x => x.id !== o.id && x.id !== me.id && !hidden(me, x)), found = await ai.similar(o, pool), byId = new Map(pool.map(p => [p.id, p]));
  const picked = found.map(f => byId.get(f.id)).filter(Boolean), dec = await decorate(me, picked);
  res.json(dec.map(d => ({ ...d, why: (found.find(f => f.id === d.id) || {}).why || [] })));
}));
r.get("/:id", wrap(async (req, res) => {
  const me = find(req.uid), o = find(+req.params.id); if (!o || o.id === me.id || hidden(me, o)) return nf(res);
  const out = (await decorate(me, [o]))[0], p = await ai.rent(o); out.price = { ...p, verdict: verdict(p, o) }; res.json(out);
}));
// Explicit human preference labels power the active-learning loop. One current label per user/profile.
r.post("/:id/feedback", (req, res) => {
  const me = find(req.uid), targetId = String(req.params.id || "").trim();
  const target = find(targetId), value = req.body && req.body.value;
  if (!me) return res.status(401).json({ error: "Please sign in again." });
  if (!target || String(target.id) === String(me.id)) return nf(res);
  if (!["like", "skip"].includes(value)) return res.status(400).json({ error: "Feedback must be like or skip." });
  if (!Array.isArray(db.feedback)) db.feedback = [];
  let row = db.feedback.find(f => String(f.by) === String(me.id) && String(f.target) === String(target.id));
  if (!row) { row = { id: id(), by: me.id, target: target.id, value, at: Date.now() }; db.feedback.push(row); }
  else { row.value = value; row.at = Date.now(); }
  save();
  res.json({ ok: true, value: row.value, message: value === "like" ? "Preference saved. It will be used in the next model training run." : "Preference saved. This will help the next training run avoid similar profiles." });
});

r.post("/:id/save", (req, res) => {
  const me = find(req.uid), i = +req.params.id; if (!find(i) || i === me.id) return nf(res);
  const k = me.saved.indexOf(i); k < 0 ? me.saved.push(i) : me.saved.splice(k, 1); save(); res.json({ saved: k < 0 });
});
r.post("/:id/block", (req, res) => {
  const me = find(req.uid), i = +req.params.id; if (!find(i) || i === me.id) return nf(res);
  if (!me.blocked.includes(i)) me.blocked.push(i); me.saved = me.saved.filter(x => x !== i); save(); res.json({ ok: true });
});
r.post("/:id/report", (req, res) => {
  const reason = String(req.body.reason || "").trim().slice(0, 300); if (!reason) return res.status(400).json({ error: "Please describe the problem." });
  if (!find(+req.params.id)) return nf(res);
  db.reports.push({ id: id(), by: req.uid, target: +req.params.id, reason, at: Date.now() }); save(); res.status(201).json({ ok: true });
});
module.exports = r;
