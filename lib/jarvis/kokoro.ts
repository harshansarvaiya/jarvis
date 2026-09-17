/**
 * J.A.R.V.I.S. Mark II — Neural Kokoro-82M TTS Substrate
 * 
 * Open-Weight 82M Neural Text-to-Speech Engine
 * Runs locally on CPU via ONNX Runtime / transformers.js with zero external API costs.
 * 
 * Voice Profiles:
 * - ⚡ J.A.R.V.I.S. (Butler): 'bm_george' (Sophisticated British Male) / 'bm_fable'
 * - 🛡️ F.R.I.D.A.Y. (Tactical): 'bf_emma' (British Female) / 'af_bella' (High-Fidelity Tactical)
 * 
 * Directive 01 & 04 Enforced: 100% Western open weights, zero data exfiltration.
 */

import { KokoroTTS } from 'kokoro-js';

let ttsInstance: KokoroTTS | null = null;
let initPromise: Promise<KokoroTTS> | null = null;

/**
 * Strips markdown symbols, code blocks, URLs, and JSON blobs to prepare natural speech
 */
export function sanitizeTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    // Strip code blocks ```...```
    .replace(/```[\s\S]*?```/g, ' [Code execution block omitted] ')
    // Strip inline code `...`
    .replace(/`([^`]+)`/g, '$1')
    // Strip markdown images and links [label](url) -> label
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Strip URLs
    .replace(/https?:\/\/\S+/g, '')
    // Strip markdown formatting headers, bold, italics, strikethrough
    .replace(/^[#>]+\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    // Strip raw JSON/bracket blobs
    .replace(/\{[^{}]*\}/g, '')
    // Clean up duplicate spaces and newlines
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Initializes and caches the Kokoro-82M ONNX model singleton
 */
export async function getKokoroInstance(): Promise<KokoroTTS> {
  if (ttsInstance) return ttsInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[Kokoro-82M] Initializing ONNX TTS substrate on CPU...');
    const start = Date.now();
    try {
      const instance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: 'cpu',
      });
      ttsInstance = instance;
      console.log(`[Kokoro-82M] Substrate operational in ${Date.now() - start}ms.`);
      return instance;
    } catch (err) {
      console.error('[Kokoro-82M] Initialization failure:', err);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export interface SpeechSynthesisOptions {
  voice?: 'bm_george' | 'bm_daniel' | 'bm_fable' | 'bf_emma' | 'bf_isabella' | 'af_heart' | 'af_bella' | string;
  speed?: number;
  persona?: 'jarvis' | 'friday';
}

/**
 * Synthesizes natural speech from text and returns a raw WAV Buffer
 */
export async function synthesizeSpeech(
  rawText: string,
  options: SpeechSynthesisOptions = {}
): Promise<Buffer> {
  const cleanText = sanitizeTextForSpeech(rawText);
  if (!cleanText) {
    throw new Error('No synthesizable text provided.');
  }

  // Cap speech synthesis to 600 characters per single transmission to preserve CPU cycles
  const speechText = cleanText.length > 600 ? cleanText.slice(0, 597) + '...' : cleanText;

  const tts = await getKokoroInstance();

  // Voice mapping based on persona
  let selectedVoice = options.voice;
  if (!selectedVoice) {
    if (options.persona === 'friday') {
      selectedVoice = 'bf_emma'; // Crisp British Female OS
    } else {
      selectedVoice = 'bm_george'; // British Butler J.A.R.V.I.S.
    }
  }

  const audio = await tts.generate(speechText, {
    voice: selectedVoice as any,
  });

  const wavArrayBuffer = audio.toWav();
  return Buffer.from(wavArrayBuffer);
}
