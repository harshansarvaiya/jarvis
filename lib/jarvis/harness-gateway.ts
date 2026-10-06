/**
 * J.A.R.V.I.S. Mark II / F.R.I.D.A.Y. — Omnichannel Ingress Normalization Gateway
 * 
 * Inspired by TencentCloud/Octop's unified HarnessProcessor & Gateway architecture.
 * Normalizes all communication surfaces (Web PWA, Telegram Bot, Satellite RPC, CLI, Cron)
 * into a single unified event contract with pre-LLM PII sanitization, universal memory
 * assimilation, and deterministic model telemetry.
 */

import { runJarvisAgent } from './agent';
import { redactSecretsAndPii } from './security/secret-sentry';
import { appendUniversalChatMessages, ChatMessageRecord } from './storage';
import { recordChronicleMilestone } from './chronicles';

export interface UnifiedInboundMessage {
  channel: 'web' | 'telegram' | 'satellite' | 'cli' | 'cron';
  senderId: string;
  text: string;
  sessionId?: string;
  media?: Array<{ type: 'image' | 'audio' | 'document'; data: string; mimeType?: string }>;
  metadata?: Record<string, any>;
}

export interface UnifiedOutboundResponse {
  channel: string;
  reply: string;
  vocalSummary: string;
  tacticalActions: string[];
  telemetry: {
    engineUsed: string;
    model: string;
    provider: string;
    latencyMs: number;
    sanitizedTokensCount: number;
  };
  error?: string;
}

/**
 * Universal Ingress Dispatcher:
 * Handles incoming directives from ANY surface uniformly.
 */
export async function processOmnichannelMessage(
  inbound: UnifiedInboundMessage
): Promise<UnifiedOutboundResponse> {
  const startTime = Date.now();

  // 1. In-Flight Pre-Prompt PII & Credential Sanitization Sentry
  const sanitizeRes = redactSecretsAndPii(inbound.text || '');
  const cleanText = sanitizeRes.sanitized;

  if (sanitizeRes.redactedCount > 0) {
    console.log(
      `[Omnichannel Gateway] 🛡️ In-flight scrubbed ${sanitizeRes.redactedCount} secret/PII token(s) [${sanitizeRes.redactedTypes.join(', ')}] from ${inbound.channel} ingress.`
    );
  }

  // 2. Prepare chat message context
  const chatMessages = [
    {
      role: 'user' as const,
      content: cleanText,
      image: inbound.media?.find((m) => m.type === 'image')?.data,
    },
  ];

  // 3. Execute Sovereign Agent Pipeline (Vertex AI, Groq LPU, NVIDIA NIM, GitHub Models)
  const agentRes = await runJarvisAgent(chatMessages, {
    orchestrationMode: 'auto',
    model: 'gemini-3.7-flash',
  });

  const durationMs = Date.now() - startTime;

  // 4. Asynchronously persist to Universal Chat Stream & Chronicles
  const nowStr = new Date().toISOString();
  const recordsToSave: ChatMessageRecord[] = [
    {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: cleanText,
      timestamp: nowStr,
    },
    {
      id: `msg-${Date.now()}-a`,
      role: 'assistant',
      content: agentRes.reply,
      timestamp: new Date(Date.now() + 50).toISOString(),
    },
  ];

  appendUniversalChatMessages(recordsToSave).catch((err) =>
    console.warn('[Omnichannel Gateway] Storage sync warning:', err)
  );

  // Chronicle high-impact engineering or directive milestones
  if (
    cleanText.startsWith('/') ||
    cleanText.toLowerCase().includes('deploy') ||
    cleanText.toLowerCase().includes('build') ||
    cleanText.toLowerCase().includes('audit')
  ) {
    recordChronicleMilestone(
      `${inbound.channel.toUpperCase()}: ${cleanText.slice(0, 80)}`,
      { theme: 'Omnichannel Ingress Execution', stateOfMind: 'Sovereign Precision' }
    ).catch(() => {});
  }

  return {
    channel: inbound.channel,
    reply: agentRes.reply,
    vocalSummary: agentRes.vocalSummary,
    tacticalActions: agentRes.tacticalActions,
    telemetry: {
      engineUsed: agentRes.telemetry.engineUsed,
      model: agentRes.telemetry.model,
      provider: agentRes.telemetry.provider,
      latencyMs: durationMs,
      sanitizedTokensCount: sanitizeRes.redactedCount,
    },
    error: agentRes.error,
  };
}
