const r = require("express").Router(), auth = require("../middleware/auth"), cfg = require("../config"), { db } = require("../db"), retrain = require("../services/retrain");
r.use(auth);
r.use((req, res, next) => { const u = db.users.find(x => x.id === req.uid); if (!u || !cfg.adminEmails.includes(u.email)) return res.status(403).json({ error: "Admins only." }); next(); });
r.post("/retrain", async (req, res) => { try { res.status(202).json(await retrain.trigger()); } catch (e) { res.status(502).json({ error: e.message }); } });
module.exports = r;
