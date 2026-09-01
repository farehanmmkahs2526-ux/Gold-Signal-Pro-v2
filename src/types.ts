export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'Daily'
export type Trend = 'UP' | 'DOWN' | 'SIDEWAYS'
export type SignalDirection = 'STRONG BUY' | 'STRONG SELL' | 'HOLD / NO TRADE'
export type SignalMode = 'scalping' | 'intraday' | 'swing'
export type DataStatus = 'LIVE' | 'DELAYED' | 'STALE' | 'DISCONNECTED'

export interface Candle {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume?: number | null
  symbol: string
  timeframe: Timeframe
  provider: string
  receivedAt: string
}

export interface IndicatorSnapshot {
  ema9?: number
  ema21?: number
  ema50?: number
  ema100?: number
  ema200?: number
  sma200?: number
  rsi14?: number
  macd?: number
  macdSignal?: number
  macdHistogram?: number
  atr14?: number
  bbUpper?: number
  bbMiddle?: number
  bbLower?: number
  keltnerUpper?: number
  keltnerMiddle?: number
  keltnerLower?: number
  adx14?: number
  supertrend?: number
  ichimokuTenkan?: number
  ichimokuKijun?: number
  ichimokuSpanA?: number
  ichimokuSpanB?: number
  stochasticK?: number
  stochasticD?: number
  cci20?: number
  roc12?: number
  vwap?: number
  obv?: number
}

export interface TimeframeAnalysis {
  timeframe: Timeframe
  trend: Trend
  score: number
  marketStructure: string
  emaAlignment: string
  momentum: string
  volatility: string
  nearestSupport?: number
  nearestResistance?: number
  lastCompletedCandleTime?: string
  reason: string
  indicators: IndicatorSnapshot
  patterns: string[]
  levels: Record<string, number>
  categoryScores: Record<string, number>
}

export interface NewsRisk {
  blocked: boolean
  status: string
  event?: string
  eventTime?: string
  countdownSeconds?: number
}

export interface SignalResult {
  id: string
  symbol: string
  mode: SignalMode
  direction: SignalDirection
  confidence: number
  score: number
  entryLow?: number
  entryHigh?: number
  stopLoss?: number
  takeProfit1?: number
  takeProfit2?: number
  takeProfit3?: number
  riskReward?: number
  invalidationLevel?: number
  createdAt: string
  expiresAt?: string
  sourceCandleTime?: string
  status: string
  reasons: string[]
  conflicts: string[]
  newsRisk: NewsRisk
  timeframeScores: TimeframeAnalysis[]
  dataStatus: DataStatus
}

export interface EconomicEvent {
  id: string
  source: 'Forex Factory'
  title: string
  currency: string
  impact: string
  sourceTime: string | null
  utcTime: string | null
  malaysiaTime: string | null
  malaysiaDate: string | null
  day: string | null
  actual?: string | null
  forecast?: string | null
  previous?: string | null
  status: string
  eventUrl: string
  isAllDay?: boolean
  isTentative?: boolean
}
