import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Simple base64url-safe hash generator for Redis key storage
function hashEndpoint(endpoint: string): string {
  let hash = 0;
  for (let i = 0; i < endpoint.length; i++) {
    const char = endpoint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const clean = Math.abs(hash).toString(36);
  const endSlice = endpoint.slice(-16).replace(/[^a-zA-Z0-9]/g, '');
  return `${clean}_${endSlice}`;
}

/**
 * POST /api/push/subscribe
 * Registers or updates a device Web Push subscription in Upstash Redis
 */
export async function POST(req: NextRequest) {
  try {
    const subscription = await req.json().catch(() => null);

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid PushSubscription payload: endpoint, p256dh, and auth keys required.' },
        { status: 400 }
      );
    }

    const redis = getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { error: 'Upstash Redis configuration missing on server.' },
        { status: 500 }
      );
    }

    const subKeyId = hashEndpoint(subscription.endpoint);
    const redisKey = `jarvis:push_subs:${subKeyId}`;

    const subRecord = {
      subscription,
      registeredAt: new Date().toISOString(),
      userAgent: req.headers.get('user-agent') || 'unknown',
    };

    // Store subscription with 60-day expiration (auto-refreshed on client visit)
    await redis.set(redisKey, JSON.stringify(subRecord), { ex: 60 * 24 * 60 * 60 });

    console.log(`[J.A.R.V.I.S. Push] Successfully registered device subscription: ${redisKey}`);

    return NextResponse.json({
      success: true,
      message: 'Push subscription registered successfully.',
      key: redisKey,
    });
  } catch (err: any) {
    console.error('[J.A.R.V.I.S. Push Subscribe Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/push/subscribe
 * Removes a push subscription when user disables notifications
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint required for unsubscription.' }, { status: 400 });
    }

    const redis = getRedisClient();
    if (redis) {
      const subKeyId = hashEndpoint(endpoint);
      await redis.del(`jarvis:push_subs:${subKeyId}`);
    }

    return NextResponse.json({ success: true, message: 'Unsubscribed successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
