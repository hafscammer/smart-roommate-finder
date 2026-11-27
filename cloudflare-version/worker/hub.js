export class RoomHub {
  constructor(state,env){this.state=state;this.env=env;}
  async fetch(request){const url=new URL(request.url);if(url.pathname==="/event"&&request.method==="POST"){const {uid,event}=await request.json();this.send(Number(uid),event);return new Response("ok");}if(url.pathname==="/connect"&&request.headers.get("Upgrade")==="websocket"){const uid=Number(request.headers.get("x-user-id")),nonce=request.headers.get("x-ticket-id");if(!uid||!nonce)return new Response("Unauthorized",{status:401});const key=`ticket:${nonce}`,used=await this.state.storage.get(key);if(used)return new Response("Ticket already used",{status:401});await this.state.storage.put(key,Date.now());const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.state.acceptWebSocket(server,[String(uid)]);server.serializeAttachment({uid});return new Response(null,{status:101,webSocket:client});}return new Response("Not found",{status:404});}
  send(uid,data){for(const ws of this.state.getWebSockets(String(uid))){try{ws.send(JSON.stringify(data));}catch{try{ws.close(1011,"send failed");}catch{}}}}
  webSocketMessage(ws,message){let data;try{data=JSON.parse(message);}catch{return;}const {uid}=ws.deserializeAttachment()||{};if(data.type==="typing"&&Number(data.to)&&Number(data.to)!==uid)this.send(Number(data.to),{type:"typing",from:uid});}
  webSocketClose(ws){try{ws.close(1000,"closed");}catch{}}
  webSocketError(ws){try{ws.close(1011,"socket error");}catch{}}
}
