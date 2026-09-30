/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. — 24/7 Real-Time Breaking Market Catalyst Sentry
 * 
 * Monitors breaking macroeconomic, regulatory, commodity, and geopolitical shocks
 * around the clock (24/7/365), translating real-time news and volatility spikes into
 * second-order actionable trading intelligence for Sir across Indian equities.
 * 
 * Enforces Directives 01, 04, and 06.
 */

import { fetchLiveQuote } from './quant-engine';
import { analyzeNseStock, fetchGlobalMacroIndicators, NSE_SECTOR_WATCHLIST } from './nse-macro-radar';
import { telegramGateway, TelegramInlineKeyboardMarkup } from './telegram';
import { Redis } from '@upstash/redis';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Initialize Redis if credentials exist
let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export type CatalystType =
  | 'REGULATORY_SEBI'
  | 'MONETARY_RBI'
  | 'COMMODITY_CRUDE'
  | 'GEOPOLITICAL'
  | 'POLICY_CAPEX'
  | 'CORPORATE_EARNINGS'
  | 'MACRO_VOLATILITY';

export interface BreakingCatalyst {
  id: string;
  type: CatalystType;
  headline: string;
  summary: string;
  sourceUrl?: string;
  sourceName: string;
  publishedAt: string;
  impactScore: number; // 1 to 10 (>= 7 triggers immediate dispatch)
  transmission: {
    summary: string;
    favoredSectors: string[];
    pressuredSectors: string[];
    keyTickers: string[];
    tacticalAction: 'BUY_DIP' | 'ACCUMULATE' | 'DEFENSIVE_HEDGE' | 'MONITOR';
  };
}

// -------------------------------------------------------------
// Deduplication Utilities
// -------------------------------------------------------------
const DISPATCHED_ALERTS_FILE = path.join(process.cwd(), 'data', 'dispatched-alerts.json');

async function isCatalystAlreadyDispatched(key: string): Promise<boolean> {
  if (redis) {
    try {
      const exists = await redis.get(key);
      if (exists) return true;
    } catch (err: any) {
      console.warn('[Market Sentry] Redis dedup read failed, falling back to local file:', err.message);
    }
  }

  try {
    if (fs.existsSync(DISPATCHED_ALERTS_FILE)) {
      const content = fs.readFileSync(DISPATCHED_ALERTS_FILE, 'utf-8');
      const list: string[] = JSON.parse(content);
      return list.includes(key);
    }
  } catch {}
  return false;
}

async function markCatalystDispatched(key: string, ttlSeconds: number = 86400): Promise<void> {
  if (redis) {
    try {
      await redis.set(key, 'DISPATCHED', { ex: ttlSeconds });
    } catch (err: any) {
      console.warn('[Market Sentry] Redis dedup write failed:', err.message);
    }
  }

  try {
    let list: string[] = [];
    if (fs.existsSync(DISPATCHED_ALERTS_FILE)) {
      list = JSON.parse(fs.readFileSync(DISPATCHED_ALERTS_FILE, 'utf-8'));
    }
    if (!list.includes(key)) {
      list.push(key);
      if (list.length > 300) list = list.slice(-250);
      fs.writeFileSync(DISPATCHED_ALERTS_FILE, JSON.stringify(list, null, 2));
    }
  } catch {}
}

// -------------------------------------------------------------
// RSS Feed Ingestion & Parsing (Zero Heavy Dependencies)
// -------------------------------------------------------------
interface RawRssItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

function cleanHtmlAndCdata(str: string): string {
  if (!str) return '';
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchRssFeed(url: string, timeoutMs = 5000): Promise<RawRssItem[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JARVIS-MarketSentry/2.0; +https://jarvis-iota-beige.vercel.app)',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return [];
    const text = await res.text();
    const items: RawRssItem[] = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(text)) !== null) {
      const raw = match[1];
      const titleMatch = raw.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
      const descMatch = raw.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
      const linkMatch = raw.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = raw.match(/<pubDate>(.*?)<\/pubDate>/);

      const title = cleanHtmlAndCdata(titleMatch?.[1] || titleMatch?.[2] || '');
      const description = cleanHtmlAndCdata(descMatch?.[1] || descMatch?.[2] || '');
      const link = (linkMatch?.[1] || '').trim();
      const pubDate = (pubDateMatch?.[1] || '').trim();

      if (title) {
        items.push({ title, description, link, pubDate });
      }
    }

    return items;
  } catch (err: any) {
    console.warn(`[Market Sentry] Failed to fetch RSS from ${url}:`, err.message);
    return [];
  }
}

