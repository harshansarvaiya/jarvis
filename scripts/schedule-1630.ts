import { Client } from '@upstash/qstash';

const QSTASH_TOKEN = process.env.QSTASH_TOKEN!;

async function schedulePush() {
  if (!QSTASH_TOKEN) {
    console.error('❌ QSTASH_TOKEN is missing from environment variables.');
    process.exit(1);
  }

  const qstash = new Client({ token: QSTASH_TOKEN });

  // Calculate delay to 16:30 UTC today (or next occurrence)
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(16, 30, 0, 0);
  if (target <= now) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  
  const delaySeconds = Math.floor((target.getTime() - now.getTime()) / 1000);

  const payload = {
    title: 'J.A.R.V.I.S. Scheduled Alert',
    body: 'Scheduled test push notification for 16:30 UTC.',
  };

  const res = await qstash.publishJSON({
    url: 'https://jarvis-iota-beige.vercel.app/api/push/send',
    body: payload,
    delay: delaySeconds,
  });

  console.log(`✅ Scheduled test push for ${target.toISOString()} (Message ID: ${res.messageId})`);
}

schedulePush().catch(console.error);
