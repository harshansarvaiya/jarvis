import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/jarvis/kokoro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, persona, voice } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Invalid or missing "text" field' },
        { status: 400 }
      );
    }

    const audioBuffer = await synthesizeSpeech(text, {
      persona: persona === 'friday' ? 'friday' : 'jarvis',
      voice,
    });

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err: any) {
    console.error('[API Voice] Synthesis error:', err);
    return NextResponse.json(
      { error: 'Speech synthesis failed', details: err?.message },
      { status: 500 }
    );
  }
}
