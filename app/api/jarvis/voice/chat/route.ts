import { NextRequest, NextResponse } from 'next/server';
import { executeVoiceDialogueTurn } from '@/lib/jarvis/voice-session';
import { transcribeAudioBuffer } from '@/lib/jarvis/audio';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let speech = '';
    let persona: 'friday' | 'jarvis' = 'friday';
    let apiKey: string | undefined;
    let groqApiKey: string | undefined;
    let transcriptionLatencyMs = 0;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as Blob | null;
      const rawPersona = formData.get('persona') as string | null;
      if (rawPersona === 'jarvis') persona = 'jarvis';

      if (!file || file.size === 0) {
        return NextResponse.json({ error: 'No audio file found in form data.', silence: true }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mime = file.type || 'audio/webm';
      const filename = (file as any).name || (mime.includes('mp4') ? 'voice.m4a' : 'voice.webm');

      const transStart = Date.now();
      const transcript = await transcribeAudioBuffer(buffer, filename, mime);
      transcriptionLatencyMs = Date.now() - transStart;

      if (!transcript.text || !transcript.text.trim()) {
        return NextResponse.json({
          silence: true,
          transcript: '',
          vocalText: '',
          fullMarkdownReply: '',
          persona,
          toolCallsExecuted: [],
          latencyMs: transcriptionLatencyMs,
          engine: 'Groq Whisper LPU (Silence)',
        });
      }

      speech = transcript.text.trim();
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      apiKey = body.apiKey;
      groqApiKey = body.groqApiKey;
      if (body.persona === 'jarvis') persona = 'jarvis';

      if (body.audioBase64) {
        const transStart = Date.now();
        const buffer = Buffer.from(body.audioBase64, 'base64');
        const transcript = await transcribeAudioBuffer(buffer, 'voice.m4a', 'audio/mp4');
        transcriptionLatencyMs = Date.now() - transStart;

        if (!transcript.text || !transcript.text.trim()) {
          return NextResponse.json({
            silence: true,
            transcript: '',
            vocalText: '',
            fullMarkdownReply: '',
            persona,
            toolCallsExecuted: [],
            latencyMs: transcriptionLatencyMs,
            engine: 'Groq Whisper LPU (Silence)',
          });
        }
        speech = transcript.text.trim();
      } else {
        speech = (body.speech || '').trim();
      }
    } else {
      // Direct raw binary stream
      const arrayBuffer = await req.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > 0) {
        const transStart = Date.now();
        const transcript = await transcribeAudioBuffer(buffer, 'voice.webm', contentType || 'audio/webm');
        transcriptionLatencyMs = Date.now() - transStart;
        speech = (transcript.text || '').trim();
      }
    }

    if (!speech) {
      return NextResponse.json({
        silence: true,
        transcript: '',
        vocalText: '',
        fullMarkdownReply: '',
        persona,
        toolCallsExecuted: [],
        latencyMs: 0,
        error: 'No discernible speech detected.',
      });
    }

    const result = await executeVoiceDialogueTurn({
      userSpeech: speech,
      persona,
      role: auth.role || 'master',
      apiKey,
      groqApiKey,
    });

    return NextResponse.json({
      ...result,
      transcript: speech,
      transcriptionLatencyMs,
    });
  } catch (err: any) {
    console.error('[Voice Chat API] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Voice dialogue execution failed.' },
      { status: 500 }
    );
  }
}
