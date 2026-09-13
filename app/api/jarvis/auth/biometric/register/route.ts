import { NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
  verifyMasterKey,
  createBiometricEnrollmentToken,
  verifyChallengeToken,
  SESSION_COOKIE_NAME,
} from '@/lib/jarvis/auth';
import { saveRegisteredCredential, verifyChallenge } from '@/lib/jarvis/webauthn';

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const isSessionValid = await verifySessionToken(sessionCookie);

    const body = await req.json().catch(() => ({}));
    const { credentialId, deviceName, challenge, challengeToken, deviceId, masterKey } = body;

    const isMasterValid = masterKey ? verifyMasterKey(masterKey) : false;

    // Registration requires either an active session or a valid master key
    if (!isSessionValid && !isMasterValid) {
      return NextResponse.json(
        {
          error:
            'UNAUTHORIZED // Biometric enrollment requires verified Master Key or active session.',
        },
        { status: 401 }
      );
    }

    if (!credentialId) {
      return NextResponse.json(
        { error: 'Biometric Credential ID is required.' },
        { status: 400 }
      );
    }

    // Verify challenge via stateless token or in-memory map
    if (challengeToken) {
      const challengeCheck = await verifyChallengeToken(challengeToken);
      if (!challengeCheck.valid) {
        return NextResponse.json(
          { error: 'Biometric challenge token expired or invalid.' },
          { status: 400 }
        );
      }
    } else if (challenge && deviceId) {
      const isValidChallenge = verifyChallenge(deviceId, challenge);
      if (!isValidChallenge) {
        return NextResponse.json(
          { error: 'Biometric challenge verification failed or expired.' },
          { status: 400 }
        );
      }
    }

    // Issue cryptographic device token
    const bioToken = await createBiometricEnrollmentToken(credentialId);

    saveRegisteredCredential({
      id: credentialId,
      name: deviceName || 'Mobile Biometric Node',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'BIOMETRIC SIGNATURE ENROLLED // DIRECTIVE 01 SATISFIED',
      bioToken,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Biometric enrollment failure' },
      { status: 500 }
    );
  }
}
