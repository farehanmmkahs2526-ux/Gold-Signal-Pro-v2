import type { Candle, IndicatorSnapshot, NewsRisk, SignalMode, SignalResult, Timeframe, TimeframeAnalysis, Trend } from '../types'

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const last = <T,>(a: T[]) => a[a.length - 1]
const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
const std = (a: number[]) => {
  const m = avg(a)
  return Math.sqrt(avg(a.map(x => (x - m) ** 2)))
}

export function sma(values: number[], period: number): number[] {
  if (period <= 0) return []
  const out: number[] = []
  for (let i = period - 1; i < values.length; i++) out.push(avg(values.slice(i - period + 1, i + 1)))
  return out
}

export function ema(values: number[], period: number): number[] {
  if (!values.length || period <= 0) return []
  const k = 2 / (period + 1)
  const out: number[] = []
  let prev = avg(values.slice(0, Math.min(period, values.length)))
  for (let i = 0; i < values.length; i++) {
    prev = i < period - 1 ? avg(values.slice(0, i + 1)) : values[i] * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

export function rsi(values: number[], period = 14): number[] {
  if (values.length < 2) return []
  const out: number[] = new Array(values.length).fill(50)
  let gain = 0, loss = 0
  for (let i = 1; i <= Math.min(period, values.length - 1); i++) {
    const d = values[i] - values[i - 1]
    if (d >= 0) gain += d; else loss -= d
  }
  let ag = gain / period, al = loss / period
  for (let i = period; i < values.length; i++) {
    if (i > period) {
      const d = values[i] - values[i - 1]
      ag = (ag * (period - 1) + Math.max(0, d)) / period
      al = (al * (period - 1) + Math.max(0, -d)) / period
    }
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al)
  }
  return out
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const ef = ema(values, fast), es = ema(values, slow)
  const line = values.map((_, i) => (ef[i] ?? 0) - (es[i] ?? 0))
  const signal = ema(line, signalPeriod)
  const histogram = line.map((v, i) => v - (signal[i] ?? 0))
  return { line, signal, histogram }
}

export function trueRange(candles: Candle[]): number[] {
  return candles.map((c, i) => i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close)))
}

export function atr(candles: Candle[], period = 14): number[] {
  return ema(trueRange(candles), period)
}

export function bollinger(values: number[], period = 20, mult = 2) {
  const upper: number[] = [], middle: number[] = [], lower: number[] = []
  for (let i = 0; i < values.length; i++) {
    const slice = values.slice(Math.max(0, i - period + 1), i + 1)
    const m = avg(slice), s = std(slice)
    middle.push(m); upper.push(m + mult * s); lower.push(m - mult * s)
  }
  return { upper, middle, lower }
}

export function stochastic(candles: Candle[], period = 14, smooth = 3) {
  const k = candles.map((c, i) => {
    const slice = candles.slice(Math.max(0, i - period + 1), i + 1)
    const hi = Math.max(...slice.map(x => x.high)); const lo = Math.min(...slice.map(x => x.low))
    return hi === lo ? 50 : ((c.close - lo) / (hi - lo)) * 100
  })
  return { k, d: sma(k, smooth).length ? ema(k, smooth) : k }
}

export function cci(candles: Candle[], period = 20) {
  const tp = candles.map(c => (c.high + c.low + c.close) / 3)
  return tp.map((v, i) => {
    const s = tp.slice(Math.max(0, i - period + 1), i + 1); const m = avg(s); const md = avg(s.map(x => Math.abs(x - m)))
    return md === 0 ? 0 : (v - m) / (0.015 * md)
  })
}

export function roc(values: number[], period = 12) {
  return values.map((v, i) => i < period || values[i - period] === 0 ? 0 : ((v - values[i - period]) / values[i - period]) * 100)
}

