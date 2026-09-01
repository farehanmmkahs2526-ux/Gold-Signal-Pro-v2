import { z } from 'zod'; import { allowMethod,error,json,rateLimit } from './_shared/http'; import { db } from './_shared/db'
const schema=z.object({endpoint:z.string().url()})
export default async(req:Request)=>{const m=allowMethod(req,['POST']);if(m)return m;if(rateLimit(req,20))return error('Rate limit exceeded',429);try{const b=schema.parse(await req.json());const sql=db();await sql`update push_subscriptions set active=false,updated_at=now() where endpoint=${b.endpoint}`;return json({ok:true})}catch(e:any){return error('Unable to unsubscribe',400,e?.message)}}
