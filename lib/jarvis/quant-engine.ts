/**
 * J.A.R.V.I.S. Mark II — Sovereign Quant & Paper Trading Engine
 * 
 * Stage 5 Institutional-Grade Quantitative Substrate
 * Enforces Zero Ruin Risk Guardian:
 *   - Max 0.75% portfolio risk per trade
 *   - Max 5.0% allocation per individual asset
 *   - Max 5 concurrent active positions
 *   - 1.5% daily drawdown circuit breaker (hard emergency halt)
 *   - Deterministic indicator math (EMA, SMA, RSI, Bollinger Bands, Z-Score, ATR)
 *   - Multi-Factor Alpha Generators (Statistical Mean Reversion, Momentum Breakout, Volatility Squeeze)
 *   - Dual-mode persistence: Upstash Redis (24/7 cloud) + local atomic file fallback
 */

import { getStorage } from './storage';

// ==========================================
// 1. Data Models & Interface Contracts
// ==========================================

export type MarketUniverseSymbol =
  | 'BTC-USD'
  | 'ETH-USD'
  | 'SOL-USD'
  | 'NVDA'
  | 'AAPL'
  | 'MSFT'
  | 'SPY'
  | 'QQQ';

export const MONITORED_UNIVERSE: MarketUniverseSymbol[] = [
  'BTC-USD',
  'ETH-USD',
  'SOL-USD',
  'NVDA',
  'AAPL',
  'MSFT',
  'SPY',
  'QQQ',
];

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change24hPct: number;
  high24h: number;
  low24h: number;
  volume: number;
  timestamp: string;
  source: 'yahoo' | 'coinbase' | 'synthetic';
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SignalStrategy =
  | 'STATISTICAL_MEAN_REVERSION'
  | 'MOMENTUM_BREAKOUT'
  | 'VOLATILITY_SQUEEZE';

export type SignalDirection = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface AlphaSignal {
  id: string;
  symbol: string;
  direction: SignalDirection;
  strategy: SignalStrategy;
  confidence: number; // 0.00 to 1.00
  currentPrice: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  metrics: {
    rsi14: number;
    zScore: number;
    ema9: number;
    ema21: number;
    sma50?: number;
    bollingerBandwidth: number;
    atr14: number;
  };
  reasoning: string;
  timestamp: string;
}

export type PositionDirection = 'LONG' | 'SHORT';
export type PositionStatus = 'OPEN' | 'CLOSED';
export type CloseReason =
  | 'STOP_LOSS'
  | 'TAKE_PROFIT'
  | 'CIRCUIT_BREAKER'
  | 'MANUAL_CLOSE'
  | 'EXPIRED';

export interface PaperPosition {
  id: string;
  symbol: string;
  direction: PositionDirection;
  strategy: SignalStrategy | 'MANUAL';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  investedAmount: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  peakPnlPct: number;
  entryTime: string;
  lastUpdated: string;
  status: PositionStatus;
  closeReason?: CloseReason;
  closedPrice?: number;
  closedTime?: string;
  realizedPnl?: number;
  realizedPnlPct?: number;
}

export interface TradeLog {
  id: string;
  positionId: string;
  symbol: string;
  direction: PositionDirection;
  strategy: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  investedAmount: number;
  realizedPnl: number;
  realizedPnlPct: number;
  entryTime: string;
  exitTime: string;
  exitReason: CloseReason;
}

export interface PaperPortfolioState {
  initialBalance: number;
  cashBalance: number;
  totalEquity: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number; // 0.00 to 1.00
  maxDrawdownPct: number;
  dailyPeakEquity: number;
  dailyDrawdownPct: number;
  dailyDrawdownResetDate: string; // YYYY-MM-DD
  isHalted: boolean;
  haltReason?: string;
  openPositions: PaperPosition[];
  recentTrades: TradeLog[];
  lastUpdated: string;
}

// ==========================================
// 2. Zero-Ruin Risk Guardian Parameters
// ==========================================