export function adx(candles: Candle[], period = 14) {
  const trs = trueRange(candles)
  const plusDM = candles.map((c, i) => i === 0 ? 0 : Math.max(0, c.high - candles[i - 1].high) > Math.max(0, candles[i - 1].low - c.low) ? Math.max(0, c.high - candles[i - 1].high) : 0)
  const minusDM = candles.map((c, i) => i === 0 ? 0 : Math.max(0, candles[i - 1].low - c.low) > Math.max(0, c.high - candles[i - 1].high) ? Math.max(0, candles[i - 1].low - c.low) : 0)
  const atrv = ema(trs, period), p = ema(plusDM, period), m = ema(minusDM, period)
  const dx = candles.map((_, i) => {
    const plus = atrv[i] ? (100 * p[i]) / atrv[i] : 0; const minus = atrv[i] ? (100 * m[i]) / atrv[i] : 0
    return plus + minus === 0 ? 0 : (100 * Math.abs(plus - minus)) / (plus + minus)
  })
  return ema(dx, period)
}

export function ichimoku(candles: Candle[]) {
  const mid = (slice: Candle[]) => (Math.max(...slice.map(x => x.high)) + Math.min(...slice.map(x => x.low))) / 2
  const tenkan = candles.map((_, i) => mid(candles.slice(Math.max(0, i - 8), i + 1)))
  const kijun = candles.map((_, i) => mid(candles.slice(Math.max(0, i - 25), i + 1)))
  const spanA = tenkan.map((v, i) => (v + kijun[i]) / 2)
  const spanB = candles.map((_, i) => mid(candles.slice(Math.max(0, i - 51), i + 1)))
  return { tenkan, kijun, spanA, spanB }
}

export function supertrend(candles: Candle[], period = 10, multiplier = 3) {
  const a = atr(candles, period); const line: number[] = []; const dir: number[] = []
  let prevUpper = 0, prevLower = 0, prevDir = 1
  candles.forEach((c, i) => {
    const hl2 = (c.high + c.low) / 2; let upper = hl2 + multiplier * (a[i] || 0); let lower = hl2 - multiplier * (a[i] || 0)
    if (i > 0) { upper = upper < prevUpper || candles[i - 1].close > prevUpper ? upper : prevUpper; lower = lower > prevLower || candles[i - 1].close < prevLower ? lower : prevLower }
    let d = prevDir
    if (c.close > upper) d = 1; else if (c.close < lower) d = -1
    line.push(d === 1 ? lower : upper); dir.push(d); prevUpper = upper; prevLower = lower; prevDir = d
  })
  return { line, dir }
}

export function vwap(candles: Candle[]) {
  let pv = 0, vol = 0
  return candles.map(c => {
    const v = c.volume ?? 0; const tp = (c.high + c.low + c.close) / 3
    pv += tp * v; vol += v
    return vol > 0 ? pv / vol : NaN
  })
}

export function obv(candles: Candle[]) {
  let value = 0
  return candles.map((c, i) => {
    if (i > 0 && c.volume != null) value += c.close > candles[i - 1].close ? c.volume : c.close < candles[i - 1].close ? -c.volume : 0
    return value
  })
}

export function detectSupportResistance(candles: Candle[], lookback = 80) {
  const s = candles.slice(-lookback); if (!s.length) return { supports: [], resistances: [] }
  const supports: number[] = [], resistances: number[] = []
  for (let i = 2; i < s.length - 2; i++) {
    if (s[i].low <= s[i-1].low && s[i].low <= s[i-2].low && s[i].low <= s[i+1].low && s[i].low <= s[i+2].low) supports.push(s[i].low)
    if (s[i].high >= s[i-1].high && s[i].high >= s[i-2].high && s[i].high >= s[i+1].high && s[i].high >= s[i+2].high) resistances.push(s[i].high)
  }
  return { supports: supports.slice(-6), resistances: resistances.slice(-6) }
}

export function marketStructure(candles: Candle[]) {
  const { supports, resistances } = detectSupportResistance(candles, 120)
  const highs = resistances.slice(-3), lows = supports.slice(-3)
  let label = 'Range / mixed structure', score = 0
  if (highs.length >= 2 && lows.length >= 2) {
    if (highs[highs.length - 1] > highs[highs.length - 2] && lows[lows.length - 1] > lows[lows.length - 2]) { label = 'Higher highs and higher lows'; score = 70 }
    else if (highs[highs.length - 1] < highs[highs.length - 2] && lows[lows.length - 1] < lows[lows.length - 2]) { label = 'Lower highs and lower lows'; score = -70 }
  }
  return { label, score, supports, resistances }
}

