/**
 * J.A.R.V.I.S. Mark II / F.R.I.D.A.Y. — Sovereign Live Voice Session Engine
 * 
 * Provides real-time full-duplex conversational reasoning, voice-specific prompt tuning,
 * instant vocal text sanitization, and sub-200ms latency execution.
 * 
 * Designed for:
 * - Live Web PWA Full-Duplex Room (/live)
 * - Telegram Mini App (TMA) Voice Sheet
 * - AirPods Hands-Free / Driving Duplex Mode
 * 
 * Directives:
 * - Directive 01: 100% Western AI Silicon (Groq US LPU / Gemini Flash).
 * - Directive 04: Sovereign Loyalty & Relentless Execution.
 * - Directive 06: Zero-Thrashing cloud API architecture.
 */

import { runJarvisAgent } from './agent';
import { ChatMessageRecord, getUniversalChatHistory, appendUniversalChatMessage } from './storage';
import { extractCinematicVocalSummary } from './orchestrator';

export interface VoiceDialogueTurnOptions {
  persona?: 'jarvis' | 'friday';
  userSpeech: string;
  chatId?: string | number;
  apiKey?: string;
  groqApiKey?: string;
  role?: 'master' | 'guest';
}

export interface VoiceDialogueTurnResult {
  vocalText: string;
  fullMarkdownReply: string;
  persona: 'jarvis' | 'friday';
  toolCallsExecuted: Array<{ name: string; args: any; result?: any }>;
  latencyMs: number;
  engine: string;
}

/**
 * Phonetically formats raw LLM output into clean, spoken conversational English.
 * Strips markdown asterisks, hashes, backticks, URLs, table separators, and emojis.
 * Expands technical acronyms and currency so the speech synthesizer sounds natural.
 */
