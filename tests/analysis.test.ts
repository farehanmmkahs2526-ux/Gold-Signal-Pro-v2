import { describe, expect, it } from 'vitest'
import { atr, bollinger, calculateSignal, ema, fibonacciLevels, macd, marketStructure, rsi, sma } from '../src/lib/analysis'
import type { Candle, TimeframeAnalysis } from '../src/types'

function candles(n=260,step=1):Candle[]{let p=2000;return Array.from({length:n},(_,i)=>{const o=p;p+=step+(i%5===0?.2:-.05);return{timestamp:new Date(Date.UTC(2026,7,1,0,i)).toISOString(),open:o,high:Math.max(o,p)+1,low:Math.min(o,p)-1,close:p,volume:100+i,symbol:'XAU/USD',timeframe:'H1',provider:'test',receivedAt:new Date().toISOString()}})}

describe('indicators',()=>{
  it('EMA follows an increasing series',()=>{const v=ema([1,2,3,4,5,6,7,8,9,10],3);expect(v.at(-1)!).toBeGreaterThan(v[3])})
  it('SMA returns expected final mean',()=>expect(sma([1,2,3,4,5],3).at(-1)).toBe(4))
  it('RSI is bullish for rising values',()=>expect(rsi(Array.from({length:40},(_,i)=>i+1),14).at(-1)!).toBeGreaterThan(70))
  it('MACD histogram is finite',()=>expect(Number.isFinite(macd(Array.from({length:80},(_,i)=>i+Math.sin(i)),12,26,9).histogram.at(-1)!)).toBe(true))
  it('ATR is positive',()=>expect(atr(candles(),14).at(-1)!).toBeGreaterThan(0))
  it('Bollinger upper is above lower',()=>{const b=bollinger(Array.from({length:80},(_,i)=>100+Math.sin(i)));expect(b.upper.at(-1)!).toBeGreaterThan(b.lower.at(-1)!)})
})

describe('structure and levels',()=>{
  it('calculates Fibonacci levels from confirmed range',()=>{const f=fibonacciLevels(candles());expect(f.fib618).toBeGreaterThan(f.swingLow);expect(f.fib618).toBeLessThan(f.swingHigh)})
  it('returns a market structure label',()=>expect(marketStructure(candles()).label.length).toBeGreaterThan(3))
})

describe('signal gates',()=>{
  const analysis=(tf:any,score:number):TimeframeAnalysis=>({timeframe:tf,trend:score>=20?'UP':score<=-20?'DOWN':'SIDEWAYS',score,marketStructure:'Higher highs and higher lows',emaAlignment:'EMA stack bullish',momentum:'MACD positive',volatility:'Suitable',nearestSupport:2000,nearestResistance:2300,lastCompletedCandleTime:new Date(Date.now()-3600e3).toISOString(),reason:'Test calculated confluence',indicators:{atr14:5},patterns:['Bullish engulfing'],levels:{},categoryScores:{structure:90,trend:90,momentum:90,levels:80,volatilityQuality:85,session:50,patterns:60}})
  const analyses=['M1','M5','M15','M30','H1','H4','Daily'].map(tf=>analysis(tf,90)) as TimeframeAnalysis[]
  const by:any={H1:candles()}
  it('permits STRONG BUY only when gates pass',()=>{const s=calculateSignal({symbol:'XAU/USD',mode:'intraday',analyses,candlesByTimeframe:by,dataStatus:'LIVE',newsRisk:{blocked:false,status:'clear'},minConfidence:75});expect(s.direction).toBe('STRONG BUY')})

  it('permits STRONG SELL only when bearish gates pass',()=>{const bearish=analyses.map(a=>({...a,trend:'DOWN' as const,score:-90,marketStructure:'Lower highs and lower lows',categoryScores:{...a.categoryScores,structure:-90,trend:-90,momentum:-90,levels:-80,session:-50,patterns:-60}}));const s=calculateSignal({symbol:'XAU/USD',mode:'intraday',analyses:bearish,candlesByTimeframe:by,dataStatus:'LIVE',newsRisk:{blocked:false,status:'clear'},minConfidence:75});expect(s.direction).toBe('STRONG SELL')})
  it('forces HOLD on high-impact news blackout',()=>{const s=calculateSignal({symbol:'XAU/USD',mode:'intraday',analyses,candlesByTimeframe:by,dataStatus:'LIVE',newsRisk:{blocked:true,status:'HOLD — HIGH-IMPACT NEWS RISK'},minConfidence:75});expect(s.direction).toBe('HOLD / NO TRADE')})
  it('forces HOLD when market data is stale',()=>{const s=calculateSignal({symbol:'XAU/USD',mode:'intraday',analyses,candlesByTimeframe:by,dataStatus:'STALE',newsRisk:{blocked:false,status:'clear'},minConfidence:75});expect(s.direction).toBe('HOLD / NO TRADE')})
})
