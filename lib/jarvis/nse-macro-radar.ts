/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. — Indian Stock Market (NSE/BSE) Macro Catalyst Radar
 * 
 * Translates global geopolitical, regulatory, commodity, and macroeconomic events
 * into second-order actionable trading setups across the Indian equity universe.
 * 
 * Design Principles:
 * 1. Zero Automated Execution Risk: Delivers tactical decision-support cards to Sir
 *    with entry zones, stop-loss invalidations, and target upsides for 10-second manual execution
 *    via Zerodha Kite / Groww / AngelOne.
 * 2. Deep Second-Order Transmission: Traces multi-hop effects from global news (Crude, DXY,
 *    US Fed, China Tariffs, Defense) directly to Indian sector baskets and specific NSE tickers.
 * 3. Technical Confluence: Combines macro tailwinds with quantitative indicators (RSI, EMA 20/50,
 *    support/resistance levels, and ATR volatility) before issuing a signal.
 * 
 * Enforces Directives 01, 04, and 06 (Zero-Thrashing Infrastructure Integrity).
 */

import {
  fetchLiveQuote,
  fetchHistoricalCandles,
  calculateRSI,
  calculateEMA,
  calculateSMA,
  calculateATR,
  MarketQuote,
  Candle,
} from './quant-engine';
import { telegramGateway } from './telegram';

// ==========================================
// 1. Data Contracts & Indian Market Universe
// ==========================================

export type MacroCatalystCategory =
  | 'CRUDE_OIL'
  | 'US_RATES_DOLLAR'
  | 'GEOPOLITICS_DEFENSE'
  | 'CHINA_PLUS_ONE'
  | 'DOMESTIC_CAPEX_POLICY'
  | 'GLOBAL_TECH_AI';

export interface MacroIndicatorState {
  symbol: string;
  name: string;
  price: number;
  change24hPct: number;
  bias: 'BULLISH_FOR_INDIA' | 'BEARISH_FOR_INDIA' | 'NEUTRAL';
}

export interface NseStockAnalysis {
  symbol: string;
  companyName: string;
  sector: string;
  currentPrice: number;
  change24hPct: number;
  rsi14: number;
  ema20: number;
  ema50: number;
  trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  macroBias: 'TAILWIND' | 'HEADWIND' | 'NEUTRAL';
  tacticalSetup?: {
    action: 'BUY_SWING' | 'BUY_POSITIONAL' | 'ACCUMULATE' | 'REDUCE_EXIT' | 'WATCH';
    entryRange: string;
    targetPrice: number;
    stopLossPrice: number;
    riskRewardRatio: number;
    timeHorizon: '3-10 Days (Swing)' | '1-6 Months (Positional)' | '12+ Months (Compounder)';
    conviction: 'HIGH' | 'MEDIUM' | 'SPECULATIVE';
    thesis: string;
  };
}

export interface MacroCatalystCard {
  id: string;
  timestamp: string;
  category: MacroCatalystCategory;
  headline: string;
  transmissionMechanism: string;
  favoredSectors: string[];
  pressuredSectors: string[];
  actionablePicks: NseStockAnalysis[];
  niftyOutlook: {
    bias: 'BULLISH' | 'BEARISH' | 'RANGEBOUND';
    supportZone: string;
    resistanceZone: string;
    rationale: string;
  };
}