export const RISK_CONFIG = {
  INITIAL_CAPITAL: 100_000,
  MAX_RISK_PER_TRADE_PCT: 0.0075, // 0.75% of total equity
  MAX_ALLOCATION_PER_ASSET_PCT: 0.05, // 5.0% max position capital
  MAX_CONCURRENT_POSITIONS: 5,
  MAX_DAILY_DRAWDOWN_PCT: 0.015, // 1.5% daily drawdown circuit breaker
  MIN_REWARD_RISK_RATIO: 1.8,
  DEFAULT_SL_ATR_MULT: 1.5,
  DEFAULT_TP_ATR_MULT: 3.0,
};

const REDIS_PORTFOLIO_KEY = 'jarvis:trading:portfolio';

// ==========================================
// 3. Quantitative Math & Indicator Library
// ==========================================

export function calculateSMA(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(values[i]);
      continue;
    }
    const slice = values.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    result.push(sum / period);
  }
  return result;
}

export function calculateEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];

  for (let i = 1; i < values.length; i++) {
    const val = values[i] * k + result[i - 1] * (1 - k);
    result.push(val);
  }
  return result;
}

export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

export function calculateBollingerBands(
  closes: number[],
  period = 20,
  stdDevMult = 2
): {
  middle: number;
  upper: number;
  lower: number;
  bandwidth: number;
  zScore: number;
} {
  if (closes.length < period) {
    const last = closes[closes.length - 1] || 0;
    return { middle: last, upper: last, lower: last, bandwidth: 0, zScore: 0 };
  }

  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;

  const variance =
    slice.reduce((acc, val) => acc + Math.pow(val - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + stdDevMult * stdDev;
  const lower = middle - stdDevMult * stdDev;
  const bandwidth = middle > 0 ? (upper - lower) / middle : 0;

  const currentPrice = closes[closes.length - 1];
  const zScore = stdDev > 0 ? (currentPrice - middle) / stdDev : 0;

  return {
    middle: Number(middle.toFixed(4)),
    upper: Number(upper.toFixed(4)),
    lower: Number(lower.toFixed(4)),
    bandwidth: Number(bandwidth.toFixed(5)),
    zScore: Number(zScore.toFixed(3)),
  };
}

export function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) return candles[0] ? candles[0].high - candles[0].low : 1;

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trueRanges.push(tr);
  }

  const effectivePeriod = Math.min(period, trueRanges.length);
  const slice = trueRanges.slice(-effectivePeriod);
  const atr = slice.reduce((sum, val) => sum + val, 0) / effectivePeriod;
  return Number(atr.toFixed(4));
}

// ==========================================
// 4. Live Market Data Ingestion Substrate
// ==========================================

export async function fetchLiveQuote(symbol: string): Promise<MarketQuote | null> {
  const normSymbol = symbol.trim().toUpperCase();

  // Try Yahoo Finance v8 API first
  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${normSymbol}?interval=1h&range=1d`;
    const res = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta && typeof meta.regularMarketPrice === 'number') {
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose || price;
        const change24h = price - prevClose;
        const change24hPct = prevClose > 0 ? (change24h / prevClose) * 100 : 0;

        return {
          symbol: normSymbol,
          name: meta.shortName || meta.symbol || normSymbol,
          price: Number(price.toFixed(4)),
          change24h: Number(change24h.toFixed(4)),
          change24hPct: Number(change24hPct.toFixed(2)),
          high24h: Number((meta.regularMarketDayHigh || price).toFixed(4)),
          low24h: Number((meta.regularMarketDayLow || price).toFixed(4)),
          volume: meta.regularMarketVolume || 0,
          timestamp: new Date().toISOString(),
          source: 'yahoo',
        };
      }
    }
  } catch (err) {
    console.warn(`[Quant Engine] Yahoo Finance quote error for ${normSymbol}:`, err);
  }

  // Coinbase fallback for Crypto
  if (normSymbol.includes('BTC') || normSymbol.includes('ETH') || normSymbol.includes('SOL')) {
    try {
      const base = normSymbol.replace('-USD', '').replace('USD', '');
      const cbUrl = `https://api.coinbase.com/v2/prices/${base}-USD/spot`;
      const res = await fetch(cbUrl, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data?.data?.amount);
        if (!isNaN(price) && price > 0) {
          return {
            symbol: normSymbol,
            name: `${base} / USD`,
            price: Number(price.toFixed(4)),
            change24h: 0,
            change24hPct: 0,
            high24h: price * 1.02,
            low24h: price * 0.98,
            volume: 0,
            timestamp: new Date().toISOString(),
            source: 'coinbase',
          };
        }
      }
    } catch (cbErr) {
      console.warn(`[Quant Engine] Coinbase quote error for ${normSymbol}:`, cbErr);
    }
  }

  return null;
}