export function fibonacciLevels(candles: Candle[], lookback = 100) {
  const s = candles.slice(-lookback); if (!s.length) return {}
  const hi = Math.max(...s.map(x => x.high)); const lo = Math.min(...s.map(x => x.low)); const range = hi - lo
  return {
    fib236: hi - range * .236, fib382: hi - range * .382, fib500: hi - range * .5, fib618: hi - range * .618, fib786: hi - range * .786,
    fib1272: hi + range * .272, fib1618: hi + range * .618, swingHigh: hi, swingLow: lo
  }
}

export function candlestickPatterns(candles: Candle[]): string[] {
  if (candles.length < 4) return []
  const c = last(candles), p = candles[candles.length - 2]
  const body = Math.abs(c.close - c.open), range = Math.max(.000001, c.high - c.low), upper = c.high - Math.max(c.open, c.close), lower = Math.min(c.open, c.close) - c.low
  const out: string[] = []
  if (c.close > c.open && p.close < p.open && c.close >= p.open && c.open <= p.close) out.push('Bullish engulfing')
  if (c.close < c.open && p.close > p.open && c.open >= p.close && c.close <= p.open) out.push('Bearish engulfing')
  if (body / range < .12) out.push('Doji')
  if (lower > body * 2 && upper < body) out.push('Hammer / bullish pin bar')
  if (upper > body * 2 && lower < body) out.push('Shooting star / bearish pin bar')
  if (c.high < p.high && c.low > p.low) out.push('Inside bar')
  if (c.high > p.high && c.low < p.low) out.push('Outside bar')
  const three = candles.slice(-3)
  if(three.length===3){const [a,b,d]=three;const ab=Math.abs(a.close-a.open),bb=Math.abs(b.close-b.open),db=Math.abs(d.close-d.open);if(a.close<a.open&&bb<ab*.45&&d.close>d.open&&d.close>(a.open+a.close)/2)out.push('Morning star');if(a.close>a.open&&bb<ab*.45&&d.close<d.open&&d.close<(a.open+a.close)/2)out.push('Evening star')}
  if (three.every(x => x.close > x.open) && three[2].close > three[1].close && three[1].close > three[0].close) out.push('Three white soldiers')
  if (three.every(x => x.close < x.open) && three[2].close < three[1].close && three[1].close < three[0].close) out.push('Three black crows')
  return out
}

export function chartPatterns(candles: Candle[]): string[] {
  const s = candles.slice(-60); if (s.length < 20) return []
  const out: string[] = []; const a = atr(s, 14); const tolerance = (last(a) || 0) * .5
  const highs = [...s].sort((x,y)=>y.high-x.high).slice(0,4).map(x=>x.high); const lows=[...s].sort((x,y)=>x.low-y.low).slice(0,4).map(x=>x.low)
  if (highs.length > 1 && Math.abs(highs[0]-highs[1]) <= tolerance) out.push('Double top area')
  if (lows.length > 1 && Math.abs(lows[0]-lows[1]) <= tolerance) out.push('Double bottom area')
  const recent = s.slice(-20), prev = s.slice(-40,-20); const rh = Math.max(...recent.map(x=>x.high)), rl=Math.min(...recent.map(x=>x.low)), ph=Math.max(...prev.map(x=>x.high)), pl=Math.min(...prev.map(x=>x.low))
  if (last(s).close > ph) out.push('Range breakout bullish')
  if (last(s).close < pl) out.push('Range breakout bearish')
  if ((rh-rl) < (ph-pl)*.65) out.push('Volatility contraction / rectangle')
  return out
}

