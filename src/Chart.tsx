import { useEffect, useRef } from 'react'
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts'
import { bollinger, ema, vwap } from '../lib/analysis'
import type { Candle, SignalResult, TimeframeAnalysis } from '../types'

export type ChartOverlays={ema9:boolean,ema21:boolean,ema50:boolean,ema200:boolean,bollinger:boolean,vwap:boolean,sr:boolean,fib:boolean,zones:boolean,tradeLevels:boolean}
type Props={candles:Candle[],signal:SignalResult|null,analysis?:TimeframeAnalysis,overlays:ChartOverlays}
export default function Chart({candles,signal,analysis,overlays}:Props){
  const ref=useRef<HTMLDivElement>(null)
  useEffect(()=>{if(!ref.current)return;const el=ref.current;const chart=createChart(el,{width:el.clientWidth,height:470,layout:{background:{type:ColorType.Solid,color:'#091321'},textColor:'#94a3b8'},grid:{vertLines:{color:'#162235'},horzLines:{color:'#162235'}},crosshair:{mode:CrosshairMode.Normal},rightPriceScale:{borderColor:'#334155'},timeScale:{borderColor:'#334155',timeVisible:true,secondsVisible:false}});const series=chart.addCandlestickSeries({upColor:'#22c55e',downColor:'#ef4444',borderVisible:false,wickUpColor:'#22c55e',wickDownColor:'#ef4444'});const times=candles.map(c=>Math.floor(Date.parse(c.timestamp)/1000) as any);series.setData(candles.map((c,i)=>({time:times[i],open:c.open,high:c.high,low:c.low,close:c.close})));
    const addLine=(values:number[],color:string,width:1|2=1)=>{const s=chart.addLineSeries({color,lineWidth:width,priceLineVisible:false,lastValueVisible:false});s.setData(values.map((v,i)=>({time:times[i],value:v})).filter(x=>Number.isFinite(x.value)))}
    const closes=candles.map(c=>c.close);if(overlays.ema9)addLine(ema(closes,9),'#38bdf8');if(overlays.ema21)addLine(ema(closes,21),'#22d3ee',2);if(overlays.ema50)addLine(ema(closes,50),'#f59e0b',2);if(overlays.ema200)addLine(ema(closes,200),'#a78bfa',2)
    if(overlays.bollinger){const b=bollinger(closes);addLine(b.upper,'#64748b');addLine(b.middle,'#94a3b8');addLine(b.lower,'#64748b')}
    if(overlays.vwap&&candles.some(c=>c.volume!=null&&c.volume>0))addLine(vwap(candles),'#e879f9',2)
    const priceLines:any[]=[];const addPrice=(price:number|undefined,title:string,color:string,style=LineStyle.Dashed)=>{if(Number.isFinite(price))priceLines.push(series.createPriceLine({price:price!,color,lineWidth:1,lineStyle:style,axisLabelVisible:true,title}))}
    if(overlays.tradeLevels&&signal&&signal.direction!=='HOLD / NO TRADE'){addPrice(signal.entryLow,'ENTRY','#22d3ee');addPrice(signal.stopLoss,'SL','#ef4444');addPrice(signal.takeProfit1,'TP1','#22c55e');addPrice(signal.takeProfit2,'TP2','#16a34a');addPrice(signal.takeProfit3,'TP3','#15803d')}
    if(overlays.sr&&analysis){addPrice(analysis.nearestSupport,'SUP','#10b981',LineStyle.Dotted);addPrice(analysis.nearestResistance,'RES','#f43f5e',LineStyle.Dotted)}
    if(overlays.fib&&analysis){for(const [k,v] of Object.entries(analysis.levels||{}))if(/^fib(236|382|500|618|786)$/.test(k))addPrice(v,k.replace('fib','FIB '),'#a78bfa',LineStyle.Dotted)}
    if(overlays.zones&&analysis){const l=analysis.levels||{};addPrice(l.demandLow,'Demand L','#10b981',LineStyle.Dotted);addPrice(l.demandHigh,'Demand H','#10b981',LineStyle.Dotted);addPrice(l.supplyLow,'Supply L','#f43f5e',LineStyle.Dotted);addPrice(l.supplyHigh,'Supply H','#f43f5e',LineStyle.Dotted);addPrice(l.bullishOrderBlock,'Bull OB','#34d399',LineStyle.Dotted);addPrice(l.bearishOrderBlock,'Bear OB','#fb7185',LineStyle.Dotted);addPrice(l.bullishFvgLow,'Bull FVG','#2dd4bf',LineStyle.Dotted);addPrice(l.bearishFvgHigh,'Bear FVG','#f97316',LineStyle.Dotted)}
    chart.timeScale().fitContent();const ro=new ResizeObserver(()=>chart.applyOptions({width:el.clientWidth}));ro.observe(el);return()=>{ro.disconnect();chart.remove()}},[candles,signal,analysis,overlays]);return <div ref={ref} className="w-full rounded-xl overflow-hidden"/>
}
