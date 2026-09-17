import { NextRequest, NextResponse } from 'next/server';
import { getPersonaConfig, updatePersonaConfig, DEFAULT_PERSONA_CONFIG } from '@/lib/jarvis/persona';
import { verifySessionToken, verifyMobileBearerToken } from '@/lib/jarvis/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const config = await getPersonaConfig();
    return NextResponse.json({
      success: true,
      config,
      defaults: DEFAULT_PERSONA_CONFIG,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to retrieve persona config' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Optional Bearer / Cookie Auth check
    const authHeader = req.headers.get('authorization');
    const cookieToken = req.cookies.get('jarvis_session')?.value;

    const isBearerValid = authHeader ? verifyMobileBearerToken(authHeader) : false;
    const isSessionValid = cookieToken ? await verifySessionToken(cookieToken) : false;

    // Allow authenticated users or internal calls
    if (authHeader && !isBearerValid && !isSessionValid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const updated = await updatePersonaConfig(body);

    return NextResponse.json({
      success: true,
      message: 'Persona configuration synchronized across cloud substrate.',
      config: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update persona config' },
      { status: 500 }
    );
  }
}
