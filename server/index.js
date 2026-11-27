const express = require("express"), http = require("http"), path = require("path"), cfg = require("./config");
const store = require("./db"), rt = require("./services/realtime"), places = require("./services/places"), auth = require("./middleware/auth");

async function main() {
  await store.init();
  if (!process.env.JWT_SECRET) console.warn("Warning: JWT_SECRET not set. Using an insecure development secret.");
  const app = express();
  app.use((req, res, next) => { res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY" }); next(); });
  app.use(express.json({ limit: "450kb" })); // profile photos arrive as small data URLs
  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/people", require("./routes/people"));
  app.use("/api/requests", require("./routes/requests"));
  app.use("/api/messages", require("./routes/messages"));
  app.use("/api/admin", require("./routes/admin"));
  app.post("/api/ws/ticket", auth, (req, res) => res.json({ ticket: rt.issueTicket(req.uid) }));
  app.get("/api/places", (req, res) => res.json(places.forCity(req.query.city)));
  app.use("/photos", express.static(require("./services/photos").dir, { index: false, maxAge: "1d" }));
  app.get("/api/ai/status", async (req, res) => res.json(await require("./services/ai").status()));
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
  app.use(express.static(path.join(__dirname, "..", "client")));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.status ? "Bad request." : "Server error." }));

  const server = http.createServer(app);
  rt.attach(server, (uid, m) => { // client -> server events: typing indicator (only between connected people, throttled)
    const to = +m.to;
    if (m.type === "typing" && store.connected(uid, to) && require("./services/limiter")(`typing:${uid}:${to}`, 2, 1500)) rt.send(to, { type: "typing", from: uid });
  });
  server.listen(cfg.port, () => console.log(`RoomieMatch running at http://localhost:${cfg.port}  (database: ${cfg.mongoUrl ? "MongoDB" : "JSON file"})`));
  require("./services/retrain").schedule();
  const stop = async () => { await store.close(); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
}
main().catch(e => { console.error(e); process.exit(1); });
