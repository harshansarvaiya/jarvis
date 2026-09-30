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

    // 1. Direct Sovereign VM Relay (Guarantees unified state with GCP VM runner & Telegram worker)
    const rpcHost = process.env.VM_RPC_HOST || '34.58.239.181';
    const rpcPort = process.env.VM_RPC_PORT || '4004';
    try {
      const vmRes = await fetch(`http://${rpcHost}:${rpcPort}/api/satellite/poll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-jarvis-rpc-token': process.env.VM_RPC_SECRET || 'jarvis-sovereign-rpc-652a16c035ab8640b52f724d3302790c31ec7497c3a71ae7db119f76d70f50d8',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (vmRes.ok) {
        const vmData = await vmRes.json();
        return NextResponse.json(vmData);
      }
    } catch {}

    // 2. Result reporting from completed command (Fallback)
    if (body.result) {
      await reportSatelliteResult(body.result);
      return NextResponse.json({ success: true, recorded: true });
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
