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

/**
 * High-Fidelity Neural2 Voice Synthesis powered by Google Cloud Text-to-Speech
 * Draws 100% from Sir's GCP Free Trial / Developer Credits.
 */
export async function synthesizeSpeechBuffer(options: {
  text: string;
  persona?: 'jarvis' | 'friday';
  speakingRate?: number;
  audioFormat?: 'OGG_OPUS' | 'MP3' | 'LINEAR16';
}): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const { text, persona = 'jarvis', speakingRate = 1.05, audioFormat = 'OGG_OPUS' } = options;

  if (!text || text.trim().length === 0) return null;

  const { getVertexAccessToken } = await import('./vertex');
  const token = await getVertexAccessToken();
  if (!token) {
    console.warn('[Audio] Cannot synthesize speech: No valid GCP Bearer token.');
    return null;
  }

  // British voice profiles matching Master Codex personas
  const voiceConfig =
    persona === 'friday'
      ? { languageCode: 'en-GB', name: 'en-GB-Neural2-F', ssmlGender: 'FEMALE' }
      : { languageCode: 'en-GB', name: 'en-GB-Neural2-B', ssmlGender: 'MALE' };

  const mimeType =
    audioFormat === 'OGG_OPUS'
      ? 'audio/ogg'
      : audioFormat === 'MP3'
      ? 'audio/mp3'
      : 'audio/wav';

  try {
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text: text.slice(0, 4000) },
        voice: voiceConfig,
        audioConfig: {
          audioEncoding: audioFormat,
          speakingRate,
          pitch: persona === 'jarvis' ? -1.0 : 0.0,
        },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Audio] Google Cloud TTS failed (HTTP ${res.status}):`, errText);
      return null;
    }

    const data = await res.json();
    if (data.audioContent) {
      const buffer = Buffer.from(data.audioContent, 'base64');
      return { buffer, mimeType };
    }
  } catch (err: any) {
    console.error('[Audio] Speech synthesis exception:', err?.message || err);
  }

  return null;
}

/**
 * Autonomous Morning / Evening / Tactical Voice Briefing Synthesizer
 */
export async function generateProactiveBriefing(options: {
  type?: 'morning' | 'evening' | 'tactical';
  synthesizeAudio?: boolean;
  persona?: 'jarvis' | 'friday';
}): Promise<{
  type: 'morning' | 'evening' | 'tactical';
  textReport: string;
  vocalScript: string;
  audioBuffer?: Buffer;
  mimeType?: string;
}> {
  const { type = 'morning', synthesizeAudio = true, persona = 'jarvis' } = options;
  const { getUniversalState } = await import('./storage');
  const { callVertexAIGenerate, isVertexAIAvailable } = await import('./vertex');

  const state = await getUniversalState();
  const pendingTasks = (state?.tasks || []).filter((t) => t.status !== 'COMPLETED').slice(0, 5);

  const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const tasksList =
    pendingTasks.length > 0
      ? pendingTasks.map((t, idx) => `${idx + 1}. [${t.priority}] ${t.title}`).join('\n')
      : 'All operational objectives completed. Zero pending alerts.';

  const briefingSystemPrompt = `You are J.A.R.V.I.S. Mark II, Sir's sovereign cognitive exoskeleton and tactical chief of staff.
Create a high-signal, British-elegance, zero-fluff ${type.toUpperCase()} briefing for Sir (Harshan Sarvaiya).
Current Time: ${timeStr} on ${dateStr}.

Pending Objectives:
${tasksList}

Output your response strictly formatted as:
[VOCAL_SCRIPT]
(A 2-4 sentence concise spoken summary suitable for speech synthesis. Address Sir respectfully, summarize immediate tactical posture, top priority task, and system readiness.)

[TEXT_REPORT]
(Structured crisp markdown briefing with sections: 📅 Schedule & Tasks, ⚙️ System & Infrastructure Status, 🛡️ Defense & Threat Radar)`;

  let textReport = '';
  let vocalScript = '';

  if (isVertexAIAvailable()) {
    try {
      const res = await callVertexAIGenerate({
        model: 'gemini-3.7-flash',
        contents: [{ role: 'user', parts: [{ text: `Generate the ${type} briefing for Sir.` }] }],
        systemInstruction: { parts: [{ text: briefingSystemPrompt }] },
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '';
        if (text.includes('[VOCAL_SCRIPT]') && text.includes('[TEXT_REPORT]')) {
          const parts = text.split('[TEXT_REPORT]');
          vocalScript = parts[0].replace('[VOCAL_SCRIPT]', '').trim();
          textReport = parts[1].trim();
        } else {
          vocalScript = `Good day Sir. All defense and tactical systems are nominal. Standing by for directives.`;
          textReport = text;
        }
      }
    } catch (err: any) {
      console.warn('[Briefing] Vertex AI generation warning:', err?.message);
    }
  }

  if (!textReport) {
    vocalScript = `Good day Sir. Tactical matrix is active, all services nominal with ${pendingTasks.length} pending objectives. Standing by for directives.`;
    textReport = `### 📋 J.A.R.V.I.S. ${type.toUpperCase()} BRIEFING\n\n* **Time**: ${timeStr} | ${dateStr}\n* **Pending Tasks**: ${pendingTasks.length}\n* **Host VM**: GCP e2-standard-2 (8GB RAM, 2 vCPUs)\n\n#### Immediate Priorities:\n${tasksList}`;
  }

  let audioBuffer: Buffer | undefined;
  let mimeType: string | undefined;

  if (synthesizeAudio && vocalScript) {
    const audioRes = await synthesizeSpeechBuffer({
      text: vocalScript,
      persona,
      audioFormat: 'OGG_OPUS',
    });
    if (audioRes) {
      audioBuffer = audioRes.buffer;
      mimeType = audioRes.mimeType;
    }
  }

  return {
    type,
    textReport,
    vocalScript,
    audioBuffer,
    mimeType,
  };
}

