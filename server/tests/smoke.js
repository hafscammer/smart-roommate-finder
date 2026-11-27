// Route-level smoke test. Uses lightweight stand-ins for express, bcryptjs, jsonwebtoken, mongodb and S3 so it runs
// without `npm install`. Start the Python service first to exercise the ML path, or leave it off to test the fallbacks.
//   node server/tests/smoke.js
const Module = require("module"), path = require("path"), os = require("os"), fs = require("fs"), http = require("http");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rm-"));
process.env.DB_FILE = path.join(tmp, "db.json"); process.env.PHOTOS_DIR = path.join(tmp, "photos");
const root = path.join(__dirname, "..") + path.sep, orig = Module._load, sleep = ms => new Promise(r => setTimeout(r, ms));
const s3calls = [], fakeStore = new Map();
function Router() { const h = []; const r = { h, use: (...a) => h.push(["USE", null, a]) }; ["get", "post", "put"].forEach(m => r[m] = (p, ...f) => h.push([m.toUpperCase(), p, f])); return r; }
class FakeCol { // just enough of the MongoDB driver for store/mongo.js
  constructor(n) { this.n = n; if (!fakeStore.has(n)) fakeStore.set(n, []); this.a = fakeStore.get(n); }
  async createIndex() {} find() { return { toArray: async () => this.a.map(d => ({ _id: d._id || d.id, ...JSON.parse(JSON.stringify(d)) })) }; }
  async findOne(q) { return this.a.find(d => d._id === q._id) || null; }
  async replaceOne(f, doc) { const i = this.a.findIndex(d => (f._id !== undefined ? d._id === f._id : d.id === f.id)); const v = f._id !== undefined ? { ...doc } : JSON.parse(JSON.stringify(doc)); i < 0 ? this.a.push(v) : (this.a[i] = v); }
  async bulkWrite(ops) { for (const o of ops) { if (o.replaceOne) await this.replaceOne(o.replaceOne.filter, o.replaceOne.replacement); else { const i = this.a.findIndex(d => d.id === o.deleteOne.filter.id); if (i >= 0) this.a.splice(i, 1); } } }
}
Module._load = function (n, ...a) {
  if (n === "express") return { Router };
  if (n === "bcryptjs") return { hashSync: s => "h" + s, compareSync: (s, h) => h === "h" + s };
  if (n === "jsonwebtoken") return { sign: p => JSON.stringify(p), verify: t => JSON.parse(t) };
  if (n === "mongodb") return { MongoClient: class { async connect() {} db() { return { collection: x => new FakeCol(x) }; } async close() {} } };
  if (n === "@aws-sdk/client-s3") return { S3Client: class { async send(c) { s3calls.push(c); } }, PutObjectCommand: class { constructor(a) { this.t = "put"; this.a = a; } }, DeleteObjectCommand: class { constructor(a) { this.t = "del"; this.a = a; } } };
  return orig.call(this, n, ...a);
};
const mount = n => require(root + "routes/" + n), R = { auth: mount("auth"), people: mount("people"), requests: mount("requests"), messages: mount("messages"), admin: mount("admin") };
const store = require(root + "db"), ai = require(root + "services/ai"), rt = require(root + "services/realtime"), cfg = require(root + "config"), photos = require(root + "services/photos");

