import { NextRequest, NextResponse } from 'next/server';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';
import {
  publishStateEvent,
  getRecentStateEvents,
  onStateEvent,
  StateBusEvent,
} from '@/lib/jarvis/state-bus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/jarvis/events
 * Supports both Server-Sent Events (SSE) and incremental polling (?since=ISO_TIMESTAMP)
 */
export async function GET(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const wantsStream =
    searchParams.get('stream') === 'true' ||
    req.headers.get('accept')?.includes('text/event-stream');

  // 1. Server-Sent Events (SSE) Mode
  if (wantsStream) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Handshake event
        controller.enqueue(
          encoder.encode(
            `event: connected\ndata: ${JSON.stringify({
              status: 'CONNECTED',
              source: 'DUAL_CITIZEN_STATE_BUS',
              timestamp: new Date().toISOString(),
            })}\n\n`
          )
        );

        // Send recent backlog on initial connect
        try {
          const backlog = await getRecentStateEvents(10);
          // Send oldest to newest
          for (const ev of backlog.reverse()) {
            controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(ev)}\n\n`));
          }
        } catch {}

        // Listen for new in-process events
        const unsubscribe = onStateEvent((event: StateBusEvent) => {
          try {
            controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(event)}\n\n`));
          } catch {
            // Stream closed
          }
        });

        // 15s Heartbeat ping to prevent gateway timeouts
        const pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
          } catch {
            clearInterval(pingInterval);
          }
        }, 15000);

        // Stream cancellation cleanup
        req.signal.addEventListener('abort', () => {
          unsubscribe();
          clearInterval(pingInterval);
          try {
            controller.close();
          } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  // 2. Incremental Polling Mode (?since=...&limit=...)
  const since = searchParams.get('since') || undefined;
  const limit = Math.min(Number(searchParams.get('limit')) || 30, 100);

  const events = await getRecentStateEvents(limit, since);
  return NextResponse.json({
    events,
    timestamp: new Date().toISOString(),
    count: events.length,
  });
}

/**
 * POST /api/jarvis/events
 * Publish an event onto the state bus
 */
export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.type || !body.title) {
      return NextResponse.json(
        { error: 'Missing required event fields: type and title are mandatory.' },
        { status: 400 }
      );
    }

    const event = await publishStateEvent({
      type: body.type,
      source: body.source || (auth.source === 'SOVEREIGN_TOKEN' ? 'friday' : 'user'),
      channel: body.channel || 'web-pwa',
      title: body.title,
      detail: body.detail,
      payload: body.payload,
    });

    return NextResponse.json({ success: true, event });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to dispatch state event' }, { status: 500 });
  }
}
