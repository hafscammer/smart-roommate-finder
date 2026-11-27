// AI service: keyword + questionnaire tagging, and importance-weighted similarity matching.
const TRAITS = ["sleep", "clean", "guests", "noise"], LABEL = { sleep: "Sleep schedule", clean: "Cleanliness", guests: "Guests", noise: "Noise level" };

function tags(u) {
  const t = [], b = String(u.bio || "").toLowerCase(), ns = /non-?smok|don.t smok|no smok/.test(b);
  if (u.smoke || (!ns && /smok|vape|cigar/.test(b))) t.push("Smoker");
  if (u.sleep >= 4 || /night|late|gamer|2 ?am/.test(b)) t.push("Night owl");
  if (u.sleep <= 2 || /early|morning|5 ?am|gym/.test(b)) t.push("Early bird");
  if (u.clean >= 4) t.push("Neat freak");
  if (u.clean <= 2) t.push("Easy-going");
  if (u.guests >= 4) t.push("Social host");
  if (u.guests <= 2 && u.noise <= 2) t.push("Quiet type");
  if (u.pets || /\b(dog|cat|pet)s?\b/.test(b)) t.push("Pet lover");
  if (/student|university|exam/.test(b)) t.push("Student");
  if (u.wfh || /remote|freelanc|work from home|works from home|developer/.test(b)) t.push("Remote worker");
  if (u.veg || /vegetarian|vegan/.test(b)) t.push("Vegetarian");
  if (/cook|chef|food/.test(b)) t.push("Foodie");
  return [...new Set(t)];
}

const sim = (a, b) => 1 - Math.abs(a - b) / 4;
function matchCore(me, o) {
  if ((me.nosmoke && o.smoke) || (o.nosmoke && me.smoke)) return { s: 0, block: "smoking dealbreaker" };
  if ((me.nopets && o.pets) || (o.nopets && me.pets)) return { s: 0, block: "pets dealbreaker" };
  let n = 0, d = 0; const f = [];
  TRAITS.forEach(k => { const w = me.w[k], s = sim(me[k], o[k]); n += w * s; d += w; f.push([LABEL[k], s]); });
  const ov = Math.min(me.max, o.max) - Math.max(me.min, o.min), bs = ov >= 0 ? 1 : Math.max(0, 1 + ov / Math.max(me.max, 1));
  const cs = String(me.city).trim().toLowerCase() === String(o.city).toLowerCase() ? 1 : 0.2;
  const ps = (o.type === me.type ? 1 : 0.3) * 0.6 + (o.beds === me.beds ? 1 : 0.4) * 0.4;
  n += 3 * bs + 3 * cs + 2 * ps; d += 8;
  f.push(["Budget", bs], ["Location", cs], ["Property", ps]);
  f.sort((a, b) => b[1] - a[1]);
  return { s: Math.round((100 * n) / d), f };
}

const places = require("./places");
// Two-way score: how well they fit you, how well you fit them, and the average. Mirrors the Python service's response shape.
function match(me, o) {
  const a = matchCore(me, o); if (a.block) return a;
  const b = matchCore(o, me), them = b.block ? 0 : b.s;
  return { ...a, you: a.s, them, s: Math.round((a.s + them) / 2), rank: Math.round((a.s + them) / 2), area_km: places.km(me.area, o.area), commute_km: places.km(me.anchor, o.area), commute_km_rev: places.km(o.anchor, me.area) };
}

