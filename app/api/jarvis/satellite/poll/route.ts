import { NextRequest, NextResponse } from 'next/server';
import {
  registerOrHeartbeatSatellite,
  pollSatelliteInbox,
  reportSatelliteResult,
  verifySatelliteToken,
} from '@/lib/jarvis/satellite';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

    if (!verifySatelliteToken(token)) {
      return NextResponse.json({ error: 'Unauthorized satellite token' }, { status: 401 });
    }

    const body = await req.json();

    // 1. Result reporting from completed command
    if (body.result) {
      await reportSatelliteResult(body.result);
      return NextResponse.json({ success: true, recorded: true });
    }

    // 1.1 Context Telepathy & Hardware Sentinel event ingestion
    if (body.telepathyEvent) {
      const { processTelepathyEvent } = await import('@/lib/jarvis/satellite');
      const eventRes = await processTelepathyEvent(body.telepathyEvent);
      return NextResponse.json({ success: eventRes.success, eventProcessed: true, message: eventRes.message });
    }

    // 2. Heartbeat & inbox poll
    if (body.device && body.device.id) {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
      await registerOrHeartbeatSatellite({
        ...body.device,
        ip: clientIp,
      });

      const nextCommand = await pollSatelliteInbox(body.device.id);

      return NextResponse.json({
        success: true,
        command: nextCommand || null,
      });
    }

    return NextResponse.json({ error: 'Invalid payload: provide "device" or "result"' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
