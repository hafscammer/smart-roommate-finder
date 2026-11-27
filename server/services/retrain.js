// Feeds real accept/decline outcomes back to the Python service, which retrains in the background and hot-swaps the models.
const cfg = require("../config"), { db, pub } = require("../db");
const u = i => db.users.find(x => x.id === i);
const rows = () => db.requests.filter(q => ["accepted", "declined"].includes(q.status) && !q.resolveAt && u(q.from) && u(q.to)) // skip demo auto-replies
  .map(q => ({ me: pub(u(q.to)), other: pub(u(q.from)), label: q.status === "accepted" ? 1 : 0 }))
  .concat(db.feedback.filter(f => f.by >= 100 && u(f.by) && u(f.target)).map(f => ({ me: pub(u(f.by)), other: pub(u(f.target)), label: f.value === "like" ? 1 : 0 })));
// Implicit feedback for collaborative filtering: real people only (demo auto-replies would be circular)
const events = () => {
  const ev = [];
  db.users.filter(x => x.id >= 100).forEach(x => (x.saved || []).forEach(id => ev.push({ user: x.id, item: id, w: 1 })));
  db.requests.filter(q => !q.resolveAt).forEach(q => { ev.push({ user: q.from, item: q.to, w: 2 }); if (q.status === "accepted") ev.push({ user: q.to, item: q.from, w: 3 }); });
  db.messages.filter(m => m.from >= 100 && m.to >= 100).forEach(m => ev.push({ user: m.from, item: m.to, w: 1 }));
  return ev;
};
async function trigger() {
  const r = rows(), res = await fetch(cfg.aiUrl + "/retrain", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": cfg.aiAdminToken }, body: JSON.stringify({ interactions: r, events: events() }) });
  const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.error || "AI service refused retraining (HTTP " + res.status + ")");
  return { rows: r.length, ...d };
}
function schedule() {
  if (cfg.aiRetrainHours > 0 && cfg.aiAdminToken) setInterval(() => trigger().then(r => console.log("[ai] retraining started with", r.rows, "real interactions"), e => console.warn("[ai] retrain skipped:", e.message)), cfg.aiRetrainHours * 3600e3).unref();
}
module.exports = { rows, trigger, schedule };
