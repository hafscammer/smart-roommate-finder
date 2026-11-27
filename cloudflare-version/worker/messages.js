import {publicUser,publicProfile,jsonResponse as json} from "./auth.js";
import {moderate,suggest} from "./ai.js";
const connected=async(db,a,b)=>!!await db.prepare("SELECT id FROM requests WHERE status='accepted' AND ((from_user=? AND to_user=?) OR (from_user=? AND to_user=?)) LIMIT 1").bind(a,b,b,a).first();
async function notify(env,event,uid){try{const stub=env.ROOM_HUB.get(env.ROOM_HUB.idFromName("roomiematch-global"));await stub.fetch("https://hub.internal/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({uid,event})});}catch{}}
export async function handleMessages(request,env,path,meRow){const db=env.roomiematch_db,me=publicUser(meRow);let b={};if(request.method!=="GET"){try{b=await request.json();}catch{return json({error:"Invalid request body."},400);}}
 try{
  if(path==="/api/messages"&&request.method==="GET"){
   const rq=await db.prepare("SELECT from_user,to_user FROM requests WHERE status='accepted' AND (from_user=? OR to_user=?)").bind(me.id,me.id).all();
   const ids=[...new Set((rq.results||[]).map(q=>q.from_user===me.id?q.to_user:q.from_user))];
   if(!ids.length)return json([]);
   // Bound the inbox query: the old implementation loaded every account and every
   // message, then repeatedly scanned the full message array for each conversation.
   const placeholders=ids.map(()=>"?").join(",");
   const [ur,mr]=await Promise.all([
    db.prepare(`SELECT id,email,data_json FROM users WHERE id IN (${placeholders})`).bind(...ids).all(),
    db.prepare("SELECT id,from_user,to_user,message_text,created_at,data_json FROM messages WHERE from_user=? OR to_user=? ORDER BY created_at DESC LIMIT 500").bind(me.id,me.id).all()
   ]);
   const users=new Map((ur.results||[]).map(u=>[u.id,u])),latest=new Map(),unread=new Map();
   for(const row of mr.results||[]){const other=row.from_user===me.id?row.to_user:row.from_user;if(!ids.includes(other))continue;const msg=JSON.parse(row.data_json||"{}");if(!latest.has(other))latest.set(other,msg);if(row.to_user===me.id&&msg.read!==true)unread.set(other,(unread.get(other)||0)+1);}
   return json(ids.map(id=>({user:users.has(id)?publicProfile(users.get(id)):null,last:latest.get(id)||null,unread:unread.get(id)||0})).filter(x=>x.user).sort((a,b)=>(b.last?.at||0)-(a.last?.at||0)));
  }
  if(path==="/api/messages/unread"&&request.method==="GET"){const r=await db.prepare("SELECT COUNT(*) AS n FROM messages WHERE to_user=? AND json_extract(data_json,'$.read') IS NOT 1").bind(me.id).first();return json({n:Number(r?.n||0)});}
  if(path==="/api/messages/suggest"&&request.method==="POST")return json(suggest(String(b.text||"").slice(0,500),me));
  const m=path.match(/^\/api\/messages\/(\d+)$/);if(!m)return json({error:"Not found"},404);const other=Number(m[1]);if(!await connected(db,me.id,other))return json({error:"Connect with this person first."},403);
  if(request.method==="GET"){
   const r=await db.prepare("SELECT * FROM messages WHERE (from_user=? AND to_user=?) OR (from_user=? AND to_user=?) ORDER BY created_at ASC").bind(me.id,other,other,me.id).all(),rows=r.results||[],fresh=rows.filter(x=>x.to_user===me.id&&JSON.parse(x.data_json).read!==true);for(const row of fresh){const d=JSON.parse(row.data_json);d.read=true;await db.prepare("UPDATE messages SET data_json=? WHERE id=?").bind(JSON.stringify(d),row.id).run();}if(fresh.length)await notify(env,{type:"read",by:me.id},other);return json(rows.map(x=>{const d=JSON.parse(x.data_json);return {...d,read:d.read||false};}));
  }
  if(request.method==="POST"){
   if(!me.verified)return json({error:"Please verify your email before sending messages."},403);
   const text=String(b.text||"").trim().slice(0,1000);if(!text)return json({error:"Write a message first."},400);const mod=moderate(text);if(mod.action==="block")return json({error:mod.reason},400);const id=Number((await db.prepare("SELECT COALESCE(MAX(id),0)+1 AS id FROM messages").first()).id),at=Date.now(),msg={id,from:me.id,to:other,text,at,read:false};await db.prepare("INSERT INTO messages(id,from_user,to_user,message_text,created_at,data_json) VALUES(?,?,?,?,?,?)").bind(id,me.id,other,text,at,JSON.stringify(msg)).run();await notify(env,{type:"message",message:msg,from:publicProfile(meRow)},other);return json({...msg,warning:mod.action==="warn"?mod.reason:undefined},201);
  }
  return json({error:"Method not allowed"},405);
 }catch{return json({error:"Unable to process messages."},500);}
}
