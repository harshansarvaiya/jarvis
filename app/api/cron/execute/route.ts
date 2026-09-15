import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { webpush } from '@/lib/jarvis/push-server';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('upstash-signature');
    const body = await req.text();

    if (!signature) {
      return NextResponse.json({ error: 'Missing Upstash signature' }, { status: 401 });
    }

    // Verify signature
    const isValid = await receiver.verify({
      signature,
      body,
    });

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Upstash signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const taskType = payload.task || 'briefing';

    console.log(`[J.A.R.V.I.S. Cron] Executing background task: ${taskType}`);

    // Here we can trigger push notifications or perform background operations
    // For demonstration, we log execution success

    return NextResponse.json({ success: true, executed: taskType, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('[J.A.R.V.I.S. Cron Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
