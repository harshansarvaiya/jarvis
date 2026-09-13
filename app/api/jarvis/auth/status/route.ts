import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/jarvis/auth';
import { getRegisteredCredentials } from '@/lib/jarvis/webauthn';

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const token = sessionCookie || authHeader;

    const authenticated = await verifySessionToken(token);
    const credentials = getRegisteredCredentials();

    return NextResponse.json({
      authenticated,
      biometricsEnabled: credentials.length > 0,
      registeredDevicesCount: credentials.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 200 }
    );
  }
}
