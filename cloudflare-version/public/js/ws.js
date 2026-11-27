// Live connection: one WebSocket per logged-in session, reconnects with backoff. Events: message, typing, read, request, accepted, declined.
import { api, token } from "./api.js";
let sock, retry = 0, closed = true;
const handlers = [];
export const onEvent = fn => handlers.push(fn);
export const live = () => !!sock && sock.readyState === 1;
export const send = o => { if (live()) sock.send(JSON.stringify(o)); };
const emit = e => handlers.forEach(h => { try { h(e); } catch (err) {} });
const later = () => { if (!closed) setTimeout(connect, Math.min(15000, 1000 * 2 ** retry++)); };
export async function connect() {
  if (!token() || (sock && sock.readyState <= 1)) return; closed = false;
  try {
    const { ticket } = await api("/ws/ticket", "POST");
    sock = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?ticket=${ticket}`);
    sock.onopen = () => { retry = 0; emit({ type: "open" }); };
    sock.onmessage = e => { try { emit(JSON.parse(e.data)); } catch (err) {} };
    sock.onclose = () => { emit({ type: "close" }); later(); };
  } catch (e) { later(); }
}
export function disconnect() { closed = true; if (sock) sock.close(); }
