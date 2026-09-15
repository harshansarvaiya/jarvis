import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Receiver } from '@upstash/qstash';
import webpush from 'web-push';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/jarvis/auth';

export const dynamic = 'force-dynamic';

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function initializeVapid(): boolean {
  const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privKey = process.env.VAPID_PRIVATE_KEY;
  if (!pubKey || !privKey) return false;
  try {
    webpush.setVapidDetails(
      'mailto:harshan@jarvis.ai',
      pubKey,
      privKey
    );
    return true;
  } catch (e) {
    console.error('[J.A.R.V.I.S. Push] VAPID initialization error:', e);
    return false;
  }
}

/**
 * POST /api/push/send
 * Dispatches Web Push notifications to all registered device subscriptions.
 * Protected by Guardian Session Auth OR Upstash QStash Signature.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Ingress: Either Guardian Session OR Upstash QStash Signature
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const qstashSignature = req.headers.get('upstash-signature');

    let isAuthorized = false;

    // A. Check Guardian Session Token
    const candidateToken = sessionCookie || authHeader;
    if (candidateToken && (await verifySessionToken(candidateToken))) {
      isAuthorized = true;
    }

    // B. Check QStash Webhook Signature if called via QStash
    if (!isAuthorized && qstashSignature) {
      const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY || '';
      const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY || '';
      if (currentSigningKey) {
        try {
          const receiver = new Receiver({ currentSigningKey, nextSigningKey });
          const rawBody = await req.clone().text();
          isAuthorized = await receiver.verify({ signature: qstashSignature, body: rawBody });
        } catch (sigErr) {
          console.warn('[J.A.R.V.I.S. Push] QStash signature verification failed:', sigErr);
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'ACCESS DENIED: Valid Guardian Session Token or QStash Signature required.' },
        { status: 401 }
      );
    }

    // 2. Initialize VAPID
    const vapidReady = initializeVapid();
    if (!vapidReady) {
      return NextResponse.json(
        { error: 'VAPID keys (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) not configured.' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const title = body.title || 'J.A.R.V.I.S. Directive Alert';
    const message = body.body || body.message || 'New autonomous tactical briefing available, Sir.';
    const actionUrl = body.url || body.actionUrl || '/';

    const redis = getRedisClient();
    if (!redis) {
      return NextResponse.json({ error: 'Upstash Redis configuration missing on server.' }, { status: 500 });
    }

    // 3. Retrieve All Registered Subscriptions from Redis
    const keys = await redis.keys('jarvis:push_subs:*');
    if (!keys || keys.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No registered device push subscriptions found in Redis.' },
        { status: 404 }
      );
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: actionUrl,
      timestamp: new Date().toISOString(),
    });

    const results = [];

    for (const key of keys) {
      const storedData = await redis.get(key);
      if (!storedData) continue;

      let pushSubscription: any = null;
      try {
        const parsed = typeof storedData === 'string' ? JSON.parse(storedData) : storedData;
        pushSubscription = parsed.subscription || parsed;
      } catch {
        continue;
      }

      if (!pushSubscription?.endpoint) continue;

      try {
        await webpush.sendNotification(pushSubscription, payload);
        results.push({ key, status: 'dispatched' });
      } catch (err: any) {
        console.warn(`[J.A.R.V.I.S. Push] Delivery to ${key} failed:`, err.message);
        results.push({ key, status: 'failed', error: err.message });

        // If subscription is expired or revoked (HTTP 410 / 404), prune it from Redis
        if (err.statusCode === 410 || err.statusCode === 404) {
          await redis.del(key);
        }
      }
    }

    const successCount = results.filter((r) => r.status === 'dispatched').length;

    return NextResponse.json({
      success: true,
      dispatchedCount: successCount,
      totalSubscribers: keys.length,
      details: results,
    });
  } catch (err: any) {
    console.error('[J.A.R.V.I.S. Push Send Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
