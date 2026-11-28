export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const P = { home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10", search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3", bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0", chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z", sparkles: "M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3zM19 14l1 2.5 2.5 1-2.5 1L19 21l-1-2.5-2.5-1 2.5-1L19 14z" };
export const ic = n => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]}"/></svg>`;
export const TYPE = { room: "Room", flat: "Flat", house: "House", studio: "Studio" };
export const COUNTRY_CURRENCY = { Pakistan:"PKR",India:"INR","United States":"USD","United Kingdom":"GBP",Canada:"CAD",Australia:"AUD","United Arab Emirates":"AED","Saudi Arabia":"SAR",Qatar:"QAR","New Zealand":"NZD",Germany:"EUR",France:"EUR",Spain:"EUR",Italy:"EUR",Netherlands:"EUR",Ireland:"EUR",Singapore:"SGD",Malaysia:"MYR",Turkey:"TRY",Japan:"JPY",China:"CNY",Bangladesh:"BDT",Nepal:"NPR","Sri Lanka":"LKR","South Africa":"ZAR",Nigeria:"NGN",Kenya:"KES","Afghanistan":"AFN","Albania":"ALL","Algeria":"DZD","Argentina":"ARS","Armenia":"AMD","Austria":"EUR","Bahrain":"BHD","Belgium":"EUR","Bhutan":"BTN","Brazil":"BRL","Bulgaria":"BGN","Cambodia":"KHR","Chile":"CLP","Colombia":"COP","Costa Rica":"CRC","Croatia":"EUR","Cyprus":"EUR","Czechia":"CZK","Denmark":"DKK","Egypt":"EGP","Estonia":"EUR","Ethiopia":"ETB","Finland":"EUR","Ghana":"GHS","Greece":"EUR","Hong Kong":"HKD","Hungary":"HUF","Iceland":"ISK","Indonesia":"IDR","Iraq":"IQD","Israel":"ILS","Jordan":"JOD","Kuwait":"KWD","Latvia":"EUR","Lebanon":"LBP","Lithuania":"EUR","Luxembourg":"EUR","Maldives":"MVR","Mexico":"MXN","Morocco":"MAD","Myanmar":"MMK","Oman":"OMR","Panama":"PAB","Peru":"PEN","Philippines":"PHP","Poland":"PLN","Portugal":"EUR","Romania":"RON","Russia":"RUB","Serbia":"RSD","South Korea":"KRW","Sweden":"SEK","Switzerland":"CHF","Taiwan":"TWD","Thailand":"THB","Tunisia":"TND","Ukraine":"UAH","Uruguay":"UYU","Uzbekistan":"UZS","Vietnam":"VND","Zimbabwe":"USD" };
export const currencyForCountry = country => COUNTRY_CURRENCY[country] || "PKR";
export const money = (value,currency="PKR") => { try { return new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0); } catch { return `${currency} ${Math.round(Number(value)||0).toLocaleString()}`; } };
export const IMP = [[1, "Nice to have"], [3, "Important"], [5, "Must-have"]];
export const TR = [
  { k: "sleep", q: "Daily rhythm", o: [[1, "Early bird"], [3, "Flexible"], [5, "Night owl"]] },
  { k: "clean", q: "Tidiness", o: [[1, "Relaxed"], [3, "Tidy"], [5, "Spotless"]] },
  { k: "guests", q: "Guests at home", o: [[1, "Rarely"], [3, "Sometimes"], [5, "Often"]] },
  { k: "noise", q: "Noise level", o: [[1, "Quiet"], [3, "Balanced"], [5, "Lively"]] }];
