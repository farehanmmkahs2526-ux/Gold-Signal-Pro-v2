import type { DataStatus, SignalMode, SignalResult, Timeframe } from '../../../src/types'
import { analyseTimeframe, calculateSignal } from '../../../src/lib/analysis'
import { getCandles, getCandlesForSymbol } from './market'
import { fetchForexFactory, newsRisk } from './news'

const timeframes:Timeframe[]=['M1','M5','M15','M30','H1','H4','Daily']
const statusRank:Record<DataStatus,number>={LIVE:0,DELAYED:1,STALE:2,DISCONNECTED:3}

function pearson(a:number[],b:number[]){const n=Math.min(a.length,b.length);if(n<12)return 0;const x=a.slice(-n),y=b.slice(-n);const ax=x.reduce((s,v)=>s+v,0)/n,ay=y.reduce((s,v)=>s+v,0)/n;let num=0,dx=0,dy=0;for(let i=0;i<n;i++){const vx=x[i]-ax,vy=y[i]-ay;num+=vx*vy;dx+=vx*vx;dy+=vy*vy}return dx&&dy?num/Math.sqrt(dx*dy):0}
function returns(c:any[]){return c.slice(1).map((x,i)=>x.close/c[i].close-1)}
async function correlationContext(gold:any[]){
  const specs=[['DXY',process.env.DXY_SYMBOL],['US10Y',process.env.US10Y_SYMBOL],['XAG/USD',process.env.XAGUSD_SYMBOL]].filter((x):x is [string,string]=>Boolean(x[1])); if(!specs.length)return {score:undefined as number|undefined,reasons:['Correlation data unavailable.']}
  const reasons:string[]=[];const scores:number[]=[]
  for(const [name,symbol] of specs){try{const d=await getCandlesForSymbol(symbol,'H1',120);const gr=returns(gold),ar=returns(d.candles);const corr=pearson(gr,ar);const arLast=ar.at(-1)??0;if(Math.abs(corr)<.2){reasons.push(`${name} correlation is currently weak (${corr.toFixed(2)}).`);continue}const contribution=Math.sign(arLast*corr)*Math.min(45,Math.abs(corr)*45);scores.push(contribution);reasons.push(`${name} rolling correlation ${corr.toFixed(2)} is ${contribution>=0?'supporting':'conflicting'} with the latest move.`)}catch{reasons.push(`${name} correlation data unavailable.`)}}
  return {score:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:undefined,reasons:reasons.length?reasons:['Correlation data unavailable.']}
}
export async function runSignal(mode:SignalMode=(process.env.DEFAULT_SIGNAL_MODE as SignalMode)||'intraday', opts:{riskReward?:number,minConfidence?:number,blackoutMinutes?:number,timeframeWeights?:Partial<Record<Timeframe,number>>,categoryWeights?:Record<string,number>}={}){
  const settled=await Promise.all(timeframes.map(async tf=>[tf,await getCandles(tf,260)] as const))
  const candlesByTimeframe:any={}; let worst:DataStatus='LIVE'; let symbol=process.env.XAUUSD_SYMBOL||'XAU/USD'
  for(const [tf,data] of settled){candlesByTimeframe[tf]=data.candles;symbol=data.symbol;if(statusRank[data.status]>statusRank[worst]) worst=data.status}
  const analyses=timeframes.map(tf=>analyseTimeframe(tf,candlesByTimeframe[tf]))
  const correlation=await correlationContext(candlesByTimeframe.H1||[])
  let news={events:[] as any[],stale:true}; try{news=await fetchForexFactory(false) as any}catch{}
  const nr=newsRisk(news.events,opts.blackoutMinutes??Number(process.env.NEWS_BLACKOUT_MINUTES||30))
  const signal=calculateSignal({symbol,mode,analyses,candlesByTimeframe,dataStatus:worst,newsRisk:nr,riskReward:opts.riskReward??Number(process.env.DEFAULT_RR||2),minConfidence:opts.minConfidence??Number(process.env.MINIMUM_CONFIDENCE||75),timeframeWeights:opts.timeframeWeights,categoryWeights:opts.categoryWeights,correlationScore:correlation.score,correlationReasons:correlation.reasons})
  return {signal,candlesByTimeframe,analyses,calendarStatus:{stale:news.stale??true,lastSuccessfulRefresh:(news as any).lastSuccessfulRefresh??null}}
}

export async function saveSignal(signal:SignalResult){
  if(signal.direction==='HOLD / NO TRADE') return false
  const { db }=await import('./db'); const sql=db()
  const r=await sql`
    insert into signals (id,symbol,mode,direction,confidence,entry_low,entry_high,stop_loss,take_profit_1,take_profit_2,take_profit_3,risk_reward,reasons,conflicts,timeframe_scores,news_risk,source_candle_time,created_at,expires_at,status)
    values (${signal.id},${signal.symbol},${signal.mode},${signal.direction},${signal.confidence},${signal.entryLow??null},${signal.entryHigh??null},${signal.stopLoss??null},${signal.takeProfit1??null},${signal.takeProfit2??null},${signal.takeProfit3??null},${signal.riskReward??null},${JSON.stringify(signal.reasons)},${JSON.stringify(signal.conflicts)},${JSON.stringify(signal.timeframeScores)},${JSON.stringify(signal.newsRisk)},${signal.sourceCandleTime??null},${signal.createdAt},${signal.expiresAt??null},${signal.status})
    on conflict (id) do nothing returning id`
  return r.length>0
}
