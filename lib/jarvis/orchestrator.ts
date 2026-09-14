/**
 * J.A.R.V.I.S. Cognitive Multi-Engine Orchestrator
 * 
 * Dynamically triages operational intent and dispatches directives to the optimal
 * neural engine based on speed, vision, reasoning depth, and quota efficiency:
 *  - Groq US LPU Silicon (OpenAI GPT-OSS-120B / 20B): Sub-second reflex speed (100–180ms)
 *  - Google Gemini 3.8 Flash: Multimodal perception & deep expansive synthesis
 * 
 * Injects execution telemetry, cinematic vocal summaries, and proactive tactical next-steps.
 */

export type OperationalArchetype = 'MULTIMODAL_PERCEPTION' | 'REFLEX_SPEED' | 'DEEP_SYNTHESIS';

export interface OrchestrationTelemetry {
  engineUsed: string;
  provider: 'groq' | 'google' | 'offline';
  model: string;
  latencyMs: number;
  archetype: OperationalArchetype;
  failoverOccurred: boolean;
  recalledEpisodesCount?: number;
}

export interface OrchestratedResult {
  reply: string;
  vocalSummary: string;
  tacticalActions: string[];
  toolCallsExecuted: Array<{ name: string; args: any; result: any }>;
  telemetry: OrchestrationTelemetry;
}

/**
 * Rapid zero-latency semantic intent classifier
 */
export function classifyOperationalIntent(
  userPrompt: string,
  hasImage: boolean
): { archetype: OperationalArchetype; reason: string } {
  if (hasImage) {
    return {
      archetype: 'MULTIMODAL_PERCEPTION',
      reason: 'Visual Sensor Input Detected — Routing to Gemini Multimodal Core.',
    };
  }

  const clean = userPrompt.toLowerCase().trim();

  // 1. Deep Synthesis & Strategic Reasoning Triggers
  const deepReasoningTriggers = [
    'red-team', 'adversarial', 'stress-test', 'sparring', 'deep analysis',
    'architect', 'strategic plan', 'comprehensive review', 'tradeoff',
    'security audit', 'break down in detail', 'synthesize findings'
  ];

  if (deepReasoningTriggers.some((t) => clean.includes(t)) || clean.length > 350) {
    return {
      archetype: 'DEEP_SYNTHESIS',
      reason: 'Complex Strategy / Analytical Depth Required — Routing to Gemini Expansive Core.',
    };
  }

  // 2. Reflex Speed Triggers (Sub-second responses for voice and quick operations)
  return {
    archetype: 'REFLEX_SPEED',
    reason: 'Conversational Reflex / Action Execution — Routing to Groq US LPU (0.1s).',
  };
}

/**
 * Extracts a concise, cinematic, British-toned vocal summary for speech synthesis (TTS),
 * preventing long markdown/code/tables from being spoken aloud.
 */
export function extractCinematicVocalSummary(fullReply: string): string {
  if (!fullReply) return 'Acknowledged, Sir.';

  // Strip code fences, tables, and markdown symbols
  const sanitized = fullReply
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\|[^\n]+\|/g, '')
    .replace(/[*#_`~\[\]]/g, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  // Grab the first two crisp sentences
  const sentences = sanitized.match(/[^.!?]+[.!?]+/g) || [sanitized];
  const summary = sentences.slice(0, 2).join(' ').trim();

  if (summary.length > 220) {
    return summary.slice(0, 217) + '...';
  }

  return summary || 'Directives acknowledged and executed, Sir.';
}

/**
 * Generates proactive "Chess Master" tactical next-action chips based on response context.
 */
export function generateTacticalNextActions(
  userPrompt: string,
  replyText: string,
  toolCalls: any[] = []
): string[] {
  const actions: string[] = [];
  const lowerQuery = userPrompt.toLowerCase();
  const lowerReply = replyText.toLowerCase();

  const hasTasksTool = toolCalls.some((tc) => tc.name?.includes('task'));
  const hasBriefingTool = toolCalls.some((tc) => tc.name?.includes('briefing'));

  if (hasTasksTool) {
    actions.push('Review Radar Tasks');
    actions.push('Set Due Date Reminder');
  } else if (hasBriefingTool) {
    actions.push('Focus On Priority 1');
    actions.push('Red-Team Current Objective');
  } else if (lowerQuery.includes('deploy') || lowerReply.includes('deploy') || lowerQuery.includes('vercel')) {
    actions.push('Verify Cloud Health');
    actions.push('Log Deployment Milestone');
  } else if (lowerQuery.includes('plan') || lowerQuery.includes('strategy')) {
    actions.push('Stress-Test Against Risks');
    actions.push('Commit Next Milestone');
  } else {
    // Default contextual accelerators
    actions.push('Tactical Briefing');
    actions.push('Scan Memory Vault');
  }

  return Array.from(new Set(actions)).slice(0, 3);
}
