import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
if (UPSTASH_URL && UPSTASH_TOKEN) {
  redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
}

// Baseline Sandbox Constants (Google Cloud Free Trial Pool)
const BASELINE_POOL_START = '2026-09-14T00:00:00.000Z';
const BASELINE_TOTAL_POOL = 33435.00;
const BASELINE_SANDBOX_DAYS = 90;
const ESTIMATED_DAILY_BURN = 0.52; // e2-micro VM + Vertex AI inference

export async function GET(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  const startTime = Date.now();
  const now = new Date();
  const startDate = new Date(BASELINE_POOL_START);

  const msElapsed = Math.max(0, now.getTime() - startDate.getTime());
  const daysElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, BASELINE_SANDBOX_DAYS - daysElapsed);

  let totalPool = BASELINE_TOTAL_POOL;
  let customBurn: number | null = null;

  if (redis) {
    try {
      const stored = await redis.get('jarvis:billing:pool');
      if (stored) {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
        if (typeof parsed?.totalPool === 'number') totalPool = parsed.totalPool;
        if (typeof parsed?.customBurn === 'number') customBurn = parsed.customBurn;
      }
    } catch (err: any) {
      console.warn('[Billing API] Upstash read warning:', err.message);
    }
  }

  const burnEstimated = customBurn !== null ? customBurn : Number((daysElapsed * ESTIMATED_DAILY_BURN).toFixed(2));
  const poolRemaining = Math.max(0, totalPool - burnEstimated);

  const expirationDate = new Date(startDate.getTime() + BASELINE_SANDBOX_DAYS * 24 * 60 * 60 * 1000).toISOString();

  return NextResponse.json({
    status: 'ONLINE',
    latencyMs: Date.now() - startTime,
    timestamp: now.toISOString(),
    billing: {
      gcpTotalCredits: totalPool,
      gcpBurnEstimated: burnEstimated,
      gcpRemaining: poolRemaining,
      daysElapsed,
      daysRemaining,
      startDate: BASELINE_POOL_START,
      expirationDate,
      totalSandboxDays: BASELINE_SANDBOX_DAYS,
      isExpired: daysRemaining === 0,
      currency: 'INR',
      currencySymbol: '₹',
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { totalPool, customBurn } = body;

    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (typeof totalPool === 'number') updatePayload.totalPool = totalPool;
    if (typeof customBurn === 'number') updatePayload.customBurn = customBurn;

    if (redis) {
      await redis.set('jarvis:billing:pool', JSON.stringify(updatePayload));
    }

    return NextResponse.json({
      success: true,
      message: 'Billing ledger and credit pool updated successfully.',
      ledger: updatePayload,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Billing update failed' }, { status: 500 });
  }
}
