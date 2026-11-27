const K = "rm_token";
export const token = () => { try { return localStorage.getItem(K); } catch (e) { return null; } };
export const setToken = t => { try { t ? localStorage.setItem(K, t) : localStorage.removeItem(K); } catch (e) {} };
const HELP = "The RoomieMatch server did not answer. Run npm start in the project folder, then open http://localhost:3000 (not the HTML file directly, and not Live Server).";
export async function api(path, method = "GET", body) {
  let r;
  try { r = await fetch("/api" + path, { method, headers: { "Content-Type": "application/json", ...(token() ? { Authorization: "Bearer " + token() } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch (e) { throw new Error(HELP); }
  if (!(r.headers.get("content-type") || "").includes("json")) throw new Error(HELP + " (HTTP " + r.status + ")");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401 && token()) { setToken(null); location.reload(); } throw new Error(d.error || "Something went wrong (HTTP " + r.status + ")."); }
  return d;
}