export function priceActionLevels(candles:Candle[], structureScore=0){
  const levels:Record<string,number>={}; if(candles.length<8)return {levels,patterns:[] as string[],score:0}
  const patterns:string[]=[]; const c=last(candles); const prior=candles.slice(-21,-1); const priorHigh=Math.max(...prior.map(x=>x.high)), priorLow=Math.min(...prior.map(x=>x.low)); const av=last(atr(candles,14))||Math.abs(c.close)*.001
  levels.recentRangeHigh=priorHigh;levels.recentRangeLow=priorLow
  if(c.high>priorHigh&&c.close<priorHigh){patterns.push('Bearish liquidity sweep');}
  if(c.low<priorLow&&c.close>priorLow){patterns.push('Bullish liquidity sweep');}
  if(c.close>priorHigh){patterns.push('Bullish Break of Structure');levels.breakoutLevel=priorHigh}
  if(c.close<priorLow){patterns.push('Bearish Break of Structure');levels.breakoutLevel=priorLow}
  const near=(x:number,y:number)=>Math.abs(x-y)<=av*.25
  const highs=prior.map(x=>x.high); const lows=prior.map(x=>x.low)
  for(let i=0;i<highs.length;i++)for(let j=i+3;j<highs.length;j++)if(near(highs[i],highs[j])){levels.equalHighs=(highs[i]+highs[j])/2;patterns.push('Equal highs liquidity');i=highs.length;break}
  for(let i=0;i<lows.length;i++)for(let j=i+3;j<lows.length;j++)if(near(lows[i],lows[j])){levels.equalLows=(lows[i]+lows[j])/2;patterns.push('Equal lows liquidity');i=lows.length;break}
  for(let i=candles.length-1;i>=Math.max(2,candles.length-35);i--){const x=candles[i],a=candles[i-2];if(x.low>a.high){levels.bullishFvgLow=a.high;levels.bullishFvgHigh=x.low;patterns.push('Bullish fair value gap');break}if(x.high<a.low){levels.bearishFvgLow=x.high;levels.bearishFvgHigh=a.low;patterns.push('Bearish fair value gap');break}}
  if(structureScore>=0){for(let i=candles.length-2;i>=Math.max(0,candles.length-30);i--){const x=candles[i];if(x.close<x.open){levels.demandLow=x.low;levels.demandHigh=x.high;levels.bullishOrderBlock=(x.open+x.close)/2;break}}}
  if(structureScore<=0){for(let i=candles.length-2;i>=Math.max(0,candles.length-30);i--){const x=candles[i];if(x.close>x.open){levels.supplyLow=x.low;levels.supplyHigh=x.high;levels.bearishOrderBlock=(x.open+x.close)/2;break}}}
  const lastDay=new Date(c.timestamp).toISOString().slice(0,10); const older=candles.filter(x=>new Date(x.timestamp).toISOString().slice(0,10)!==lastDay); const prevDate=older.at(-1)?new Date(older.at(-1)!.timestamp).toISOString().slice(0,10):null
  if(prevDate){const d=older.filter(x=>new Date(x.timestamp).toISOString().slice(0,10)===prevDate);if(d.length){levels.previousDayHigh=Math.max(...d.map(x=>x.high));levels.previousDayLow=Math.min(...d.map(x=>x.low))}}
  const today=candles.filter(x=>new Date(x.timestamp).toISOString().slice(0,10)===lastDay);if(today.length)levels.dailyOpen=today[0].open
  let score=0;if(patterns.some(x=>/Bullish|equal lows/i.test(x)))score+=35;if(patterns.some(x=>/Bearish|equal highs/i.test(x)))score-=35
  if(levels.breakoutLevel&&candles.length>2){const p=candles[candles.length-2];if(Math.abs(p.close-levels.breakoutLevel)<av*.5||Math.abs(c.low-levels.breakoutLevel)<av*.5||Math.abs(c.high-levels.breakoutLevel)<av*.5)patterns.push('Breakout and retest area')}
  return {levels,patterns:Array.from(new Set(patterns)),score:clamp(score,-100,100)}
}

export function rsiDivergence(candles:Candle[], rsiValues:number[]){
  if(candles.length<25)return {score:0,label:''};const s=candles.slice(-25);const r=rsiValues.slice(-25);let low1=0,low2=0,high1=0,high2=0;for(let i=2;i<s.length-2;i++){if(s[i].low<=s[i-1].low&&s[i].low<=s[i+1].low){low1=low2;low2=i}if(s[i].high>=s[i-1].high&&s[i].high>=s[i+1].high){high1=high2;high2=i}}
  if(low1&&low2&&s[low2].low<s[low1].low&&r[low2]>r[low1])return {score:35,label:'Bullish RSI divergence'}
  if(high1&&high2&&s[high2].high>s[high1].high&&r[high2]<r[high1])return {score:-35,label:'Bearish RSI divergence'}
  return {score:0,label:''}
}

