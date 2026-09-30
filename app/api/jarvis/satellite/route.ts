import { NextRequest, NextResponse } from 'next/server';
import {
  listRegisteredSatellites,
  dispatchSatelliteCommand,
  registerOrHeartbeatSatellite,
  verifySatelliteToken,
} from '@/lib/jarvis/satellite';

export const dynamic = 'force-dynamic';

/**
 * GET: Lists all registered satellite devices and their live statuses
 */
export async function GET() {
  try {
    const devices = await listRegisteredSatellites();
    return NextResponse.json({
      success: true,
      count: devices.length,
      devices,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: Dispatches a directive to a satellite device
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId, type, command, action, params, timeoutMs } = body;

    if (!deviceId) {
      return NextResponse.json({ success: false, error: 'Missing deviceId parameter' }, { status: 400 });
    }

    if (type !== 'SHELL' && type !== 'ACTION') {
      return NextResponse.json(
        { success: false, error: 'type must be SHELL or ACTION' },
        { status: 400 }
      );
    }

    const result = await dispatchSatelliteCommand(
      deviceId,
      type,
      { command, action, params },
      timeoutMs || 25000,
      'Web-PWA/API'
    );

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