// -------------------------------------------------------------
// Catalyst Classifier & Transmission Synthesis
// -------------------------------------------------------------
export function classifyNewsItem(item: RawRssItem): BreakingCatalyst | null {
  const fullText = `${item.title} ${item.description}`.toLowerCase();

  // Strict Exclusion: Filter out opinion pieces, editorial columns, speculative advice, and op-eds
  const isOpinionOrCommentary =
    /\b(opinion|editorial|column|views|viewpoint|blog|says analyst|brokerage view|expert view|argues|demands a rate|could see|may see|what if)\b/i.test(
      fullText
    );
  if (isOpinionOrCommentary) {
    return null;
  }

  // Filter 1: Regulatory & Central Bank (SEBI / RBI)
  if (/\b(sebi|derivatives curbs|f&o curbs|margin rule|circular|penalties|investigation)\b/i.test(fullText)) {
    return {
      id: crypto.createHash('sha256').update(item.title).digest('hex').slice(0, 16),
      type: 'REGULATORY_SEBI',
      headline: item.title,
      summary: item.description.slice(0, 300),
      sourceUrl: item.link,
      sourceName: 'SEBI / Regulatory Wire',
      publishedAt: item.pubDate || new Date().toISOString(),
      impactScore: 8,
      transmission: {
        summary: 'Regulatory modifications impact market liquidity, proprietary trading desks, and high-frequency volume.',
        favoredSectors: ['Large-cap defensive', 'Private Banks'],
        pressuredSectors: ['Discount Brokers (BSE, Angel One)', 'Mid/Small-cap Beta'],
        keyTickers: ['HDFCBANK.NS', 'BSE.NS', 'ANGELONE.NS'],
        tacticalAction: 'MONITOR',
      },
    };
  }

  if (
    /\b(rbi|repo rate|monetary policy|mpc|crr)\b/i.test(fullText) &&
    /\b(cuts?|hiked?|hikes?|reduces?|raises?|holds?|held|decision|announces?|unveils?|inflation rate|status quo)\b/i.test(fullText)
  ) {
    const isRateCut = /\b(cuts?|easing|lower|reduction|reduces?)\b/i.test(fullText);
    return {
      id: crypto.createHash('sha256').update(item.title).digest('hex').slice(0, 16),
      type: 'MONETARY_RBI',
      headline: item.title,
      summary: item.description.slice(0, 300),
      sourceUrl: item.link,
      sourceName: 'RBI / Macro Financial Wire',
      publishedAt: item.pubDate || new Date().toISOString(),
      impactScore: 9,
      transmission: {
        summary: isRateCut
          ? 'Interest rate reduction/easing boosts credit expansion, real estate demand, and auto volume.'
          : 'Elevated policy stance dampens high-multiple growth equities and pressures rate-sensitive sectors.',
        favoredSectors: isRateCut ? ['Banking & NBFCs', 'Auto', 'Real Estate'] : ['Export IT', 'Pharma'],
        pressuredSectors: isRateCut ? ['Export IT'] : ['Real Estate', 'High-Beta NBFCs'],
        keyTickers: ['HDFCBANK.NS', 'MARUTI.NS', 'DLF.NS'],
        tacticalAction: isRateCut ? 'ACCUMULATE' : 'DEFENSIVE_HEDGE',
      },
    };
  }

  // Filter 2: Defence & Strategic Sovereign Capex
  if (
    /\b(hal|hindustan aeronautics|tejas|bel|bharat electronics|defence ministry|mod order|defence contract|warship|mazagon)\b/i.test(
      fullText
    ) &&
    /\b(order|contract|delivery|re-rating|target|clearance|clears|approves|billion|crore)\b/i.test(fullText)
  ) {
    return {
      id: crypto.createHash('sha256').update(item.title).digest('hex').slice(0, 16),
      type: 'POLICY_CAPEX',
      headline: item.title,
      summary: item.description.slice(0, 300),
      sourceUrl: item.link,
      sourceName: 'Defence & Industrial Capex Wire',
      publishedAt: item.pubDate || new Date().toISOString(),
      impactScore: 8,
      transmission: {
        summary: 'Direct order accretion expands multi-year defence revenue runway and triggers multiple expansion.',
        favoredSectors: ['Defence Aerospace', 'Electronics EMS', 'Naval Shipbuilding'],
        pressuredSectors: [],
        keyTickers: ['HAL.NS', 'BEL.NS', 'DIXON.NS'],
        tacticalAction: 'BUY_DIP',
      },
    };
  }

  // Filter 3: Crude Oil & Geopolitical Energy Shocks
  if (
    /\b(crude oil|brent crude|opec\+|strait of hormuz|red sea attack|tanker|petroleum price spike|energy shock)\b/i.test(
      fullText
    )
  ) {
    const isSpike = /\b(surge|spike|soars|jump|climb|high|war|crisis)\b/i.test(fullText);
    return {
      id: crypto.createHash('sha256').update(item.title).digest('hex').slice(0, 16),
      type: 'COMMODITY_CRUDE',
      headline: item.title,
      summary: item.description.slice(0, 300),
      sourceUrl: item.link,
      sourceName: 'Global Commodity & Energy Wire',
      publishedAt: item.pubDate || new Date().toISOString(),
      impactScore: 8,
      transmission: {
        summary: isSpike
          ? 'Crude price escalation compresses gross margins for downstream refiners, paint, and tyre makers while boosting upstream E&P realizations.'
          : 'Crude softening provides immediate margin relief to consumer paints, airlines, and logistics.',
        favoredSectors: isSpike ? ['Upstream Oil & Gas (ONGC, Oil India)'] : ['Paints (Asian Paints)', 'Aviation', 'Tyres'],
        pressuredSectors: isSpike ? ['Paints & Coatings', 'Aviation (InterGlobe)', 'Tyres', 'OMCs'] : ['Upstream Energy'],
        keyTickers: ['ONGC.NS', 'BERGEPAINT.NS', 'BPCL.NS'],
        tacticalAction: isSpike ? 'ACCUMULATE' : 'BUY_DIP',
      },
    };
  }

  // Filter 4: Electronics & Semiconductor PLI / Make in India
  if (/\b(dixon|semiconductor|pli scheme|electronics export|iphone assembly|foxconn india)\b/i.test(fullText)) {
    return {
      id: crypto.createHash('sha256').update(item.title).digest('hex').slice(0, 16),
      type: 'POLICY_CAPEX',
      headline: item.title,
      summary: item.description.slice(0, 300),
      sourceUrl: item.link,
      sourceName: 'PLI & Industrial Tech Wire',
      publishedAt: item.pubDate || new Date().toISOString(),
      impactScore: 7,
      transmission: {
        summary: 'Structural domestic manufacturing tailwinds and global supply chain localization continue to drive top-line compounding.',
        favoredSectors: ['Electronics EMS', 'Telecom Equipment'],
        pressuredSectors: [],
        keyTickers: ['DIXON.NS', 'KAYNES.NS'],
        tacticalAction: 'BUY_DIP',
      },
    };
  }

  // Filter 5: Corporate Black Swan / Major Regulatory Enforcement
  if (/\b(usfda|import alert|form 483|warning letter|hindenburg|fraud|cbi|ed raid|promoter pledged|default)\b/i.test(fullText)) {
    return {
      id: crypto.createHash('sha256').update(item.title).digest('hex').slice(0, 16),
      type: 'CORPORATE_EARNINGS',
      headline: item.title,
      summary: item.description.slice(0, 300),
      sourceUrl: item.link,
      sourceName: 'Corporate Forensic & FDA Wire',
      publishedAt: item.pubDate || new Date().toISOString(),
      impactScore: 8,
      transmission: {
        summary: 'Acute regulatory warning or forensic scrutiny causes immediate valuation de-rating and margin calls.',
        favoredSectors: ['Defensive Quality Cash Compounders'],
        pressuredSectors: ['Pharma US Exporters', 'High-Pledge Promoter Entities'],
        keyTickers: [],
        tacticalAction: 'DEFENSIVE_HEDGE',
      },
    };
  }

  return null;
}