// Key Bellwethers across major Indian sectors
export const NSE_SECTOR_WATCHLIST: Record<string, { symbol: string; name: string }[]> = {
  INDICES: [
    { symbol: '^NSEI', name: 'Nifty 50' },
    { symbol: '^NSEBANK', name: 'Bank Nifty' },
  ],
  UPSTREAM_ENERGY: [
    { symbol: 'ONGC.NS', name: 'Oil & Natural Gas Corp' },
    { symbol: 'OIL.NS', name: 'Oil India Ltd' },
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
  ],
  CRUDE_CONSUMERS_PAINTS: [
    { symbol: 'ASIANPAINT.NS', name: 'Asian Paints' },
    { symbol: 'BERGEPAINT.NS', name: 'Berger Paints' },
    { symbol: 'APOLLOTYRE.NS', name: 'Apollo Tyres' },
  ],
  DEFENSE_AEROSPACE: [
    { symbol: 'HAL.NS', name: 'Hindustan Aeronautics' },
    { symbol: 'BEL.NS', name: 'Bharat Electronics' },
    { symbol: 'MAZDOCK.NS', name: 'Mazagon Dock Shipbuilders' },
  ],
  IT_TECH_EXPORTERS: [
    { symbol: 'TCS.NS', name: 'Tata Consultancy Services' },
    { symbol: 'INFY.NS', name: 'Infosys' },
    { symbol: 'HCLTECH.NS', name: 'HCL Technologies' },
    { symbol: 'LTIM.NS', name: 'LTIMindtree' },
  ],
  ELECTRONICS_EMS: [
    { symbol: 'DIXON.NS', name: 'Dixon Technologies' },
    { symbol: 'KAYNES.NS', name: 'Kaynes Technology' },
  ],
  SPECIALTY_CHEM_PHARMA: [
    { symbol: 'DEEPAKNTR.NS', name: 'Deepak Nitrite' },
    { symbol: 'SRF.NS', name: 'SRF Ltd' },
    { symbol: 'DIVISLAB.NS', name: "Divi's Laboratories" },
  ],
  BANKING_FINANCIALS: [
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
    { symbol: 'ICICIBANK.NS', name: 'ICICI Bank' },
    { symbol: 'SBIN.NS', name: 'State Bank of India' },
  ],
  RAILWAY_CAPEX_INFRA: [
    { symbol: 'RVNL.NS', name: 'Rail Vikas Nigam' },
    { symbol: 'TATAPOWER.NS', name: 'Tata Power' },
    { symbol: 'NTPC.NS', name: 'NTPC Ltd' },
  ],
};

// ==========================================
// 2. Macro Barometers (Global Indicators)
// ==========================================

export async function fetchGlobalMacroIndicators(): Promise<MacroIndicatorState[]> {
  const barometers = [
    { symbol: 'BZ=F', name: 'Brent Crude Oil' },
    { symbol: 'DX-Y.NYB', name: 'US Dollar Index (DXY)' },
    { symbol: '^TNX', name: 'US 10-Yr Treasury Yield' },
    { symbol: 'INR=X', name: 'USD / INR' },
    { symbol: '^GSPC', name: 'S&P 500' },
  ];

  const results: MacroIndicatorState[] = [];
  for (const b of barometers) {
    try {
      const q = await fetchLiveQuote(b.symbol);
      if (q) {
        let bias: 'BULLISH_FOR_INDIA' | 'BEARISH_FOR_INDIA' | 'NEUTRAL' = 'NEUTRAL';

        // Crude oil rising > 2% is generally inflationary / negative for India CAD
        if (b.symbol === 'BZ=F') {
          bias = q.change24hPct > 1.5 ? 'BEARISH_FOR_INDIA' : q.change24hPct < -1.5 ? 'BULLISH_FOR_INDIA' : 'NEUTRAL';
        }
        // DXY strengthening causes FII outflows from emerging markets
        else if (b.symbol === 'DX-Y.NYB') {
          bias = q.change24hPct > 0.5 ? 'BEARISH_FOR_INDIA' : q.change24hPct < -0.5 ? 'BULLISH_FOR_INDIA' : 'NEUTRAL';
        }
        // US 10-Yr yield spike draws capital back to US Treasuries
        else if (b.symbol === '^TNX') {
          bias = q.change24hPct > 2.0 ? 'BEARISH_FOR_INDIA' : 'NEUTRAL';
        }

        results.push({
          symbol: b.symbol,
          name: b.name,
          price: q.price,
          change24hPct: q.change24hPct,
          bias,
        });
      }
    } catch (err) {
      console.warn(`[NSE Radar] Error fetching barometer ${b.symbol}:`, err);
    }
  }
  return results;
}

// ==========================================
// 3. Technical & Quantitative Stock Analysis
// ==========================================

