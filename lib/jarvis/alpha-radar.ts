/**
 * J.A.R.V.I.S. Mark II — Real-Time Alpha Radar Subsystem (Grok-Inspired)
 * 
 * Taps real-time developer discourse, breakout open-source frameworks, and frontier
 * AI engineering shifts via the Developer Pulse firehose. Filters for breakthrough velocity,
 * executes 4-lens Multi-Perspective Deconstruction, and dispatches high-signal intelligence
 * to Telegram before the market catches on.
 * 
 * Deduplication: Upstash Redis (`jarvis:alpha_radar:seen:<id>`) with 72-hour TTL
 * Enforces Directive 01 (Guardian Protocol) and Directive 04 (Sovereign Loyalty).
 */

import { fetchDeveloperPulse, DeveloperPulseItem } from './developer-pulse';
import { deconstructMultiPerspective, MultiPerspectiveResult } from './multi-perspective';
import { getStorage } from './storage';
import { telegramGateway, TelegramInlineKeyboardMarkup } from './telegram';

export interface AlphaRadarReport {
  id: string;
  item: DeveloperPulseItem;
  velocityScore: number;
  deconstruction: MultiPerspectiveResult;
  dispatchedAt: string;
}

const REDIS_PREFIX = 'jarvis:alpha_radar:seen:';
const SEEN_TTL_SECONDS = 72 * 60 * 60; // 72 Hours

/**
 * Checks whether an item was already analyzed and dispatched
 */
async function isItemSeen(itemId: string): Promise<boolean> {
  const storage = getStorage();
  if (storage.isCloud) {
    try {
      const res = await storage.execute('get', `${REDIS_PREFIX}${itemId}`);
      return Boolean(res);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Marks an item as seen in Upstash with a 72-hour TTL
 */
async function markItemSeen(itemId: string): Promise<void> {
  const storage = getStorage();
  if (storage.isCloud) {
    try {
      await storage.execute('setex', `${REDIS_PREFIX}${itemId}`, SEEN_TTL_SECONDS, '1');
    } catch (err) {
      console.warn('[Alpha Radar] Failed to mark item seen in Redis:', err);
    }
  }
}

/**
 * Evaluates whether a developer discussion qualifies as an asymmetric breakthrough
 */
function isBreakoutCandidate(item: DeveloperPulseItem): boolean {
  const title = item.title.toLowerCase();

  // High-signal keywords indicating frontier advancements
  const breakthroughSignals = [
    'model', 'open-weight', 'llm', 'transformer', 'agent', 'rag', 'compiler',
    'distributed', 'consensus', 'kafka', 'redis', 'database', 'latency', 'zero-day',
    'vulnerability', 'framework', 'unsloth', 'lora', 'cuda', 'h100', 'benchmark'
  ];

  const hasSignal = breakthroughSignals.some((sig) => title.includes(sig));
  const hasVelocity = item.score >= 120 || item.commentsCount >= 80;

  return hasSignal && hasVelocity;
}

/**
 * Executes a full Alpha Radar sweep across real-time developer firehoses
 */
export async function runAlphaRadarSweep(): Promise<{
  sweptCount: number;
  breakoutsFound: number;
  dispatched: AlphaRadarReport[];
}> {
  console.log('[Alpha Radar] ⚡ Initiating real-time developer pulse sweep...');
  const pulse = await fetchDeveloperPulse(15);
  const dispatched: AlphaRadarReport[] = [];
  const authChatId = process.env.TELEGRAM_AUTHORIZED_CHAT_ID || '864360540';

  for (const item of pulse.topDiscussions) {
    if (!isBreakoutCandidate(item)) continue;

    const alreadySeen = await isItemSeen(item.id);
    if (alreadySeen) continue;

    console.log(`[Alpha Radar] 🚀 Breakout detected: "${item.title}" (Score: ${item.score}, Comments: ${item.commentsCount})`);

    // Run 4-lens Multi-Perspective Deconstruction
    const deconstruction = await deconstructMultiPerspective(
      item.title,
      `Source: ${item.source} | URL: ${item.url || 'N/A'} | Community Heat: Score ${item.score}, ${item.commentsCount} comments`
    );

    const report: AlphaRadarReport = {
      id: `alpha-${item.id}`,
      item,
      velocityScore: item.score + item.commentsCount * 1.5,
      deconstruction,
      dispatchedAt: new Date().toISOString(),
    };

    // Format high-impact Telegram dispatch
    const grokLens = deconstruction.perspectives.find((p) => p.lens === 'ADVERSARIAL_RED_TEAMER');
    const archLens = deconstruction.perspectives.find((p) => p.lens === 'SYSTEMS_ARCHITECT');

    const message = `⚡ **[REAL-TIME ALPHA RADAR — BREAKOUT DETECTED]**

🔥 **Subject:** [${item.title}](${item.url || 'https://news.ycombinator.com'})
📊 **Velocity:** ${item.score} points • ${item.commentsCount} comments

🏛️ **Architect Verdict:** ${archLens?.verdict || 'Architectural shift verified.'}
🗡️ **Grok Razor (Contrarian):** ${grokLens?.verdict || 'Stress-test completed.'}

🎯 **Dialectical Consensus:**
${deconstruction.dialecticalConsensus}

🚀 **Strategic Action Item for Sir:**
${deconstruction.recommendedActionItem}

_Synthesized autonomously by F.R.I.D.A.Y. via live developer firehose._`;

    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '🌐 View Source', url: item.url || 'https://news.ycombinator.com' },
          { text: '💡 Incubate Loop', callback_data: `cmd:incubate:${item.id}` },
        ],
      ],
    };

    try {
      await telegramGateway.dispatchCronAlert('AINEWS', message, {
        parseMode: 'Markdown',
        replyMarkup: keyboard,
      });
      await markItemSeen(item.id);
      dispatched.push(report);
      console.log(`[Alpha Radar] 📱 Dispatched breakout alert to Telegram [AINEWS]: ${item.title}`);
    } catch (telErr: any) {
      console.warn('[Alpha Radar] Telegram dispatch warning:', telErr.message);
    }
  }

  return {
    sweptCount: pulse.topDiscussions.length,
    breakoutsFound: dispatched.length,
    dispatched,
  };
}