// -------------------------------------------------------------
// Real-Time Macro Shock Monitor (Yahoo Finance Fast Poller)
// -------------------------------------------------------------
export async function checkMacroPriceShocks(): Promise<BreakingCatalyst | null> {
  try {
    const indicators = await fetchGlobalMacroIndicators();
    const brent = indicators.find((i) => i.symbol === 'BZ=F');
    const dxy = indicators.find((i) => i.symbol === 'DX-Y.NYB');
    const tnx = indicators.find((i) => i.symbol === '^TNX');

    // Brent crude sudden move > 2.2%
    if (brent && Math.abs(brent.change24hPct) >= 2.2) {
      const isUp = brent.change24hPct > 0;
      return {
        id: `shock-brent-${new Date().toISOString().slice(0, 13)}-${Math.round(brent.price)}`,
        type: 'MACRO_VOLATILITY',
        headline: `Brent Crude ${isUp ? 'Surges' : 'Tumbles'} ${isUp ? '+' : ''}${brent.change24hPct.toFixed(2)}% to $${brent.price.toFixed(2)}/bbl`,
        summary: `Sharp price volatility detected in global benchmark Brent crude. Significant second-order effects incoming for Indian fiscal balance and corporate operating margins.`,
        sourceName: 'Real-Time Commodity Exchange',
        publishedAt: new Date().toISOString(),
        impactScore: 8,
        transmission: {
          summary: isUp
            ? 'Upstream producers benefit from elevated realization; downstream consumers and high-oil-input industries face immediate gross margin contraction.'
            : 'Crude softening provides direct disinflationary relief to India CAD and input margin expansion for manufacturing.',
          favoredSectors: isUp ? ['Upstream E&P (ONGC, Oil India)'] : ['Paints', 'Aviation', 'Tyres'],
          pressuredSectors: isUp ? ['Paints', 'Aviation', 'Tyres', 'OMCs'] : ['Upstream Energy'],
          keyTickers: ['ONGC.NS', 'BERGEPAINT.NS', 'BPCL.NS'],
          tacticalAction: isUp ? 'ACCUMULATE' : 'BUY_DIP',
        },
      };
    }

    // US Dollar Index sudden move > 0.6%
    if (dxy && Math.abs(dxy.change24hPct) >= 0.6) {
      const isUp = dxy.change24hPct > 0;
      return {
        id: `shock-dxy-${new Date().toISOString().slice(0, 13)}-${Math.round(dxy.price)}`,
        type: 'MACRO_VOLATILITY',
        headline: `US Dollar Index (DXY) ${isUp ? 'Spikes' : 'Declines'} ${isUp ? '+' : ''}${dxy.change24hPct.toFixed(2)}% to ${dxy.price.toFixed(2)}`,
        summary: `Sharp currency dislocation detected. Rapid dollar strengthening draws FII liquidity out of emerging market equities toward US fixed income assets.`,
        sourceName: 'Global FX Radar',
        publishedAt: new Date().toISOString(),
        impactScore: 7,
        transmission: {
          summary: isUp
            ? 'Currency depreciation pressures domestic import costs and prompts FII equity selling; IT services export revenue receives mild FX tailwind.'
            : 'Dollar softening accelerates foreign portfolio capital inflows into high-growth Indian equities.',
          favoredSectors: isUp ? ['Export IT (TCS, Infosys)'] : ['Domestic Cyclicals', 'Banking'],
          pressuredSectors: isUp ? ['High-Debt Equities', 'Import-Dependent Manufacturing'] : ['Export IT'],
          keyTickers: ['TCS.NS', 'HDFCBANK.NS'],
          tacticalAction: isUp ? 'DEFENSIVE_HEDGE' : 'ACCUMULATE',
        },
      };
    }

    // US 10-Yr Yield sudden jump > 2.5%
    if (tnx && Math.abs(tnx.change24hPct) >= 2.5) {
      const isUp = tnx.change24hPct > 0;
      return {
        id: `shock-tnx-${new Date().toISOString().slice(0, 13)}-${Math.round(tnx.price)}`,
        type: 'MACRO_VOLATILITY',
        headline: `US 10-Year Treasury Yield Jumps ${isUp ? '+' : ''}${tnx.change24hPct.toFixed(2)}% to ${(tnx.price / 10).toFixed(2)}%`,
        summary: `Rapid shift in global risk-free rate expectations detected. Bond yield surges compress equity valuation multiples globally.`,
        sourceName: 'US Treasury Markets',
        publishedAt: new Date().toISOString(),
        impactScore: 7,
        transmission: {
          summary: 'Higher global discount rates compress high-PE growth multiples. Cash-generative low-debt value compounders outperform.',
          favoredSectors: ['Cash-Rich Value', 'Commodity Exporters'],
          pressuredSectors: ['High-PE Growth Tech', 'Interest-Sensitive Real Estate'],
          keyTickers: ['TCS.NS', 'ONGC.NS'],
          tacticalAction: 'DEFENSIVE_HEDGE',
        },
      };
    }
  } catch (err: any) {
    console.warn('[Market Sentry] Macro price shock check warning:', err.message);
  }
  return null;
}

