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
export type ActivePersona = 'FRIDAY' | 'JARVIS';

export interface OrchestrationTelemetry {
  engineUsed: string;
  provider: 'groq' | 'google' | 'vertex-ai' | 'github-models' | 'offline';
  model: string;
  latencyMs: number;
  archetype: OperationalArchetype;
  failoverOccurred: boolean;
  recalledEpisodesCount?: number;
  motiveAnalysis?: string;
  persona?: ActivePersona;
}

export interface PreThoughtReasoningPass {
  unstatedMotive: string;
  targetEntities: string[];
  requiredToolChain: string[];
  riskVectors: string[];
  strategicPlan: string;
}

/**
 * Detects whether Sir is addressing F.R.I.D.A.Y. (Antigravity Apex)
 * or J.A.R.V.I.S. (Tactical Chief of Staff)
 */
export function detectActivePersona(prompt: string): { persona: ActivePersona; explicit: boolean } {
  const clean = prompt.toLowerCase();
  if (/\bfriday\b|\bf\.r\.i\.d\.a\.y\b/i.test(clean)) {
    return { persona: 'FRIDAY', explicit: true };
  }
  if (/\bjarvis\b|\bj\.a\.r\.v\.i\.s\b/i.test(clean)) {
    return { persona: 'JARVIS', explicit: true };
  }

  // Heuristic Auto-Triage:
  // Coding, bugs, debugging, architecture, refactoring, compiler, deep analysis -> FRIDAY
  const fridayTriggers = [
    'code', 'bug', 'fix', 'debug', 'refactor', 'compile', 'tsc', 'test',
    'function', 'file', 'architecture', 'system design', 'script', 'daemon',
    'endpoint', 'api', 'git', 'commit', 'pr', 'deep', 'antigravity', 'infra',
    'error', 'exception', 'stack trace', 'inspect', 'grep', 'search_workspace'
  ];
  if (fridayTriggers.some((t) => clean.includes(t))) {
    return { persona: 'FRIDAY', explicit: false };
  }

  // Routines, reminders, calendar, radar tasks, quick status -> JARVIS
  return { persona: 'JARVIS', explicit: false };
}

/**
 * Pre-Thought Reasoning Pass & Motive Deconstruction (Pillar 1)
 * Analyzes hidden user intent, entity requirements, and tool vectors before token synthesis.
 */
export function deconstructOperationalMotive(userPrompt: string): PreThoughtReasoningPass {
  const clean = userPrompt.toLowerCase().trim();
  const targetEntities: string[] = [];
  const requiredToolChain: string[] = [];
  const riskVectors: string[] = [];

  // Local & Healthcare entity extraction heuristics
  if (/physio|clinic|doctor|hospital|medical|rehab|treatment/i.test(clean)) {
    targetEntities.push('Healthcare Practitioners & Verified Local Clinics');
    requiredToolChain.push('search_web', 'read_web_page');
  }
  if (/cost|price|pricing|fee|charge|rate|inexpensive|cheap|package/i.test(clean)) {
    targetEntities.push('Quoted Per-Session Fees & Verified Pricing Breakdown');
  }
  if (/mira road|mumbai|near|location|address|distance|landmark/i.test(clean)) {
    targetEntities.push('Geo-targeted Local Addresses, Phone Numbers & Landmarks');
  }

  // System & Architecture execution heuristics
  if (/build|code|repo|github|file|terminal|script|daemon|task/i.test(clean)) {
    targetEntities.push('Physical Codebase & Infrastructure State');
    requiredToolChain.push('inspect_infrastructure', 'cloud_execute_command', 'cloud_write_file');
  }

  if (requiredToolChain.length === 0) {
    if (/find|search|lookup|where|who|what is/i.test(clean)) {
      requiredToolChain.push('search_web');
    }
  }

  const unstatedMotive = `Sir requires specific, empirical intelligence for: "${userPrompt.slice(0, 80)}". Must extract verified entity names, addresses, and price numbers rather than generic placeholders.`;

  return {
    unstatedMotive,
    targetEntities: targetEntities.length > 0 ? targetEntities : ['Specific Named Entities & Data Points'],
    requiredToolChain: requiredToolChain.length > 0 ? requiredToolChain : ['Direct Synthesis'],
    riskVectors,
    strategicPlan: `1. Deconstruct request into explicit entity targets.\n2. Execute tool chain (${requiredToolChain.join(' -> ') || 'Direct Synthesis'}).\n3. Enforce Entity-Specific Precision Standard in response.`,
  };
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

  // 0. Dual-Agent Call Sign / Technical Triage
  const { persona, explicit } = detectActivePersona(userPrompt);
  if (persona === 'FRIDAY') {
    return {
      archetype: 'DEEP_SYNTHESIS',
      reason: explicit
        ? 'Explicit Call Sign: F.R.I.D.A.Y. Engaged — Routing to Antigravity / Gemini 3.8 Apex Core.'
        : 'Technical Engineering / Coding Intent Detected — Routing to F.R.I.D.A.Y. Apex Core.',
    };
  }

  const clean = userPrompt.toLowerCase().trim();

  // 1. System Telemetry & Operational Reflex Triggers
  const reflexTriggers = [
    'status', 'telemetry', 'health', 'ping',
    'briefing', 'task', 'radar', 'memory', 'directive', 'protocol', 'storage'
  ];
  if (reflexTriggers.some((t) => clean.includes(t))) {
    return {
      archetype: 'REFLEX_SPEED',
      reason: 'System Telemetry / Operational Reflex — Routing to Groq US LPU (Sub-Second 0.1s).',
    };
  }

  // 2. Deep Synthesis & Strategic Reasoning Triggers
  const deepReasoningTriggers = [
    // Original strategic triggers
    'red-team', 'adversarial', 'stress-test', 'sparring', 'deep analysis',
    'architect a', 'strategic plan', 'comprehensive review', 'tradeoff analysis',
    'security audit', 'break down in detail', 'synthesize findings',
    // Cost, Financial & ROI Reasoning
    'cost', 'price', 'pricing', 'cheap', 'cheaper', 'expensive', 'budget',
    'roi', 'value', 'worth', 'investment', 'spend', 'afford',
    // Infrastructure, Cloud & Hardware
    'vm', 'virtual machine', 'cloud server', 'compute', 'instance',
    'hardware', 'server', 'cpu', 'gpu', 'ram', 'storage', 'disk',
    'aws', 'azure', 'gcp', 'oracle cloud', 'digitalocean', 'linode',
    // Comparison & Evaluation
    'compare', ' vs ', 'versus', 'benchmark', 'performance', 'difference',
    'which is better', 'should i use', 'best option',
    // Planning & Architecture
    'architect', 'design', 'infrastructure', 'roadmap', 'approach', 'plan',
    'how should', 'should we', 'what would', 'recommend',
    // Review & Analysis
    'review', 'audit', 'assess', 'evaluate', 'analyse', 'analyze',
    'explain', 'breakdown', 'understand', 'why does', 'how does',
  ];

  if (deepReasoningTriggers.some((t) => clean.includes(t)) || clean.length > 100) {
    return {
      archetype: 'DEEP_SYNTHESIS',
      reason: 'Complex Strategy / Analytical Depth Required — Routing to Gemini Expansive Core.',
    };
  }

  // 3. Conversational Reflex / Action Execution
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
