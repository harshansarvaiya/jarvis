import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/jarvis/auth';
import {
  verifyChallenge,
  getRegisteredCredentials,
} from '@/lib/jarvis/webauthn';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { credentialId, challenge, deviceId } = body;

    if (!credentialId) {
      return NextResponse.json(
        { error: 'Credential ID is required for biometric authentication.' },
        { status: 400 }
      );
    }

    // 1. Verify Challenge
    if (challenge && deviceId) {
      const isValid = verifyChallenge(deviceId, challenge);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Biometric challenge expired or invalid. Please try again.' },
          { status: 401 }
        );
      }
    }

    // 2. Verify registered credential matches
    const registered = getRegisteredCredentials();
    const match = registered.find((c) => c.id === credentialId);

    // If credentials are registered on server, enforce match
    if (registered.length > 0 && !match) {
      return NextResponse.json(
        { error: 'ACCESS DENIED // Unrecognized biometric signature.' },
        { status: 401 }
      );
    }

    // 3. Issue Session Token & Set HttpOnly Cookie
    const sessionToken = await createSessionToken();
    const response = NextResponse.json({
      success: true,
      message: 'BIOMETRIC SCAN CONFIRMED // WELCOME BACK, SIR',
      token: sessionToken,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error: any) {
    console.error('Biometric verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Biometric verification failure' },
      { status: 500 }
    );
  }
}