// -------------------------------------------------------------
// Master Sentry Dispatcher
// -------------------------------------------------------------
export async function dispatchBreakingCatalystAlert(
  catalyst: BreakingCatalyst,
  dispatchPushFn?: (title: string, body: string, url?: string, options?: any) => Promise<any>
): Promise<boolean> {
  const dedupKey = `jarvis:breaking_market_catalyst:${catalyst.id}`;
  const alreadyNotified = await isCatalystAlreadyDispatched(dedupKey);

  if (alreadyNotified) {
    return false;
  }

  await markCatalystDispatched(dedupKey, 86400); // 24-hour deduplication window

  // 1. Fetch live actionable setups for key tickers (filter out invalid/dead quotes)
  const actionableAnalyses: any[] = [];
  for (const ticker of catalyst.transmission.keyTickers.slice(0, 2)) {
    try {
      const a = await analyzeNseStock(ticker);
      if (a && a.currentPrice > 0) actionableAnalyses.push(a);
    } catch {}
  }

  // 2. Format Telegram Intelligence Card
  const authChatId = process.env.TELEGRAM_AUTHORIZED_CHAT_ID || '864360540';
  let msg = `⚡ **[F.R.I.D.A.Y. — BREAKING MARKET CATALYST ALERT]**\n\n`;
  msg += `🚨 **Event**: ${catalyst.headline}\n`;
  msg += `🌐 **Source**: \`${catalyst.sourceName}\`\n\n`;
  msg += `🧠 **Second-Order Transmission**:\n`;
  msg += `• _${catalyst.transmission.summary}_\n\n`;

  if (catalyst.transmission.favoredSectors.length > 0) {
    msg += `📈 **Favored Sectors**: ${catalyst.transmission.favoredSectors.join(', ')}\n`;
  }
  if (catalyst.transmission.pressuredSectors.length > 0) {
    msg += `📉 **Pressured Sectors**: ${catalyst.transmission.pressuredSectors.join(', ')}\n`;
  }
  msg += `🎯 **Tactical Stance**: **${catalyst.transmission.tacticalAction}**\n\n`;

  if (actionableAnalyses.length > 0) {
    msg += `🎯 **KEY BELLWETHERS ON WATCH**:\n\n`;
    for (let i = 0; i < actionableAnalyses.length; i++) {
      const stock = actionableAnalyses[i];
      const setup = stock.tacticalSetup;
      msg += `*${i + 1}. ${stock.companyName} (\`${stock.symbol}\`)*\n`;
      msg += `• Price: *₹${stock.currentPrice.toLocaleString('en-IN')}* | Trend: \`${stock.trend}\`\n`;
      if (setup) {
        msg += `• Setup: *${setup.action}* | Target: *₹${setup.targetPrice}* | Stop: \`₹${setup.stopLossPrice}\`\n`;
      }
      msg += `\n`;
    }
  }

  msg += `_Execute manual orders on Zerodha Kite / Groww / AngelOne._`;

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      catalyst.transmission.keyTickers.slice(0, 2).map((t) => ({
        text: `🔍 Inspect ${t.replace('.NS', '')}`,
        callback_data: `nse_inspect:${t}`,
      })),
      [
        { text: '🇮🇳 Full NSE Radar', callback_data: 'cmd:nse' },
        { text: '📈 Quant Sentry', callback_data: 'cmd:quant' },
      ],
    ],
  };

  try {
    await telegramGateway.sendMessage(authChatId, msg, {
      parseMode: 'Markdown',
      replyMarkup: keyboard,
    });
    console.log(`[Market Sentry] 🚨 Breaking catalyst alert sent to Telegram: "${catalyst.headline.slice(0, 50)}..."`);
  } catch (tgErr: any) {
    console.warn('[Market Sentry] Telegram alert dispatch failed:', tgErr.message);
  }

  // 3. Dispatch Native Web Push if handler provided
  if (dispatchPushFn) {
    try {
      await dispatchPushFn(
        `⚡ [MARKET ALERT] ${catalyst.headline.slice(0, 50)}`,
        `${catalyst.transmission.summary.slice(0, 160)}... Stance: ${catalyst.transmission.tacticalAction}`,
        '/api/jarvis/trading',
        { skipTelegram: true }
      );
    } catch (pushErr: any) {
      console.warn('[Market Sentry] Web Push dispatch failed:', pushErr.message);
    }
  }

  return true;
}

