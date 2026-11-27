import data from "../places.json" with { type: "json" };
export const all=data.places||[];const map=new Map(all.map(p=>[p.id,p]));
export const byId=id=>map.get(id)||null;export const valid=id=>id===""||map.has(id);
export const forCity=city=>all.filter(p=>p.city===String(city||"").trim().toLowerCase());
export function km(a,b){const x=byId(a),y=byId(b);if(!x||!y)return null;const r=Math.PI/180,h=Math.sin((y.lat-x.lat)*r/2)**2+Math.cos(x.lat*r)*Math.cos(y.lat*r)*Math.sin((y.lng-x.lng)*r/2)**2;return Math.round(2*6371*Math.asin(Math.sqrt(h))*10)/10;}