export const snap = v => (v <= 2 ? 1 : v >= 4 ? 5 : 3);
export const lbl = (k, v) => TR.find(t => t.k === k).o.find(x => x[0] === snap(v))[1];
export const hue = s => [...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) * 47 % 360;
export const avatar = (u, c = "") => { const name = u?.name || "?", photo = typeof u?.photo === "string" ? u.photo : "", ok = /^(\/photos\/|https:\/\/|data:image\/)/.test(photo); return `<div class="av ${c}${ok ? " has-photo" : ""}" style="--h:${hue(name)}">${esc(name[0].toUpperCase())}${ok ? `<img src="${esc(photo)}" alt="" loading="${c.includes("lg") ? "eager" : "lazy"}" decoding="async" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.classList.remove('has-photo')">` : ""}</div>`; };
export const chips = a => a.length ? a.map(t => `<span class="chip">${esc(t)}</span>`).join("") : '<span class="mu">No tags yet</span>';
export const scol = m => m.block ? "var(--bad)" : m.s >= 75 ? "var(--pr)" : m.s >= 50 ? "var(--ac)" : "var(--bad)";
export const ring = m => `<div class="ring" style="--c:${scol(m)};--p:${m.block ? 0 : m.s}"><b>${m.block ? "-" : m.s + "%"}</b></div>`;
export const why = m => m.block ? `<span class="bad">Blocked: ${m.block}</span>` : `Strong on ${m.f.slice(0, 2).map(x => x[0].toLowerCase()).join(" and ")}. Weakest: ${m.f[m.f.length - 1][0].toLowerCase()}.`;
export const seg = (name, list) => `<div class="seg" role="radiogroup">${list.map(([v, l]) => `<label class="opt"><input type="radio" name="${name}" value="${v}"><span>${l}</span></label>`).join("")}</div>`;
export const tog = (name, l) => `<label class="opt"><input type="checkbox" name="${name}" value="1"><span>${l}</span></label>`;
export const LV = { sleep: { 1: "Early bird", 5: "Night owl" }, clean: { 1: "Relaxed about mess", 5: "Spotless" }, guests: { 1: "Rarely has guests", 5: "Loves hosting" }, noise: { 1: "Prefers quiet", 5: "Lively home" } };
export const chipsOf = m => [
  ...(m.profession ? [{ l: m.profession, c: "job" }] : []),
  ...TR.filter(t => LV[t.k][snap(m[t.k])]).map(t => ({ l: LV[t.k][snap(m[t.k])] + (snap((m.w || {})[t.k]) === 5 ? " · must-have" : ""), c: "life" })),
  ...[["smoke", "Smoker"], ["pets", "Has pets"], ["wfh", "Works from home"], ["veg", "Vegetarian"]].filter(([k]) => m[k]).map(([, l]) => ({ l, c: "habit" })),
  ...[["nosmoke", "No smokers"], ["nopets", "No pets"]].filter(([k]) => m[k]).map(([, l]) => ({ l, c: "deal" }))];
export const chipsHtml = a => a.map(c => `<span class="chip ${c.c}">${esc(c.l)}</span>`).join("");

export const radar = (o, me) => {
  const Cx = 150, Cy = 130, R = 78, ax = [[0, -1], [1, 0], [0, 1], [-1, 0]], pt = (i, r) => `${Cx + ax[i][0] * R * r},${Cy + ax[i][1] * R * r}`, rv = v => 0.15 + 0.85 * (snap(v) - 1) / 4;
  const poly = u => TR.map((t, i) => pt(i, rv(u[t.k]))).join(" "), lab = [[Cx, Cy - R - 12, "middle"], [Cx + R + 8, Cy + 4, "start"], [Cx, Cy + R + 20, "middle"], [Cx - R - 8, Cy + 4, "end"]];
  return `<svg class="rd" viewBox="0 0 300 260" role="img" aria-label="Lifestyle radar: ${esc(o.name)} compared with you">${[0.33, 0.66, 1].map(r => `<polygon class="gr" points="${ax.map((_, i) => pt(i, r)).join(" ")}"/>`).join("")}${ax.map((a, i) => `<line class="ax" x1="${Cx}" y1="${Cy}" x2="${Cx + a[0] * R}" y2="${Cy + a[1] * R}"/>`).join("")}<polygon class="rd-them" points="${poly(o)}"/><polygon class="rd-you" points="${poly(me)}"/>${TR.map((t, i) => `<text x="${lab[i][0]}" y="${lab[i][1]}" text-anchor="${lab[i][2]}">${t.q}</text>`).join("")}</svg>`;
};
export const distText = m => m.commute_km != null ? `${m.commute_km} km commute` : m.area_km != null ? `${m.area_km} km away` : m.commute_km_rev != null ? `${m.commute_km_rev} km commute for them` : "";
export const cmpPanel = (o, m, me) => {
  const d = k => Math.abs(snap(o[k]) - snap(me[k])) / 2, cls = ["f-ok", "f-mid", "f-bad"], txt = ["Same", "Close", "Different"];
  const tiles = m.block ? `<p class="bad">Blocked: ${m.block}</p>` : `<div class="tiles">${m.f.map(([l, s]) => `<div class="tile ${s >= 0.8 ? "t-hi" : s >= 0.5 ? "t-mid" : "t-lo"}"><b>${Math.round(s * 100)}%</b><small>${l}</small></div>`).join("")}</div>`;
  return `<div class="cmpgrid"><div>${radar(o, me)}<div class="legend"><span class="lg">${esc(o.name)}</span><span class="lg you">You</span></div></div><div><h3 style="margin-top:0">How your lifestyles line up</h3>${m.you != null && !m.block ? `<p class="mu" style="margin-top:0">They fit you <b>${m.you}%</b> · you fit them <b>${m.them}%</b>. The overall score averages both views.</p>` : ""}${tiles}<div class="fits">${TR.map(t => `<span class="fit ${cls[d(t.k)]}"><i></i>${t.q}: ${txt[d(t.k)]}</span>`).join("")}</div><p class="mu"><small>Scored by the ${m.engine === "ml" ? "Python ML model" : "rule-based fallback"}. Each tile shows how well that factor fits; low tiles hold the match back.</small></p></div></div>`;
};
export const complete = u => { const c = [u.name, u.city, (u.bio || "").length >= 20, u.movein, u.done, u.max > 0]; return Math.round(100 * c.filter(Boolean).length / c.length); };

export const card = o => { const m = o.match; return `<article class="card" data-go="u/${o.id}"><div class="cb" style="--h:${hue(o.name)}">${ring(m)}</div>
<div class="ch">${avatar(o)}<div><b>${esc(o.name)}, ${o.age}</b><br><small class="mu">${esc(o.city || "No city yet")}</small></div></div>
<div class="body"><div class="facts"><span>${o.role === "host" ? "Offering" : "Seeking"} ${TYPE[o.type].toLowerCase()}</span><span>${o.beds} bed</span><span>${money(o.min,o.currency)}-${money(o.max,o.currency)}</span>${distText(m) ? `<span>${esc(distText(m))}</span>` : ""}</div><div>${chips(o.tags.slice(0, 4))}</div><small class="mu">${why(m)}</small></div>
<div class="ca"><small class="mu">View profile</small><button class="g ic ${o.saved ? "on" : ""}" data-act="save" data-id="${o.id}" aria-label="Save ${esc(o.name)}" aria-pressed="${!!o.saved}">${ic("heart")}</button></div>
<div class="match-feedback" aria-label="Train your recommendations"><small class="mu">Teach the AI your preferences</small><button class="g sm ${o.feedback === "like" ? "selected" : ""}" data-act="feedback" data-value="like" data-id="${o.id}" aria-pressed="${o.feedback === "like"}">♥ Good fit</button><button class="g sm ${o.feedback === "skip" ? "selected" : ""}" data-act="feedback" data-value="skip" data-id="${o.id}" aria-pressed="${o.feedback === "skip"}">× Not for me</button></div></article>`; };
