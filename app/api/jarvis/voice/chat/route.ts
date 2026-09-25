import { NextRequest, NextResponse } from 'next/server';
import { executeVoiceDialogueTurn } from '@/lib/jarvis/voice-session';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { speech, persona, apiKey, groqApiKey } = body;

    if (!speech || typeof speech !== 'string' || !speech.trim()) {
      return NextResponse.json({ error: 'Valid speech input string is required.' }, { status: 400 });
    }

    const result = await executeVoiceDialogueTurn({
      userSpeech: speech.trim(),
      persona: persona === 'jarvis' ? 'jarvis' : 'friday',
      role: auth.role || 'master',
      apiKey,
      groqApiKey,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[Voice Chat API] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Voice dialogue execution failed.' },
      { status: 500 }
    );
  }
}
