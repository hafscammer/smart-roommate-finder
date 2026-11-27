// MongoDB persistence for the in-memory working set: load everything at start, write changed documents back (debounced).
const COLS = ["users", "requests", "messages", "reports", "feedback"];
module.exports = async function mongoAdapter(url, dbName) {
  const { MongoClient } = require("mongodb");
  const client = new MongoClient(url); await client.connect();
  const mdb = client.db(dbName), col = n => mdb.collection(n), snap = {};
  for (const c of COLS) await col(c).createIndex({ id: 1 }, { unique: true });
  await col("users").createIndex({ email: 1 }, { unique: true });
  let chain = Promise.resolve(), timer = null;
  const strip = ({ _id, ...d }) => d;

  async function load(db) {
    for (const c of COLS) {
      const docs = (await col(c).find({}).toArray()).map(strip);
      db[c].length = 0; db[c].push(...docs); snap[c] = new Map(docs.map(d => [d.id, JSON.stringify(d)]));
    }
    const meta = await col("meta").findOne({ _id: "meta" }); if (meta) db.nextId = meta.nextId;
  }
  async function flushNow(db) {
    for (const c of COLS) {
      const ops = [], seen = new Set(), s = snap[c] || (snap[c] = new Map());
      for (const d of db[c]) { const str = JSON.stringify(d); seen.add(d.id); if (s.get(d.id) !== str) { ops.push({ replaceOne: { filter: { id: d.id }, replacement: d, upsert: true } }); s.set(d.id, str); } }
      for (const id of [...s.keys()]) if (!seen.has(id)) { ops.push({ deleteOne: { filter: { id } } }); s.delete(id); }
      if (ops.length) await col(c).bulkWrite(ops, { ordered: false });
    }
    await col("meta").replaceOne({ _id: "meta" }, { _id: "meta", nextId: db.nextId }, { upsert: true });
  }
  const flush = db => (chain = chain.then(() => flushNow(db)).catch(e => console.error("[mongo] flush failed:", e.message)));
  return { load, flush, save(db) { clearTimeout(timer); timer = setTimeout(() => flush(db), 150); }, async close(db) { clearTimeout(timer); await flush(db); await client.close(); } };
};