export function indicatorSnapshot(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map(c => c.close); const mac = macd(closes); const bb = bollinger(closes); const stoch=stochastic(candles); const ichi=ichimoku(candles); const st=supertrend(candles)
  const vol = candles.some(c => c.volume != null && c.volume > 0)
  const vw = vol ? vwap(candles) : []; const ov = vol ? obv(candles) : []
  const kelMid=ema(closes,20), kelAtr=atr(candles,20);
  const snap: IndicatorSnapshot = {
    ema9:last(ema(closes,9)), ema21:last(ema(closes,21)), ema50:last(ema(closes,50)), ema100:last(ema(closes,100)), ema200:last(ema(closes,200)), sma200:last(sma(closes,200)),
    rsi14:last(rsi(closes,14)), macd:last(mac.line), macdSignal:last(mac.signal), macdHistogram:last(mac.histogram), atr14:last(atr(candles,14)),
    bbUpper:last(bb.upper), bbMiddle:last(bb.middle), bbLower:last(bb.lower), keltnerMiddle:last(kelMid), keltnerUpper:(last(kelMid)??0)+2*(last(kelAtr)??0), keltnerLower:(last(kelMid)??0)-2*(last(kelAtr)??0), adx14:last(adx(candles,14)), supertrend:last(st.line),
    ichimokuTenkan:last(ichi.tenkan), ichimokuKijun:last(ichi.kijun), ichimokuSpanA:last(ichi.spanA), ichimokuSpanB:last(ichi.spanB),
    stochasticK:last(stoch.k), stochasticD:last(stoch.d), cci20:last(cci(candles,20)), roc12:last(roc(closes,12))
  }
  if (vol) { snap.vwap = last(vw); snap.obv = last(ov) }
  return snap
}

function trendCategory(candles: Candle[], i: IndicatorSnapshot) {
  const price = last(candles).close; let score=0; const reasons:string[]=[]
  const alignedBull = [i.ema9,i.ema21,i.ema50,i.ema200].every((v,idx,a)=> idx===0 || (a[idx-1] ?? 0) >= (v ?? 0))
  const alignedBear = [i.ema9,i.ema21,i.ema50,i.ema200].every((v,idx,a)=> idx===0 || (a[idx-1] ?? 0) <= (v ?? 0))
  if (alignedBull) { score += 55; reasons.push('EMA stack bullish') } else if (alignedBear) { score -= 55; reasons.push('EMA stack bearish') }
  if (i.ema200 != null) { if (price > i.ema200) score += 15; else score -= 15 }
  if (i.supertrend != null) { if (price > i.supertrend) score += 15; else score -= 15 }
  if((i.adx14??0)<18){score*=.75;reasons.push('ADX indicates weak trend')}else if((i.adx14??0)>25)reasons.push('ADX confirms trend strength')
  if(i.vwap!=null){if(price>i.vwap){score+=8;reasons.push('Price above VWAP')}else{score-=8;reasons.push('Price below VWAP')}}
  if (i.ichimokuSpanA != null && i.ichimokuSpanB != null) { const top=Math.max(i.ichimokuSpanA,i.ichimokuSpanB), bot=Math.min(i.ichimokuSpanA,i.ichimokuSpanB); if(price>top) score+=15; else if(price<bot) score-=15 }
  return {score:clamp(score,-100,100),reason:reasons.join(', ') || 'Trend indicators mixed'}
}

function momentumCategory(i: IndicatorSnapshot, candles?:Candle[]) {
  let score=0; const reasons:string[]=[]
  if ((i.macdHistogram ?? 0) > 0) { score+=35; reasons.push('MACD histogram positive') } else { score-=35; reasons.push('MACD histogram negative') }
  if ((i.rsi14 ?? 50) > 52 && (i.rsi14 ?? 50) < 75) score+=25; else if ((i.rsi14 ?? 50)<48 && (i.rsi14 ?? 50)>25) score-=25
  if ((i.stochasticK ?? 50) > (i.stochasticD ?? 50) && (i.stochasticK ?? 50)<85) score+=20; else if ((i.stochasticK ?? 50)<(i.stochasticD ?? 50) && (i.stochasticK ?? 50)>15) score-=20
  if ((i.cci20 ?? 0)>50) score+=10; else if((i.cci20??0)<-50) score-=10
  if ((i.roc12 ?? 0)>0) score+=10; else if((i.roc12??0)<0) score-=10
  if(candles){const div=rsiDivergence(candles,rsi(candles.map(c=>c.close),14));score+=div.score;if(div.label)reasons.push(div.label)}
  return {score:clamp(score,-100,100),reason:reasons.join(', ') || 'Momentum mixed'}
}