// ---- Python ML service client, with automatic fallback to the local rules above ----
const cfg = require("../config"), { pub } = require("../db");
async function http(path, body) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), cfg.aiTimeoutMs);
  try {
    const r = await fetch(cfg.aiUrl + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: c.signal });
    if (!r.ok) throw new Error("AI service HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
// Returns [{ tags, match }] aligned with `others`
async function enrich(me, others) {
  if (!others.length) return [];
  try { return (await http("/analyze", { me: pub(me), candidates: others.map(pub) })).results; }
  catch (e) { return others.map(o => ({ tags: topTags(o), persona: "", match: { ...match(me, o), engine: "rules" } })); }
}
// Keyword fallback mirroring ai-service/pipeline/rules.py (used when the Python service is offline)
const RX = {
  sleep: [/night owl|stay up late|up late|sleep (very )?late|late[- ]night|after midnight|\b[1-3] ?am\b|night shifts?|games? at night|work late/i, /early (riser|bird)|morning person|\b[4-6] ?am\b|gym at [4-7]|in bed (by|early)|dawn|wake up early/i],
  guests: [/\bhost(ing)?\b|friends over|game nights?|dinner parties|visit all the time|always friends|people over/i, /rarely (have|bring|invite)|homebody|no visitors|without visitors|my space|privacy|don'?t invite|keep to myself/i],
  noise: [/loud|lively|noisy|drummer|part(y|ies)|music on/i, /quiet|calm|peaceful|silent|low volume|sensitive to noise|can'?t concentrate/i],
};
const CLEAN_LO = /relaxed about (the )?(mess|clean)|laid[- ]?back about|not fussy|\bmessy|don'?t mind (the )?(mess|clutter)|dishes can wait/i;
const CLEAN_HI = /\btidy|spotless|organi[sz]ed|\bneat\b|immaculate|clutter|clean every|very clean|super clean/i;
const CUE = /\b(must|need|needs|essential|non-negotiable|important|really want|have to)\b/i;
const JOBS = [["Medical student", /\b(medical|medicine|mbbs|bds) student\b|\bmed student\b|final[- ]year mbbs|\bdoing mbbs\b|\bstudying medicine\b/i],
  ["Software engineering student", /\b(software engineering|computer science|computer sciences|information technology|information systems|data science) student\b|\b(bs|bsc|bachelor'?s|ms|msc|master'?s) (in )?(computer science|software engineering|information technology|data science)\b|\b(bscs|bsse|bsit|bsds) student\b|\b(studying|pursuing|majoring in) (computer science|software engineering|information technology|data science)\b|\b(doing|pursuing|enrolled in) (my )?(bscs|bsse|bsit|bsds)\b/i],
  ["Software developer", /\b(software|web|frontend|front[- ]end|backend|back[- ]end|full[- ]stack|mobile|app) (developer|engineer)\b|\bdeveloper\b|\bprogrammer\b|\bcoder\b|\bdevops\b|\bdata scientist\b|\bqa engineer\b|\bcyber ?security\b|\bmachine learning engineer\b|\b(build|building|develop|developing) (websites|web apps|mobile apps|software|applications)\b|\bworks? in (tech|technology|software)\b/i],
  ["Designer", /\b(graphic|ui|ux|product|fashion|interior|web) designer\b|\bdesigner\b|\billustrator\b|\banimator\b/i], ["Doctor", /\b(doctor|physician|surgeon|house officer|dentist|medical officer)\b/i],
  ["Nurse", /\b(nurse|nursing officer|registered nurse|midwife)\b/i], ["Pharmacist", /\b(pharmacist|pharmacy technician|pharmacy assistant)\b|\bpharmacy\b/i],
  ["Engineer", /\b(civil|mechanical|electrical|chemical|industrial|automotive|telecom|electronics|structural|environmental|petroleum|aerospace)? ?engineer\b/i], ["Architect", /\barchitect\b/i],
  ["Teacher", /\b(school teacher|teacher|lecturer|professor|tutor|instructor|educator)\b/i], ["Finance", /\b(accountant|accounting|auditor|banker|banking|financial analyst|finance officer|investment analyst|bookkeeper|data analyst|business analyst)\b/i], ["IT professional", /\b(it support|systems administrator|system administrator|network administrator|database administrator|cloud engineer|it specialist)\b/i],
  ["Marketing", /\b(marketing|sales|seo|digital marketing|social media|brand) (executive|manager|specialist|officer|analyst|coordinator)\b|\b(marketer|salesperson|copywriter|advertiser)\b/i],
  ["Hospitality", /\b(chef|cook|barista|waiter|waitress|server|hotel manager|hospitality|restaurant manager|baker)\b/i], ["Lawyer", /\b(lawyer|attorney|advocate|paralegal|solicitor|legal counsel)\b/i],
  ["Writer", /\b(writer|journalist|editor|content creator|blogger|author|reporter)\b/i], ["Entrepreneur", /\b(entrepreneur|startup founder|business owner|founder|co[- ]founder)\b/i],
  ["Researcher", /\b(researcher|scientist|research assistant|research fellow|phd researcher)\b/i], ["Student", /\b(student|undergrad|postgrad|university student|college student)\b/i],
  ["Government employee", /\b(civil servant|government employee|government officer|public servant|bureaucrat|public sector employee|government service|works? for the government|federal employee)\b/i], ["Police / Armed forces", /\b(police officer|soldier|army officer|navy officer|air force officer|armed forces|military officer|pakistan army|pakistan navy|pakistan air force)\b/i],
  ["Skilled trades", /\b(electrician|plumber|mechanic|technician|welder|carpenter|technologist|hvac technician|auto mechanic|maintenance technician|machinist)\b/i],
  ["Data / Analytics", /\b(data analyst|business intelligence analyst|bi analyst|analytics engineer|data engineer|statistician|power bi developer|tableau developer)\b/i],
  ["Psychology / Counseling", /\b(psychologist|clinical psychologist|therapist|counsell?or|psychotherapist|mental health professional)\b/i],
  ["Design / Media", /\b(video editor|photographer|videographer|motion designer|3d artist|3d modeler|animator|content strategist)\b/i],
  ["Agriculture", /\b(farmer|agronomist|agricultural engineer|veterinarian|vet|animal doctor)\b/i], ["Transport / Logistics", /\b(driver|pilot|delivery rider|courier|logistics|supply chain)\b/i],
  ["Human resources", /\b(hr|human resources|recruiter|talent acquisition)\b/i], ["Customer support", /\b(customer support|customer service|call center|help desk)\b/i], ["Real estate", /\b(real estate agent|realtor|property dealer|property consultant)\b/i], ["Unemployed", /\b(unemployed|currently not working|between jobs)\b/i]];
function jobEvidence(text, rx) {
  for (const m of text.matchAll(new RegExp(rx.source, rx.flags.replace("g", "") + "g"))) {
    const start = Math.max(text.lastIndexOf(".", m.index - 1), text.lastIndexOf("!", m.index - 1), text.lastIndexOf("?", m.index - 1), text.lastIndexOf("\n", m.index - 1)) + 1;
    const before = text.slice(start, m.index);
    const other = /\b(my|his|her|their|our) (friend|brother|sister|father|mother|husband|wife|cousin|roommate|colleague|boss|manager|son|daughter)\b.{0,65}\b(is|are|works?|studies|studied|became|was|were)\b/i.exec(before);
    if (other && !/\bI (am|work|study|teach|serve|run|manage)\b/i.test(before.slice(other.index + other[0].length))) continue;
    const context = before + m[0];
    if (/\b(not|never) (a |an )?(doctor|nurse|teacher|engineer|developer|student|lawyer|accountant|designer)\b|\b(want|hope|plan|wish|aspire) to become (a |an )?/i.test(context)) continue;
    return m;
  }
  return null;
}
function jobsOf(text) {
  let out = JOBS.filter(([, r]) => jobEvidence(text, r)).map(([l]) => l);
  if (out.includes("Medical student") || out.includes("Software engineering student")) out = out.filter(j => j !== "Student");
  if (out.includes("Software developer")) out = out.filter(j => j !== "Engineer");
  return out;
}
function extractLocal(bio) {
  const text = String(bio || ""), sents = text.split(/(?<=[.!?;])\s+|\n+/).filter(s => s.trim()), traits = {}, importance = {};
  for (const k of ["sleep", "clean", "guests", "noise"]) {
    let lvl = 3, cue = false;
    for (const s of sents) {
      const v = k === "clean" ? (CLEAN_LO.test(s) ? 1 : CLEAN_HI.test(s) ? 5 : 3) : RX[k][0].test(s) ? 5 : RX[k][1].test(s) ? 1 : 3;
      if (v !== 3) { lvl = v; cue = CUE.test(s); break; }
    }
    traits[k] = lvl; importance[k] = lvl !== 3 && cue ? 5 : 3;
  }
  const t = r => (r.test(text) ? 1 : 0), nosmoke = t(/no smokers|smoke-free|non-?smokers only|can'?t live with smokers|no smoking|without smok/i);
  const flags = { nosmoke, smoke: /\b(smoke|smoker|vape|vaping)\b/i.test(text) && !/non-?smoker|don'?t smoke|do not smoke/i.test(text) && !nosmoke ? 1 : 0,
    pets: t(/(i have|my) (a |an )?(cat|dog|pet|rabbit|puppy|kitten)|dog lover|cat lover/i), nopets: t(/no pets|pet-free|allergic|no animals/i),
    wfh: t(/work(ing)? (from home|remotely)|works from home|remote|freelanc|\bwfh\b/i), veg: t(/vegetarian|vegan/i) };
  let jobs = jobsOf(text);
  const evidence = JOBS.flatMap(([label, rx]) => { const m = jobEvidence(text, rx); return m ? [{ label, text: text.slice(Math.max(0, m.index - 35), Math.min(text.length, m.index + m[0].length + 35)), confidence: 0.96 }] : []; }).slice(0, 3);
  if (evidence.some(x => ["Medical student", "Software engineering student"].includes(x.label))) jobs = jobs.filter(x => x !== "Student");
  return { traits, importance, flags, profession: jobs[0] || "", professions: jobs.slice(0, 2), occupation_evidence: evidence, occupation_confidence: evidence[0]?.confidence || (jobs.length ? 0.55 : 0), tags: topTags({ ...traits, ...flags, bio: text, profession: jobs[0] || "" }) };
}
async function extract(bio) { try { return await http("/extract", { bio }); } catch (e) { return { ...extractLocal(bio), engine: "rules" }; } }
// Fallback for the "1 to 2 tags" rule: rare, informative tags first; nothing unless there is a description (or a profession)
const RARE = ["Smoker", "Night owl", "Early bird", "Neat freak", "Social host", "Quiet type", "Pet lover", "Vegetarian", "Remote worker", "Foodie", "Student", "Easy-going"];
function topTags(u) {
  const has = String(u.bio || "").trim().length >= 8, prof = u.profession || "", all = has ? tags(u) : [];
  return [...(prof ? [prof] : []), ...RARE.filter(t => all.includes(t) && !(prof && t === "Student"))].slice(0, has ? 2 : 1);
}
async function tagsFor(u) { try { return (await http("/tags", { users: [u] })).tags[0]; } catch (e) { return topTags(u); } }
// People like this person: embeddings + personas + collaborative filtering in Python; lifestyle distance only as a fallback
async function similar(target, pool, k = 4) {
  try { return (await http("/similar", { target: pub(target), pool: pool.map(pub), k })).results; }
  catch (e) {
    const d = (a, b) => ["sleep", "clean", "guests", "noise"].reduce((s, x) => s + Math.abs(a[x] - b[x]), 0);
    return pool.map(p => ({ id: p.id, score: +(1 - d(target, p) / 16).toFixed(3), why: ["similar lifestyle"] })).sort((a, b) => b.score - a.score).slice(0, k);
  }
}
async function status() {
  try { const h = await http("/health"); return { engine: "python", label: h.label, model: h.model, version: h.version, sklearn: h.sklearn, metrics: h.metrics, trained_at: h.trained_at, n_real: h.n_real, training: h.training, last_retrain: h.last_retrain, n_profiles: h.n_profiles, n_pairs: h.n_pairs, n_events: h.n_events, collab_active: h.collab_active }; }
  catch (e) { return { engine: "local", label: "Rule-based fallback (Python service offline)" }; }
}

// ---- Safety, price check and smart replies: ML service first, simple rules when it is offline ----
const MOD = { toxic: /\b(idiot|stupid|loser|worthless|trash|disgusting|pathetic)\b|shut up|i hate (you|people like you)|you will regret/i, scam: /western union|wire (the )?(money|deposit|advance)|gift cards?|crypto(currency)? payment|send (the )?(money|deposit) first|advance before (the )?viewing|click this link|guaranteed (investment )?returns/i, contact: /\+?\d[\d\s().-]{8,}\d|[\w.+-]+@[\w-]+\.[\w.-]+|whats ?app|telegram|instagram|snapchat|text me on|call me on|dm me/i };
const REASON = { toxic: "That message looks abusive, so it was not sent.", scam: "That message looks like a scam or a request for money, so it was not sent.", contact: "For your safety, avoid sharing phone numbers or other contact details before you have met." };
async function moderate(text) {
  try { return await http("/moderate", { text: String(text).slice(0, 1000) }); }
  catch (e) {
    const label = ["scam", "toxic", "contact"].find(k => MOD[k].test(text)) || "ok", action = label === "ok" ? "allow" : label === "contact" ? "warn" : "block";
    return { label, score: 0.9, action, reason: REASON[label] || "", engine: "rules" };
  }
}
const BASE = { faisalabad: 170, lahore: 230, islamabad: 300, london: 1000, toronto: 1050 }, TYPEF = { room: 1, studio: 1.5, flat: 2, house: 2.8 };
async function rent(p) {
  try { return await http("/rent", p); }
  catch (e) {
    const known = BASE[String(p.city || "").trim().toLowerCase()], b = known || 250, beds = Math.max(1, +p.beds || 1), t = TYPEF[p.type] || 1;
    const mid = Math.round((b * t * (["flat", "house"].includes(p.type) ? 1 + 0.3 * (beds - 1) : 1) * (p.furn ? 1.12 : 1)) / 5) * 5;
    return { low: Math.round((mid * 0.8) / 5) * 5, mid, high: Math.round((mid * 1.25) / 5) * 5, known_city: !!known, engine: "rules" };
  }
}
const INTENTS = [["ask_movein", /move.?in|when (can|are) you (move|start)|how soon/i], ["ask_budget", /budget|how much|rent|price range|per month/i], ["ask_viewing", /viewing|\bmeet\b|video call|visit|see the (place|flat|room)/i], ["ask_rules", /smoke|pets?\b|guests?|noisy|dealbreaker|cook/i], ["ask_about", /about yourself|do for work|studying|looking for in a roommate|daily routine/i], ["thanks", /thanks|thank you|appreciate|cheers/i], ["greeting", /^(hi|hello|hey|good (morning|evening))\b/i]];
const SUG = { greeting: ["Hi! Nice to meet you.", "Hello! Thanks for connecting.", "Hey! How are you?"], ask_movein: ["I'm hoping to move in {movein}.", "I'm flexible on dates. What works for you?", "As soon as the room is free would be ideal."], ask_budget: ["My budget is ${min}-{max} per month.", "I can do up to ${max} per month.", "Does ${max} per month work for you?"],
  ask_viewing: ["I'd love to view it. Are you free this weekend?", "Could we do a video call first?", "Weekday evenings work best for me."], ask_rules: ["{rules}", "Happy to follow your house rules.", "What are your rules on guests and noise?"], ask_about: ["{about}", "I'm tidy, respectful and easy to live with.", "What are you looking for in a roommate?"],
  thanks: ["You're welcome!", "Happy to help.", "Anytime!"], other: ["Sounds good!", "Could you tell me more?", "Let me think and get back to you."] };
const fillSug = (t, me) => t.replace("{movein}", me.movein || "next month").replace("{min}", me.min || 0).replace("{max}", me.max || 0)
  .replace("{rules}", (me.smoke ? "I smoke outside" : "I don't smoke") + (me.pets ? " and I have pets." : " and I have no pets."))
  .replace("{about}", me.profession && me.city ? `I'm a ${me.profession.toLowerCase()} based in ${me.city}.` : "I'm a tidy, respectful person looking for a calm home.");
async function suggest(text, me) {
  try { return await http("/suggest", { text, me }); }
  catch (e) { const intent = (INTENTS.find(([, r]) => r.test(text)) || ["other"])[0]; return { intent, suggestions: SUG[intent].map(t => fillSug(t, me)), engine: "rules" }; }
}
module.exports = { tags, topTags, match, enrich, tagsFor, similar, extract, status, moderate, rent, suggest };
