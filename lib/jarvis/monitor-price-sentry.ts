/**
 * J.A.R.V.I.S. Mark II — Autonomous Hardware Price Sentry
 * 
 * Monitors target displays for Sir (Harshan Sarvaiya):
 * 1. Acer Nitro XV272U V3 (27" 2K 180Hz Ergonomic Fast IPS) [Target: <= ₹15,000 / restock alert]
 * 2. Acer PM161QT (15.6" Full HD 10-Point Touch) [Target: <= ₹10,000 / drop from ₹10,699]
 * 
 * Synchronizes with Upstash Redis ('jarvis:monitor-price-sentry') and dispatches
 * dual-channel proactive alerts to Telegram (@harshan_jarvis_bot) and VAPID Web Push.
 */

import { Redis } from '@upstash/redis';

export interface MonitorTarget {
  id: string;
  name: string;
  url: string;
  platform: 'amazon' | 'flipkart';
  targetPriceThreshold: number; // Trigger alert if price <= threshold
  lastObservedPrice?: number;
  lastNotifiedPrice?: number;
  lastCheckedAt?: string;
  inStock?: boolean;
}

export interface PriceSentryState {
  monitors: Record<string, MonitorTarget>;
  lastSweepAt?: string;
}

const DEFAULT_TARGETS: Record<string, MonitorTarget> = {
  'acer-xv272u-v3-amazon': {
    id: 'acer-xv272u-v3-amazon',
    name: 'Acer Nitro XV272U V3 (27" 2K 180Hz) - Amazon',
    url: 'https://www.amazon.in/Acer-Backlight-Monitor-Refresh-Certified/dp/B0CCSL95T1',
    platform: 'amazon',
    targetPriceThreshold: 15000,
  },
  'acer-xv272u-v3-flipkart': {
    id: 'acer-xv272u-v3-flipkart',
    name: 'Acer Nitro XV272U V3 (27" 2K 180Hz) - Flipkart',
    url: 'https://www.flipkart.com/acer-nitro-68-58-cm-27-inch-wqhd-led-backlit-ips-panel-gaming-monitor-xv272u-v3/p/itm9425aca7daee4',
    platform: 'flipkart',
    targetPriceThreshold: 15000,
  },
  'acer-pm161qt-amazon': {
    id: 'acer-pm161qt-amazon',
    name: 'Acer PM161QT (15.6" FHD Touch) - Amazon',
    url: 'https://www.amazon.in/Acer-Multi-Touch-Anti-Fingerprint-VisionCare-Adjustable/dp/B0HCX4F8WG',
    platform: 'amazon',
    targetPriceThreshold: 10000,
  },
};

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Lightweight price extraction via HTTP request
 */
async function fetchPriceForTarget(target: MonitorTarget): Promise<{ price: number | null; inStock: boolean }> {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    const res = await fetch(target.url, { headers, redirect: 'follow' });
    if (!res.ok) {
      return { price: null, inStock: false };
    }

    const html = await res.text();

    if (target.platform === 'amazon') {
      // Check stock status
      const isUnavailable = html.includes('Currently unavailable') || html.includes('we don\'t know when or if this item will be back in stock');
      if (isUnavailable) {
        return { price: null, inStock: false };
      }

      // Check for whole price
      const priceWholeMatch = html.match(/class=["\x27]a-price-whole["\x27][^>]*>([0-9,]+)/);
      if (priceWholeMatch) {
        const cleanPrice = parseInt(priceWholeMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(cleanPrice) && cleanPrice > 1000) {
          return { price: cleanPrice, inStock: true };
        }
      }

      // Fallback: price span
      const offscreenMatch = html.match(/class=["\x27]a-offscreen["\x27][^>]*>₹([0-9,.]+)/);
      if (offscreenMatch) {
        const cleanPrice = parseFloat(offscreenMatch[1].replace(/,/g, ''));
        if (!isNaN(cleanPrice) && cleanPrice > 1000) {
          return { price: Math.round(cleanPrice), inStock: true };
        }
      }
    } else if (target.platform === 'flipkart') {
      const isOutOfStock = html.includes('This item is currently out of stock') || html.includes('Sold Out');
      if (isOutOfStock) {
        return { price: null, inStock: false };
      }

      // Flipkart price div usually has class _30jeq3 or similar currency format
      const priceMatch = html.match(/₹([0-9,]+)/);
      if (priceMatch) {
        const cleanPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(cleanPrice) && cleanPrice > 1000 && cleanPrice < 50000) {
          return { price: cleanPrice, inStock: true };
        }
      }
    }

    return { price: null, inStock: true };
  } catch (err: any) {
    console.warn(`[Price Sentry] Failed to fetch price for ${target.name}:`, err.message);
    return { price: null, inStock: false };
  }
}

