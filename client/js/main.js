import { api, token, setToken } from "./api.js";
import { esc, ic, TYPE, IMP, TR, snap, hue, avatar, chips, ring, seg, tog, complete, card, chipsOf, chipsHtml, cmpPanel, distText } from "./components.js";
import { connect, disconnect, onEvent, send as wsSend, live as wsLive } from "./ws.js";
import { openCropper } from "./crop.js";
const $ = s => document.querySelector(s), app = $("#app"), side = $("#side");
let me = null, F = { sort: "match" }, mode = "login", timer, poll, step = 0, lastTh = "", convos = [], B = { req: 0, msg: 0 }, AIS = null, touched = new Set(), xt, ct, pt, photoNew, devLink = "", typingT, lastTyping = 0;
const ST = { 3: "3 months", 6: "6 months", 12: "12+ months" }, STEPS = 4;
const THEME_KEY = "roomiematch-theme";
function setTheme(theme) { document.documentElement.dataset.theme = theme; try { localStorage.setItem(THEME_KEY, theme); } catch (e) {} const b = $("#theme-toggle"); if (b) { b.textContent = theme === "dark" ? "☀" : "☾"; b.setAttribute("aria-pressed", String(theme === "dark")); } }
function initTheme() { let saved = "light"; try { saved = localStorage.getItem(THEME_KEY) || "light"; } catch (e) {} setTheme(saved === "dark" ? "dark" : "light"); }

const STARTERS = [["Night owl", "I'm a night owl who works late."], ["Early bird", "I'm an early riser and love mornings."], ["Tidy", "I keep the place very tidy."], ["Relaxed", "I'm relaxed about mess."], ["Hosts friends", "I love hosting friends and game nights."], ["Needs quiet", "I need a quiet home to study, it's a must."], ["Works from home", "I work from home."], ["No smokers", "Please no smokers."], ["Has a pet", "I have a cat."]];
const sk = n => Array(n).fill('<div class="sk"></div>').join("");
const fill = (f, V) => [...f.elements].forEach(e => { if (!e.name) return; const v = V[e.name] ?? ""; e.type === "radio" ? (e.checked = String(e.value) === String(v)) : e.type === "checkbox" ? (e.checked = !!v) : (e.value = v); });
const toast = (m, bad) => { const t = $("#toast"); t.textContent = m; t.style.background = bad ? "var(--bad)" : ""; t.style.color = bad ? "#fff" : ""; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3000); };
const to = t => (location.hash === "#" + t ? go() : (location.hash = t));
const time = ts => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const route = () => { const [p, a] = (location.hash.slice(1) || "home").split("/"); if (p === "verify" || p === "reset") return [p, a]; return [me ? (views[p] && p !== "auth" ? p : "home") : "auth", a]; };

function nav() {
  if (!me) { side.innerHTML = '<div class="brandrow"><div class="logo">RoomieMatch</div><button id="theme-toggle" class="g sm theme-toggle" type="button" data-act="theme">☾ Night mode</button></div>'; setTheme(document.documentElement.dataset.theme || "light"); return; }
  const [p] = route(), L = [["home", "Home", "home"], ["discover", "Discover", "search"], ["requests", "Requests", "bell", B.req], ["chat", "Messages", "chat", B.msg], ["profile", "My profile", "user"], ["lab", "AI Lab", "sparkles"]];
  side.innerHTML = '<div class="brandrow"><div class="logo">RoomieMatch</div><button id="theme-toggle" class="g sm theme-toggle" type="button" data-act="theme">☾ Night mode</button></div>' + L.map(([h, l, i, n]) => `<a class="nl ${p === h || (h === "discover" && p === "u") ? "on" : ""}" href="#${h}">${ic(i)}<span>${l}</span>${n ? `<em class="bd">${n}</em>` : ""}</a>`).join("") +
    (AIS ? `<small class="aib" title="Which engine scores your matches">AI: ${esc(AIS.label)}</small>` : "") + `<div class="me">${avatar(me, "sm")}<div><b>${esc(me.name)}</b><br><a href="#" data-act="out"><small>Log out</small></a></div></div>`;
  setTheme(document.documentElement.dataset.theme || "light");
}
async function badges() {
  try { const [r, m, s] = await Promise.all([api("/requests"), api("/messages/unread"), api("/ai/status")]); AIS = s; B.req = r.incoming.filter(q => q.status === "pending").length; B.msg = m.n; nav(); } catch (e) {}
}

