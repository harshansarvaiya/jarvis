import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudioBuffer } from '@/lib/jarvis/audio';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  try {
    const contentType = req.headers.get('content-type') || '';
    let buffer: Buffer;
    let filename = 'voice.webm';
    let mimeType = 'audio/webm';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as Blob | null;
      if (!file) {
        return NextResponse.json({ error: 'No audio file provided in form-data.' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      mimeType = file.type || 'audio/webm';
      filename = (file as any).name || (mimeType.includes('wav') ? 'voice.wav' : 'voice.webm');
    } else {
      // Direct raw binary stream
      const arrayBuffer = await req.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      if (contentType.includes('audio/wav')) {
        filename = 'voice.wav';
        mimeType = 'audio/wav';
      } else if (contentType.includes('audio/ogg')) {
        filename = 'voice.ogg';
        mimeType = 'audio/ogg';
      }
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: 'Empty audio buffer received.' }, { status: 400 });
    }

    const transcription = await transcribeAudioBuffer(buffer, filename, mimeType);
    const latencyMs = Date.now() - startTime;

    if (transcription.error && !transcription.text) {
      return NextResponse.json({ error: transcription.error }, { status: 500 });
    }

    return NextResponse.json({
      text: transcription.text,
      duration: transcription.duration,
      language: transcription.language,
      latencyMs,
    });
  } catch (err: any) {
    console.error('[Voice Transcribe API] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to process voice transcription.' },
      { status: 500 }
    );
  }
}
