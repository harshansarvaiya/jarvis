import { NextRequest, NextResponse } from 'next/server';
import { generateWebAuthnChallenge, getRegisteredCredentials } from '@/lib/jarvis/webauthn';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const deviceId = body.deviceId || 'jarvis-primary-device';

    const challenge = generateWebAuthnChallenge(deviceId);
    const registered = getRegisteredCredentials();

    return NextResponse.json({
      challenge,
      rp: {
        name: 'J.A.R.V.I.S. Core Matrix',
        id: req.nextUrl.hostname,
      },
      user: {
        id: 'jarvis-creator-harshan',
        name: 'harshan',
        displayName: 'Sir (Creator)',
      },
      allowCredentials: registered.map((c) => ({
        id: c.id,
        type: 'public-key',
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Challenge generation failed' },
      { status: 500 }
    );
  }
}