const views = {
  auth() {
    const su = mode === "signup", fg = mode === "forgot";
    app.innerHTML = `<div class="land"><section class="pitch"><div class="logo">RoomieMatch</div><h1>Find a roommate you will actually get along with.</h1>
    <ul><li>Two-way AI scores: how well they fit you and how well you fit them</li><li>Tags and professions read from your own words</li><li>Commute distance, price checks and safety screening built in</li><li>Live chat with typing indicators, read receipts and smart replies</li></ul></section>
    <section class="formside"><form id="af" class="auth"><h2>${fg ? "Reset your password" : su ? "Create your account" : "Welcome back"}</h2><p class="mu">${fg ? "Enter your email and we will send you a reset link." : su ? "It takes a minute. You can finish your profile next." : "Log in to see your matches."}</p>
    ${su ? '<label>Full name<input name="name" autocomplete="name" required></label>' : ""}<label>Email<input name="email" type="email" autocomplete="email" required></label>
    ${fg ? "" : `<label>Password<input name="password" type="password" autocomplete="${su ? "new-password" : "current-password"}" required></label>`}
    <div class="err" id="err" role="alert"></div><button class="wide">${fg ? "Send reset link" : su ? "Sign up" : "Log in"}</button>
    <p class="mu">${fg ? '<a href="#" data-act="mode" data-m="login">Back to log in</a>' : `${su ? "Already registered?" : "New here?"} <a href="#" data-act="mode" data-m="${su ? "login" : "signup"}">${su ? "Log in" : "Create an account"}</a>${su ? "" : ' · <a href="#" data-act="mode" data-m="forgot">Forgot password?</a>'}`}</p>
    ${mode === "login" ? '<div class="note"><small>Demo account: ayesha@demo.test / Demo1234!</small></div>' : ""}</form></section></div>`;
  },

  async lab() {
    app.innerHTML = `<div class="vb"><div><h2>AI Lab</h2><p class="mu">A live look inside RoomieMatch's machine-learning stack.</p></div><span class="ver">MODEL OBSERVABILITY</span></div><div id="lab-content"><div class="sk"></div></div>`;
    let s; try { s = await api("/ai/status"); } catch (e) { $("#lab-content").innerHTML = `<div class="note">${esc(e.message)}</div>`; return; }
    const root = $("#lab-content"); if (!root) return;
    if (s.engine !== "python" || !s.metrics) { root.innerHTML = `<div class="pan"><h3>Python ML service is not connected</h3><p class="mu">The app is currently using its safe rule-based fallback. Start the Python service to unlock model metrics, model-backed extraction, mutual compatibility scoring and retraining.</p><pre class="cmd">cd ai-service
python app.py</pre></div>`; return; }
    const m = s.metrics, c = m.compat || {}, r = m.ranking || {}, t = m.tags || {}, x = m.extract || {}, nd = r.ndcg5 || {};
    const pct = v => Number.isFinite(+v) ? `${Math.round(+v * 1000) / 10}%` : "—", date = s.trained_at ? new Date(s.trained_at).toLocaleString() : "Unknown";
    const metric = (label, value, hint) => `<div class="stat"><b>${value}</b><small class="mu">${label}</small><small class="mu">${hint || ""}</small></div>`;
    root.innerHTML = `<div class="lab-status"><div><span class="live-dot"></span><b>Python inference online</b><small class="mu">${esc(s.model || "ML model")} · scikit-learn ${esc(s.sklearn || "")}</small></div><div><small class="mu">Model trained</small><b>${esc(date)}</b></div></div>
      <div class="stats">${metric("Compatibility AUC", pct(c.auc), "User-disjoint test split")}${metric("Ranking NDCG@5", pct(nd.mutual), "Mutual preference ranking")}${metric("Tag micro F1", pct(t.micro_f1), "Synthetic held-out labels")}${metric("Lifestyle extraction", pct(x.level_acc), "Sentence-level test set")}</div>
      <div class="lab-grid"><section class="pan"><h3>Model architecture</h3><div class="lab-line"><b>Compatibility</b><span>HistGradientBoosting · two-way scoring</span></div><div class="lab-line"><b>Text features</b><span>Word + character TF-IDF · sentence-level extraction</span></div><div class="lab-line"><b>Personas</b><span>K-means clustering</span></div><div class="lab-line"><b>Ranking</b><span>${esc(r.choice || "Mutual score")}</span></div><div class="lab-line"><b>Collaborative filtering</b><span>${s.collab_active ? "Active" : "Waiting for enough real interactions"}</span></div></section>
      <section class="pan"><h3>Learning loop</h3><div class="lab-big">${Number(s.n_real || 0).toLocaleString()}</div><b>Real labelled interactions</b><p class="mu">${Number(s.n_profiles || 0).toLocaleString()} synthetic bootstrap profiles · ${Number(s.n_pairs || 0).toLocaleString()} synthetic pairs</p><p class="mu">${Number(s.n_events || 0).toLocaleString()} collaborative events · ${s.training ? "Retraining in progress" : "Model idle"}</p><p class="mu">New Good fit / Not for me feedback is included in the next training run.</p></section></div>
      <section class="pan"><h3>What the current benchmark says</h3><div class="lab-bars"><div><span>Mutual model</span><i><b style="width:${Math.max(0,Math.min(100,(nd.mutual || 0)*100))}%"></b></i><strong>${pct(nd.mutual)}</strong></div><div><span>One-way model</span><i><b style="width:${Math.max(0,Math.min(100,(nd.forward || 0)*100))}%"></b></i><strong>${pct(nd.forward)}</strong></div><div><span>Original rule baseline</span><i><b style="width:${Math.max(0,Math.min(100,(nd.rule || 0)*100))}%"></b></i><strong>${pct(nd.rule)}</strong></div></div><p class="mu">AUC measures pair discrimination; NDCG@5 measures ordering quality in candidate lists. They are different metrics.</p></section>
      <div class="note"><b>Research honesty:</b> ${Number(s.n_real || 0) === 0 ? "The current benchmark is synthetic. These scores are not evidence of real-world roommate prediction accuracy yet." : "Real user labels have entered training. Keep collecting independent test labels and monitor calibration and group-level performance."} Phrase-match evidence for occupation is a deterministic text cue, not a calibrated probability.</div>`;
  },

  async verify(token) {
    app.innerHTML = '<div class="formside"><div class="auth pan"><h2>Verifying...</h2></div></div>';
    let msg, good = false;
    try { await api("/auth/verify", "POST", { token }); good = true; msg = "Your email is verified. You can now send requests and messages."; if (me) me = await api("/auth/me"); } catch (e) { msg = e.message; }
    devLink = "";
    app.innerHTML = `<div class="formside"><div class="auth pan"><h2>${good ? "Email verified" : "Link problem"}</h2><p class="${good ? "" : "bad"}">${esc(msg)}</p><a class="btn" href="#${me ? "home" : ""}">${me ? "Continue" : "Log in"}</a></div></div>`;
    nav(); banner();
  },

  reset(token) {
    app.innerHTML = `<div class="formside"><form id="rf" class="auth pan" data-token="${esc(token || "")}"><h2>Choose a new password</h2><label>New password<input name="password" type="password" autocomplete="new-password" required></label><small class="mu">At least 8 characters with a letter and a number.</small><div class="err" id="err" role="alert"></div><button class="wide">Save new password</button></form></div>`;
  },

  async home() {
    app.innerHTML = `<h2>Hi ${esc(me.name.split(" ")[0])}</h2><p class="mu">Here is how your search is going.</p><div class="stats" id="st"></div><div id="cp"></div><h3>Top matches for you</h3><div class="grid" id="g">${sk(3)}</div>`;
    const [L] = await Promise.all([api("/people?sort=match"), badges()]), top = L.filter(o => !o.match.block);
    if (!$("#st")) return;
    $("#st").innerHTML = [["Strong matches", top.filter(o => o.match.s >= 75).length, "discover"], ["Requests waiting", B.req, "requests"], ["Unread messages", B.msg, "chat"]].map(([l, n, h]) => `<a class="stat" href="#${h}"><b>${n}</b><small class="mu">${l}</small></a>`).join("");
    const pc = complete(me); $("#cp").innerHTML = pc < 100 ? `<div class="note"><b>Your profile is ${pc}% complete.</b> A full profile gets better matches. <a href="#profile">Finish it now</a><div class="mt"><i style="width:${pc}%"></i></div></div>` : "";
    $("#g").innerHTML = top.slice(0, 3).map(card).join("") || '<div class="empty"><b>No matches yet</b></div>';
  },

  discover() {
    app.innerHTML = `<h2>Discover</h2><p class="mu">Ranked by AI compatibility with you.</p><form class="tools" id="fl">
    <div class="row"><input name="city" placeholder="City" aria-label="City"><input name="max" type="number" placeholder="Max budget" aria-label="Max budget"><select name="sort" aria-label="Sort"><option value="match">Best match</option><option value="budget">Lowest budget</option><option value="new">Newest</option></select></div>
    <div class="row"><span class="lb">Property</span>${seg("type", [["", "Any"], ...Object.entries(TYPE)])}<span class="lb">Bedrooms</span>${seg("beds", [["", "Any"], [1, "1"], [2, "2"], [3, "3+"]])}</div>
    <div class="row"><span class="lb">Who</span>${seg("role", [["", "Everyone"], ["host", "Offering"], ["seeker", "Seeking"]])}${tog("furn", "Furnished")}${tog("saved", "Saved only")}</div></form><div class="grid" id="g">${sk(6)}</div>`;
    fill($("#fl"), F); load();
  },

  async u(id) {
    app.innerHTML = sk(1);
    const o = await api("/people/" + id), m = o.match;
    const act = { "": m.block ? '<button disabled>Not compatible</button>' : `<button data-act="conn" data-id="${o.id}">Send request</button>`, "pending-out": '<button disabled>Request sent</button>', "pending-in": '<a class="btn" href="#requests">Review their request</a>', accepted: `<a class="btn" href="#chat/${o.id}">Message</a>`, declined: '<button disabled>Declined</button>', expired: `<button data-act="conn" data-id="${o.id}">Send again</button>` }[o.rel];
    const facts = [["Property", TYPE[o.type]], ["Bedrooms", o.beds], ["Furnished", o.furn ? "Yes" : "No"], ["Budget", `$${o.min}-${o.max}/mo`], ["Move-in", o.movein || "Flexible"], ["Stay", ST[o.stay] || "6 months"]];
    app.innerHTML = `<a href="#discover" class="mu">&larr; Back to discover</a><div class="hero"><div class="cb" style="--h:${hue(o.name)}"></div><div class="hd">${avatar(o, "lg")}
    <div class="gr"><h2>${esc(o.name)}, ${o.age}</h2><span class="mu">${o.profession ? esc(o.profession) + " · " : ""}${esc(o.city || "No city yet")} · ${o.role === "host" ? "Offering" : "Looking for"} a ${TYPE[o.type].toLowerCase()}${o.verified ? ' · <span class="ver">Verified</span>' : ""}</span></div>${ring(m)}</div>
    <div class="acts">${act}<button class="g ${o.saved ? "on" : ""}" data-act="save" data-id="${o.id}">${ic("heart")} ${o.saved ? "Saved" : "Save"}</button><button class="g" data-act="block" data-id="${o.id}">Block</button><button class="g" data-act="report" data-id="${o.id}">Report</button></div></div>
    <div class="cols"><section class="pan"><h3 style="margin-top:0">About</h3><p>${esc(o.bio || "No description yet.")}</p><div>${chips(o.tags)}</div>${o.persona ? `<p class="mu" style="margin:8px 0 0">Roommate persona: <b>${esc(o.persona)}</b></p>` : ""}<h3>Lifestyle</h3><div>${chipsHtml(chipsOf(o)) || '<span class="mu">Not specified</span>'}</div></section>
    <section class="pan"><h3 style="margin-top:0">Place and budget</h3><dl class="facts2">${facts.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl>${priceHtml(o)}${distHtml(m)}
    <h3>Compatibility</h3><p class="mu">Curious how your lifestyles line up? Open the comparison whenever you like.</p><button class="g" data-act="cmp" aria-expanded="false">Compare lifestyle with you</button></section></div>
    <section class="pan" id="cmp" hidden style="margin-top:16px">${cmpPanel(o, m, me)}</section><section class="pan" id="sim" hidden style="margin-top:16px"></section>`;
    api(`/people/${id}/similar`).then(L => { const box = $("#sim"); if (!box || !L.length) return; box.innerHTML = `<h3 style="margin-top:0">People like ${esc(o.name)}</h3><p class="mu">Similar lifestyle, wording and persona${L.some(x => x.why.includes("liked by similar people")) ? ", and liked by the same people" : ""}.</p><div class="grid">${L.map(card).join("")}</div>`; box.hidden = false; }).catch(() => {});
  },

  profile() {
    step = 0; touched = new Set(); photoNew = undefined; const sec = (t, h) => `<section data-s hidden><h3>${t}</h3>${h}</section>`;
    app.innerHTML = `<h2>My profile</h2><p class="mu" id="stp"></p><div class="prog"><i id="pg"></i></div><form id="pf" class="wiz">
    ${sec("About you", `<div class="photo"><div id="pp"></div><div><button type="button" class="g sm" data-act="photo">Upload photo</button> <button type="button" class="g sm" data-act="photo-rm">Remove</button><p class="mu"><small>Optional. JPG, PNG or WebP. We crop it to a square.</small></p><input type="file" id="pf-file" accept="image/jpeg,image/png,image/webp" hidden></div></div><div class="two"><label>Name<input name="name" required></label><label>Age<input name="age" type="number" min="18" max="99"></label></div><label>City<input name="city" required></label><label>I am</label>${seg("role", [["seeker", "Looking for a place"], ["host", "Offering a place"]])}`)}
    ${sec("The place", `<label>Property type</label>${seg("type", Object.entries(TYPE))}<label>Bedrooms</label>${seg("beds", [[1, "1"], [2, "2"], [3, "3"], [4, "4+"]])}<div class="seg">${tog("furn", "Furnished")}</div><div class="two"><label>Area<select name="area" id="sel-area"></select></label><label>Study or work location<select name="anchor" id="sel-anchor"></select></label></div><p class="mu"><small>Used to rank people by commute distance.</small></p><div class="two"><label>Min budget ($/mo)<input name="min" type="number" min="0"></label><label>Max budget ($/mo)<input name="max" type="number" min="0"></label></div><div class="pricebox" id="pricebox" hidden></div><div class="two"><label>Move-in date<input name="movein" type="date"></label><div><label>Stay length</label>${seg("stay", [["3", "3 mo"], ["6", "6 mo"], ["12", "12+ mo"]])}</div></div>`)}
    ${sec("In your words", `<p class="mu">Describe yourself and the home you want. The AI reads it and fills in your lifestyle, habits and must-haves for you.</p>
      <textarea name="bio" rows="6" maxlength="500" placeholder="Example: I'm a student who studies late and loves quiet evenings. I keep the kitchen spotless, it's a must. No smokers please."></textarea>
      <div class="seg starters">${STARTERS.map(([l, t]) => `<button type="button" class="g sm" data-act="starter" data-t="${esc(t)}">+ ${l}</button>`).join("")}</div>
      <div class="aipanel"><div class="aih"><b>What the AI understood</b><small class="mu" id="aistat"></small></div><div id="aichips"></div><div id="aievidence" class="ai-evidence" aria-live="polite"></div></div>
      <details class="adj"><summary>Not quite right? Adjust manually</summary><div class="q"><b>Profession</b><input name="profession" maxlength="40" placeholder="e.g. Software developer"></div>${TR.map(t => `<div class="q"><b>${t.q}</b>${seg(t.k, t.o)}<small class="mu">How much does this matter to you?</small>${seg("w_" + t.k, IMP)}</div>`).join("")}
      <div class="q"><b>Habits</b><div class="seg">${tog("smoke", "I smoke")}${tog("pets", "I have pets")}${tog("wfh", "I work from home")}${tog("veg", "Vegetarian")}</div></div>
      <div class="q"><b>Dealbreakers</b><div class="seg">${tog("nosmoke", "No smokers")}${tog("nopets", "No pets")}</div></div></details>`)}
    ${sec("Review", `<div id="rv"></div><div class="note"><b>AI tags (up to 2):</b> <span id="pt"></span></div><div class="err" id="err" role="status"></div>`)}
    <div class="nav2"><button type="button" class="g" data-act="back">Back</button><div class="navr"><button type="button" data-act="next">Next</button><button id="sv" hidden>Save profile</button></div></div></form>
    <p><a href="#" data-act="out">Log out</a></p>`;
    fill($("#pf"), { ...me, beds: Math.min(me.beds, 4), ...Object.fromEntries(TR.flatMap(t => [[t.k, snap(me[t.k])], ["w_" + t.k, snap(me.w[t.k])]])) }); show(); paintChips(); paintPhoto(); $("#sel-area").dataset.v = me.area || ""; $("#sel-anchor").dataset.v = me.anchor || "";
  },

  async requests() {
    app.innerHTML = `<h2>Requests</h2><div class="pan" id="rq" style="margin-top:14px">${sk(1)}</div>`;
    const { incoming, outgoing } = await api("/requests");
    const row = (q, r) => `<div class="rq"><a class="who" href="#u/${q.user.id}">${avatar(q.user, "sm")}<span><b>${esc(q.user.name)}</b><br><small class="mu">${esc(q.user.city)} · ${q.user.match.block ? "incompatible" : q.user.match.s + "% match"}</small></span></a><span>${r}</span></div>`;
    const tag = s => `<span class="pill st-${s}">${s}</span>`, msg = q => `<a class="btn" href="#chat/${q.user.id}">Message</a>`;
    const rin = q => q.status === "pending" ? `<button data-act="acc" data-id="${q.id}">Accept</button> <button class="g" data-act="dec" data-id="${q.id}">Decline</button>` : q.status === "accepted" ? msg(q) : tag(q.status);
    if ($("#rq")) $("#rq").innerHTML = `<h3 style="margin-top:0">Received</h3>${incoming.map(q => row(q, rin(q))).join("") || '<p class="mu">No requests yet.</p>'}<h3>Sent</h3>${outgoing.map(q => row(q, q.status === "accepted" ? msg(q) : tag(q.status))).join("") || '<p class="mu">Send a request from someone\'s profile.</p>'}`;
  },

  async chat(id) {
    app.innerHTML = `<h2>Messages</h2><div class="chat ${id ? "open" : ""}"><aside id="cl"></aside><section id="th"><div class="empty"><b>Select a conversation</b><p class="mu">Accepted requests appear here.</p></div></section></div>`;
    lastTh = ""; await convoList(id); if (id) await thread(+id);
    poll = setInterval(async () => { if (wsLive()) return; try { await convoList(id); if (id) await thread(+id, true); } catch (e) {} }, 4000); // polling only while the live connection is down
  },
};