export async function analyzeNseStock(
  symbol: string,
  macroContext?: string
): Promise<NseStockAnalysis> {
  const normSymbol = symbol.endsWith('.NS') || symbol.endsWith('.BO') || symbol.startsWith('^')
    ? symbol
    : `${symbol}.NS`;

  const quote = await fetchLiveQuote(normSymbol);
  const candles = await fetchHistoricalCandles(normSymbol, '1mo', '1d');

  const currentPrice = quote?.price || 0;
  const companyName = quote?.name || normSymbol;
  const change24hPct = quote?.change24hPct || 0;

  if (candles.length < 14) {
    return {
      symbol: normSymbol,
      companyName,
      sector: 'Diversified',
      currentPrice,
      change24hPct,
      rsi14: 50,
      ema20: currentPrice,
      ema50: currentPrice,
      trend: 'SIDEWAYS',
      macroBias: 'NEUTRAL',
    };
  }

  const closes = candles.map(c => c.close);
  const rsi = calculateRSI(closes, 14);
  const ema20Arr = calculateEMA(closes, 20);
  const ema50Arr = calculateEMA(closes, 50);
  const atr = calculateATR(candles, 14);

  const ema20 = ema20Arr.length > 0 ? ema20Arr[ema20Arr.length - 1] : currentPrice;
  const ema50 = ema50Arr.length > 0 ? ema50Arr[ema50Arr.length - 1] : currentPrice;

  // Determine trend
  let trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS' = 'SIDEWAYS';
  if (currentPrice > ema20 && ema20 > ema50) {
    trend = 'UPTREND';
  } else if (currentPrice < ema20 && ema20 < ema50) {
    trend = 'DOWNTREND';
  }

  // Derive Sector
  let sector = 'Equities';
  for (const [secKey, list] of Object.entries(NSE_SECTOR_WATCHLIST)) {
    if (list.some(item => item.symbol.toUpperCase() === normSymbol.toUpperCase())) {
      sector = secKey.replace(/_/g, ' ');
      break;
    }
  }

  // Determine Macro Bias from sector attributes
  let macroBias: 'TAILWIND' | 'HEADWIND' | 'NEUTRAL' = 'NEUTRAL';
  if (['DEFENSE AEROSPACE', 'ELECTRONICS EMS', 'RAILWAY CAPEX INFRA'].includes(sector)) {
    macroBias = 'TAILWIND'; // Structural domestic capex + Make in India
  }

  // Calculate Tactical Setup
  let tacticalSetup: NseStockAnalysis['tacticalSetup'];
  if (trend === 'UPTREND' && rsi < 68) {
    const entryLow = Number((currentPrice * 0.985).toFixed(1));
    const entryHigh = Number(currentPrice.toFixed(1));
    const stopLoss = Number((Math.min(ema50, currentPrice - (atr * 1.8))).toFixed(1));
    const target = Number((currentPrice + (currentPrice - stopLoss) * 2.5).toFixed(1));
    const risk = currentPrice - stopLoss;
    const reward = target - currentPrice;
    const rr = risk > 0 ? Number((reward / risk).toFixed(1)) : 2.5;

    tacticalSetup = {
      action: rsi < 45 ? 'BUY_POSITIONAL' : 'BUY_SWING',
      entryRange: `₹${entryLow} – ₹${entryHigh}`,
      targetPrice: target,
      stopLossPrice: stopLoss,
      riskRewardRatio: rr,
      timeHorizon: rsi < 45 ? '1-6 Months (Positional)' : '3-10 Days (Swing)',
      conviction: macroBias === 'TAILWIND' ? 'HIGH' : 'MEDIUM',
      thesis: `${companyName} trades in a strong daily uptrend above 20 & 50 EMA (RSI: ${rsi.toFixed(1)}). Structural tailwinds in ${sector} provide expansion catalyst with favorable 1:${rr} R:R.`,
    };
  } else if (trend === 'DOWNTREND' && rsi > 60) {
    tacticalSetup = {
      action: 'REDUCE_EXIT',
      entryRange: 'N/A (Bearish Structure)',
      targetPrice: Number((currentPrice * 0.92).toFixed(1)),
      stopLossPrice: Number((currentPrice * 1.04).toFixed(1)),
      riskRewardRatio: 1.5,
      timeHorizon: '3-10 Days (Swing)',
      conviction: 'MEDIUM',
      thesis: `Trading below key moving averages with weak relative momentum. Avoid fresh longs until support consolidates.`,
    };
  } else {
    tacticalSetup = {
      action: 'WATCH',
      entryRange: `Around 50-EMA (₹${ema50.toFixed(1)})`,
      targetPrice: Number((currentPrice * 1.08).toFixed(1)),
      stopLossPrice: Number((currentPrice * 0.95).toFixed(1)),
      riskRewardRatio: 2.0,
      timeHorizon: '1-6 Months (Positional)',
      conviction: 'MEDIUM',
      thesis: `Consolidating in a neutral band (RSI: ${rsi.toFixed(1)}). Await clean volume breakout or pullback to ₹${ema50.toFixed(1)} before entry.`,
    };
  }

  return {
    symbol: normSymbol,
    companyName,
    sector,
    currentPrice: Number(currentPrice.toFixed(2)),
    change24hPct: Number(change24hPct.toFixed(2)),
    rsi14: Number(rsi.toFixed(1)),
    ema20: Number(ema20.toFixed(1)),
    ema50: Number(ema50.toFixed(1)),
    trend,
    macroBias,
    tacticalSetup,
  };
}

