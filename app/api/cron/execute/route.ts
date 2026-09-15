import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { getTasks, getMemories } from '@/lib/jarvis/memory';

export const dynamic = 'force-dynamic';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

/**
 * POST /api/cron/execute
 * Upstash QStash Webhook Receiver for autonomous background cron jobs.
 * Cryptographically verifies incoming QStash signatures before execution.
 */
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('upstash-signature');
    const rawBody = await req.text();

    if (!signature) {
      return NextResponse.json({ error: 'Missing Upstash signature header.' }, { status: 401 });
    }

    // Cryptographic signature verification
    const isValid = await receiver.verify({
      signature,
      body: rawBody,
    });

    if (!isValid) {
      console.warn('[J.A.R.V.I.S. Cron] Rejected invalid QStash signature.');
      return NextResponse.json({ error: 'Invalid Upstash signature.' }, { status: 401 });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = { task: 'briefing' };
    }

    const taskType = payload.task || 'briefing';
    console.log(`[J.A.R.V.I.S. Cron] Authenticated QStash trigger executing: "${taskType}"`);

    let executionSummary = '';

    // Task Execution Router
    switch (taskType) {
      case 'briefing': {
        const tasks = getTasks();
        const pending = tasks.filter((t) => t.status !== 'COMPLETED');
        const critical = pending.filter((t) => t.priority === 'CRITICAL');
        executionSummary = `Autonomous Briefing: ${pending.length} pending radar tasks (${critical.length} critical).`;
        break;
      }

      case 'health': {
        const memories = getMemories();
        const tasks = getTasks();
        executionSummary = `Health Check: System operational. ${memories.length} memories, ${tasks.length} tasks registered.`;
        break;
      }

      case 'reminder': {
        const reminderTitle = payload.title || 'Scheduled Directive Alert';
        const reminderMsg = payload.message || 'Scheduled tactical reminder from J.A.R.V.I.S.';
        executionSummary = `Reminder Dispatched: ${reminderTitle} — ${reminderMsg}`;
        break;
      }

      default: {
        executionSummary = `Custom Routine [${taskType}] executed cleanly.`;
        break;
      }
    }

    // If requested, forward result to push notification dispatch
    if (payload.notify) {
      try {
        const pushUrl = new URL('/api/push/send', req.url).toString();
        await fetch(pushUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'upstash-signature': signature, // Re-use verified signature
          },
          body: JSON.stringify({
            title: payload.title || 'J.A.R.V.I.S. Scheduled Briefing',
            body: executionSummary,
            url: payload.url || '/',
          }),
        });
      } catch (pushErr) {
        console.warn('[J.A.R.V.I.S. Cron] Forwarding to push/send note:', pushErr);
      }
    }

    return NextResponse.json({
      success: true,
      task: taskType,
      summary: executionSummary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[J.A.R.V.I.S. Cron Execution Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
