// Dependency-free WebSocket server (RFC 6455, text frames) for live chat: messages, typing, read receipts, request updates.
// Clients first POST /api/ws/ticket (authenticated) and connect to /ws?ticket=...  (one-time, 30 s).
const crypto = require("crypto");
const conns = new Map(), tickets = new Map(), GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function issueTicket(uid) { const t = crypto.randomBytes(16).toString("hex"); tickets.set(t, { uid, exp: Date.now() + 30000 }); return t; }
function frame(op, payload) {
  const n = payload.length; let h;
  if (n < 126) h = Buffer.from([0x80 | op, n]);
  else if (n < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(n, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([h, payload]);
}
function send(uid, obj) { const set = conns.get(uid); if (!set) return 0; const f = frame(1, Buffer.from(JSON.stringify(obj))); set.forEach(s => s.write(f)); return set.size; }

function attach(server, onMessage) {
  server.on("upgrade", (req, socket) => {
    const url = new URL(req.url, "http://localhost"), key = req.headers["sec-websocket-key"], tk = url.searchParams.get("ticket");
    const t = url.pathname === "/ws" ? tickets.get(tk) : null; if (t) tickets.delete(tk);
    if (!t || t.exp < Date.now() || !key || String(req.headers.upgrade).toLowerCase() !== "websocket") return void socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + crypto.createHash("sha1").update(key + GUID).digest("base64") + "\r\n\r\n");
    const uid = t.uid; if (!conns.has(uid)) conns.set(uid, new Set()); conns.get(uid).add(socket);
    let buf = Buffer.alloc(0), alive = true; socket.setNoDelay(true);
    const close = () => { clearInterval(ping); const s = conns.get(uid); if (s) { s.delete(socket); if (!s.size) conns.delete(uid); } socket.destroy(); };
    const ping = setInterval(() => { if (!alive) return close(); alive = false; socket.write(frame(9, Buffer.alloc(0))); }, 25000); if (ping.unref) ping.unref();
    socket.on("data", chunk => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 2) {
        const op = buf[0] & 0x0f, masked = !!(buf[1] & 0x80); let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (!masked || len > 65536) return close();           // clients must mask; keep frames small
        if (buf.length < off + 4 + len) return;
        const mask = buf.subarray(off, off + 4), data = Buffer.from(buf.subarray(off + 4, off + 4 + len)); for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
        buf = buf.subarray(off + 4 + len);
        if (op === 8) { socket.end(frame(8, Buffer.alloc(0))); return close(); }
        if (op === 9) socket.write(frame(10, data));
        else if (op === 10) alive = true;
        else if (op === 1) { alive = true; try { onMessage(uid, JSON.parse(data.toString("utf8"))); } catch (e) {} }
      }
    });
    socket.on("close", close); socket.on("error", close);
  });
}
module.exports = { attach, send, issueTicket };
