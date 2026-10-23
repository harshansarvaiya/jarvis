/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. Movie-Fidelity Neural Speech Synthesis Substrate
 * Powered by Google Cloud Neural Text-to-Speech (GCP Vertex Enterprise Credits)
 * with Edge TTS secondary fallback.
 * 
 * Authentic Movie Personas:
 * - F.R.I.D.A.Y. (MCU Kerry Condon): en-GB-Neural2-F (Crisp British/Irish AI tone)
 * - J.A.R.V.I.S. (MCU Paul Bettany): en-GB-Neural2-D (Refined British Baritone)
 * - KHUSHI (Indic Conversational Persona): en-IN-Neural2-A (Natural Indian English)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { EdgeTTS } from 'node-edge-tts';
import { getVertexAccessToken } from './vertex';

export type VoicePersona = 'FRIDAY' | 'JARVIS' | 'KHUSHI';

export interface TTSVoiceConfig {
  voice: string;
  lang: string;
  googleVoice: string;
  googleLang: string;
  pitch?: string;
  rate?: string;
}

export const MOVIE_VOICE_CONFIGS: Record<VoicePersona, TTSVoiceConfig> = {
  // F.R.I.D.A.Y. — Kerry Condon MCU persona
  FRIDAY: {
    voice: 'en-IE-EmilyNeural',
    lang: 'en-IE',
    googleVoice: 'en-GB-Neural2-F',
    googleLang: 'en-GB',
    pitch: '+0Hz',
    rate: '+3%',
  },
  // J.A.R.V.I.S. — Paul Bettany British Baritone
  JARVIS: {
    voice: 'en-GB-RyanNeural',
    lang: 'en-GB',
    googleVoice: 'en-GB-Neural2-D',
    googleLang: 'en-GB',
    pitch: '-4Hz',
    rate: '+2%',
  },
  // KHUSHI — Natural Indic English Companion
  KHUSHI: {
    voice: 'en-IN-NeerjaNeural',
    lang: 'en-IN',
    googleVoice: 'en-IN-Neural2-A',
    googleLang: 'en-IN',
    pitch: '+0Hz',
    rate: '+2%',
  },
};

/**
 * Sanitizes markdown, codeblocks, emojis, and symbols into pristine spoken text.
 */
export function sanitizeTextForSpeech(rawText: string): string {
  if (!rawText) return '';

  return rawText
    .replace(/```[\s\S]*?```/g, ' Code block omitted for brevity. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/(\*\*|\*|__|_)/g, '')
    .replace(/^>\s*/gm, '')
    .replace(/^(\*|-|\d+\.)\s+/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Synthesizes speech using Google Cloud Neural TTS (Enterprise GCP Credits)
 */
async function synthesizeGoogleCloudTTS(
  text: string,
  persona: VoicePersona = 'FRIDAY'
): Promise<Buffer | null> {
  try {
    const token = await getVertexAccessToken();
    if (!token) return null;

    const cfg = MOVIE_VOICE_CONFIGS[persona] || MOVIE_VOICE_CONFIGS.FRIDAY;
    const projectId = process.env.GCP_PROJECT_ID || 'antigravity-cloud-runner';

    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-goog-user-project': projectId,
      },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: cfg.googleLang,
          name: cfg.googleVoice,
        },
        audioConfig: {
          audioEncoding: 'OGG_OPUS', // Native format for Telegram Voice Notes & Web Audio
          speakingRate: 1.05,
          pitch: persona === 'JARVIS' ? -2.0 : 0.0,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Google TTS] HTTP ${res.status}: ${errText.slice(0, 100)}`);
      return null;
    }

    const data = await res.json();
    if (data.audioContent) {
      return Buffer.from(data.audioContent, 'base64');
    }
    return null;
  } catch (err: any) {
    console.warn('[Google TTS] Synthesis warning:', err?.message || err);
    return null;
  }
}

/**
 * Synthesizes text into high-fidelity neural audio buffer matching movie personas.
 */
export async function synthesizeMovieVoice(
  text: string,
  persona: VoicePersona = 'FRIDAY',
  options?: { pitch?: string; rate?: string }
): Promise<Buffer | null> {
  const cleanSpoken = sanitizeTextForSpeech(text);
  if (!cleanSpoken) return null;

  const truncatedText = cleanSpoken.length > 600
    ? `${cleanSpoken.slice(0, 580)}... and more details are available in the briefing.`
    : cleanSpoken;

  // 1. Primary: Google Cloud Neural TTS (100% reliable on GCP & Vercel, zero 403 blocks)
  const googleBuffer = await synthesizeGoogleCloudTTS(truncatedText, persona);
  if (googleBuffer && googleBuffer.length > 0) {
    return googleBuffer;
  }

  // 2. Secondary Fallback: Edge TTS
  const cfg = MOVIE_VOICE_CONFIGS[persona] || MOVIE_VOICE_CONFIGS.FRIDAY;
  const tempPath = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);

  try {
    const tts = new EdgeTTS({
      voice: cfg.voice,
      lang: cfg.lang,
      pitch: options?.pitch || cfg.pitch,
      rate: options?.rate || cfg.rate,
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    });

    await tts.ttsPromise(truncatedText, tempPath);

    if (fs.existsSync(tempPath)) {
      const buffer = fs.readFileSync(tempPath);
      try { fs.unlinkSync(tempPath); } catch {}
      return buffer;
    }
    return null;
  } catch (err: any) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    return null;
  }
}