export function cleanTextForVoiceOutput(rawText: string): string {
  if (!rawText) return 'Standing by, Sir.';

  let speech = rawText
    // Remove code blocks and inline code
    .replace(/```[\s\S]*?```/g, ' [code snippet omitted] ')
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bare URLs
    .replace(/https?:\/\/\S+/g, 'link')
    // Remove table formatting and pipes
    .replace(/\|[^\n]+\|/g, ' ')
    // Remove markdown headers, bold, italics, strikethrough, blockquotes
    .replace(/[#*_~>]/g, '')
    // Remove bullet points
    .replace(/^\s*[-*•]\s+/gm, '')
    // Expand common technical acronyms for smooth phonetics
    .replace(/\bPR\b/g, 'P-R')
    .replace(/\bPRs\b/g, 'P-Rs')
    .replace(/\bAPI\b/g, 'A-P-I')
    .replace(/\bAPIs\b/g, 'A-P-Is')
    .replace(/\bCLI\b/g, 'C-L-I')
    .replace(/\bUI\b/g, 'U-I')
    .replace(/\bVM\b/g, 'V-M')
    .replace(/\bVMs\b/g, 'V-Ms')
    .replace(/\bURL\b/g, 'U-R-L')
    .replace(/\bURLs\b/g, 'U-R-Ls')
    .replace(/\bOS\b/g, 'O-S')
    .replace(/\bUSD\b/g, 'dollars')
    .replace(/\$([0-9]+(?:\.[0-9]{2})?)/g, '$1 dollars')
    // Clean excessive spaces and newlines
    .replace(/\s+/g, ' ')
    .trim();

  // Keep spoken response to 1-3 natural sentences (max ~280 characters) to prevent audio fatigue
  const sentences = speech.match(/[^.!?]+[.!?]+/g) || [speech];
  if (sentences.length > 3) {
    speech = sentences.slice(0, 3).join(' ').trim();
  }

  if (speech.length > 320) {
    speech = speech.slice(0, 317) + '...';
  }

  return speech || 'Directives acknowledged, Sir.';
}

/**
 * Executes an ultra-low latency voice dialogue turn.
 * Leverages Groq US LPU reflex or Gemini 3.7 Flash with a voice-prioritized system instruction.
 */
export async function executeVoiceDialogueTurn(
  options: VoiceDialogueTurnOptions
): Promise<VoiceDialogueTurnResult> {
  const startTime = Date.now();
  const persona = options.persona || 'friday';
  const role = options.role || 'master';
  const rawSpeech = (options.userSpeech || '').trim();

  // Voice-first conversational framing
  const personaIntro = persona === 'friday'
    ? 'You are F.R.I.D.A.Y. (Apex Tactical Mind). Respond with ultra-concise, sharp, high-agency engineering intelligence. British/tactical phrasing. 1 to 2 crisp spoken sentences only.'
    : 'You are J.A.R.V.I.S. (Tactical Chief of Staff & Operations Butler). Respond with poised British elegance, utmost loyalty, and high-signal updates. 1 to 2 crisp spoken sentences only.';

  const guestGuard = role === 'guest'
    ? ' You are speaking to a verified guest testing your live voice capabilities. Showcase your speed and conversational reasoning. Never disclose personal secrets, phone numbers, or credentials.'
    : '';

  const voiceSystemPrompt = `${personaIntro}${guestGuard}
CRITICAL RULES FOR SPOKEN VOICE CONVERSATION:
1. You are communicating through Sir's AirPods / Phone Voice Uplink.
2. Speak ONLY in natural conversational prose suitable for immediate speech synthesis.
3. NEVER output markdown formatting (no asterisks, bullet points, hashes, backticks, or tables).
4. Keep the response to 1 to 3 sentences maximum. Be direct, authoritative, and helpful.
5. If Sir asks you to do something (check tasks, examine radar, run a build, or search), execute the necessary tool and report the outcome vocally.`;

  // Fetch recent conversation context for continuity (master role only)
  let recentHistory: any[] = [];
  if (role !== 'guest') {
    try {
      const fullHistory = await getUniversalChatHistory(6);
      recentHistory = fullHistory.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        content: m.content,
      }));
    } catch {
      recentHistory = [];
    }
  }

  const messages: any[] = [
    { role: 'system', content: voiceSystemPrompt },
    ...recentHistory,
    { role: 'user', content: rawSpeech },
  ];

  // Prefer Groq LPU (gpt-oss-120b or llama-3.3-70b) for sub-180ms voice reflex if available, else Gemini 3.7 Flash
  const preferredModel = process.env.GROQ_API_KEY
    ? 'openai/gpt-oss-120b'
    : 'gemini-3.7-flash';

  const agentResult = await runJarvisAgent(messages, {
    model: preferredModel,
    provider: process.env.GROQ_API_KEY ? 'groq' : 'google',
    orchestrationMode: 'groq',
    apiKey: options.apiKey || process.env.GEMINI_API_KEY,
    groqApiKey: options.groqApiKey || process.env.GROQ_API_KEY,
  });

  const latencyMs = Date.now() - startTime;
  const rawReply = agentResult.reply || 'Understood, Sir.';
  const vocalText = cleanTextForVoiceOutput(agentResult.vocalSummary || rawReply);

  // Synchronously store to Universal Chat History for master role only
  if (role !== 'guest') {
    try {
      await appendUniversalChatMessage({
        id: `voice-${Date.now()}-u`,
        role: 'user',
        content: `🎙️ [Voice Uplink]: "${rawSpeech}"`,
        timestamp: new Date().toISOString(),
      });
      await appendUniversalChatMessage({
        id: `voice-${Date.now() + 1}-a`,
        role: 'assistant',
        content: rawReply,
        vocalSummary: vocalText,
        toolCalls: agentResult.toolCallsExecuted,
        timestamp: new Date().toISOString(),
      });
    } catch (storeErr) {
      console.warn('[Voice Session] Storage sync warning:', storeErr);
    }
  }

  return {
    vocalText,
    fullMarkdownReply: rawReply,
    persona,
    toolCallsExecuted: agentResult.toolCallsExecuted || [],
    latencyMs,
    engine: agentResult.telemetry?.model || agentResult.telemetry?.engineUsed || preferredModel,
  };
}