export async function fetchHistoricalCandles(
  symbol: string,
  range = '5d',
  interval = '1h'
): Promise<Candle[]> {
  const normSymbol = symbol.trim().toUpperCase();
  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${normSymbol}?interval=${interval}&range=${range}`;
    const res = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    if (!quote || !timestamps.length) return [];

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = quote.close?.[i];
      const o = quote.open?.[i] || c;
      const h = quote.high?.[i] || c;
      const l = quote.low?.[i] || c;
      const v = quote.volume?.[i] || 0;

      if (typeof c === 'number' && !isNaN(c)) {
        candles.push({
          timestamp: timestamps[i] * 1000,
          open: Number(o.toFixed(4)),
          high: Number(h.toFixed(4)),
          low: Number(l.toFixed(4)),
          close: Number(c.toFixed(4)),
          volume: v,
        });
      }
    }

    return candles;
  } catch (err) {
    console.warn(`[Quant Engine] Failed to fetch candles for ${symbol}:`, err);
    return [];
  }
}

// ==========================================
// 5. Multi-Factor Alpha Signal Generators
// ==========================================

export async function generateAlphaSignalsForUniverse(): Promise<AlphaSignal[]> {
  const signals: AlphaSignal[] = [];

  for (const sym of MONITORED_UNIVERSE) {
    try {
      const candles = await fetchHistoricalCandles(sym, '5d', '1h');
      if (candles.length < 25) continue;

      const closes = candles.map((c) => c.close);
      const currentPrice = closes[closes.length - 1];

      // Compute mathematical indicators
      const rsi = calculateRSI(closes, 14);
      const bb = calculateBollingerBands(closes, 20, 2);
      const atr = calculateATR(candles, 14);
      const ema9Arr = calculateEMA(closes, 9);
      const ema21Arr = calculateEMA(closes, 21);
      const ema9 = Number(ema9Arr[ema9Arr.length - 1].toFixed(4));
      const ema21 = Number(ema21Arr[ema21Arr.length - 1].toFixed(4));
      const prevEma9 = Number(ema9Arr[ema9Arr.length - 2]?.toFixed(4) || ema9);
      const prevEma21 = Number(ema21Arr[ema21Arr.length - 2]?.toFixed(4) || ema21);

      // Strategy 1: Statistical Mean Reversion (Extreme Z-Score + Oversold/Overbought RSI)
      if (bb.zScore <= -2.1 && rsi <= 32) {
        const stopDistance = Math.max(1.5 * atr, currentPrice * 0.015);
        const stopLoss = Number((currentPrice - stopDistance).toFixed(4));
        const takeProfit = Number(bb.middle.toFixed(4));
        const rr = (takeProfit - currentPrice) / (currentPrice - stopLoss);

        if (rr >= RISK_CONFIG.MIN_REWARD_RISK_RATIO) {
          signals.push({
            id: `sig-${sym}-mean-rev-${Date.now()}`,
            symbol: sym,
            direction: 'LONG',
            strategy: 'STATISTICAL_MEAN_REVERSION',
            confidence: Number(Math.min(0.92, 0.70 + Math.abs(bb.zScore) * 0.08).toFixed(2)),
            currentPrice,
            entryPrice: currentPrice,
            stopLoss,
            takeProfit,
            riskRewardRatio: Number(rr.toFixed(2)),
            metrics: {
              rsi14: rsi,
              zScore: bb.zScore,
              ema9,
              ema21,
              bollingerBandwidth: bb.bandwidth,
              atr14: atr,
            },
            reasoning: `Extreme statistical discount: Z-Score=${bb.zScore} (< -2.1) and RSI=${rsi} (< 32). Mean reversion target towards SMA20 (${bb.middle}).`,
            timestamp: new Date().toISOString(),
          });
          continue;
        }
      } else if (bb.zScore >= 2.1 && rsi >= 68) {
        const stopDistance = Math.max(1.5 * atr, currentPrice * 0.015);
        const stopLoss = Number((currentPrice + stopDistance).toFixed(4));
        const takeProfit = Number(bb.middle.toFixed(4));
        const rr = (currentPrice - takeProfit) / (stopLoss - currentPrice);

        if (rr >= RISK_CONFIG.MIN_REWARD_RISK_RATIO) {
          signals.push({
            id: `sig-${sym}-mean-rev-short-${Date.now()}`,
            symbol: sym,
            direction: 'SHORT',
            strategy: 'STATISTICAL_MEAN_REVERSION',
            confidence: Number(Math.min(0.90, 0.70 + Math.abs(bb.zScore) * 0.07).toFixed(2)),
            currentPrice,
            entryPrice: currentPrice,
            stopLoss,
            takeProfit,
            riskRewardRatio: Number(rr.toFixed(2)),
            metrics: {
              rsi14: rsi,
              zScore: bb.zScore,
              ema9,
              ema21,
              bollingerBandwidth: bb.bandwidth,
              atr14: atr,
            },
            reasoning: `Severe overextension: Z-Score=${bb.zScore} (> 2.1) and RSI=${rsi} (> 68). Expecting mathematical mean reversion to SMA20 (${bb.middle}).`,
            timestamp: new Date().toISOString(),
          });
          continue;
        }
      }

      // Strategy 2: Momentum Breakout (EMA Golden/Death Cross with RSI Confirmation)
      const bullishCross = prevEma9 <= prevEma21 && ema9 > ema21;
      const bearishCross = prevEma9 >= prevEma21 && ema9 < ema21;

      if (bullishCross && rsi >= 50 && rsi <= 68) {
        const stopLoss = Number((currentPrice - 1.5 * atr).toFixed(4));
        const takeProfit = Number((currentPrice + 3.0 * atr).toFixed(4));
        const rr = 2.0;

        signals.push({
          id: `sig-${sym}-mom-breakout-${Date.now()}`,
          symbol: sym,
          direction: 'LONG',
          strategy: 'MOMENTUM_BREAKOUT',
          confidence: 0.85,
          currentPrice,
          entryPrice: currentPrice,
          stopLoss,
          takeProfit,
          riskRewardRatio: rr,
          metrics: {
            rsi14: rsi,
            zScore: bb.zScore,
            ema9,
            ema21,
            bollingerBandwidth: bb.bandwidth,
            atr14: atr,
          },
          reasoning: `Bullish Trend Inception: EMA 9 (${ema9}) crossed above EMA 21 (${ema21}) with healthy RSI ${rsi}. Favorable volatility expansion.`,
          timestamp: new Date().toISOString(),
        });
        continue;
      } else if (bearishCross && rsi >= 32 && rsi <= 50) {
        const stopLoss = Number((currentPrice + 1.5 * atr).toFixed(4));
        const takeProfit = Number((currentPrice - 3.0 * atr).toFixed(4));
        const rr = 2.0;

        signals.push({
          id: `sig-${sym}-mom-breakdown-${Date.now()}`,
          symbol: sym,
          direction: 'SHORT',
          strategy: 'MOMENTUM_BREAKOUT',
          confidence: 0.83,
          currentPrice,
          entryPrice: currentPrice,
          stopLoss,
          takeProfit,
          riskRewardRatio: rr,
          metrics: {
            rsi14: rsi,
            zScore: bb.zScore,
            ema9,
            ema21,
            bollingerBandwidth: bb.bandwidth,
            atr14: atr,
          },
          reasoning: `Bearish Breakdown: EMA 9 (${ema9}) crossed below EMA 21 (${ema21}) with weakening RSI ${rsi}.`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      // Strategy 3: Volatility Squeeze Expansion
      if (bb.bandwidth < 0.04 && currentPrice > bb.upper && rsi > 55) {
        const stopLoss = Number(bb.middle.toFixed(4));
        const risk = currentPrice - stopLoss;
        const takeProfit = Number((currentPrice + risk * 2.2).toFixed(4));
        const rr = 2.2;

        signals.push({
          id: `sig-${sym}-vol-squeeze-${Date.now()}`,
          symbol: sym,
          direction: 'LONG',
          strategy: 'VOLATILITY_SQUEEZE',
          confidence: 0.88,
          currentPrice,
          entryPrice: currentPrice,
          stopLoss,
          takeProfit,
          riskRewardRatio: rr,
          metrics: {
            rsi14: rsi,
            zScore: bb.zScore,
            ema9,
            ema21,
            bollingerBandwidth: bb.bandwidth,
            atr14: atr,
          },
          reasoning: `Volatility Squeeze Release: Bandwidth contracted to ${bb.bandwidth} (< 0.04) and broke out above upper band with RSI=${rsi}.`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (symErr) {
      console.warn(`[Quant Engine] Error generating alpha signal for ${sym}:`, symErr);
    }
  }

  return signals;
}

// ==========================================
// 6. State Management & Storage Engine
// ==========================================

export async function getPortfolioState(): Promise<PaperPortfolioState> {
  const storage = getStorage();
  try {
    const raw = await storage.execute('get', REDIS_PORTFOLIO_KEY);
    if (raw) {
      const parsed: PaperPortfolioState = typeof raw === 'string' ? JSON.parse(raw) : raw;
      // Daily drawdown reset check (reset dailyPeakEquity on new calendar day)
      const today = new Date().toISOString().slice(0, 10);
      if (parsed.dailyDrawdownResetDate !== today) {
        parsed.dailyDrawdownResetDate = today;
        parsed.dailyPeakEquity = parsed.totalEquity;
        parsed.dailyDrawdownPct = 0;
      }
      return parsed;
    }
  } catch (err) {
    console.warn('[Quant Engine] Failed to fetch portfolio state from storage, initializing fresh:', err);
  }

  // Initial Sovereign Paper Portfolio state ($100k USD)
  const today = new Date().toISOString().slice(0, 10);
  const initialState: PaperPortfolioState = {
    initialBalance: RISK_CONFIG.INITIAL_CAPITAL,
    cashBalance: RISK_CONFIG.INITIAL_CAPITAL,
    totalEquity: RISK_CONFIG.INITIAL_CAPITAL,
    unrealizedPnl: 0,
    realizedPnl: 0,
    totalTrades: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    maxDrawdownPct: 0,
    dailyPeakEquity: RISK_CONFIG.INITIAL_CAPITAL,
    dailyDrawdownPct: 0,
    dailyDrawdownResetDate: today,
    isHalted: false,
    openPositions: [],
    recentTrades: [],
    lastUpdated: new Date().toISOString(),
  };

  await savePortfolioState(initialState);
  return initialState;
}

export async function savePortfolioState(state: PaperPortfolioState): Promise<void> {
  const storage = getStorage();
  try {
    state.lastUpdated = new Date().toISOString();
    await storage.execute('set', REDIS_PORTFOLIO_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('[Quant Engine] Failed to save portfolio state:', err);
  }
}

// ==========================================
// 7. Deterministic Risk Sizing Engine
// ==========================================

export function calculateDeterministicOrderSize(
  portfolio: PaperPortfolioState,
  entryPrice: number,
  stopLossPrice: number
): {
  allowed: boolean;
  quantity: number;
  investedAmount: number;
  riskAmount: number;
  reason?: string;
} {
  if (portfolio.isHalted) {
    return { allowed: false, quantity: 0, investedAmount: 0, riskAmount: 0, reason: `Trading is HALTED: ${portfolio.haltReason || 'Circuit breaker active'}` };
  }

  if (portfolio.openPositions.length >= RISK_CONFIG.MAX_CONCURRENT_POSITIONS) {
    return { allowed: false, quantity: 0, investedAmount: 0, riskAmount: 0, reason: `Max concurrent positions limit reached (${RISK_CONFIG.MAX_CONCURRENT_POSITIONS})` };
  }

  const lossPerUnit = Math.abs(entryPrice - stopLossPrice);
  if (lossPerUnit <= 0) {
    return { allowed: false, quantity: 0, investedAmount: 0, riskAmount: 0, reason: 'Invalid Stop Loss: must differ from entry price' };
  }

  // Constraint A: Max 0.75% portfolio risk
  const maxRiskCapital = portfolio.totalEquity * RISK_CONFIG.MAX_RISK_PER_TRADE_PCT; // $750 on $100k
  const sharesFromRisk = maxRiskCapital / lossPerUnit;

  // Constraint B: Max 5.0% allocation per asset
  const maxAssetCapital = portfolio.totalEquity * RISK_CONFIG.MAX_ALLOCATION_PER_ASSET_PCT; // $5,000 on $100k
  const sharesFromAllocation = maxAssetCapital / entryPrice;

  // Constraint C: Available cash limit
  const sharesFromCash = portfolio.cashBalance / entryPrice;

  let optimalShares = Math.min(sharesFromRisk, sharesFromAllocation, sharesFromCash);

  // Formatting precision: Crypto 4 decimals, Equities 2 decimals
  optimalShares = entryPrice > 500 ? Number(optimalShares.toFixed(4)) : Number(optimalShares.toFixed(2));

  if (optimalShares <= 0) {
    return { allowed: false, quantity: 0, investedAmount: 0, riskAmount: 0, reason: 'Calculated order size is 0 or insufficient cash balance' };
  }

  const investedAmount = Number((optimalShares * entryPrice).toFixed(2));
  const riskAmount = Number((optimalShares * lossPerUnit).toFixed(2));

  return {
    allowed: true,
    quantity: optimalShares,
    investedAmount,
    riskAmount,
  };
}

// ==========================================
// 8. Order Execution & Active Sentry
// ==========================================

export async function executePaperOrder(params: {
  symbol: string;
  direction: PositionDirection;
  strategy?: SignalStrategy | 'MANUAL';
  customStopLoss?: number;
  customTakeProfit?: number;
}): Promise<{
  success: boolean;
  position?: PaperPosition;
  error?: string;
}> {
  const portfolio = await getPortfolioState();
  const quote = await fetchLiveQuote(params.symbol);

  if (!quote) {
    return { success: false, error: `Could not obtain real-time market quote for ${params.symbol}` };
  }

  const entryPrice = quote.price;

  // Sentry check: Existing open position for the same symbol
  const existing = portfolio.openPositions.find((p) => p.symbol === params.symbol);
  if (existing) {
    return { success: false, error: `An active position for ${params.symbol} already exists (${existing.direction}). Close it before re-entering.` };
  }

  // Derive Stop-Loss & Take-Profit if not provided
  let stopLoss = params.customStopLoss;
  let takeProfit = params.customTakeProfit;

  if (!stopLoss || !takeProfit) {
    const defaultDist = entryPrice * 0.02; // 2% baseline
    if (params.direction === 'LONG') {
      stopLoss = stopLoss || Number((entryPrice - defaultDist).toFixed(4));
      takeProfit = takeProfit || Number((entryPrice + defaultDist * 2.2).toFixed(4));
    } else {
      stopLoss = stopLoss || Number((entryPrice + defaultDist).toFixed(4));
      takeProfit = takeProfit || Number((entryPrice - defaultDist * 2.2).toFixed(4));
    }
  }

  // Deterministic Zero-Ruin Sizing Check
  const sizing = calculateDeterministicOrderSize(portfolio, entryPrice, stopLoss);
  if (!sizing.allowed) {
    return { success: false, error: sizing.reason };
  }

  const newPosition: PaperPosition = {
    id: `pos-${params.symbol.toLowerCase()}-${Date.now()}`,
    symbol: params.symbol,
    direction: params.direction,
    strategy: params.strategy || 'MANUAL',
    entryPrice,
    currentPrice: entryPrice,
    quantity: sizing.quantity,
    stopLoss,
    takeProfit,
    investedAmount: sizing.investedAmount,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    peakPnlPct: 0,
    entryTime: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    status: 'OPEN',
  };

  // Mutate portfolio state
  portfolio.cashBalance = Number((portfolio.cashBalance - sizing.investedAmount).toFixed(2));
  portfolio.openPositions.push(newPosition);

  await savePortfolioState(portfolio);
  return { success: true, position: newPosition };
}

export async function evaluateOpenPositions(): Promise<{
  closedPositions: TradeLog[];
  circuitBreakerTripped: boolean;
  portfolio: PaperPortfolioState;
}> {
  const portfolio = await getPortfolioState();
  const closedLogs: TradeLog[] = [];
  const remainingPositions: PaperPosition[] = [];

  let totalUnrealizedPnl = 0;
  const now = new Date().toISOString();

  for (const pos of portfolio.openPositions) {
    const quote = await fetchLiveQuote(pos.symbol);
    const currentPrice = quote ? quote.price : pos.currentPrice;

    pos.currentPrice = currentPrice;
    pos.lastUpdated = now;

    // Calculate PnL
    let pnl = 0;
    if (pos.direction === 'LONG') {
      pnl = (currentPrice - pos.entryPrice) * pos.quantity;
    } else {
      pnl = (pos.entryPrice - currentPrice) * pos.quantity;
    }

    pos.unrealizedPnl = Number(pnl.toFixed(2));
    pos.unrealizedPnlPct = Number(((pnl / pos.investedAmount) * 100).toFixed(2));
    pos.peakPnlPct = Math.max(pos.peakPnlPct, pos.unrealizedPnlPct);

    // Check Trigger Conditions (Stop Loss or Take Profit)
    let shouldClose = false;
    let reason: CloseReason = 'MANUAL_CLOSE';

    if (pos.direction === 'LONG') {
      if (currentPrice <= pos.stopLoss) {
        shouldClose = true;
        reason = 'STOP_LOSS';
      } else if (currentPrice >= pos.takeProfit) {
        shouldClose = true;
        reason = 'TAKE_PROFIT';
      }
    } else {
      if (currentPrice >= pos.stopLoss) {
        shouldClose = true;
        reason = 'STOP_LOSS';
      } else if (currentPrice <= pos.takeProfit) {
        shouldClose = true;
        reason = 'TAKE_PROFIT';
      }
    }

    if (shouldClose) {
      const exitPrice = currentPrice;
      const realizedPnl = pos.unrealizedPnl;
      const realizedPnlPct = pos.unrealizedPnlPct;

      const tradeLog: TradeLog = {
        id: `trd-${pos.id}`,
        positionId: pos.id,
        symbol: pos.symbol,
        direction: pos.direction,
        strategy: pos.strategy,
        entryPrice: pos.entryPrice,
        exitPrice,
        quantity: pos.quantity,
        investedAmount: pos.investedAmount,
        realizedPnl,
        realizedPnlPct,
        entryTime: pos.entryTime,
        exitTime: now,
        exitReason: reason,
      };

      closedLogs.push(tradeLog);

      // Return invested capital + realized PnL back to cash
      portfolio.cashBalance = Number((portfolio.cashBalance + pos.investedAmount + realizedPnl).toFixed(2));
      portfolio.realizedPnl = Number((portfolio.realizedPnl + realizedPnl).toFixed(2));
      portfolio.totalTrades += 1;
      if (realizedPnl > 0) portfolio.winCount += 1;
      else portfolio.lossCount += 1;
      portfolio.winRate = Number((portfolio.winCount / portfolio.totalTrades).toFixed(3));
      portfolio.recentTrades.unshift(tradeLog);
      if (portfolio.recentTrades.length > 50) portfolio.recentTrades.pop();
    } else {
      remainingPositions.push(pos);
      totalUnrealizedPnl += pos.unrealizedPnl;
    }
  }

  portfolio.openPositions = remainingPositions;
  portfolio.unrealizedPnl = Number(totalUnrealizedPnl.toFixed(2));

  // Compute Total Equity
  const activeInvested = remainingPositions.reduce((sum, p) => sum + p.investedAmount, 0);
  portfolio.totalEquity = Number((portfolio.cashBalance + activeInvested + portfolio.unrealizedPnl).toFixed(2));

  // Peak Equity & Drawdown Tracking
  portfolio.dailyPeakEquity = Math.max(portfolio.dailyPeakEquity, portfolio.totalEquity);
  const currentDrawdown = (portfolio.dailyPeakEquity - portfolio.totalEquity) / portfolio.dailyPeakEquity;
  portfolio.dailyDrawdownPct = Number((currentDrawdown * 100).toFixed(2));
  portfolio.maxDrawdownPct = Math.max(portfolio.maxDrawdownPct, portfolio.dailyDrawdownPct);

  // 1.5% Daily Drawdown Circuit Breaker Enforcement
  let circuitBreakerTripped = false;
  if (currentDrawdown >= RISK_CONFIG.MAX_DAILY_DRAWDOWN_PCT && !portfolio.isHalted) {
    portfolio.isHalted = true;
    portfolio.haltReason = `1.5% Daily Drawdown Circuit Breaker Triggered (Current DD: ${portfolio.dailyDrawdownPct}%)`;
    circuitBreakerTripped = true;
  }

  await savePortfolioState(portfolio);

  return {
    closedPositions: closedLogs,
    circuitBreakerTripped,
    portfolio,
  };
}

export async function closePositionManually(positionId: string): Promise<{
  success: boolean;
  tradeLog?: TradeLog;
  error?: string;
}> {
  const portfolio = await getPortfolioState();
  const index = portfolio.openPositions.findIndex((p) => p.id === positionId);
  if (index === -1) {
    return { success: false, error: `Position ${positionId} not found among open positions` };
  }

  const pos = portfolio.openPositions[index];
  const quote = await fetchLiveQuote(pos.symbol);
  const exitPrice = quote ? quote.price : pos.currentPrice;

  let realizedPnl = 0;
  if (pos.direction === 'LONG') {
    realizedPnl = (exitPrice - pos.entryPrice) * pos.quantity;
  } else {
    realizedPnl = (pos.entryPrice - exitPrice) * pos.quantity;
  }

  const realizedPnlPct = Number(((realizedPnl / pos.investedAmount) * 100).toFixed(2));

  const tradeLog: TradeLog = {
    id: `trd-${pos.id}`,
    positionId: pos.id,
    symbol: pos.symbol,
    direction: pos.direction,
    strategy: pos.strategy,
    entryPrice: pos.entryPrice,
    exitPrice,
    quantity: pos.quantity,
    investedAmount: pos.investedAmount,
    realizedPnl: Number(realizedPnl.toFixed(2)),
    realizedPnlPct,
    entryTime: pos.entryTime,
    exitTime: new Date().toISOString(),
    exitReason: 'MANUAL_CLOSE',
  };

  portfolio.openPositions.splice(index, 1);
  portfolio.cashBalance = Number((portfolio.cashBalance + pos.investedAmount + realizedPnl).toFixed(2));
  portfolio.realizedPnl = Number((portfolio.realizedPnl + realizedPnl).toFixed(2));
  portfolio.totalTrades += 1;
  if (realizedPnl > 0) portfolio.winCount += 1;
  else portfolio.lossCount += 1;
  portfolio.winRate = Number((portfolio.winCount / portfolio.totalTrades).toFixed(3));
  portfolio.recentTrades.unshift(tradeLog);

  // Recalculate Total Equity
  const activeInvested = portfolio.openPositions.reduce((sum, p) => sum + p.investedAmount, 0);
  const totalUnrealized = portfolio.openPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  portfolio.totalEquity = Number((portfolio.cashBalance + activeInvested + totalUnrealized).toFixed(2));

  await savePortfolioState(portfolio);
  return { success: true, tradeLog };
}

export async function toggleEmergencyHalt(halt: boolean, reason?: string): Promise<PaperPortfolioState> {
  const portfolio = await getPortfolioState();
  portfolio.isHalted = halt;
  portfolio.haltReason = halt ? (reason || 'Emergency Circuit Breaker Triggered by Command') : undefined;
  await savePortfolioState(portfolio);
  return portfolio;
}

export async function resetPortfolio(): Promise<PaperPortfolioState> {
  const today = new Date().toISOString().slice(0, 10);
  const fresh: PaperPortfolioState = {
    initialBalance: RISK_CONFIG.INITIAL_CAPITAL,
    cashBalance: RISK_CONFIG.INITIAL_CAPITAL,
    totalEquity: RISK_CONFIG.INITIAL_CAPITAL,
    unrealizedPnl: 0,
    realizedPnl: 0,
    totalTrades: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    maxDrawdownPct: 0,
    dailyPeakEquity: RISK_CONFIG.INITIAL_CAPITAL,
    dailyDrawdownPct: 0,
    dailyDrawdownResetDate: today,
    isHalted: false,
    openPositions: [],
    recentTrades: [],
    lastUpdated: new Date().toISOString(),
  };

  await savePortfolioState(fresh);
  return fresh;
}
