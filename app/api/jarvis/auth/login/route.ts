import { NextRequest, NextResponse } from 'next/server';
import {
  verifyMasterKey,
  createSessionToken,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/jarvis/auth';

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // 1. Check Anti-Brute-Force Rate Limiter
    const rateStatus = checkRateLimit(ip);
    if (rateStatus.isLocked) {
      return NextResponse.json(
        {
          error: `SECURITY LOCKOUT ENGAGED // Too many failed attempts. Try again in ${rateStatus.remainingSeconds}s.`,
          isLocked: true,
          remainingSeconds: rateStatus.remainingSeconds,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { passcode } = body;

    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json(
        { error: 'Passcode is required.' },
        { status: 400 }
      );
    }

    // 2. Validate Master Key
    const isMatch = verifyMasterKey(passcode);
    if (!isMatch) {
      const failRecord = recordFailedAttempt(ip);
      if (failRecord.isLocked) {
        return NextResponse.json(
          {
            error: `CRITICAL // Security lock triggered. Suspicious activity isolated for ${failRecord.remainingSeconds}s.`,
            isLocked: true,
            remainingSeconds: failRecord.remainingSeconds,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: `ACCESS DENIED // Passcode invalid. (${failRecord.attemptsLeft} attempts remaining)`,
          attemptsLeft: failRecord.attemptsLeft,
        },
        { status: 401 }
      );
    }

    // 3. Success: Reset rate limits & Issue cryptographic session token
    resetRateLimit(ip);
    const sessionToken = await createSessionToken();

    const response = NextResponse.json({
      success: true,
      message: 'AUTHENTICATION VERIFIED // GUARDIAN PROTOCOL UNLOCKED',
      token: sessionToken,
    });

    // 4. Attach Secure HttpOnly Cookie
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
    console.error('Auth login error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Security Gateway Error' },
      { status: 500 }
    );
  }
}
