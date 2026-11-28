import {all as places,km} from "./places.js";
const TRAITS=["sleep","clean","guests","noise"],LABEL={sleep:"Sleep schedule",clean:"Cleanliness",guests:"Guests",noise:"Noise level"};
export function tags(u){const t=[],b=String(u.bio||"").toLowerCase(),ns=/non-?smok|don.t smok|no smok/.test(b);if(u.smoke||(!ns&&/smok|vape|cigar/.test(b)))t.push("Smoker");if(u.sleep>=4||/night|late|gamer|2 ?am/.test(b))t.push("Night owl");if(u.sleep<=2||/early|morning|5 ?am|gym/.test(b))t.push("Early bird");if(u.clean>=4)t.push("Neat freak");if(u.clean<=2)t.push("Easy-going");if(u.guests>=4)t.push("Social host");if(u.guests<=2&&u.noise<=2)t.push("Quiet type");if(u.pets||/\b(dog|cat|pet)s?\b/.test(b))t.push("Pet lover");if(/student|university|exam/.test(b))t.push("Student");if(u.wfh||/remote|freelanc|work from home|developer/.test(b))t.push("Remote worker");if(u.veg||/vegetarian|vegan/.test(b))t.push("Vegetarian");if(/cook|chef|food/.test(b))t.push("Foodie");return [...new Set(t)];}
const RARE=["Smoker","Night owl","Early bird","Neat freak","Social host","Quiet type","Pet lover","Vegetarian","Remote worker","Foodie","Student","Easy-going"];
export function topTags(u){const has=String(u.bio||"").trim().length>=8,prof=u.profession||"",all=has?tags(u):[];return [...(prof?[prof]:[]),...RARE.filter(t=>all.includes(t)&&!(prof&&t==="Student"))].slice(0,has?2:1);}
const sim=(a,b)=>1-Math.abs((+a||0)-(+b||0))/4;
function core(a,b){if((a.nosmoke&&b.smoke)||(b.nosmoke&&a.smoke))return {s:0,block:"smoking dealbreaker"};if((a.nopets&&b.pets)||(b.nopets&&a.pets))return {s:0,block:"pets dealbreaker"};const accepts=(pref,g)=>!pref||pref==="any"||!g||pref===g;if(!accepts(a.gender_preference,b.gender)||!accepts(b.gender_preference,a.gender))return {s:0,block:"gender preference mismatch"};let n=0,d=0;const f=[];for(const k of TRAITS){const w=Number(a.w?.[k]||1),v=sim(a[k],b[k]);n+=w*v;d+=w;f.push([LABEL[k],v]);}const amin=Number.isFinite(+a.min_usd)?+a.min_usd:+a.min||0,amax=Number.isFinite(+a.max_usd)?+a.max_usd:+a.max||0,bmin=Number.isFinite(+b.min_usd)?+b.min_usd:+b.min||0,bmax=Number.isFinite(+b.max_usd)?+b.max_usd:+b.max||0,ov=Math.min(amax,bmax)-Math.max(amin,bmin),bs=ov>=0?1:Math.max(0,1+ov/Math.max(amax,1)),cs=String(a.city||"").trim().toLowerCase()===String(b.city||"").trim().toLowerCase()?1:.2,ps=(a.type===b.type?1:.3)*.6+(a.beds===b.beds?1:.4)*.4;n+=3*bs+3*cs+2*ps+1;d+=9;f.push(["Budget",bs],["Location",cs],["Property",ps],["Gender preference",1]);f.sort((x,y)=>y[1]-x[1]);return {s:Math.round(100*n/d),f};}
export function match(a,b){const x=core(a,b);if(x.block)return x;const y=core(b,a),them=y.block?0:y.s,s=Math.round((x.s+them)/2);return {...x,you:x.s,them,s,rank:s,area_km:km(a.area,b.area),commute_km:km(a.anchor,b.area),commute_km_rev:km(b.anchor,a.area),engine:"rules"};}
export function enrich(me,others){return others.map(o=>({tags:topTags(o),persona:"",match:match(me,o)}));}

