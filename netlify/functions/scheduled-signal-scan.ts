import type { Config } from '@netlify/functions'
import webpush from 'web-push'
import { runSignal, saveSignal } from './_shared/signal'
import { db } from './_shared/db'

const fmt=(n:any)=>Number.isFinite(Number(n))?Number(n).toFixed(2):'Unavailable'
const finalStatuses=new Set(['TP3 reached','Stop Loss reached','Expired','Invalidated'])

function pushReady(){return Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT)}
function setupPush(){if(pushReady())webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!)}

async function sendPush(subscription:any,payload:any,signalId:string,type:string){
  const sql=db()
  try{
    await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},JSON.stringify(payload))
    await sql`insert into notification_history(signal_id,subscription_id,notification_type,delivery_status) values(${signalId},${subscription.id},${type},'sent') on conflict do nothing`
  }catch(e:any){
    const status=e?.statusCode
    if(status===404||status===410)await sql`update push_subscriptions set active=false where id=${subscription.id}`
    await sql`insert into notification_history(signal_id,subscription_id,notification_type,delivery_status) values(${signalId},${subscription.id},${type},${`failed:${status||'unknown'}`}) on conflict do nothing`
    console.warn('push failed',status)
  }
}

async function activeSubscriptions(){
  const sql=db()
  return sql`select s.id,s.endpoint,s.p256dh,s.auth,p.strong_buy,p.strong_sell,p.target_updates,p.stop_loss_updates,p.invalidation_updates,p.cooldown_minutes from push_subscriptions s join notification_preferences p on p.subscription_id=s.id where s.active=true`
}

async function notifyStrong(signal:any){
  if(!pushReady())return
  setupPush(); const sql=db(); const subs=await activeSubscriptions()
  const previous=await sql`select direction,created_at from signals where id<>${signal.id} order by created_at desc limit 1`
  for(const s of subs){
    if(signal.direction==='STRONG BUY'&&!s.strong_buy)continue
    if(signal.direction==='STRONG SELL'&&!s.strong_sell)continue
    const reversed=previous[0]&&previous[0].direction!==signal.direction
    if(!reversed){
      const recent=await sql`select sent_at from notification_history where subscription_id=${s.id} and notification_type='strong-signal' order by sent_at desc limit 1`
      if(recent[0]&&Date.now()-Date.parse(recent[0].sent_at)<Number(s.cooldown_minutes||30)*60000)continue
    }
    const payload={title:`XAU/USD ${signal.direction}`,body:`Entry ${fmt(signal.entryLow)} | SL ${fmt(signal.stopLoss)} | TP1 ${fmt(signal.takeProfit1)} | TP2 ${fmt(signal.takeProfit2)} | ${signal.confidence}%`,url:`/?signal=${encodeURIComponent(signal.id)}`,signalId:signal.id,direction:signal.direction,entry:signal.entryLow,stopLoss:signal.stopLoss,tp1:signal.takeProfit1,tp2:signal.takeProfit2,confidence:signal.confidence,time:signal.createdAt,reason:signal.reasons?.[0]||''}
    await sendPush(s,payload,signal.id,'strong-signal')
  }
}

async function notifyStatus(row:any,newStatus:string){
  if(!pushReady())return
  setupPush(); const subs=await activeSubscriptions(); const target=newStatus.startsWith('TP'); const stop=newStatus==='Stop Loss reached'; const invalidated=newStatus==='Invalidated'
  for(const s of subs){
    if(target&&!s.target_updates)continue
    if(stop&&!s.stop_loss_updates)continue
    if(invalidated&&!s.invalidation_updates)continue
    if(!target&&!stop&&!invalidated)continue
    const type=target?`target-${newStatus.split(' ')[0]}`:stop?'stop-loss':'invalidation'
    const payload={title:`XAU/USD · ${newStatus}`,body:`${row.direction} · Entry ${fmt(row.entry_low)} · Current status ${newStatus}`,url:`/?signal=${encodeURIComponent(row.id)}`,signalId:row.id}
    await sendPush(s,payload,row.id,type)
  }
}

function nextStatus(row:any,price:number){
  if(finalStatuses.has(row.status))return row.status
  if(row.expires_at&&Date.parse(row.expires_at)<=Date.now())return 'Expired'
  const buy=row.direction==='STRONG BUY'
  if(Number.isFinite(row.stop_loss)&&((buy&&price<=row.stop_loss)||(!buy&&price>=row.stop_loss)))return 'Stop Loss reached'
  if(Number.isFinite(row.take_profit_3)&&((buy&&price>=row.take_profit_3)||(!buy&&price<=row.take_profit_3)))return 'TP3 reached'
  if(Number.isFinite(row.take_profit_2)&&((buy&&price>=row.take_profit_2)||(!buy&&price<=row.take_profit_2)))return 'TP2 reached'
  if(Number.isFinite(row.take_profit_1)&&((buy&&price>=row.take_profit_1)||(!buy&&price<=row.take_profit_1)))return 'TP1 reached'
  return row.status
}

async function updateSignalStatuses(price:number){
  if(!Number.isFinite(price))return
  const sql=db(); const rows=await sql`select * from signals where status not in ('TP3 reached','Stop Loss reached','Expired','Invalidated') order by created_at desc limit 100`
  for(const row of rows){const ns=nextStatus(row,price);if(ns!==row.status){await sql`update signals set status=${ns} where id=${row.id}`;await notifyStatus(row,ns)}}
}

async function invalidateOpposite(signal:any){
  const sql=db(); const rows=await sql`select * from signals where symbol=${signal.symbol} and direction<>${signal.direction} and id<>${signal.id} and status not in ('TP3 reached','Stop Loss reached','Expired','Invalidated')`
  for(const row of rows){await sql`update signals set status='Invalidated' where id=${row.id}`;await notifyStatus(row,'Invalidated')}
}

export default async()=>{
  try{
    const mode=(process.env.DEFAULT_SIGNAL_MODE as any)||'intraday'
    const {signal,candlesByTimeframe}=await runSignal(mode)
    const latestM1=candlesByTimeframe.M1?.at(-1)?.close
    if(Number.isFinite(latestM1))await updateSignalStatuses(Number(latestM1))
    if(signal.direction==='HOLD / NO TRADE'){console.log(JSON.stringify({event:'signal_scan',direction:signal.direction,score:signal.score}));return}
    const inserted=await saveSignal(signal)
    if(inserted){await invalidateOpposite(signal);await notifyStrong(signal)}
    console.log(JSON.stringify({event:'signal_scan',direction:signal.direction,signalId:signal.id,new:inserted}))
  }catch(e){console.error(JSON.stringify({event:'signal_scan_failed',message:e instanceof Error?e.message:'unknown'}))}
}
export const config:Config={schedule:'* * * * *'}
