// Data store: an in-memory working set persisted either to a JSON file (default) or to MongoDB (set MONGO_URL).
const fs = require("fs"), path = require("path"), bcrypt = require("bcryptjs");
const cfg = require("./config"), seed = require("./data/seed");
const file = cfg.dbFile;
const db = { users: [], requests: [], messages: [], reports: [], feedback: [], nextId: 100 };
let adapter = null;

const seedUsers = () => seed.map(u => ({ ...u, email: u.name.toLowerCase() + "@demo.test", passHash: bcrypt.hashSync("Demo1234!", 10), fails: 0, lockUntil: 0, verified: 1 }));
function migrate() { // bring older data files up to date
  const sp = new Map(seed.map(s => [s.id, s]));
  db.messages = db.messages || []; db.reports = db.reports || []; db.feedback = db.feedback || [];
  db.users.forEach(u => {
    const s = sp.get(u.id) || {};
    u.saved = u.saved || []; u.blocked = u.blocked || []; u.movein = u.movein || ""; u.stay = u.stay || "6";
    if (u.done == null) u.done = u.id < 100 ? 1 : 0;
    if (u.profession == null) u.profession = s.profession || "";
    if (u.area == null) u.area = s.area || ""; if (u.anchor == null) u.anchor = s.anchor || "";
    u.photo = u.photo || ""; u.tv = u.tv || 0; if (u.verified == null) u.verified = 1;
  });
}
if (!cfg.mongoUrl) { // JSON mode loads synchronously so the app works as soon as it is required
  if (fs.existsSync(file)) Object.assign(db, JSON.parse(fs.readFileSync(file, "utf8"))); else db.users = seedUsers();
  migrate();
}
async function init() {
  if (!cfg.mongoUrl) return save();
  adapter = await require("./store/mongo")(cfg.mongoUrl, cfg.mongoDb);
  await adapter.load(db); if (!db.users.length) db.users = seedUsers(); migrate(); await adapter.flush(db);
  console.log("[db] connected to MongoDB:", cfg.mongoDb);
}
const save = () => { if (adapter) adapter.save(db); else fs.writeFileSync(file, JSON.stringify(db, null, 2)); };
const close = async () => { if (adapter) await adapter.close(db); };
const id = () => db.nextId++;
const pub = ({ passHash, fails, lockUntil, email, saved, blocked, verifyHash, verifyExp, resetHash, resetExp, tv, ...p }) => p;
const self = u => ({ ...pub(u), email: u.email, saved: u.saved, blocked: u.blocked });
const live = q => (q.status === "pending" && Date.now() - q.at > cfg.requestTtlMs ? "expired" : q.status);
const pair = (q, a, b) => (q.from === a && q.to === b) || (q.from === b && q.to === a);
const connected = (a, b) => db.requests.some(q => q.status === "accepted" && pair(q, a, b));
// Safety net: demo users also answer lazily if the server restarted before their timer fired
const settle = () => { const n = Date.now(); let c = 0; db.requests.forEach(q => { if (q.status === "pending" && q.resolveAt && q.resolveAt <= n) { q.status = q.resolveTo; c = 1; } }); if (c) save(); };
module.exports = { db, init, save, close, id, pub, self, live, pair, connected, settle };