async function load() {
  const q = new URLSearchParams(Object.entries(F).filter(([, v]) => v)), g = $("#g");
  try { const L = await api("/people?" + q); if ($("#g")) $("#g").innerHTML = L.map(card).join("") || '<div class="empty"><b>No one fits those filters</b><p class="mu">Clear a filter or raise your budget.</p></div>'; }
  catch (e) { if (g) g.innerHTML = `<p class="bad">${esc(e.message)}</p>`; }
}
async function convoList(id) {
  convos = await api("/messages"); const c = $("#cl"); if (!c) return;
  c.innerHTML = convos.map(x => `<a class="ci ${+id === x.user.id ? "on" : ""}" href="#chat/${x.user.id}">${avatar(x.user, "sm")}<div><b>${esc(x.user.name)}</b><br><small class="mu">${x.last ? esc(x.last.text.slice(0, 38)) : "Say hello"}</small></div>${x.unread ? `<em class="bd">${x.unread}</em>` : ""}</a>`).join("") || '<p class="mu" style="padding:16px">No connections yet.</p>';
}
async function thread(id, quiet) {
  const c = convos.find(x => x.user.id === id), t = $("#th"); if (!c || !t) return;
  const L = await api("/messages/" + id), sig = L.map(m => m.id + (m.read ? "r" : "")).join(",");
  if (!quiet || !$("#ms")) { t.innerHTML = `<header class="th"><a href="#chat" class="mu">&larr;</a>${avatar(c.user, "sm")}<div class="chat-person"><b>${esc(c.user.name)}</b><small id="connection-status" class="mu">${wsLive() ? "Live connection" : "Reconnecting · messages will sync"}</small></div><a href="#u/${id}"><small>View profile</small></a></header><div class="ms" id="ms"></div><div class="typing" id="ty" hidden>${esc(c.user.name)} is typing...</div><form id="mf" data-to="${id}"><input name="text" placeholder="Write a message" maxlength="1000" autocomplete="off" required><button>Send</button></form>`; lastTh = ""; }
  if (sig !== lastTh) {
    const first = lastTh === ""; lastTh = sig; const ms = $("#ms"), mine = [...L].reverse().find(m => m.from === me.id), end = L[L.length - 1], stick = first || (end && end.from === me.id) || ms.scrollHeight - ms.scrollTop - ms.clientHeight < 90; // keep your place when reading older messages
    ms.innerHTML = L.map(m => `<div class="bub ${m.from === me.id ? "me" : ""}">${esc(m.text)}<small>${time(m.at)}${mine && m.id === mine.id && m.read ? " · Seen" : ""}</small></div>`).join("") || '<p class="mu">No messages yet. Say hello.</p>'; if (stick) ms.scrollTop = ms.scrollHeight;
    // Incoming messages never trigger an automatic reply or an auto-filled response.
  }
}
function show() {
  const S = [...document.querySelectorAll("[data-s]")]; S.forEach((s, i) => (s.hidden = i !== step));
  $("#pg").style.width = ((step + 1) / STEPS) * 100 + "%"; $("#stp").textContent = `Step ${step + 1} of ${STEPS}: ${S[step].querySelector("h3").textContent}`;
  $("#sv").hidden = step < STEPS - 1; $("[data-act=next]").hidden = step >= STEPS - 1; $("[data-act=back]").style.visibility = step ? "visible" : "hidden";
  if (step === 1) { loadPlaces(); priceNow(); }
  if (step === STEPS - 1) renderReview();
}
function read(f) {
  const d = new FormData(f), n = k => +d.get(k), m = { w: {} };
  ["name", "city", "bio", "role", "type", "movein", "stay", "profession", "area", "anchor"].forEach(k => (m[k] = d.get(k) || ""));
  m.age = n("age") || 22; ["min", "max", "beds"].forEach(k => (m[k] = n(k)));
  ["smoke", "pets", "wfh", "veg", "nosmoke", "nopets", "furn"].forEach(k => (m[k] = d.get(k) ? 1 : 0));
  TR.forEach(t => { m[t.k] = n(t.k) || 3; m.w[t.k] = n("w_" + t.k) || 3; }); return m;
}
const setRadio = (f, n, v) => f.querySelectorAll(`input[name="${n}"]`).forEach(e => (e.checked = String(e.value) === String(v)));
function paintPhoto() { const f = $("#pf"), box = $("#pp"); if (!f || !box) return; box.innerHTML = avatar({ name: f.elements.name.value || me.name, photo: photoNew === undefined ? me.photo : photoNew || "" }, "lg"); }
function applyExtract(f, r) {
  if (!touched.has("profession") && f.elements.profession) f.elements.profession.value = r.profession || "";
  const ev = $("#aievidence"); if (ev) ev.innerHTML = r.profession ? `<small><b>Occupation detected:</b> ${esc(r.profession)} · ${(r.occupation_confidence || 0) >= 0.9 ? "High-confidence phrase match" : "Detected role"}${r.occupation_evidence?.[0]?.text ? ` · evidence: “${esc(r.occupation_evidence[0].text)}”` : ""}</small>` : '<small class="mu">No clear occupation phrase detected yet. The model will not guess.</small>';
  TR.forEach(t => { if (!touched.has(t.k)) setRadio(f, t.k, r.traits[t.k]); if (!touched.has("w_" + t.k)) setRadio(f, "w_" + t.k, r.importance[t.k]); });
  ["smoke", "pets", "wfh", "veg", "nosmoke", "nopets"].forEach(k => { if (!touched.has(k) && f.elements[k]) f.elements[k].checked = !!r.flags[k]; });
}
function paintChips() {
  const f = $("#pf"), box = $("#aichips"); if (!f || !box) return;
  box.innerHTML = chipsHtml(chipsOf(read(f))) || '<span class="mu">Write a few sentences above and your lifestyle will appear here.</span>';
}
async function extractNow() {
  const f = $("#pf"); if (!f) return; const bio = f.elements.bio.value.trim();
  if (bio.length < 8) return paintChips();
  $("#aistat").textContent = "Reading...";
  try { const r = await api("/people/extract", "POST", { bio }); applyExtract(f, r); $("#aistat").textContent = r.engine === "ml" ? "Python ML model" : "Rule-based fallback"; } catch (e) { $("#aistat").textContent = ""; }
  paintChips();
}
function renderReview() {
  const m = read($("#pf"));
  $("#rv").innerHTML = `<div class="rvw"><b>${esc(m.name || "Your name")}${m.age ? ", " + m.age : ""}</b><br><span class="mu">${esc(m.city || "No city yet")} · ${m.role === "host" ? "Offering" : "Looking for"} a ${(TYPE[m.type] || "place").toLowerCase()} · ${m.beds} bed · ${m.furn ? "furnished" : "unfurnished"}</span>
  <p class="mu">Budget $${m.min}-${m.max}/mo${m.movein ? " · move-in " + esc(m.movein) : ""} · stay ${ST[m.stay] || "6 months"}</p><p>${m.bio ? esc(m.bio) : '<span class="mu">No description yet. Go back and write a few sentences.</span>'}</p><div>${chipsHtml(chipsOf(m))}</div></div>`;
  tagPreview();
}
function tagPreview() { clearTimeout(timer); timer = setTimeout(async () => { try { const t = await api("/people/tags", "POST", read($("#pf"))); $("#pt").innerHTML = t.length ? chips(t) : '<span class="mu">None yet. Describe yourself to get up to two tags.</span>'; } catch (e) {} }, 200); }