/**
 * Execute a complete price sentry sweep across all target displays
 */
export async function runMonitorPriceSentrySweep(
  dispatchAlertFn?: (title: string, body: string, url: string) => Promise<void>
): Promise<{ triggeredAlerts: string[]; state: PriceSentryState }> {
  console.log('[Price Sentry] 🔍 Initiating autonomous hardware price radar sweep...');
  const redis = getRedisClient();
  const stateKey = 'jarvis:monitor-price-sentry';

  let state: PriceSentryState = {
    monitors: { ...DEFAULT_TARGETS },
    lastSweepAt: new Date().toISOString(),
  };

  if (redis) {
    try {
      const stored = (await redis.get(stateKey)) as string | PriceSentryState | null;
      if (stored) {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
        state.monitors = { ...DEFAULT_TARGETS, ...parsed.monitors };
      }
    } catch (e: any) {
      console.warn('[Price Sentry] Redis state read warning:', e.message);
    }
  }

  const triggeredAlerts: string[] = [];

  for (const [key, target] of Object.entries(state.monitors)) {
    const { price, inStock } = await fetchPriceForTarget(target);
    target.lastCheckedAt = new Date().toISOString();
    target.inStock = inStock;

    if (price !== null) {
      target.lastObservedPrice = price;
      console.log(`[Price Sentry] 📊 ${target.name}: ₹${price.toLocaleString('en-IN')} (Target: <= ₹${target.targetPriceThreshold.toLocaleString('en-IN')})`);

      // Check if price meets or falls below the alert threshold
      if (price <= target.targetPriceThreshold) {
        // Prevent duplicate spam if we already notified at this exact or higher price recently
        const shouldNotify = !target.lastNotifiedPrice || price < target.lastNotifiedPrice;

        if (shouldNotify) {
          target.lastNotifiedPrice = price;
          const discountDesc = target.id.includes('xv272u')
            ? `\n• Target Drop Confirmed: ₹${price.toLocaleString('en-IN')} (Was ₹19,000+!)\n• Card Checkout Estimate: ~₹${Math.round(price * 0.9).toLocaleString('en-IN')}`
            : `\n• Price Drop Confirmed: ₹${price.toLocaleString('en-IN')} (Dropped from ₹10,699!)\n• Card Cashback Net: ~₹${Math.max(0, price - 500).toLocaleString('en-IN')}`;

          const alertTitle = `🎯 TARGET HIT: ${target.name.split(' - ')[0]} @ ₹${price.toLocaleString('en-IN')}`;
          const alertBody = `Sir, your tracked display has hit your purchase trigger threshold!${discountDesc}\n\n🔗 Direct Link: ${target.url}\n\n⚡ Recommendation: Strike immediately before flash allocations deplete.`;

          triggeredAlerts.push(`${target.name} @ ₹${price}`);

          if (dispatchAlertFn) {
            await dispatchAlertFn(alertTitle, alertBody, target.url);
          } else {
            console.log(`[Price Sentry ALERT] ${alertTitle}\n${alertBody}`);
          }
        }
      }
    } else {
      console.log(`[Price Sentry] ℹ️ ${target.name}: Out of stock or bot-shielded.`);
    }
  }

  state.lastSweepAt = new Date().toISOString();

  if (redis) {
    try {
      await redis.set(stateKey, JSON.stringify(state));
    } catch (e: any) {
      console.warn('[Price Sentry] Redis state write warning:', e.message);
    }
  }

  return { triggeredAlerts, state };
}