// -------------------------------------------------------------
// Top-Level Sentry Routine (Invoked by 24/7 Cloud Worker)
// -------------------------------------------------------------
export async function runMarketCatalystSentrySweep(
  dispatchPushFn?: (title: string, body: string, url?: string, options?: any) => Promise<any>
): Promise<{ evaluated: number; dispatched: number }> {
  console.log('[Market Sentry] 📡 Running 24/7 Breaking Market Catalyst Sentry sweep...');
  let dispatched = 0;
  let evaluated = 0;

  // 1. Check Macro Price Shocks (Brent Crude, DXY, US 10-Yr Yield)
  const macroShock = await checkMacroPriceShocks();
  if (macroShock && macroShock.impactScore >= 7) {
    evaluated++;
    const sent = await dispatchBreakingCatalystAlert(macroShock, dispatchPushFn);
    if (sent) dispatched++;
  }

  // 2. Check Breaking Indian Market & Regulatory News Feeds (ET Markets + Google News Finance)
  const feedUrls = [
    'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    'https://news.google.com/rss/search?q=(SEBI+OR+RBI+OR+Nifty+OR+NSE+OR+Sensex)+when:2h&hl=en-IN&gl=IN&ceid=IN:en',
  ];

  for (const url of feedUrls) {
    try {
      const items = await fetchRssFeed(url, 4000);
      for (const item of items.slice(0, 8)) {
        evaluated++;
        const catalyst = classifyNewsItem(item);
        if (catalyst && catalyst.impactScore >= 7) {
          const sent = await dispatchBreakingCatalystAlert(catalyst, dispatchPushFn);
          if (sent) {
            dispatched++;
            // Limit to at most 1 high-impact breaking alert per sweep to prevent notification bursts
            break;
          }
        }
      }
    } catch (feedErr: any) {
      console.warn('[Market Sentry] Feed processing warning:', feedErr.message);
    }
  }

  console.log(`[Market Sentry] Sweep complete: evaluated ${evaluated} signals, dispatched ${dispatched} new alerts.`);
  return { evaluated, dispatched };
}