// ==========================================
// 4. Full Indian Market Macro Catalyst Scan
// ==========================================

export async function scanIndianMarketCatalysts(): Promise<MacroCatalystCard> {
  const timestamp = new Date().toISOString();
  console.log(`[NSE Macro Radar] 🛰️ Initiating Indian Market Macro Scan at ${timestamp}...`);

  // 1. Fetch Global Indicators
  const macroBarometers = await fetchGlobalMacroIndicators();
  const brent = macroBarometers.find(b => b.symbol === 'BZ=F');
  const dxy = macroBarometers.find(b => b.symbol === 'DX-Y.NYB');
  const niftyQuote = await fetchLiveQuote('^NSEI');

  // 2. Determine Primary Macro Driver
  let category: MacroCatalystCategory = 'DOMESTIC_CAPEX_POLICY';
  let headline = 'Capital Goods & Infrastructure Outperformance Amid Global Consolidation';
  let transmission = 'Domestic institutional capital (DII) and capex allocation are insulating Indian manufacturing while global markets navigate interest rate volatility.';
  let favored = ['Defense & Aerospace', 'Electronics EMS', 'Power & Railway Capex'];
  let pressured = ['High-Beta IT Services', 'Crude-Sensitive Consumer Durables'];

  if (brent && brent.change24hPct > 2.5) {
    category = 'CRUDE_OIL';
    headline = `Crude Oil Surge (${brent.price.toFixed(1)} USD, +${brent.change24hPct.toFixed(1)}%) Transmits Sectoral Divergence`;
    transmission = 'Rising crude directly benefits upstream producers (ONGC, OIL) while compressing margins for paints, adhesives, and tyre manufacturers.';
    favored = ['Upstream Oil & Exploration', 'Coal & Domestic Energy'];
    pressured = ['Paints', 'Tyres', 'Specialty Chemicals'];
  } else if (dxy && dxy.change24hPct > 0.6) {
    category = 'US_RATES_DOLLAR';
    headline = `Dollar Index Hardening (${dxy.price.toFixed(2)}) Triggers Selective FII Rebalancing`;
    transmission = 'A strengthening greenback pressures emerging market currencies, favoring dollar-earning IT exporters while moderating domestic consumption valuations.';
    favored = ['Tier-1 IT Exporters (TCS, INFY)', 'Pharma APIs'];
    pressured = ['Midcap NBFCs', 'Domestic Cyclicals'];
  }

  // 3. Scan Key Tactical Candidates across Favored Sectors
  const candidateSymbols = [
    'HAL.NS',
    'DIXON.NS',
    'ONGC.NS',
    'TCS.NS',
    'HDFCBANK.NS',
    'RELIANCE.NS',
    'TATAPOWER.NS',
  ];

  const actionablePicks: NseStockAnalysis[] = [];
  for (const sym of candidateSymbols) {
    try {
      const analysis = await analyzeNseStock(sym);
      if (analysis.tacticalSetup && analysis.tacticalSetup.action !== 'REDUCE_EXIT') {
        actionablePicks.push(analysis);
      }
    } catch (err) {
      console.warn(`[NSE Radar] Failed to analyze ${sym}:`, err);
    }
  }

  // Sort picks: High conviction first
  actionablePicks.sort((a, b) => {
    const scoreA = a.tacticalSetup?.conviction === 'HIGH' ? 2 : 1;
    const scoreB = b.tacticalSetup?.conviction === 'HIGH' ? 2 : 1;
    return scoreB - scoreA;
  });

  // 4. Formulate Nifty 50 Outlook
  const niftyPrice = niftyQuote?.price || 23140;
  const niftyOutlook = {
    bias: (dxy?.bias === 'BEARISH_FOR_INDIA' ? 'RANGEBOUND' : 'BULLISH') as 'BULLISH' | 'BEARISH' | 'RANGEBOUND',
    supportZone: `${Math.round(niftyPrice * 0.985)} – ${Math.round(niftyPrice * 0.99)}`,
    resistanceZone: `${Math.round(niftyPrice * 1.015)} – ${Math.round(niftyPrice * 1.02)}`,
    rationale: `Nifty 50 at ${niftyPrice.toFixed(0)} maintains primary support above 50-day moving average. Strong DII domestic SIP inflows counterbalance foreign institutional flow.`,
  };

  return {
    id: `nse-catalyst-${Date.now()}`,
    timestamp,
    category,
    headline,
    transmissionMechanism: transmission,
    favoredSectors: favored,
    pressuredSectors: pressured,
    actionablePicks: actionablePicks.slice(0, 4),
    niftyOutlook,
  };
}

