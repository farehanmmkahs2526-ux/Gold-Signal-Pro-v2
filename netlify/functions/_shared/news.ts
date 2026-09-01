import { XMLParser } from 'fast-xml-parser'
import { DateTime } from 'luxon'
import type { EconomicEvent, NewsRisk } from '../../../src/types'
import { cacheGet, cacheSet } from './cache'
import { fetchWithTimeout } from './http'

const CACHE_KEY='forex-factory-current-week-v1'
const FF='https://www.forexfactory.com/calendar'
function arr<T>(x:T|T[]|undefined):T[]{return x==null?[]:Array.isArray(x)?x:[x]}
function text(x:any):string{return x==null?'':typeof x==='object'?(x['#text']??''):String(x)}

export function parseEvent(raw:any,index:number):EconomicEvent{
  const sourceTz=process.env.FOREX_FACTORY_SOURCE_TIMEZONE||'America/New_York'; const date=text(raw.date); const time=text(raw.time); const title=text(raw.title)||'Untitled event'; const currency=text(raw.country)||text(raw.currency)||''; const impact=text(raw.impact)||'Unknown'
  const allDay=/all day/i.test(time); const tentative=/tentative/i.test(time); let sourceTime:string|null=null,utcTime:string|null=null,malaysiaTime:string|null=null,malaysiaDate:string|null=null,day:string|null=null
  if(date&&!allDay&&!tentative&&time){
    const candidates=['MM-dd-yy h:mma','MM-dd-yyyy h:mma','M-d-yy h:mma','M-d-yyyy h:mma']
    let dt:DateTime|null=null
    for(const f of candidates){const d=DateTime.fromFormat(`${date} ${time}`.replace(/\s+/g,' ').trim(),f,{zone:sourceTz,locale:'en-US'});if(d.isValid){dt=d;break}}
    if(dt){const my=dt.setZone('Asia/Kuala_Lumpur'); sourceTime=dt.toISO();utcTime=dt.toUTC().toISO();malaysiaTime=my.toFormat('dd LLL yyyy, hh:mm a')+' MYT';malaysiaDate=my.toFormat('dd LLL yyyy');day=my.toFormat('cccc')}
  } else if(date){
    const d=DateTime.fromFormat(date,'MM-dd-yy',{zone:sourceTz}); if(d.isValid){const my=d.setZone('Asia/Kuala_Lumpur');malaysiaDate=my.toFormat('dd LLL yyyy');day=my.toFormat('cccc')}
  }
  const id=`ff-${index}-${Buffer.from(`${date}|${time}|${currency}|${title}`).toString('base64url').slice(0,18)}`
  return {id,source:'Forex Factory',title,currency,impact,sourceTime,utcTime,malaysiaTime,malaysiaDate,day,actual:text(raw.actual)||null,forecast:text(raw.forecast)||null,previous:text(raw.previous)||null,status:allDay?'All Day':tentative?'Tentative':'Scheduled',eventUrl:text(raw.url)||text(raw.link)||FF,isAllDay:allDay,isTentative:tentative}
}

export async function fetchForexFactory(force=false){
  const cached=await cacheGet<any>(CACHE_KEY); const staleAfter=15*60*1000
  if(!force&&cached?.fetchedAt&&Date.now()-Date.parse(cached.fetchedAt)<staleAfter) return {...cached,stale:false,fromCache:true}
  const feed=process.env.FOREX_FACTORY_FEED_URL||'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
  try{
    const res=await fetchWithTimeout(feed,{headers:{'user-agent':'GoldSignalPro/1.0 (+economic-calendar-cache)'}},8000,2); const xml=await res.text(); const parsed=new XMLParser({ignoreAttributes:false,trimValues:true}).parse(xml)
    const rawEvents=arr(parsed?.weeklyevents?.event??parsed?.events?.event??parsed?.calendar?.event); const events=rawEvents.map(parseEvent).sort((a,b)=>(a.utcTime?Date.parse(a.utcTime):Number.MAX_SAFE_INTEGER)-(b.utcTime?Date.parse(b.utcTime):Number.MAX_SAFE_INTEGER))
    const data={events,fetchedAt:new Date().toISOString(),source:'Forex Factory',feedUrl:feed,lastSuccessfulRefresh:new Date().toISOString(),nextScheduledRefresh:new Date(Date.now()+15*60e3).toISOString()}; await cacheSet(CACHE_KEY,data); try{const {db}=await import('./db');const sql=db();for(const e of events){await sql`insert into cached_news(event_id,source,title,currency,impact,source_time,utc_time,malaysia_time,actual,forecast,previous,event_url,fetched_at) values(${e.id},${e.source},${e.title},${e.currency},${e.impact},${e.sourceTime},${e.utcTime},${e.malaysiaTime},${e.actual??null},${e.forecast??null},${e.previous??null},${e.eventUrl},${data.fetchedAt}) on conflict(event_id) do update set actual=excluded.actual,forecast=excluded.forecast,previous=excluded.previous,fetched_at=excluded.fetched_at`}}catch{} return {...data,stale:false,fromCache:false}
  }catch(e){
    if(cached) return {...cached,stale:true,fromCache:true,error:e instanceof Error?e.message:'Calendar fetch failed'}
    throw e
  }
}

export function newsRisk(events:EconomicEvent[],blackoutMinutes=30,now=new Date()):NewsRisk{
  const windowMs=blackoutMinutes*60e3; const t=now.getTime()
  const near=events.filter(e=>e.currency==='USD'&&/high/i.test(e.impact)&&e.utcTime).map(e=>({e,d:Date.parse(e.utcTime!)-t})).filter(x=>Math.abs(x.d)<=windowMs).sort((a,b)=>Math.abs(a.d)-Math.abs(b.d))[0]
  if(!near) return {blocked:false,status:'No high-impact USD news inside blackout window'}
  return {blocked:true,status:'HOLD — HIGH-IMPACT NEWS RISK',event:near.e.title,eventTime:near.e.utcTime!,countdownSeconds:Math.round(near.d/1000)}
}
