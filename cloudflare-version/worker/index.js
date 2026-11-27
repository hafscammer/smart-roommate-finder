import {handleAuth,authenticate,signToken,verifyToken,jsonResponse as json} from "./auth.js";
import {handlePeople} from "./people.js";
import {handleRequests} from "./requests.js";
import {handleMessages} from "./messages.js";
import {forCity} from "./places.js";
import {aiStatus} from "./ai.js";
export {RoomHub} from "./hub.js";
const security={"X-Content-Type-Options":"nosniff","Referrer-Policy":"same-origin","X-Frame-Options":"DENY","Permissions-Policy":"camera=(), microphone=(), geolocation=()"};
function withHeaders(response){const h=new Headers(response.headers);for(const [k,v] of Object.entries(security))h.set(k,v);return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});}
async function retrainPython(env){
 const base=String(env.AI_SERVICE_URL||"").replace(/\/$/,""),serviceToken=String(env.AI_SERVICE_TOKEN||""),adminToken=String(env.AI_ADMIN_TOKEN||"");
 if(!base||!serviceToken||!adminToken) return json({error:"Python AI URL, service token and admin token must be configured."},503);
 const db=env.roomiematch_db;
 const [us,rs,fs,ms]=await Promise.all([
  db.prepare("SELECT id,email,data_json FROM users").all(),
  db.prepare("SELECT id,from_user,to_user,status,data_json FROM requests").all(),
  db.prepare("SELECT by_user,target_user,value FROM feedback").all(),
  db.prepare("SELECT from_user,to_user FROM messages").all()
 ]);
 const users=new Map((us.results||[]).map(r=>{const p=JSON.parse(r.data_json||"{}");for(const k of ["email","saved","blocked","passHash","pass_hash"])delete p[k];return [Number(r.id),{...p,id:Number(r.id)}];}));
 const interactions=[];
 for(const q of rs.results||[]){const from=Number(q.from_user),to=Number(q.to_user),raw=JSON.parse(q.data_json||"{}");if(from<100||to<100||raw.resolveAt||!['accepted','declined'].includes(q.status))continue;const me=users.get(to),other=users.get(from);if(me&&other)interactions.push({me,other,label:q.status==='accepted'?1:0});}
 for(const f of fs.results||[]){const by=Number(f.by_user),target=Number(f.target_user);if(by<100)continue;const me=users.get(by),other=users.get(target);if(me&&other)interactions.push({me,other,label:f.value==='like'?1:0});}
 const events=[];
 for(const [id,u] of users){if(id>=100)for(const item of (JSON.parse((us.results||[]).find(x=>Number(x.id)===id).data_json||"{}").saved||[]))events.push({user:id,item:Number(item),w:1});}
 for(const q of rs.results||[]){const from=Number(q.from_user),to=Number(q.to_user),raw=JSON.parse(q.data_json||"{}");if(raw.resolveAt)continue;events.push({user:from,item:to,w:2});if(q.status==='accepted')events.push({user:to,item:from,w:3});}
 for(const m of ms.results||[]){const from=Number(m.from_user),to=Number(m.to_user);if(from>=100&&to>=100)events.push({user:from,item:to,w:1});}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const r=await fetch(base+"/retrain",{method:"POST",headers:{"Content-Type":"application/json","X-Service-Token":serviceToken,"X-Admin-Token":adminToken},body:JSON.stringify({interactions,events}),signal:controller.signal});const d=await r.json().catch(()=>({}));if(!r.ok)return json({error:d.error||`Python retraining request failed (${r.status}).`},r.status);return json({rows:interactions.length,events:events.length,...d},202);}catch(e){return json({error:"Could not reach the Python AI service. Check its URL and availability."},502);}finally{clearTimeout(timer);}
}
export default {async fetch(request,env){const url=new URL(request.url),path=url.pathname;try{
 if(path==="/api/health")return withHeaders(json({status:"ok",service:"RoomieMatch Cloudflare API",version:"3.1.0-cf.1",database:"D1",ai:(await aiStatus(env)).label}));
 if(path.startsWith("/api/auth/"))return withHeaders(await handleAuth(request,env,path));
 if(path==="/api/places"&&request.method==="GET")return withHeaders(json(forCity(url.searchParams.get("city"))));
 if(path==="/api/ai/status"&&request.method==="GET")return withHeaders(json(await aiStatus(env)));
 if(path==="/api/ws/ticket"&&request.method==="POST"){const user=await authenticate(request,env);if(!user)return withHeaders(json({error:"Please log in again."},401));const ticket=await signToken({uid:user.id,scope:"ws",nonce:crypto.randomUUID()},env.JWT_SECRET,30);return withHeaders(json({ticket}));}
 if(path==="/ws"){const ticket=url.searchParams.get("ticket"),p=await verifyToken(ticket||"",env.JWT_SECRET);if(!p||p.scope!=="ws"||!p.uid)return new Response("Unauthorized",{status:401});const stub=env.ROOM_HUB.get(env.ROOM_HUB.idFromName("roomiematch-global"));const headers=new Headers(request.headers);headers.set("x-user-id",String(p.uid));headers.set("x-ticket-id",String(p.nonce||""));return stub.fetch("https://hub.internal/connect",{headers});}
 if(path.startsWith("/api/")){const user=await authenticate(request,env);if(!user)return withHeaders(json({error:"Please log in again."},401));let response;
  if(path.startsWith("/api/people"))response=await handlePeople(request,env,path,user);
  else if(path.startsWith("/api/requests"))response=await handleRequests(request,env,path,user);
  else if(path.startsWith("/api/messages"))response=await handleMessages(request,env,path,user);
  else if(path.startsWith("/api/admin")){const allowed=String(env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);if(!allowed.includes(user.email.toLowerCase()))response=json({error:"Admins only."},403);else if(path==="/api/admin/retrain"&&request.method==="POST")response=await retrainPython(env);else response=json({error:"Not found"},404);}
  else response=json({error:"Not found"},404);return withHeaders(response);
 }
 return withHeaders(await env.ASSETS.fetch(request));
 }catch(e){console.error("RoomieMatch Worker request failed",{path,method:request.method,message:e?.message||String(e),stack:e?.stack});return withHeaders(json({error:"Server error. Please try again."},500));}}};
