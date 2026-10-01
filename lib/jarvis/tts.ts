/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. Movie-Fidelity Neural Speech Synthesis Substrate
 * Powered by Microsoft Azure Cloud Neural Speech (Edge TTS)
 * 100% Free, Zero API Keys Required, Zero VM Thrashing (Directive 06 Compliant)
 * 
 * Authentic Movie Personas:
 * - F.R.I.D.A.Y. (MCU Kerry Condon): en-IE-EmilyNeural (Warm Irish AI cadence)
 * - J.A.R.V.I.S. (MCU Paul Bettany): en-GB-RyanNeural [pitch: -4Hz, rate: +2%] (Refined British Baritone)
 * - KHUSHI (Indic Conversational Persona): en-IN-NeerjaNeural (Natural Hinglish/Indian English)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { EdgeTTS } from 'node-edge-tts';

export type VoicePersona = 'FRIDAY' | 'JARVIS' | 'KHUSHI';

export interface TTSVoiceConfig {
  voice: string;
  lang: string;
  pitch?: string;
  rate?: string;
}

export const MOVIE_VOICE_CONFIGS: Record<VoicePersona, TTSVoiceConfig> = {
  // Kerry Condon — Authentic Irish AI from Avengers: Age of Ultron / Infinity War / Endgame
  FRIDAY: {
    voice: 'en-IE-EmilyNeural',
    lang: 'en-IE',
    pitch: '+0Hz',
    rate: '+3%',
  },
  // Paul Bettany — Refined British Baritone from Iron Man 1-3 & The Avengers
  JARVIS: {
    voice: 'en-GB-RyanNeural',
    lang: 'en-GB',
    pitch: '-4Hz',
    rate: '+2%',
  },
  // Khushi — Conversational Indian English / Hinglish Companion
  KHUSHI: {
    voice: 'en-IN-NeerjaNeural',
    lang: 'en-IN',
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
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' Code block omitted for brevity. ')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bare URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    // Remove bold/italics asterisks and underscores
    .replace(/(\*\*|\*|__|_)/g, '')
    // Remove blockquotes
    .replace(/^>\s*/gm, '')
    // Remove bullet points / list numbers
    .replace(/^(\*|-|\d+\.)\s+/gm, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Clean up excessive whitespace and punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Synthesizes text into high-fidelity neural audio MP3 buffer matching movie personas.
 */
export async function synthesizeMovieVoice(
  text: string,
  persona: VoicePersona = 'FRIDAY',
  options?: { pitch?: string; rate?: string }
): Promise<Buffer | null> {
  const cleanSpoken = sanitizeTextForSpeech(text);
  if (!cleanSpoken) return null;

  // Truncate to speech-friendly length (up to 800 characters for vocal summaries)
  const truncatedText = cleanSpoken.length > 800
    ? `${cleanSpoken.slice(0, 780)}... and more details are available in the briefing.`
    : cleanSpoken;

  const cfg = MOVIE_VOICE_CONFIGS[persona] || MOVIE_VOICE_CONFIGS.FRIDAY;
  const tempPath = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);

  const activePitch = options?.pitch || cfg.pitch;
  const activeRate = options?.rate || cfg.rate;

  try {
    const tts = new EdgeTTS({
      voice: cfg.voice,
      lang: cfg.lang,
      pitch: activePitch,
      rate: activeRate,
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    });

    await tts.ttsPromise(truncatedText, tempPath);

    if (fs.existsSync(tempPath)) {
      const buffer = fs.readFileSync(tempPath);
      try {
        fs.unlinkSync(tempPath);
      } catch {}
      return buffer;
    }
    return null;
  } catch (err: any) {
    console.error(`[TTS Engine] Error synthesizing voice for ${persona}:`, err?.message || err);
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    return null;
  }
}