async function loadPlaces() { // areas and campuses/workplaces for the typed city (commute distance feature)
  const f = $("#pf"); if (!f) return; const city = f.elements.city.value.trim(); let L = [];
  try { if (city) L = await api("/places?city=" + encodeURIComponent(city)); } catch (e) {}
  [["area", L.filter(p => p.kind === "area"), "Not set"], ["anchor", L.filter(p => p.kind !== "area"), "None"]].forEach(([n, list, none]) => {
    const sel = f.elements[n]; if (!sel) return; const cur = sel.dataset.v || "";
    sel.innerHTML = `<option value="">${list.length || !city ? none : "No places for this city yet"}</option>` + list.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join(""); sel.value = list.some(p => p.id === cur) ? cur : "";
  });
}
const VERDICT = { below: "below the typical range", fair: "in line with the market", above: "above the typical range" };
async function priceNow() { // AI price check from the rent model
  const f = $("#pf"), box = $("#pricebox"); if (!f || !box) return; const m = read(f); if (!m.city) { box.hidden = true; return; }
  try {
    const p = await api("/people/price", "POST", m);
    box.hidden = false; box.innerHTML = `<b>AI price check</b><br><small>Typical ${(TYPE[m.type] || "place").toLowerCase()} in ${esc(m.city)}: <b>$${p.low}-${p.high}</b> a month (median $${p.mid}).${VERDICT[p.verdict] ? ` Your ${m.role === "host" ? "asking rent" : "budget"} is ${VERDICT[p.verdict]}.` : ""}${p.known_city === false ? " Rough estimate: little data for this city." : ""}</small>`;
  } catch (e) { box.hidden = true; }
}
const priceHtml = o => { const p = o.price; return p ? `<div class="pricebox"><b>AI price check</b><br><small>Typical ${o.type} in ${esc(o.city || "this area")}: <b>$${p.low}-${p.high}</b> a month (median $${p.mid}).${VERDICT[p.verdict] ? ` This ${o.role === "host" ? "asking rent" : "budget"} is ${VERDICT[p.verdict]}.` : ""}${p.known_city === false ? " Rough estimate: little data for this city." : ""}</small></div>` : ""; };
const distHtml = m => (distText(m) ? `<p class="mu" style="margin:8px 0 0">${esc(distText(m))}</p>` : "");
function banner() {
  const b = $("#banner"); if (!b) return;
  b.innerHTML = me && !me.verified ? `<div class="note vb"><span><b>Verify your email</b> to send requests and messages. We sent a link to ${esc(me.email || "your inbox")}.${devLink ? ` <a href="${esc(devLink)}">Dev mode: verify now</a>` : ""}</span><button class="g sm" data-act="resend">Resend email</button></div>` : "";
}