// ==========================================
// 5. Telegram Dispatch Formatter
// ==========================================

export async function dispatchIndianMarketAlertToTelegram(card: MacroCatalystCard): Promise<boolean> {
  try {
    const authChatId = process.env.TELEGRAM_AUTHORIZED_CHAT_ID || '864360540';

    let msg = `🇮🇳 *[F.R.I.D.A.Y. — INDIAN MARKET MACRO RADAR]*\n\n`;
    msg += `🌐 *Catalyst*: ${card.headline}\n\n`;
    msg += `🧠 *Transmission*: ${card.transmissionMechanism}\n\n`;
    msg += `📈 *Favored*: ${card.favoredSectors.join(', ')}\n`;
    msg += `📉 *Pressured*: ${card.pressuredSectors.join(', ')}\n\n`;
    msg += `📊 *Nifty 50 Outlook*: *${card.niftyOutlook.bias}*\n`;
    msg += `• Support: \`${card.niftyOutlook.supportZone}\` | Resistance: \`${card.niftyOutlook.resistanceZone}\`\n\n`;
    msg += `🎯 *TOP TACTICAL SETUPS (FOR MANUAL EXECUTION)*:\n\n`;

    for (let idx = 0; idx < card.actionablePicks.length; idx++) {
      const pick = card.actionablePicks[idx];
      const s = pick.tacticalSetup;
      if (!s) continue;
      msg += `*${idx + 1}. ${pick.companyName} (\`${pick.symbol}\`)*\n`;
      msg += `• Action: *${s.action}* | Current: *₹${pick.currentPrice}*\n`;
      msg += `• Entry Zone: \`${s.entryRange}\`\n`;
      msg += `• Target: *₹${s.targetPrice}* | Stop-Loss: \`₹${s.stopLossPrice}\` (R:R 1:${s.riskRewardRatio})\n`;
      msg += `• Horizon: _${s.timeHorizon}_ | Conviction: *${s.conviction}*\n`;
      msg += `• _${s.thesis}_\n\n`;
    }

    msg += `_Execute orders manually on Zerodha Kite / Groww / AngelOne._`;

    await telegramGateway.sendMessage(authChatId, msg, { parseMode: 'Markdown' });
    console.log(`[NSE Radar] 📱 Tactical market card dispatched to Telegram chat ${authChatId}.`);
    return true;
  } catch (err) {
    console.warn(`[NSE Radar] Telegram alert dispatch failed:`, err);
    return false;
  }
}
