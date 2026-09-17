/**
 * J.A.R.V.I.S. Audio Substrate — Groq Whisper & Voice Ingestion
 * 
 * Provides sub-200ms speech-to-text via Groq LPU Custom Silicon
 * (whisper-large-v3-turbo / whisper-large-v3).
 * Directive 01 & Directive 04 Compliant: Western LPU hardware, ultra-low latency.
 */

export interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
  error?: string;
}

export async function transcribeAudioBuffer(
  buffer: Buffer,
  filename = 'audio.ogg',
  mimeType = 'audio/ogg'
): Promise<TranscriptionResult> {
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    return {
      text: '',
      error: 'GROQ_API_KEY is not configured for voice transcription.',
    };
  }

  // Normalize Telegram .oga / custom extensions to Groq-supported format (.ogg / .wav / .mp3)
  let cleanFilename = filename.split('/').pop() || 'audio.ogg';
  if (cleanFilename.endsWith('.oga')) {
    cleanFilename = cleanFilename.replace(/\.oga$/i, '.ogg');
  }
  if (!cleanFilename.match(/\.(flac|mp3|mp4|mpeg|mpga|m4a|ogg|opus|wav|webm)$/i)) {
    cleanFilename = `${cleanFilename}.ogg`;
  }

  let cleanMime = mimeType;
  if (!cleanMime || cleanMime === 'application/octet-stream' || cleanMime === 'audio/oga') {
    cleanMime = 'audio/ogg';
  }

  try {
    const uint8 = new Uint8Array(buffer);
    const blob = new Blob([uint8], { type: cleanMime });

    const formData = new FormData();
    formData.append('file', blob, cleanFilename);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'en');
    formData.append('prompt', 'J.A.R.V.I.S., F.R.I.D.A.Y., Harshan, Sir, system health, radar, directives, code, deployment');
    formData.append('response_format', 'verbose_json');
    formData.append('temperature', '0.0');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Audio] Groq Whisper turbo returned HTTP ${res.status}:`, errText);
      // Fallback to standard whisper-large-v3
      const fallbackFormData = new FormData();
      const fallbackBlob = new Blob([uint8], { type: cleanMime });
      fallbackFormData.append('file', fallbackBlob, cleanFilename);
      fallbackFormData.append('model', 'whisper-large-v3');
      fallbackFormData.append('language', 'en');
      fallbackFormData.append('prompt', 'J.A.R.V.I.S., F.R.I.D.A.Y., Harshan, Sir, system health, radar, directives, code, deployment');

      const retryRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: fallbackFormData,
        signal: AbortSignal.timeout(15000),
      });

      if (!retryRes.ok) {
        const retryErr = await retryRes.text().catch(() => '');
        throw new Error(`Groq Whisper failed (HTTP ${retryRes.status}): ${retryErr.slice(0, 150)}`);
      }

      const retryData = await retryRes.json();
      return {
        text: (retryData.text || '').trim(),
        duration: retryData.duration,
        language: retryData.language,
      };
    }

    const data = await res.json();
    return {
      text: (data.text || '').trim(),
      duration: data.duration,
      language: data.language,
    };
  } catch (err: any) {
    console.error('[Audio] Speech-to-text exception:', err?.message || err);
    return {
      text: '',
      error: err?.message || 'Audio transcription failed.',
    };
  }
}
