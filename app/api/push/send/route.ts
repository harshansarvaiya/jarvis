import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import webpush from 'web-push';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

webpush.setVapidDetails(
  'mailto:support@harshansarvaiya.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = body.title || 'J.A.R.V.I.S. Alert';
    const message = body.body || body.message || 'Scheduled tactical dispatch.';

    // Fetch all registered subscriptions from Redis
    const keys = await redis.keys('jarvis:push_subs:*');
    if (!keys || keys.length === 0) {
      return NextResponse.json({ success: false, error: 'No push subscriptions found in Redis' }, { status: 404 });
    }

    const results = [];
    for (const key of keys) {
      const sub = await redis.get(key);
      if (sub) {
        try {
          const pushSubscription = typeof sub === 'string' ? JSON.parse(sub) : sub;
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify({ title, body: message })
          );
          results.push({ key, status: 'sent' });
        } catch (err: any) {
          console.error(`Failed to push to ${key}:`, err);
          results.push({ key, status: 'failed', error: err.message });
          // If subscription is gone/expired, clean it up
          if (err.statusCode === 410 || err.statusCode === 404) {
            await redis.del(key);
          }
        }
      }
    }

    return NextResponse.json({ success: true, dispatchedTo: results });
  } catch (err: any) {
    console.error('Error in push/send cron route:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
