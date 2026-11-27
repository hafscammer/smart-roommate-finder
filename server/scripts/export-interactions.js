// Exports real accept/decline outcomes as training data for the Python pipeline.
// Each row: { me: the person who decided, other: the requester, label: 1 accepted / 0 declined }.
const fs = require("fs"), path = require("path"), { db, pub } = require("../db");
const u = i => db.users.find(x => x.id === i);
const rows = db.requests
  .filter(q => ["accepted", "declined"].includes(q.status) && !q.resolveAt && u(q.from) && u(q.to)) // skip demo auto-replies
  .map(q => ({ me: pub(u(q.to)), other: pub(u(q.from)), label: q.status === "accepted" ? 1 : 0 }))
  .concat((db.feedback || []).filter(f => f.by >= 100 && u(f.by) && u(f.target)).map(f => ({ me: pub(u(f.by)), other: pub(u(f.target)), label: f.value === "like" ? 1 : 0 })));
const out = path.join(__dirname, "..", "..", "ai-service", "data", "interactions.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(rows, null, 2));
console.log(`Exported ${rows.length} real interactions (request decisions + explicit profile feedback) to ${out}`);
