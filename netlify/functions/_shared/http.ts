const buckets = new Map<string,{count:number,reset:number}>()

export function json(data:unknown,status=200,extra:Record<string,string>={}){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','access-control-allow-origin':process.env.URL||'*',...extra}})
}

export function error(message:string,status=500,details?:unknown){
  return json({ok:false,error:message,...(process.env.CONTEXT==='dev'&&details?{details}: {})},status)
}

export function allowMethod(req:Request,methods:string[]){
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:{'access-control-allow-origin':process.env.URL||'*','access-control-allow-methods':methods.join(','),'access-control-allow-headers':'content-type'}})
  if(!methods.includes(req.method)) return error('Method not allowed',405)
  return null
}

export function rateLimit(req:Request,limit=90,windowMs=60_000){
  const ip=req.headers.get('x-nf-client-connection-ip')||req.headers.get('x-forwarded-for')||'unknown'; const now=Date.now(); const key=`${ip}:${new URL(req.url).pathname}`
  const b=buckets.get(key); if(!b||b.reset<now){buckets.set(key,{count:1,reset:now+windowMs});return false} b.count++; return b.count>limit
}

export async function fetchWithTimeout(url:string,init:RequestInit={},timeoutMs=8000,retries=2){
  let lastError:unknown
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs)
    try{ const res=await fetch(url,{...init,signal:controller.signal}); clearTimeout(timer); if(res.ok) return res; lastError=new Error(`HTTP ${res.status}`) }
    catch(e){clearTimeout(timer);lastError=e}
    if(attempt<retries) await new Promise(r=>setTimeout(r,350*2**attempt))
  }
  throw lastError instanceof Error?lastError:new Error('Request failed')
}