function go() {
  clearInterval(poll); const [p, a] = route(); document.body.className = me ? "in" : "out"; nav(); banner();
  Promise.resolve(views[p](a)).catch(x => { app.innerHTML = `<div class="empty"><b>Something went wrong</b><p class="mu">${esc(x.message)}</p></div>`; });
}
addEventListener("hashchange", go);
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]");
  if (!b) { const c = e.target.closest("[data-go]"); if (c) location.hash = c.dataset.go; return; }
  const a = b.dataset.act, id = b.dataset.id;
  try {
    if (a === "theme") { e.preventDefault(); setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); return; }
    if (a === "mode") { e.preventDefault(); mode = b.dataset.m || (mode === "login" ? "signup" : "login"); return go(); }
    if (a === "out") { e.preventDefault(); setToken(null); disconnect(); me = null; B = { req: 0, msg: 0 }; location.hash = ""; return go(); }
    if (a === "resend") { const r = await api("/auth/resend", "POST"); devLink = r.devLink || devLink; banner(); return toast(r.already ? "Your email is already verified." : "Verification email sent."); }
    if (a === "photo") return $("#pf-file").click();
    if (a === "photo-rm") { photoNew = null; return paintPhoto(); }
    if (a === "starter") { const t = $("#pf").elements.bio; t.value = (t.value.trim() + " " + b.dataset.t).trim().slice(0, 500); return extractNow(); }
    if (a === "cmp") { const p = $("#cmp"), open = p.hidden; p.hidden = !open; b.setAttribute("aria-expanded", open); b.textContent = open ? "Hide comparison" : "Compare lifestyle with you"; if (open) p.scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
    if (a === "next") { if (step === 0 && !$("#pf").reportValidity()) return; step++; return show(); }
    if (a === "back") { step--; return show(); }
    if (a === "conn") { await api("/requests", "POST", { to: id }); toast("Request sent"); return go(); }
    if (a === "acc" || a === "dec") { await api(`/requests/${id}/respond`, "POST", { action: a === "acc" ? "accept" : "decline" }); toast(a === "acc" ? "Connected. You can now message them." : "Request declined"); await badges(); return go(); }
    if (a === "save") { const r = await api(`/people/${id}/save`, "POST"); toast(r.saved ? "Saved" : "Removed from saved"); if (route()[0] === "u") return go(); b.classList.toggle("on", r.saved); b.setAttribute("aria-pressed", r.saved); }
    if (a === "feedback") { const r = await api(`/people/${id}/feedback`, "POST", { value: b.dataset.value }); toast(r.message); return load(); }
    if (a === "block") { if (!confirm("Block this person? You will no longer see each other.")) return; await api(`/people/${id}/block`, "POST"); toast("Blocked"); to("discover"); }
    if (a === "report") { const reason = prompt("What is the problem? (spam, fake profile, harassment...)"); if (!reason) return; await api(`/people/${id}/report`, "POST", { reason }); toast("Report sent to the moderators"); }
  } catch (err) { toast(err.message, true); }
});
document.addEventListener("input", e => {
  const f = e.target.form; if (!f) return;
  if (f.id === "fl") { F = Object.fromEntries([...new FormData(f)].filter(([, v]) => v)); F.sort = F.sort || "match"; clearTimeout(timer); timer = setTimeout(load, 250); }
  if (f.id === "pf") {
    const n = e.target.name; if (e.target.tagName === "SELECT") e.target.dataset.v = e.target.value;
    if (n === "name") paintPhoto();
    if (n === "city") { clearTimeout(ct); ct = setTimeout(() => { loadPlaces(); priceNow(); }, 450); }
    if (["type", "beds", "furn", "min", "max", "area", "role"].includes(n)) { clearTimeout(pt); pt = setTimeout(priceNow, 450); }
    if (n === "bio") { clearTimeout(xt); xt = setTimeout(extractNow, 500); } else if (n) { touched.add(n); if (step === 2) paintChips(); }
  }
  if (f.id === "mf" && Date.now() - lastTyping > 1500) { lastTyping = Date.now(); wsSend({ type: "typing", to: +f.dataset.to }); }
});
document.addEventListener("change", async e => {
  if (e.target.id !== "pf-file") return; const file = e.target.files[0]; if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10e6) return toast("Choose a JPG, PNG or WebP image under 10 MB.", true);
  const r = await openCropper(file); e.target.value = ""; if (r === undefined) toast("Could not read that image.", true); else if (r) { photoNew = r; paintPhoto(); }
});
document.addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target, err = $("#err");
  try {
    if (f.id === "af") {
      const d = Object.fromEntries(new FormData(f));
      if (mode === "forgot") { const r = await api("/auth/forgot", "POST", d); err.style.color = "var(--pr)"; err.innerHTML = "If that email has an account, a reset link is on its way." + (r.devLink ? ` <a href="${esc(r.devLink)}">Dev mode: open reset link</a>` : ""); return; }
      const r = await api("/auth/" + mode, "POST", d); setToken(r.token); me = r.user; devLink = r.devLink || ""; connect(); await badges(); return to(me.done ? "home" : "profile");
    }
    if (f.id === "rf") { await api("/auth/reset", "POST", { token: f.dataset.token, password: f.elements.password.value }); toast("Password updated. Please log in."); setToken(null); disconnect(); me = null; mode = "login"; location.hash = ""; return go(); }
    if (f.id === "pf") { if (step < STEPS - 1) { step++; return show(); } const body = read(f); if (photoNew !== undefined) body.photo = photoNew || ""; me = await api("/people/me", "PUT", body); photoNew = undefined; toast("Profile saved"); return to("home"); }
    if (f.id === "mf") { const i = f.elements.text, t = f.dataset.to; const r = await api("/messages/" + t, "POST", { text: i.value }); i.value = ""; if (r.warning) toast(r.warning); await convoList(t); await thread(+t, true); }
  } catch (x) { if (err) { err.style.color = ""; err.textContent = x.message; } toast(x.message, true); }
});
onEvent(async e => { // live events from the WebSocket
  if (!me) return; const [p, a] = route();
  if (e.type === "open" || e.type === "close") { const st = $("#connection-status"); if (st) st.textContent = e.type === "open" ? "Live connection" : "Reconnecting · messages will sync"; }
  if (e.type === "message") {
    const ty = $("#ty"); if (ty) ty.hidden = true;
    if (p === "chat" && +a === e.message.from) { await convoList(a); await thread(+a, true); } else { toast(`New message from ${e.from.name}`); badges(); if (p === "chat") convoList(a); }
  }
  if (e.type === "typing" && p === "chat" && +a === e.from) { const ty = $("#ty"); if (ty) { ty.hidden = false; clearTimeout(typingT); typingT = setTimeout(() => (ty.hidden = true), 3000); } }
  if (e.type === "read" && p === "chat" && +a === e.by) thread(+a, true);
  if (e.type === "request") { toast(`${e.from.name} sent you a connection request`); badges(); if (p === "requests") go(); }
  if (e.type === "accepted" || e.type === "declined") { toast(e.type === "accepted" ? `${e.by.name} accepted your request. You can message them now.` : `${e.by.name} declined your request.`); badges(); if (p === "requests" || (p === "u" && +a === e.by.id)) go(); }
});
setInterval(() => { if (me) badges(); }, 10000);
initTheme();
(async () => { if (token()) { try { me = await api("/auth/me"); await badges(); } catch (e) { me = null; } } if (me) connect(); go(); })();
