import type { Candle, DataStatus, Timeframe } from '../../../src/types'
import { fetchWithTimeout } from './http'

const intervalMap:Record<Timeframe,string>={M1:'1min',M5:'5min',M15:'15min',M30:'30min',H1:'1h',H4:'4h',Daily:'1day'}
const tfMs:Record<Timeframe,number>={M1:60e3,M5:300e3,M15:900e3,M30:1800e3,H1:3600e3,H4:14400e3,Daily:86400e3}

function config(){
  const provider=process.env.MARKET_DATA_PROVIDER?.toLowerCase(); const apiKey=process.env.MARKET_DATA_API_KEY; const baseUrl=process.env.MARKET_DATA_BASE_URL||'https://api.twelvedata.com'; const symbol=process.env.XAUUSD_SYMBOL||'XAU/USD'
  if(!provider||!apiKey) throw new Error('NOT_CONFIGURED')
  if(provider!=='twelvedata') throw new Error(`Unsupported provider: ${provider}. Initial production adapter supports twelvedata.`)
  return {provider,apiKey,baseUrl,symbol}
}

export async function getCandlesForSymbol(symbol:string,timeframe:Timeframe,outputsize=260):Promise<{candles:Candle[],provider:string,symbol:string,status:DataStatus,receivedAt:string}>{
  const {provider,apiKey,baseUrl}=config(); const receivedAt=new Date().toISOString();
  const url=new URL('/time_series',baseUrl); url.searchParams.set('symbol',symbol);url.searchParams.set('interval',intervalMap[timeframe]);url.searchParams.set('outputsize',String(outputsize));url.searchParams.set('timezone','UTC');url.searchParams.set('format','JSON');url.searchParams.set('apikey',apiKey)
  const res=await fetchWithTimeout(url.toString(),{},9000,2); const body=await res.json() as any
  if(body.status==='error'||!Array.isArray(body.values)) throw new Error(body.message||'Market-data response missing values')
  const now=Date.now(); const interval=tfMs[timeframe]
  const candles:Candle[]=body.values.map((v:any)=>({timestamp:new Date(v.datetime.replace(' ','T')+'Z').toISOString(),open:Number(v.open),high:Number(v.high),low:Number(v.low),close:Number(v.close),volume:v.volume!=null?Number(v.volume):null,symbol,timeframe,provider,receivedAt})).filter((c:Candle)=>Number.isFinite(c.close)).sort((a:Candle,b:Candle)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)).filter((c:Candle)=>Date.parse(c.timestamp)+interval<=now-1500)
  const age=now-Date.parse(candles.at(-1)?.timestamp||receivedAt); const status:DataStatus=age<=interval*2.2?'LIVE':age<=interval*4?'DELAYED':age<=interval*12?'STALE':'DISCONNECTED'
  return {candles,provider,symbol,status,receivedAt}
}

export async function getCandles(timeframe:Timeframe,outputsize=260){const {symbol}=config();return getCandlesForSymbol(symbol,timeframe,outputsize)}

export async function getLatestQuote(){
  const {provider,apiKey,baseUrl,symbol}=config(); const url=new URL('/quote',baseUrl);url.searchParams.set('symbol',symbol);url.searchParams.set('apikey',apiKey)
  const res=await fetchWithTimeout(url.toString(),{},7000,2); const q=await res.json() as any; if(q.status==='error') throw new Error(q.message||'Quote error')
  const close=Number(q.close??q.price); const previous=Number(q.previous_close); const change=Number.isFinite(close)&&Number.isFinite(previous)?close-previous:Number(q.change); const percent=Number.isFinite(previous)&&previous!==0?(change/previous)*100:Number(q.percent_change)
  return {symbol,price:Number.isFinite(close)?close:null,bid:q.bid?Number(q.bid):null,ask:q.ask?Number(q.ask):null,spread:q.bid&&q.ask?Number(q.ask)-Number(q.bid):null,dailyChange:Number.isFinite(change)?change:null,dailyChangePercent:Number.isFinite(percent)?percent:null,marketStatus:q.is_market_open===true?'OPEN':q.is_market_open===false?'CLOSED':'UNKNOWN',provider,updatedAt:new Date().toISOString()}
}