function volatilityCategory(candles:Candle[], i:IndicatorSnapshot) {
  const price=last(candles).close; const atrPct=((i.atr14??0)/price)*100; const width=((i.bbUpper??price)-(i.bbLower??price))/price*100
  const keltnerSqueeze=i.bbUpper!=null&&i.bbLower!=null&&i.keltnerUpper!=null&&i.keltnerLower!=null&&i.bbUpper<i.keltnerUpper&&i.bbLower>i.keltnerLower
  if(atrPct<0.03 || width<0.08 || keltnerSqueeze) return {score:0,quality:35,reason:'Abnormally low volatility / Bollinger-Keltner squeeze'}
  if(atrPct>1.2) return {score:0,quality:35,reason:'Excessive unstable volatility'}
  return {score:0,quality:85,reason:'Volatility suitable for analysis'}
}

function levelCategory(candles:Candle[], i:IndicatorSnapshot, supports:number[], resistances:number[], fib:Record<string,number>) {
  const p=last(candles).close; const atrv=i.atr14??Math.abs(p)*.001; let score=0; const reasons:string[]=[]
  const ns=supports.filter(x=>x<=p).sort((a,b)=>b-a)[0]; const nr=resistances.filter(x=>x>=p).sort((a,b)=>a-b)[0]
  if(ns && p-ns<atrv*1.2){score+=35;reasons.push('Price near confirmed support')}
  if(nr && nr-p<atrv*1.2){score-=35;reasons.push('Price near confirmed resistance')}
  const fibVals=Object.entries(fib).filter(([k])=>k.startsWith('fib') && !k.includes('1272')&&!k.includes('1618')).map(([,v])=>v)
  if(fibVals.some(v=>Math.abs(p-v)<atrv*.6)) reasons.push('Price near Fibonacci retracement')
  return {score:clamp(score,-100,100),reason:reasons.join(', ') || 'No decisive level reaction',nearestSupport:ns,nearestResistance:nr}
}

function sessionScore(now = new Date()) {
  const h=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',hour12:false}).format(now))
  if(h>=15 && h<24) return {score:10,reason:h>=20?'London/New York active or overlap period':'London session active'}
  if(h>=7 && h<16) return {score:0,reason:'Asian session active'}
  return {score:-5,reason:'Lower-liquidity transition period'}
}

export function analyseTimeframe(timeframe: Timeframe, candles: Candle[]): TimeframeAnalysis {
  if(candles.length < 60) return {timeframe,trend:'SIDEWAYS',score:0,marketStructure:'Insufficient completed candles',emaAlignment:'Unavailable',momentum:'Unavailable',volatility:'Unavailable',reason:'Not enough completed candles for reliable classification',indicators:{},patterns:[],levels:{},categoryScores:{}}
  const i=indicatorSnapshot(candles); const ms=marketStructure(candles); const pa=priceActionLevels(candles,ms.score); const trend=trendCategory(candles,i); const mom=momentumCategory(i,candles); const vol=volatilityCategory(candles,i); const fib=fibonacciLevels(candles); const lv=levelCategory(candles,i,ms.supports,ms.resistances,fib); const sess=sessionScore()
  const patterns=[...candlestickPatterns(candles),...chartPatterns(candles),...pa.patterns]
  let patternScore=0
  if(patterns.some(p=>/bullish|white soldiers|double bottom|breakout bullish|hammer/i.test(p))) patternScore+=25
  if(patterns.some(p=>/bearish|black crows|double top|breakout bearish|shooting/i.test(p))) patternScore-=25
  const volumeScore=i.vwap!=null?(last(candles).close>i.vwap?35:-35):0
  const score=clamp(ms.score*.25+pa.score*.10+trend.score*.28+mom.score*.20+lv.score*.10+patternScore*.04+sess.score*.03,-100,100)
  const direction:Trend=score>=20?'UP':score<=-20?'DOWN':'SIDEWAYS'
  return {
    timeframe,trend:direction,score:Math.round(score),marketStructure:ms.label,emaAlignment:trend.reason,momentum:mom.reason,volatility:vol.reason,
    nearestSupport:lv.nearestSupport,nearestResistance:lv.nearestResistance,lastCompletedCandleTime:last(candles).timestamp,
    reason:`${ms.label}; ${trend.reason}; ${mom.reason}; ${vol.reason}`,
    indicators:i,patterns,levels:{...fib,...pa.levels},categoryScores:{structure:clamp(ms.score*.75+pa.score*.25,-100,100),trend:trend.score,momentum:mom.score,levels:lv.score,volatilityQuality:vol.quality,session:sess.score,patterns:patternScore,...(i.vwap!=null?{volume:volumeScore}:{})}
  }
}

