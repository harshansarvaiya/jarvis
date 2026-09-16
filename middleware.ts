import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, verifyMasterKey, SESSION_COOKIE_NAME } from './lib/jarvis/auth';

/**
 * J.A.R.V.I.S. Edge Security Middleware
 * Intercepts incoming requests at the Edge before route handlers execute.
 * Directive 01: Guardian Protocol
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /api/jarvis/* and /api/mcp/* endpoints
  if (!pathname.startsWith('/api/jarvis') && !pathname.startsWith('/api/mcp')) {
    return NextResponse.next();
  }

  // Exempt public authentication routes
  if (pathname.startsWith('/api/jarvis/auth')) {
    return NextResponse.next();
  }

  // Allow verified Master PIN for mobile shortcuts, hardware triggers, and CLI bridges
  const masterPin = req.headers.get('x-master-pin');
  if (masterPin && verifyMasterKey(masterPin)) {
    return NextResponse.next();
  }

  // Check for session cookie or explicit bearer header
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const candidateToken = sessionCookie || authHeader;

  const isValid = await verifySessionToken(candidateToken);

  if (!isValid) {
    return NextResponse.json(
      {
        error: 'ACCESS DENIED // DIRECTIVE 01: GUARDIAN AUTHENTICATION REQUIRED',
        code: 'UNAUTHORIZED',
        protocol: 'GUARDIAN_GATE_ENFORCED',
      },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/jarvis/:path*', '/api/mcp/:path*'],
};