async function call(name, method, url, { body = {}, token, query = {} } = {}) {
  const r = R[name], req = { headers: token ? { authorization: "Bearer " + token } : {}, body, query, params: {}, ip: "10.0.0.1" };
  const res = { code: 200, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } }, chain = [];
  for (const [m, p, f] of r.h) {
    if (m === "USE") { chain.push(...f); continue; }
    if (m !== method) continue;
    const keys = [], re = new RegExp("^" + p.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "$"), mm = re.exec(url); if (!mm) continue;
    keys.forEach((k, i) => (req.params[k] = mm[i + 1]));
    const all = [...chain, ...f], pend = []; let i = 0;
    const next = e => { if (e) { res.code = 500; res.body = { error: String(e) }; return; } const fn = all[i++]; if (fn) pend.push(fn(req, res, next)); };
    next(); await Promise.all(pend); return res;
  }
  throw new Error("no route " + method + " " + url);
}
let failed = 0;
const t = async (name, fn) => { try { await fn(); console.log("ok   -", name); } catch (e) { failed++; console.log("FAIL -", name, "\n      ", e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const eq = (a, b, m) => ok(a === b, `${m || ""} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

(async () => {
  const st = await ai.status(); console.log("AI engine:", st.engine, "-", st.label, "\n");
  let tk, me, verifyToken;
  await t("sign up creates an unverified account and a verification link", async () => {
    let r = await call("auth", "POST", "/signup", { body: { name: "Test User", email: "t@x.com", password: "Passw0rd1" } });
    eq(r.code, 201); eq(r.body.user.verified, 0); ok(r.body.devLink && r.body.devLink.includes("#verify/")); tk = r.body.token; me = r.body.user; verifyToken = r.body.devLink.split("#verify/")[1];
    eq((await call("auth", "POST", "/signup", { body: { name: "Dup", email: "t@x.com", password: "Passw0rd1" } })).code, 409);
    eq((await call("auth", "POST", "/signup", { body: { name: "Weak", email: "w@x.com", password: "short" } })).code, 400);
  });
  await t("unverified users cannot send requests or messages; verifying unlocks them", async () => {
    eq((await call("requests", "POST", "/", { token: tk, body: { to: 1 } })).code, 403);
    eq((await call("auth", "POST", "/verify", { body: { token: "bogus" } })).code, 400);
    eq((await call("auth", "POST", "/verify", { body: { token: verifyToken } })).code, 200);
    eq((await call("auth", "GET", "/me", { token: tk })).body.verified, 1);
    eq((await call("auth", "POST", "/verify", { body: { token: verifyToken } })).code, 400, "token is single use");
  });
  await t("password reset: no account enumeration, weak password rejected, old sessions invalidated", async () => {
    const u = await call("auth", "POST", "/forgot", { body: { email: "nobody@x.com" } }); eq(u.code, 200); ok(!u.body.devLink);
    const k = await call("auth", "POST", "/forgot", { body: { email: "t@x.com" } }); eq(k.code, 200); const rt_ = k.body.devLink.split("#reset/")[1];
    eq((await call("auth", "POST", "/reset", { body: { token: rt_, password: "weak" } })).code, 400);
    eq((await call("auth", "POST", "/reset", { body: { token: rt_, password: "NewPassw0rd" } })).code, 200);
    eq((await call("auth", "GET", "/me", { token: tk })).code, 401, "old token must stop working");
    eq((await call("auth", "POST", "/reset", { body: { token: rt_, password: "AnotherPass1" } })).code, 400, "reset token is single use");
    const l = await call("auth", "POST", "/login", { body: { email: "t@x.com", password: "NewPassw0rd" } }); eq(l.code, 200); tk = l.body.token;
  });
  await t("5 wrong passwords lock the account", async () => {
    for (let i = 0; i < 5; i++) await call("auth", "POST", "/login", { body: { email: "t@x.com", password: "wrong" + i } });
    eq((await call("auth", "POST", "/login", { body: { email: "t@x.com", password: "NewPassw0rd" } })).code, 423);
    store.db.users.find(u => u.email === "t@x.com").lockUntil = 0;
  });
  await t("profile: safety classifier, commute places, photo upload", async () => {
    eq((await call("people", "PUT", "/me", { token: tk, body: { bio: "Call me on 0300 1234567 or whatsapp" } })).code, 400);
    eq((await call("people", "PUT", "/me", { token: tk, body: { bio: "Send the deposit first by western union please" } })).code, 400);
    const body = { name: "Test User", city: "Faisalabad", age: 24, min: 100, max: 250, beds: 1, type: "room", role: "seeker", sleep: 1, clean: 5, guests: 1, noise: 1, w: { sleep: 5, clean: 3, guests: 3, noise: 5 }, bio: "Quiet medical student, early riser, non-smoker", area: "fsd-madina-town", anchor: "fsd-uaf", profession: "Medical student", photo: PNG };
    const r = await call("people", "PUT", "/me", { token: tk, body }); eq(r.code, 200); eq(r.body.area, "fsd-madina-town"); ok(r.body.photo.startsWith("/photos/")); ok(fs.existsSync(path.join(cfg.photosDir, path.basename(r.body.photo))));
    eq((await call("people", "PUT", "/me", { token: tk, body: { area: "nowhere" } })).body.area, "fsd-madina-town", "unknown place ids are ignored");
    eq((await call("people", "PUT", "/me", { token: tk, body: { photo: "data:image/png;base64,AAAAAAAAAAAA" } })).code, 400);
  });
  await t("discover: two-way scores, commute distance, filters, price check", async () => {
    let r = await call("people", "GET", "/", { token: tk }); eq(r.code, 200); eq(r.body.length, 8); ok(r.body.every(o => o.tags.length <= 2), "at most two tags per profile");
    const noor = r.body.find(o => o.name === "Noor"); ok(noor.match.you != null && noor.match.them != null, "mutual score parts"); ok(noor.match.commute_km != null || noor.match.area_km != null, "distance present");
    console.log("      ranking:", r.body.map(o => `${o.name}:${o.match.block || o.match.s}`).join(" "), "| engine:", noor.match.engine);
    r = await call("people", "GET", "/", { token: tk, query: { type: "flat", beds: "2", furn: "1" } }); ok(r.body.every(o => o.type === "flat" && o.beds === 2 && o.furn === 1));
    const h = await call("people", "GET", "/2", { token: tk }); ok(h.body.price && h.body.price.low <= h.body.price.mid && h.body.price.mid <= h.body.price.high, "price band"); ok(["below", "fair", "above"].includes(h.body.price.verdict));
    const p = await call("people", "POST", "/price", { token: tk, body: { city: "London", type: "flat", beds: 2, furn: 1, min: 100, max: 120 } }); eq(p.body.verdict, "below");
    ok(Array.isArray((await call("people", "POST", "/extract", { token: tk, body: { bio: "I'm a night owl nurse. Please no smokers." } })).body.professions));
    const degree = await call("people", "POST", "/extract", { token: tk, body: { bio: "I'm a software engineering student doing my BSSE." } });
    eq(degree.body.profession, "Software engineering student");
    const army = await call("people", "POST", "/extract", { token: tk, body: { bio: "I am a Pakistan Army officer." } });
    eq(army.body.profession, "Police / Armed forces");
    const thirdPerson = await call("people", "POST", "/extract", { token: tk, body: { bio: "My brother is a doctor and I am a student." } });
    eq(thirdPerson.body.profession, "Student", "do not attribute a relative's profession to the user");
  });
  await t("explicit profile feedback is saved for future supervised retraining", async () => {
    let r = await call("people", "POST", "/2/feedback", { token: tk, body: { value: "like" } }); eq(r.code, 200); eq(r.body.value, "like");
    r = await call("people", "GET", "/", { token: tk }); eq(r.body.find(o => o.id === 2).feedback, "like");
    r = await call("people", "POST", "/2/feedback", { token: tk, body: { value: "skip" } }); eq(r.body.value, "skip");
    eq(store.db.feedback.filter(f => f.by === me.id && f.target === 2).length, 1, "one mutable label per user/profile");
    eq((await call("people", "POST", "/2/feedback", { token: tk, body: { value: "maybe" } })).code, 400);
  });
  await t("people like this person (embeddings, personas, collaborative filtering)", async () => {
    const r = await call("people", "GET", "/2/similar", { token: tk }); eq(r.code, 200); ok(r.body.length >= 1 && r.body.length <= 4); ok(r.body.every(o => o.id !== 2 && o.tags.length <= 2 && Array.isArray(o.why)));
    console.log("      like Hamza:", r.body.map(o => `${o.name} (${o.why.join(", ") || "-"})`).join(" | "));
  });
  await t("requests and chat: moderation, smart replies, read receipts", async () => {
    const reqs = (await call("requests", "GET", "/", { token: tk })).body; eq(reqs.incoming.length, 2);
    eq((await call("requests", "POST", `/${reqs.incoming[0].id}/respond`, { token: tk, body: { action: "accept" } })).code, 200);
    const sara = reqs.incoming[0].user.id;
    let r = await call("messages", "POST", `/${sara}`, { token: tk, body: { text: "Hi! When can I move in and what is the rent?" } }); eq(r.code, 201); ok(!r.body.warning);
    r = await call("messages", "POST", `/${sara}`, { token: tk, body: { text: "send the deposit first by western union, no viewing needed" } }); eq(r.code, 400);
    r = await call("messages", "POST", `/${sara}`, { token: tk, body: { text: "sure, call me on 0300 1234567" } }); eq(r.code, 201); ok(r.body.warning, "contact details trigger a safety warning");
    eq((await call("messages", "POST", "/4", { token: tk, body: { text: "hi" } })).code, 403, "not connected");
    const s = await call("messages", "POST", "/suggest", { token: tk, body: { text: "Hey, when can you move in?" } }); eq(s.body.intent, "ask_movein"); ok(s.body.suggestions.length === 3);
    store.db.messages.forEach(m => { m.at = Date.now() - 1; });
    eq((await call("messages", "GET", `/${sara}`, { token: tk })).code, 200); eq((await call("messages", "GET", "/unread", { token: tk })).body.n, 0);
    const outgoing = await call("requests", "POST", "/", { token: tk, body: { to: 1 } }); eq(outgoing.code, 201);
  });
  await t("demo user answers a request using their side of the score", async () => {
    await sleep(4300); const r = (await call("requests", "GET", "/", { token: tk })).body.outgoing.find(q => q.user.id === 1);
    ok(["accepted", "declined"].includes(r.status), "demo user decided: " + r.status); console.log("      Ayesha:", r.status, "(they would rate you", r.user.match.them + "%)");
  });
  await t("admin retraining endpoint is protected and talks to the AI service", async () => {
    eq((await call("admin", "POST", "/retrain", { token: tk })).code, 403);
    cfg.adminEmails = ["t@x.com"]; const r = await call("admin", "POST", "/retrain", { token: tk });
    if (st.engine === "python" && cfg.aiAdminToken) eq(r.code, 202); else eq(r.code, 502, "AI service offline or token unset");
  });
  await t("S3 photo storage adapter", async () => {
    Object.assign(cfg, { s3Bucket: "test-bucket", s3Region: "eu-west-1" }); const u = { photo: "" };
    eq(await photos.save(u, PNG), null); ok(u.photo.startsWith("https://test-bucket.s3.eu-west-1.amazonaws.com/photos/"), u.photo); eq(s3calls[0].t, "put"); eq(s3calls[0].a.Bucket, "test-bucket");
    await photos.remove(u); eq(s3calls[1].t, "del"); eq(u.photo, ""); cfg.s3Bucket = "";
  });
  await t("MongoDB adapter persists changes and reloads them", async () => {
    const mk = require(root + "store/mongo"), a = await mk("mongodb://fake", "t"), d = { users: [], requests: [], messages: [], reports: [], feedback: [], nextId: 100 };
    await a.load(d); d.users.push({ id: 1, email: "a@x", name: "A" }, { id: 2, email: "b@x", name: "B" }); d.requests.push({ id: 3, from: 1, to: 2 }); d.nextId = 105; await a.flush(d);
    d.users[0].name = "A2"; d.requests.length = 0; await a.flush(d);
    const b = await mk("mongodb://fake", "t"), d2 = { users: [], requests: [], messages: [], reports: [], feedback: [], nextId: 100 }; await b.load(d2);
    eq(d2.users.length, 2); eq(d2.users[0].name, "A2"); eq(d2.requests.length, 0); eq(d2.nextId, 105);
  });
  await t("WebSocket server: tickets, push, typing, 16-bit and 64-bit frames", async () => {
    if (typeof WebSocket === "undefined") return console.log("      (skipped: needs Node 22's built-in WebSocket client)");
    const server = http.createServer(), got = []; rt.attach(server, (uid, m) => got.push([uid, m]));
    await new Promise(r => server.listen(0, "127.0.0.1", r)); const port = server.address().port, ticket = rt.issueTicket(77), ws = new WebSocket(`ws://127.0.0.1:${port}/ws?ticket=${ticket}`), msgs = [];
    ws.onmessage = e => msgs.push(JSON.parse(e.data)); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("websocket error")); });
    rt.send(77, { type: "message", text: "hello" }); await sleep(100); ok(msgs[0] && msgs[0].text === "hello", "server push");
    ws.send(JSON.stringify({ type: "typing", to: 5, pad: "y".repeat(300) })); await sleep(100); ok(got[0] && got[0][0] === 77 && got[0][1].type === "typing", "client frame with 16-bit length");
    rt.send(77, { type: "big", d: "x".repeat(70000) }); await sleep(250); ok(msgs.some(m => m.type === "big"), "64-bit length frame");
    const closed = await new Promise(res => { const w2 = new WebSocket(`ws://127.0.0.1:${port}/ws?ticket=${ticket}`); w2.onopen = () => res(false); w2.onerror = () => res(true); w2.onclose = () => res(true); });
    ok(closed, "a ticket can be used only once"); ws.close(); await sleep(50); server.close(); server.closeAllConnections && server.closeAllConnections();
  });
  console.log(failed ? `\n${failed} test(s) failed` : "\nall tests passed"); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(failed ? 1 : 0);
})();