export const MODE_WEIGHTS: Record<SignalMode, Record<Timeframe, number>> = {
  scalping:{M1:.24,M5:.26,M15:.24,M30:.16,H1:.10,H4:0,Daily:0},
  intraday:{M1:.04,M5:.06,M15:.20,M30:.22,H1:.24,H4:.14,Daily:.10},
  swing:{M1:0,M5:0,M15:.04,M30:.06,H1:.24,H4:.34,Daily:.32}
}

function signalId(symbol:string, mode:SignalMode, direction:string, candleTime:string|undefined, entry:number|undefined){
  const raw=`${symbol}|${mode}|${direction}|${candleTime??''}|${entry?.toFixed(2)??''}`
  let h=2166136261
  for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619)}
  return `gsp-${(h>>>0).toString(16)}`
}

export function calculateSignal(params:{symbol:string,mode:SignalMode,analyses:TimeframeAnalysis[],candlesByTimeframe:Partial<Record<Timeframe,Candle[]>>,dataStatus:'LIVE'|'DELAYED'|'STALE'|'DISCONNECTED',newsRisk:NewsRisk,riskReward?:number,minConfidence?:number,timeframeWeights?:Partial<Record<Timeframe,number>>,categoryWeights?:Record<string,number>,correlationScore?:number,correlationReasons?:string[]}):SignalResult {
  const {symbol,mode,analyses,candlesByTimeframe,dataStatus,newsRisk}=params; const rr=params.riskReward??2; const minConfidence=params.minConfidence??75
  const weights=params.timeframeWeights?Object.fromEntries(Object.entries(MODE_WEIGHTS[mode]).map(([k,v])=>[k,(params.timeframeWeights?.[k as Timeframe]??v*100)/100])) as Record<Timeframe,number>:MODE_WEIGHTS[mode]
  const cw=params.categoryWeights||{structure:25,trend:20,momentum:15,levels:15,volatility:10,session:10,news:5}
  const directionalTotal=(cw.structure??25)+(cw.trend??20)+(cw.momentum??15)+(cw.levels??15)+(cw.session??10)||85
  const directional=(a:TimeframeAnalysis)=>{const c=a.categoryScores;const structure=((c.structure??0)*.8+(c.patterns??0)*.2);return (structure*(cw.structure??25)+(c.trend??0)*(cw.trend??20)+(c.momentum??0)*(cw.momentum??15)+(c.levels??0)*(cw.levels??15)+(c.session??0)*(cw.session??10))/directionalTotal}
  const weighted=analyses.reduce((s,a)=>s+directional(a)*(weights[a.timeframe]??0),0)
  const relevant=analyses.filter(a=>(weights[a.timeframe]??0)>0)
  const bullishCategories=new Set<string>(), bearishCategories=new Set<string>()
  for(const a of relevant){for(const [k,v] of Object.entries(a.categoryScores)){if(Number(v)>=25)bullishCategories.add(k);if(Number(v)<=-25)bearishCategories.add(k)}}
  let score=clamp(params.correlationScore==null?weighted:weighted*.90+params.correlationScore*.10,-100,100)
  const volatilityQuality=avg(relevant.map(a=>a.categoryScores.volatilityQuality??50)); if(volatilityQuality<50) score*=.85
  const higher = mode==='scalping'?analyses.filter(a=>['M30','H1'].includes(a.timeframe)):mode==='intraday'?analyses.filter(a=>['H4','Daily'].includes(a.timeframe)):analyses.filter(a=>['H4','Daily'].includes(a.timeframe))
  const bullHTF=higher.some(a=>a.score>=20), bearHTF=higher.some(a=>a.score<=-20)
  const confidence=Math.round(Math.abs(score))
  const reasons:string[]=[]; const conflicts:string[]=[]
  relevant.sort((a,b)=>Math.abs(b.score)-Math.abs(a.score)).slice(0,4).forEach(a=>reasons.push(`${a.timeframe}: ${a.reason}`)); if(params.correlationReasons?.length)reasons.push(...params.correlationReasons)
  relevant.filter(a=>Math.sign(a.score)!==Math.sign(score)&&Math.abs(a.score)>=20).slice(0,3).forEach(a=>conflicts.push(`${a.timeframe} disagrees (${a.trend})`))
  const freshnessOk=dataStatus==='LIVE'; const completeOk=relevant.every(a=>Boolean(a.lastCompletedCandleTime)); const bullAgreement=bullishCategories.size>=4; const bearAgreement=bearishCategories.size>=4
  let direction:'STRONG BUY'|'STRONG SELL'|'HOLD / NO TRADE'='HOLD / NO TRADE'
  if(score>=minConfidence && freshnessOk&&completeOk&&bullAgreement&&bullHTF&&!newsRisk.blocked) direction='STRONG BUY'
  if(score<=-minConfidence && freshnessOk&&completeOk&&bearAgreement&&bearHTF&&!newsRisk.blocked) direction='STRONG SELL'
  if(newsRisk.blocked) conflicts.unshift(newsRisk.status)
  if(!freshnessOk) conflicts.unshift(`Market data status is ${dataStatus}`)
  const primaryTf:Timeframe=mode==='scalping'?'M5':mode==='intraday'?'H1':'H4'; const primaryCandles=candlesByTimeframe[primaryTf]??[]; const pc=last(primaryCandles); const pa=analyses.find(a=>a.timeframe===primaryTf)
  let entry:number|undefined,sl:number|undefined,tp1:number|undefined,tp2:number|undefined,tp3:number|undefined, invalid:number|undefined
  if(direction!=='HOLD / NO TRADE' && pc && pa){
    const av=pa.indicators.atr14??Math.abs(pc.close)*.0015; entry=pc.close
    if(direction==='STRONG BUY'){ const structural=pa.nearestSupport; sl=structural&&structural<entry?Math.min(entry-av,structural-av*.15):entry-av*1.25; invalid=sl; const risk=entry-sl; tp1=entry+risk; tp2=entry+risk*rr; tp3=entry+risk*Math.max(3,rr+1) }
    else { const structural=pa.nearestResistance; sl=structural&&structural>entry?Math.max(entry+av,structural+av*.15):entry+av*1.25; invalid=sl; const risk=sl-entry; tp1=entry-risk; tp2=entry-risk*rr; tp3=entry-risk*Math.max(3,rr+1) }
  }
  const createdAt=new Date().toISOString(); const expiryMinutes=mode==='scalping'?30:mode==='intraday'?240:1440; const expiresAt=new Date(Date.now()+expiryMinutes*60000).toISOString(); const sourceCandleTime=pc?.timestamp
  return {id:signalId(symbol,mode,direction,sourceCandleTime,entry),symbol,mode,direction,confidence:direction==='HOLD / NO TRADE'?confidence:Math.max(confidence,minConfidence),score:Math.round(score),entryLow:entry,entryHigh:entry,stopLoss:sl,takeProfit1:tp1,takeProfit2:tp2,takeProfit3:tp3,riskReward:direction==='HOLD / NO TRADE'?undefined:rr,invalidationLevel:invalid,createdAt,expiresAt,sourceCandleTime,status:direction==='HOLD / NO TRADE'?'No trade':'Active',reasons,conflicts,newsRisk,timeframeScores:analyses,dataStatus}
}