// Server-to-server bridge. Python is optional: every operation retains its local rules fallback.
async function pythonCall(env,path,payload,timeout=3500){
  const base=String(env.AI_SERVICE_URL||"").replace(/\/$/,"");
  const token=String(env.AI_SERVICE_TOKEN||"");
  if(!base||!token) throw new Error("Python AI service is not configured");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetch(base+path,{method:payload?"POST":"GET",headers:{"Content-Type":"application/json","X-Service-Token":token},body:payload?JSON.stringify(payload):undefined,signal:controller.signal});
    if(!response.ok) throw new Error(`Python AI HTTP ${response.status}`);
    return await response.json();
  } finally {clearTimeout(timer);}
}
export async function aiStatus(env){
  try {const s=await pythonCall(env,"/health",null,1800);if(!s||s.ok!==true)throw new Error("Invalid health response");return {...s,engine:"python",mlInference:true,label:s.label||"Python ML",fallback:"javascript"};}
  catch(e){return {engine:"rules",label:"JavaScript rule-based fallback (Python ML unavailable)",mlInference:false,training:false,reason:String(e.message||e),fallback:"javascript"};}
}
export async function analyzeWithFallback(env,me,others){
  if(!others.length)return [];
  try {
    const out=[];
    for(let i=0;i<others.length;i+=500){
      const batch=others.slice(i,i+500),r=await pythonCall(env,"/analyze",{me,candidates:batch},6500);
      if(!Array.isArray(r.results)||r.results.length!==batch.length)throw new Error("Invalid analyze response");
      out.push(...r.results.map((x,j)=>({...x,tags:Array.isArray(x.tags)?x.tags:topTags(batch[j]),match:{...(x.match||x),engine:"ml"}})));
    }
    return out;
  } catch{return enrich(me,others).map(x=>({...x,match:{...x.match,engine:"rules"}}));}
}
export async function extractWithFallback(env,bio){try{return {...await pythonCall(env,"/extract",{bio},4000),engine:"ml"};}catch{return extract(bio);}}
export async function tagsWithFallback(env,users){try{const r=await pythonCall(env,"/tags",{users},3500);if(!Array.isArray(r.tags))throw new Error("Invalid tags response");return r.tags;}catch{return users.map(topTags);}}
export async function rentWithFallback(env,p){try{return {...await pythonCall(env,"/rent",{city:p.city,type:p.type,beds:p.beds,furn:p.furn,area:p.area}),engine:"ml"};}catch{return rent(p);}}
export async function moderateWithFallback(env,value){try{return {...await pythonCall(env,"/moderate",{text:value},2500),engine:"ml"};}catch{return moderate(value);}}

export function rent(p){const BASE={faisalabad:170,lahore:230,islamabad:300,london:1000,toronto:1050},TYPEF={room:1,studio:1.5,flat:2,house:2.8};const known=BASE[String(p.city||"").trim().toLowerCase()],b=known||250,beds=Math.max(1,+p.beds||1),t=TYPEF[p.type]||1,mid=Math.round((b*t*( ["flat","house"].includes(p.type)?1+.3*(beds-1):1)*(p.furn?1.12:1))/5)*5;return {low:Math.round(mid*.8/5)*5,mid,high:Math.round(mid*1.25/5)*5,known_city:!!known,engine:"rules"};}
const MOD={scam:/\b(send|transfer|wire|deposit|advance)\b.{0,45}\b(money|cash|payment|fee)\b|\b(crypto|bitcoin|investment opportunity|guaranteed profit)\b/i,toxic:/\b(fuck you|bitch|slut|idiot|kill yourself|stupid moron)\b/i,contact:/\b(?:\+?\d[\d ()-]{7,}\d|[\w.+-]+@[\w-]+\.[\w.-]+|whats ?app|telegram|instagram|snapchat|text me on|call me on|dm me)\b/i};
export function moderate(text){const label=["scam","toxic","contact"].find(k=>MOD[k].test(String(text)))||"ok",action=label==="ok"?"allow":label==="contact"?"warn":"block",reason=label==="contact"?"For your safety, avoid sharing contact details before you have met.":label==="scam"?"That message looks like a scam or a request for money, so it was not sent.":label==="toxic"?"That message looks abusive, so it was not sent.":"";return {label,score:label==="ok"?0:.9,action,reason,engine:"rules"};}
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

export function extract(bio){return {...extractLocal(String(bio||"").slice(0,1000)),engine:"rules"};}

const intents=[["ask_movein",/move.?in|when (can|are) you (move|start)|how soon/i],["ask_budget",/budget|how much|rent|price/i],["ask_viewing",/viewing|\bmeet\b|video call|visit/i],["ask_rules",/smoke|pets?\b|guests?|noisy|cook/i],["ask_about",/about yourself|do for work|studying|daily routine/i],["thanks",/thanks|thank you|appreciate/i],["greeting",/^(hi|hello|hey|good (morning|evening))\b/i]];
export function suggest(text,me){const intent=intents.find(([,r])=>r.test(text))?.[0]||"other",rules={greeting:["Hi! Nice to meet you.","Hello! Thanks for connecting."],ask_movein:[`I'm hoping to move in ${me.movein||"next month"}.`,`I'm flexible on dates. What works for you?`],ask_budget:[`My budget is ${me.min||0}-${me.max||0} per month.`,`I can do up to ${me.max||0} per month.`],ask_viewing:["I'd love to view it. Are you free this weekend?","Could we do a video call first?"],ask_rules:[`${me.smoke?"I smoke outside":"I don't smoke"}${me.pets?" and I have pets.":" and I have no pets."}`,"Happy to follow your house rules."],ask_about:[me.profession&&me.city?`I'm a ${me.profession.toLowerCase()} based in ${me.city}.`:"I'm a tidy, respectful person looking for a calm home."],thanks:["You're welcome!","Happy to help."],other:["Sounds good!","Could you tell me more?"]};return {intent,suggestions:rules[intent],engine:"rules"};}
export const status=()=>({engine:"rules",label:"JavaScript rule-based fallback (Python ML service unavailable)",mlInference:false,training:false});
