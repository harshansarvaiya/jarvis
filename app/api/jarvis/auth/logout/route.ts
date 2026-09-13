import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/jarvis/auth';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'GUARDIAN PROTOCOL RE-LOCKED // SESSION TERMINATED',
  });

  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
