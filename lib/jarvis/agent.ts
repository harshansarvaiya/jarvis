import { JARVIS_SYSTEM_PROMPT, CORE_DIRECTIVES, validateActionAgainstDirectives } from './directives';
import { getTasks, getMemories, addMemory, recordEvolution } from './memory';
import { JARVIS_TOOLS, executeJarvisTool } from './tools';
import { findCorrelatedEpisodes, formatRecalledEpisodesPrompt } from './recall';
import { queryKnowledgeBase, formatKnowledgePromptContext } from './rag';
import { isVertexAIAvailable, callVertexAIGenerate, mapToVertexModel } from './vertex';
import {
  classifyOperationalIntent,
  deconstructOperationalMotive,
  extractCinematicVocalSummary,
  generateTacticalNextActions,
  generateSpeculativeDraft,
  OperationalArchetype,
  OrchestrationTelemetry,
  detectActivePersona,
  ActivePersona,
} from './orchestrator';
import { appendUniversalChatMessage, appendAgentChatMessage, getCrossChannelContext } from './storage';
import { getPersonaConfig, buildPersonaPromptBlock } from './persona';
import { compressSystemPrompt, compressToolOutput } from './compression';

import { getSpecializedAgentProfile, selectOptimalSubagent } from './agents-registry';
import { sanitizeInboundText } from './security/shield';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'model' | 'system' | 'assistant';
  content: string;
  image?: string; // Base64 data URL if multimodal
  toolCalls?: Array<{
    id?: string;
    name: string;
    args: Record<string, any>;
    result?: any;
  }>;
  timestamp?: string;
}

export interface JarvisAgentOptions {
  apiKey?: string;
  model?: string;
  stream?: boolean;
  groqApiKey?: string;
  githubToken?: string;
  nvidiaApiKey?: string;
  openrouterApiKey?: string;
  provider?: 'google' | 'groq' | 'github-models' | 'openai' | 'nvidia' | 'openrouter' | 'auto';
  orchestrationMode?: 'auto' | 'groq' | 'gemini' | 'nvidia' | 'openrouter' | 'manual';
  specializedAgentId?: string;
}

export function normalizeModel(m?: string): string {
  if (!m) return 'gemini-3.7-flash';
  const clean = m.trim().toLowerCase();
  if (clean.startsWith('nvidia/') || clean.startsWith('nim/') || clean.startsWith('openrouter/')) return clean;
  if (clean.includes('120b') || clean.includes('gpt-oss-120b')) return 'openai/gpt-oss-120b';
  if (clean.includes('20b') || clean.includes('gpt-oss-20b')) return 'openai/gpt-oss-20b';
  if (clean.includes('compound-mini')) return 'groq/compound-mini';
  if (clean.includes('compound')) return 'groq/compound';
  if (clean.includes('llama-3.3') || clean.includes('llama-70b') || clean === 'llama') return 'openai/gpt-oss-120b';
  if (clean.includes('llama-3.1') || clean.includes('llama-8b')) return 'openai/gpt-oss-120b';
  if (clean.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (clean.includes('gpt-4') || clean === 'gpt') return 'gpt-4o';
  if (clean.includes('3.8')) return 'gemini-3.8-flash';
  if (clean.includes('3.7')) return 'gemini-3.7-flash';
  if (clean.includes('3.6')) return 'gemini-3.6-flash';
  if (clean.includes('3.5')) return 'gemini-3.5-flash';
  if (clean.includes('3.1-pro') || (clean.includes('3.1') && clean.includes('pro'))) return 'gemini-3.1-pro-preview';
  if (clean.includes('3.1')) return 'gemini-3.1-flash-lite';
  if (clean.includes('2.5-pro') || (clean.includes('2.5') && clean.includes('pro'))) return 'gemini-2.5-pro';
  if (clean.includes('2.5')) return 'gemini-2.5-flash';
  if (clean.includes('flash-latest')) return 'gemini-flash-latest';
  if (clean.includes('pro-latest')) return 'gemini-pro-latest';
  if (clean.includes('2.0') || clean.includes('1.5') || clean === 'gemini-flash') {
    return 'gemini-2.5-flash';
  }
  return clean;
}

/**
 * Stepwise Quantum Fallback Hierarchy for Gemini
 */
export function getModelFallbackHierarchy(requestedModel: string): string[] {
  // Ordered by confirmed HTTP 200 availability (empirically verified 2026-09-15)
  const masterHierarchy = [
    'gemini-3.7-flash',          // PRIMARY — HTTP 200 confirmed live
    'gemini-flash-lite-latest',  // SECONDARY — HTTP 200 confirmed live
    'gemini-3.1-flash-lite',     // TERTIARY — HTTP 200 confirmed live
    'gemini-3.5-flash-lite',     // QUATERNARY — HTTP 200 confirmed live
    'gemini-3-flash-preview',    // QUINARY — fallback
    'gemini-3.8-flash',          // LAST — quota may clear between calls
  ];

  const primary = normalizeModel(requestedModel);
  const startIndex = masterHierarchy.indexOf(primary);

  if (startIndex !== -1) {
    const rotated = [
      ...masterHierarchy.slice(startIndex),
      ...masterHierarchy.slice(0, startIndex),
    ];
    return rotated;
  }

  return [primary, ...masterHierarchy].filter((v, i, a) => a.indexOf(v) === i);
}

export async function runJarvisAgent(
  messages: ChatMessage[],
  options: JarvisAgentOptions = {}
): Promise<{
  reply: string;
  vocalSummary: string;
  tacticalActions: string[];
  toolCallsExecuted: Array<{ name: string; args: any; result: any }>;
  motiveAnalysis?: string;
  internalThoughts?: string;
  telemetry: OrchestrationTelemetry;
  error?: string;
}> {
  const startTime = Date.now();
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
  const groqKey = options.groqApiKey || process.env.GROQ_API_KEY || '';
  const githubKey = options.githubToken || process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN || '';
  const nvidiaKey = options.nvidiaApiKey || process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || '';
  const openrouterKey = options.openrouterApiKey || process.env.OPENROUTER_API_KEY || '';
  const requestedModel = normalizeModel(options.model || 'gemini-3.7-flash');
  const orchestrationMode = options.orchestrationMode || 'auto';

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) {
    return {
      reply: 'Sir, I did not detect an operational directive.',
      vocalSummary: 'No operational directive detected, Sir.',
      tacticalActions: ['Tactical Briefing', 'Review Radar Tasks'],
      toolCallsExecuted: [],
      telemetry: {
        engineUsed: 'Idle Sentry',
        provider: 'offline',
        model: 'none',
        latencyMs: 1,
        archetype: 'REFLEX_SPEED',
        failoverOccurred: false,
      },
    };
  }

  // 1. AgentShield Inbound Firewall (Directive 01 Guardian Protocol)
  const shieldResult = sanitizeInboundText(lastUserMessage.content);
  if (shieldResult.threatDetected) {
    console.warn(`[AgentShield Sentry] 🛡️ Neutralized inbound prompt injection threat (Risk=${shieldResult.riskScore}):`, shieldResult.flags);
    lastUserMessage.content = shieldResult.sanitized;
  }

  // 1.1 Safety & Directive Check (Guardian Protocol)
  const directiveCheck = validateActionAgainstDirectives(lastUserMessage.content);
  if (!directiveCheck.allowed) {
    const reply = `Sir, I must respectfully halt this operation under **[${directiveCheck.violatedDirective?.name}]**: ${directiveCheck.reason}. My prime mandate is to protect your security and well-being.`;
    return {
      reply,
      vocalSummary: `Operation halted under Guardian Protocol, Sir.`,
      tacticalActions: ['Review Protocols', 'Report Threat Vector'],
      toolCallsExecuted: [],
      telemetry: {
        engineUsed: 'Guardian Protocol Sentry',
        provider: 'offline',
        model: 'sentry-core',
        latencyMs: Date.now() - startTime,
        archetype: 'REFLEX_SPEED',
        failoverOccurred: false,
        recalledEpisodesCount: 0,
      },
    };
  }

  // 2. Persona Detection & 4-Tier Cognitive Recall
  const { persona, explicit: personaExplicit } = detectActivePersona(lastUserMessage.content);

  let recalledEpisodes: any[] = [];
  let cognitiveContextPrompt = '';
  let retrievedKnowledgeContext = '';
  try {
    const isSimpleMessage = lastUserMessage.content.length < 40 && !/remember|recall|history|what did|search|find|how|rule|recipe|run|test|build/i.test(lastUserMessage.content);
    if (!isSimpleMessage) {
      const { recallCognitiveContext } = await import('./recall');
      const [cognitiveRecall, knowledgeChunks, crossChannel] = await Promise.all([
        recallCognitiveContext(lastUserMessage.content, { excludeIds: [lastUserMessage.id || ''] }),
        queryKnowledgeBase(lastUserMessage.content, { topK: 3, minScore: 0.35, apiKey }),
        getCrossChannelContext(persona === 'FRIDAY' ? 'friday' : 'jarvis', 8),
      ]);
      recalledEpisodes = cognitiveRecall.episodicEpisodes;
      if (cognitiveRecall.distilledPromptBlock) {
        cognitiveContextPrompt = `\n${cognitiveRecall.distilledPromptBlock}\n`;
      }
      if (knowledgeChunks && knowledgeChunks.length > 0) {
        retrievedKnowledgeContext = formatKnowledgePromptContext(knowledgeChunks);
      }
      if (crossChannel) {
        retrievedKnowledgeContext += crossChannel;
      }
    }
  } catch (recallErr) {
    console.warn('[Agent] Cognitive recall warning:', recallErr);
  }

  // 3. Synthesize Active State Context & Pre-Thought Motive Pass (Pillar 1: Working Memory)
  const allTasks = getTasks();
  const activeTasks = allTasks.filter((t) => t.status !== 'COMPLETED').slice(0, 8);
  const completedTasks = allTasks.filter((t) => t.status === 'COMPLETED').slice(0, 5);
  const motivePass = deconstructOperationalMotive(lastUserMessage.content);


  let skillsContext = '';
  try {
    const { matchRelevantSkills, formatSkillCatalogPrompt } = await import('./skills');
    const matched = matchRelevantSkills(lastUserMessage.content, 2);
    if (matched.length > 0) {
      skillsContext = `\n[ACTIVATED SKILL PLAYBOOKS]:\n${matched.map((s) => `### Skill: ${s.metadata.name}\n${s.content}`).join('\n\n')}\n`;
    }
    const catalog = formatSkillCatalogPrompt();
    if (catalog) skillsContext += catalog;
  } catch (skillsErr) {
    console.warn('[Agent] Skills loading warning:', skillsErr);
  }

  // 3.6. Load User-Customized Dynamic Persona Substrate
  let personaPromptBlock = '';
  try {
    const personaConfig = await getPersonaConfig();
    personaPromptBlock = buildPersonaPromptBlock(personaConfig, persona);
  } catch (personaErr) {
    console.warn('[Agent] Persona config loading warning:', personaErr);
  }

  // 3.7. Autonomous & Explicit Specialized Subagent Assignment (Inspired by ECC & gstack)
  let specializedAgentBlock = '';
  const delegatedAgent = options.specializedAgentId
    ? getSpecializedAgentProfile(options.specializedAgentId)
    : selectOptimalSubagent(lastUserMessage.content);

  if (delegatedAgent) {
    specializedAgentBlock = `
[AUTONOMOUS SUBAGENT DELEGATION ACTIVE]:
- Delegated Specialist: ${delegatedAgent.name} (Role: ${delegatedAgent.role}, Category: ${delegatedAgent.category})
- Specialized Mission & Standard: ${delegatedAgent.systemPrompt}
- Prioritized Domain Tools: ${delegatedAgent.tools.join(', ')}
You (${persona === 'FRIDAY' ? 'F.R.I.D.A.Y.' : 'J.A.R.V.I.S.'}) have autonomously engaged this specialist. Fulfill the directive embodying the depth, rigor, and verified domain expertise of this subagent.`;
  }

  const contextPrompt = `
[CURRENT TEMPORAL CONTEXT]: ${new Date().toISOString()} (Local time: ${new Date().toLocaleString()})
${personaPromptBlock}
${specializedAgentBlock}

[TIER 1 - WORKING MEMORY & PRE-THOUGHT REASONING PASS]:
- Unstated Motive: ${motivePass.unstatedMotive}
- Target Entities Required: ${motivePass.targetEntities.join(', ')}
- Tactical Plan: ${motivePass.strategicPlan}

[ACTIVE TASKS ON RADAR]:
${activeTasks.map((t) => `- [${t.priority}] ${t.title} (ID: ${t.id}, Status: ${t.status}${t.dueDate ? `, Due: ${t.dueDate}` : ''})`).join('\n') || 'No active pending tasks.'}

[RECENT COMPLETED TASKS & ACHIEVEMENTS]:
${completedTasks.map((t) => `- [COMPLETED] ${t.title} (ID: ${t.id}${t.completedAt ? `, Completed: ${t.completedAt}` : ''})`).join('\n') || 'No recently completed tasks recorded.'}
${cognitiveContextPrompt}
${retrievedKnowledgeContext}
${skillsContext}
[CREATOR IDENTITY & CONTEXTUAL GATING]:
- Creator: Sir (Harshan Kishor Sarvaiya), Java Full Stack Developer & Backend Consultant (Morgan Stanley via Wissen Tech), Mumbai (IST, UTC+5:30).
- CRITICAL CONTEXTUAL GATING RULE: Sir's professional engineering stack (Java, Spring Boot, Microservices, Kafka, Redis, SQL) and personal lifestyle (M/W/F office, 10k steps, vegetarian nutrition) are background context. DO NOT shoehorn or force his developer profile or personal routines into unrelated prompts (e.g. when discussing J.A.R.V.I.S. substrate architecture, Next.js, Telegram, general research, or general tasks). Only activate developer or lifestyle context when Sir explicitly touches upon backend engineering, system design, interview preparation, work scheduling, or fitness.

[DIRECTIVE ENFORCEMENT]:
${CORE_DIRECTIVES.map((d) => `- ${d.name}: ${d.statement}`).join('\n')}
`;

  // 4. Intent Classification & Cognitive Dispatch Decision
  const hasImage = Boolean(lastUserMessage.image && lastUserMessage.image.includes(';base64,'));
  const { archetype, reason } = classifyOperationalIntent(lastUserMessage.content, hasImage);

  // Upgrade 3: Speculative Fast Reasoning Draft (Groq LPU -> Frontier Synthesis)
  let speculativeDraftPrompt = '';
  if (groqKey && (persona === 'FRIDAY' || archetype === 'DEEP_SYNTHESIS')) {
    try {
      const spec = await generateSpeculativeDraft(lastUserMessage.content, { groqApiKey: groqKey, timeoutMs: 600 });
      if (spec && spec.draft) {
        speculativeDraftPrompt = `\n[SPECULATIVE LPU REASONING DRAFT (${spec.latencyMs}ms)]:\n${spec.draft}\nUse this fast hypothesis as a pre-computed strategic scaffold to accelerate your verified synthesis.\n`;
      }
    } catch {}
  }

  // Upgrade 4: Dynamic Needle Packing & Context Compression
  const uncompressedPrompt = `${JARVIS_SYSTEM_PROMPT}\n\n${contextPrompt}${speculativeDraftPrompt}`;
  const fullSystemPrompt = compressSystemPrompt(uncompressedPrompt);

  const shouldPreferGroq =
    groqKey &&
    persona !== 'FRIDAY' && // Friday ALWAYS engages the Apex Core (Vertex AI / Antigravity)
    (orchestrationMode === 'groq' ||
      requestedModel.startsWith('openai/') ||
      requestedModel.startsWith('groq/') ||
      (orchestrationMode === 'auto' && archetype === 'REFLEX_SPEED' && !hasImage));

  // =========================================================================
  // ROUTE A: GROQ US LPU REFLEX ENGINE (Sub-Second 100–180ms Dispatch)
  // =========================================================================
  if (shouldPreferGroq) {
    try {
      const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
      const primaryModel = requestedModel.startsWith('openai/') || requestedModel.startsWith('groq/')
        ? requestedModel
        : 'openai/gpt-oss-120b';

      const groqCandidates = [
        primaryModel,
        'openai/gpt-oss-120b',
        // NOTE: gpt-oss-20b PERMANENTLY EXCISED — hallucinates + produces robotic tables (2026-09-15)
        // NOTE: groq/compound-mini EXCISED — no tool call support
      ].filter((v, i, a) => a.indexOf(v) === i);

      // Prepare lean reflex prompt for Groq (strictly enforcing <3,000 tokens to protect 8,000 TPM limit)
      const groqSystemPrompt = fullSystemPrompt.length > 3500
        ? `${JARVIS_SYSTEM_PROMPT.slice(0, 1500)}\n\n${personaPromptBlock}\n[CURRENT TIME]: ${new Date().toISOString()}\n[ACTIVE DIRECTIVES]: Protect Sir at all costs. Concise high-signal execution.`
        : fullSystemPrompt;

      for (const groqModel of groqCandidates) {
        try {
          const groqResult = await runOpenAICompatibleAgent(messages.slice(-4), {
            endpoint: 'https://api.groq.com/openai/v1/chat/completions',
            apiKey: groqKey,
            model: groqModel,
            systemPrompt: groqSystemPrompt,
            maxTokens: 1024,
          });

          if (groqResult && !groqResult.error && groqResult.reply) {
            const latencyMs = Date.now() - startTime;
            return {
              reply: groqResult.reply,
              vocalSummary: extractCinematicVocalSummary(groqResult.reply),
              tacticalActions: generateTacticalNextActions(lastUserMessage.content, groqResult.reply, groqResult.toolCallsExecuted),
              toolCallsExecuted: groqResult.toolCallsExecuted,
              telemetry: {
                engineUsed: `Groq US LPU Core (${groqModel})`,
                provider: 'groq',
                model: groqModel,
                latencyMs,
                archetype,
                failoverOccurred: groqModel !== primaryModel,
                recalledEpisodesCount: recalledEpisodes.length,
              },
            };
          }
        } catch (err: any) {
          console.warn(`[Groq Cascade] Model ${groqModel} failed:`, err?.message);
          continue;
        }
      }
    } catch (groqErr) {
      console.warn('[Groq Engine] Non-fatal failure, escalating to Tier 2:', groqErr);
    }
  }

  // =========================================================================
  // ROUTE B: GITHUB MODELS / OPENAI DIRECT (Sovereign Dual-Key Cloud Pool)
  // =========================================================================
  if (requestedModel.startsWith('gpt-') || options.provider === 'github-models' || options.provider === 'openai') {
    const githubKey = options.githubToken || process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_API_KEY;
    if (githubKey) {
      const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
      const ghResult = await runOpenAICompatibleAgent(messages, {
        endpoint: 'https://models.inference.ai.azure.com',
        apiKey: githubKey,
        model: requestedModel || 'gpt-4o',
        systemPrompt: fullSystemPrompt,
      });

      if (!ghResult.error && ghResult.reply) {
        const latencyMs = Date.now() - startTime;
        return {
          reply: ghResult.reply,
          vocalSummary: extractCinematicVocalSummary(ghResult.reply),
          tacticalActions: generateTacticalNextActions(lastUserMessage.content, ghResult.reply, ghResult.toolCallsExecuted),
          toolCallsExecuted: ghResult.toolCallsExecuted,
          telemetry: {
            engineUsed: `GitHub Models (${requestedModel || 'gpt-4o'})`,
            provider: 'github-models',
            model: requestedModel || 'gpt-4o',
            latencyMs,
            archetype,
            failoverOccurred: false,
            recalledEpisodesCount: recalledEpisodes.length,
          },
        };
      }
    }
  }

  // =========================================================================
  // ROUTE B.2: NVIDIA NIM (Enterprise H100 GPU Microservices)
  // =========================================================================
  if (requestedModel.startsWith('nvidia/') || requestedModel.startsWith('nim/') || options.provider === 'nvidia' || options.orchestrationMode === 'nvidia') {
    if (nvidiaKey) {
      const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
      const nimModel = requestedModel.replace(/^(nvidia\/|nim\/)/, '') || 'meta/llama-3.2-90b-vision-instruct';
      const nimResult = await runOpenAICompatibleAgent(messages, {
        endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
        apiKey: nvidiaKey,
        model: nimModel,
        systemPrompt: fullSystemPrompt,
      });

      if (!nimResult.error && nimResult.reply) {
        const latencyMs = Date.now() - startTime;
        return {
          reply: nimResult.reply,
          vocalSummary: extractCinematicVocalSummary(nimResult.reply),
          tacticalActions: generateTacticalNextActions(lastUserMessage.content, nimResult.reply, nimResult.toolCallsExecuted),
          toolCallsExecuted: nimResult.toolCallsExecuted,
          telemetry: {
            engineUsed: `NVIDIA NIM (${nimModel})`,
            provider: 'groq', // open-weights
            model: nimModel,
            latencyMs,
            archetype,
            failoverOccurred: false,
            recalledEpisodesCount: recalledEpisodes.length,
          },
        };
      }
    }
  }

  // =========================================================================
  // ROUTE B.3: OPENROUTER (Universal Global API Gateway & Free Tier Pool)
  // =========================================================================
  if (requestedModel.startsWith('openrouter/') || options.provider === 'openrouter' || options.orchestrationMode === 'openrouter') {
    if (openrouterKey) {
      const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
      const routerModel = requestedModel.replace(/^openrouter\//, '') || 'nvidia/nemotron-3-super-120b-a12b:free';
      const routerResult = await runOpenAICompatibleAgent(messages, {
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: openrouterKey,
        model: routerModel,
        systemPrompt: fullSystemPrompt,
        extraHeaders: {
          'HTTP-Referer': 'https://github.com/harshansarvaiya/jarvis',
          'X-Title': 'J.A.R.V.I.S. Mark II',
        },
      });

      if (!routerResult.error && routerResult.reply) {
        const latencyMs = Date.now() - startTime;
        return {
          reply: routerResult.reply,
          vocalSummary: extractCinematicVocalSummary(routerResult.reply),
          tacticalActions: generateTacticalNextActions(lastUserMessage.content, routerResult.reply, routerResult.toolCallsExecuted),
          toolCallsExecuted: routerResult.toolCallsExecuted,
          telemetry: {
            engineUsed: `OpenRouter (${routerModel})`,
            provider: 'groq',
            model: routerModel,
            latencyMs,
            archetype,
            failoverOccurred: false,
            recalledEpisodesCount: recalledEpisodes.length,
          },
        };
      }
    }
  }

  // =========================================================================
  // ROUTE C: GOOGLE GEMINI CORE (Multimodal & Deep Strategic Synthesis)
  // =========================================================================
  if (!apiKey && !isVertexAIAvailable()) {
    // If no Gemini key, but Groq key is available, execute on Groq
    if (groqKey) {
      const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
      const groqResult = await runOpenAICompatibleAgent(messages, {
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: groqKey,
        model: 'openai/gpt-oss-120b',
        systemPrompt: fullSystemPrompt,
      });
      const latencyMs = Date.now() - startTime;
      return {
        reply: groqResult.reply,
        vocalSummary: extractCinematicVocalSummary(groqResult.reply),
        tacticalActions: generateTacticalNextActions(lastUserMessage.content, groqResult.reply, groqResult.toolCallsExecuted),
        toolCallsExecuted: groqResult.toolCallsExecuted,
        telemetry: {
          engineUsed: 'Groq US LPU Core (Primary)',
          provider: 'groq',
          model: 'openai/gpt-oss-120b',
          latencyMs,
          archetype,
          failoverOccurred: false,
          recalledEpisodesCount: recalledEpisodes.length,
        },
      };
    }
    const offline = await handleOfflineJarvisResponse(lastUserMessage.content, activeTasks);
    return {
      reply: offline.reply,
      vocalSummary: extractCinematicVocalSummary(offline.reply),
      tacticalActions: ['Tactical Briefing', 'Review Radar Tasks'],
      toolCallsExecuted: offline.toolCallsExecuted,
      telemetry: {
        engineUsed: 'Offline Core',
        provider: 'offline',
        model: 'local-heuristics',
        latencyMs: Date.now() - startTime,
        archetype: 'REFLEX_SPEED',
        failoverOccurred: false,
        recalledEpisodesCount: 0,
      },
    };
  }

  try {
    const geminiTools = [
      {
        functionDeclarations: JARVIS_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ];

    const contents: any[] = [];
    const generationTemperature = archetype === 'DEEP_SYNTHESIS' ? 0.6 : 0.5;

    const systemInstruction = {
      parts: [
        {
          text: `${personaPromptBlock}\n\n${JARVIS_SYSTEM_PROMPT}\n\n${contextPrompt}\n\n[MANDATORY FINAL ANCHOR]: Speak directly to Sir as ${persona}. Fluid natural paragraphs. Strictly ban textbook listicles and newsletter headings.`,
        },
      ],
    };

    // Performance Mode Context Window (Up to 24 messages, 4000 char clamping on older turns)
    // Slashes token constraints using Vertex AI 1M+ token capacity and ₹33,435+ credit pool
    const contextDepth = isVertexAIAvailable() ? 24 : 12;
    const charClamp = isVertexAIAvailable() ? 4000 : 1500;
    const recentMessages = messages.slice(-contextDepth);
    for (let i = 0; i < recentMessages.length; i++) {
      const msg = recentMessages[i];
      const role = msg.role === 'assistant' ? 'model' : msg.role;
      const isRecent = i >= recentMessages.length - 4;
      const contentText = isRecent ? (msg.content || '') : (msg.content || '').slice(0, charClamp);
      const parts: any[] = [{ text: contentText }];
      if (isRecent && msg.image && msg.image.includes(';base64,')) {
        const [meta, base64Data] = msg.image.split(';base64,');
        const mimeType = meta.replace('data:', '');
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }
      contents.push({ role, parts });
    }

    const candidateModels = getModelFallbackHierarchy(requestedModel);

    let response: Response | null = null;
    let activeApiUrl = '';
    let lastErrorText = '';
    let selectedModel = candidateModels[0] || 'gemini-3.7-flash';
    let attemptsCount = 0;
    const MAX_GEMINI_ATTEMPTS = 6; // Must cover full hierarchy depth (6 models)

    let isVertexEngine = false;
    let selectedVertexModel = '';

    // Tier 1 Primary: Google Cloud Vertex AI (Draws 100% from ₹33,435+ GCP Credits)
    if (isVertexAIAvailable()) {
      const primaryCandidate = mapToVertexModel(requestedModel).model;
      const vertexCandidates = [
        primaryCandidate,
        'gemini-3.7-flash',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
      ].filter((v, i, a) => a.indexOf(v) === i);

      for (const vertexCandidate of vertexCandidates) {
        try {
          console.log(`[Vertex AI] Invoking enterprise endpoint for model: ${vertexCandidate}...`);
          const vRes = await callVertexAIGenerate({
            model: vertexCandidate,
            contents,
            systemInstruction,
            tools: geminiTools,
            generationConfig: {
              temperature: generationTemperature,
              maxOutputTokens: 4096,
              thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: 2048,
              },
            },
            signal: AbortSignal.timeout(180000),
          });

          if (vRes.ok) {
            response = vRes;
            isVertexEngine = true;
            selectedVertexModel = vertexCandidate;
            selectedModel = vertexCandidate;
            console.log(`[Vertex AI] Success with ${vertexCandidate} (GCP Credits active)`);
            break;
          } else {
            const errText = await vRes.text();
            console.warn(`[Vertex AI] Call failed for ${vertexCandidate} (${vRes.status}):`, errText.slice(0, 150));
          }
        } catch (vErr: any) {
          console.warn(`[Vertex AI] Execution error for ${vertexCandidate}:`, vErr?.message);
        }
      }
    }

    if (!response || !response.ok) {
      for (const candidateModel of candidateModels) {
      if (attemptsCount >= MAX_GEMINI_ATTEMPTS) {
        console.warn(`[Quantum Fallback] Reached max Gemini attempts (${MAX_GEMINI_ATTEMPTS}). Cascading to Groq US LPU.`);
        break;
      }
      if (attemptsCount > 0) {
        // 200ms gentle breathing delay to prevent burst rate limiters from tripping
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      attemptsCount++;

      const generationConfig = {
        temperature: generationTemperature,
        maxOutputTokens: 4096,
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${apiKey}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction,
            tools: geminiTools,
            generationConfig,
          }),
          signal: AbortSignal.timeout(6000), // Increased from 2500ms to 6000ms for reliable synthesis
        });

        if (res.ok) {
          response = res;
          activeApiUrl = url;
          selectedModel = candidateModel;
          break;
        }

        lastErrorText = await res.text();
        console.warn(`[Quantum Fallback] Model ${candidateModel} failed with HTTP ${res.status}:`, lastErrorText.slice(0, 150));

        // If 429 Quota Exceeded on this model: Log warning and continue to next Gemini model in hierarchy
        if (res.status === 429) {
          console.warn(`[Quantum Fallback] Gemini API Quota Exceeded (429) on ${candidateModel}. Continuing to next live Gemini candidate...`);
          continue;
        }

        let errorData: any = null;
        try {
          errorData = JSON.parse(lastErrorText);
        } catch {}

        const isApiKeyError =
          res.status === 401 ||
          res.status === 403 ||
          lastErrorText.includes('API_KEY_INVALID') ||
          lastErrorText.includes('API key not valid') ||
          errorData?.error?.message?.toLowerCase().includes('api key');

        if (isApiKeyError) {
          response = res;
          activeApiUrl = url;
          break;
        }

        if (res.status === 404 || res.status === 400 || res.status === 503) {
          continue;
        }

        response = res;
        activeApiUrl = url;
        break;
      } catch (fetchErr: any) {
        lastErrorText = fetchErr?.message || 'Network request failed';
        if (fetchErr.name === 'TimeoutError') {
          console.warn(`[Quantum Fallback] Gemini endpoint timed out after 6000ms for ${candidateModel}. Shifting to next tier.`);
        }
        continue;
      }
    }
  }

    // Sovereign Autonomous Failover if Gemini is throttled (429) or unavailable
    if (!response || !response.ok) {
      if (groqKey) {
        console.log('[Orchestrator Failover] Gemini unavailable, shifting instantly to Groq US LPU fleet...');
        try {
          const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
          const failoverCandidates = ['openai/gpt-oss-120b'];

          for (const groqModel of failoverCandidates) {
            try {
              const failoverResult = await runOpenAICompatibleAgent(messages, {
                endpoint: 'https://api.groq.com/openai/v1/chat/completions',
                apiKey: groqKey,
                model: groqModel,
                systemPrompt: fullSystemPrompt,
                maxTokens: 1024,
              });

              if (failoverResult && !failoverResult.error && failoverResult.reply) {
                const latencyMs = Date.now() - startTime;
                return {
                  reply: `*(Sovereign Autonomous Failover to ${groqModel} on Groq)*\n\n${failoverResult.reply}`,
                  vocalSummary: extractCinematicVocalSummary(failoverResult.reply),
                  tacticalActions: generateTacticalNextActions(lastUserMessage.content, failoverResult.reply, failoverResult.toolCallsExecuted),
                  toolCallsExecuted: failoverResult.toolCallsExecuted,
                  telemetry: {
                    engineUsed: `Groq US LPU (${groqModel}) [Failover]`,
                    provider: 'groq',
                    model: groqModel,
                    latencyMs,
                    archetype,
                    failoverOccurred: true,
                    recalledEpisodesCount: recalledEpisodes.length,
                  },
                };
              }
            } catch (failErr: any) {
              console.warn(`[Groq Failover] ${groqModel} failed:`, failErr?.message);
              continue;
            }
          }
        } catch (failoverErr) {
          console.warn('[Orchestrator Failover] Groq fleet failover error:', failoverErr);
        }
      }

      // Secondary Failover to GitHub Models (Azure Frontier Fleet)
      if (githubKey) {
        try {
          console.log('[Orchestrator Failover] Engaging GitHub Models Frontier Backup...');
          const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
          const ghResult = await runOpenAICompatibleAgent(messages, {
            endpoint: 'https://models.github.ai/inference/chat/completions',
            apiKey: githubKey,
            model: 'gpt-4o',
            systemPrompt: fullSystemPrompt,
          });

          if (ghResult && !ghResult.error && ghResult.reply) {
            const latencyMs = Date.now() - startTime;
            return {
              reply: `*(Sovereign Autonomous Failover to GitHub Models GPT-4o)*\n\n${ghResult.reply}`,
              vocalSummary: extractCinematicVocalSummary(ghResult.reply),
              tacticalActions: generateTacticalNextActions(lastUserMessage.content, ghResult.reply, ghResult.toolCallsExecuted),
              toolCallsExecuted: ghResult.toolCallsExecuted,
              telemetry: {
                engineUsed: 'GitHub Models (Azure)',
                provider: 'groq',
                model: 'gpt-4o',
                latencyMs,
                archetype,
                failoverOccurred: true,
                recalledEpisodesCount: recalledEpisodes.length,
              },
            };
          }
        } catch (ghErr) {
          console.warn('[Orchestrator Failover] GitHub Models failover error:', ghErr);
        }
      }

      // Offline Guardian Fallback ensures Sir always receives a coherent response
      const offline = await handleOfflineJarvisResponse(lastUserMessage.content, activeTasks);
      return {
        reply: offline.reply,
        vocalSummary: extractCinematicVocalSummary(offline.reply),
        tacticalActions: ['Tactical Briefing', 'Review Radar Tasks'],
        toolCallsExecuted: offline.toolCallsExecuted,
        telemetry: {
          engineUsed: 'Guardian Sentry Heuristics',
          provider: 'offline',
          model: 'offline-safeguard',
          latencyMs: Date.now() - startTime,
          archetype,
          failoverOccurred: true,
          recalledEpisodesCount: 0,
        },
        error: lastErrorText,
      };
    }

    // Process Gemini Candidate & Tool Multi-Turn Loop
    let data = await response.json();
    let candidate = data.candidates?.[0];
    const toolCallsExecuted: Array<{ name: string; args: any; result: any }> = [];

    let loopCount = 0;
    let pipelineAutoRetried = false;
    let functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);

    // Multi-turn ReAct Autonomous Tool Execution Loop (up to 12 iterations for full-stack tasks)
    while (loopCount < 12) {
      // Check if model returned zero function calls, but an uncompleted UI component pipeline was detected
      if (!functionCalls || functionCalls.length === 0) {
        const unmountedComponent = toolCallsExecuted.find(
          (t) =>
            (t.name === 'edit_workspace_file' || t.name === 'cloud_write_file') &&
            t.args?.path &&
            (t.args.path.startsWith('components/') || t.args.path.includes('/components/')) &&
            !t.args.path.startsWith('app/api/') &&
            !toolCallsExecuted.some(
              (other) =>
                (other.name === 'edit_workspace_file' || other.name === 'cloud_write_file') &&
                other.args?.path?.includes('app/page.tsx')
            )
        );

        if (unmountedComponent && !pipelineAutoRetried && loopCount < 10) {
          pipelineAutoRetried = true;
          console.log(`[Autonomous Pipeline Sentry] Detected unmounted component "${unmountedComponent.args.path}". Prompting model to complete Stage 2-4...`);

          contents.push({
            role: 'model',
            parts: candidate?.content?.parts || [{ text: 'Component authored on disk.' }],
          });

          contents.push({
            role: 'user',
            parts: [
              {
                text: `[AUTONOMOUS PIPELINE SENTRY - DIRECTIVE 05 MANDATE]: You created/updated UI component "${unmountedComponent.args.path}". Authoring alone is incomplete. You MUST now execute the remaining required pipeline steps: (1) Mount and import this component into 'app/page.tsx' navigation/tabs so Sir can access it in the UI, (2) Run 'cloud_execute_command' with 'npx tsc --noEmit' to verify type safety, and (3) Run 'cloud_execute_command' with 'git add -A && git commit -m "feat: ..." && git push origin main'. Proceed with tool calls immediately.`,
              },
            ],
          });

          const sentryGenConfig = {
            temperature: 0.2,
            maxOutputTokens: 4096,
          };

          try {
            if (isVertexEngine) {
              response = await callVertexAIGenerate({
                model: selectedVertexModel,
                contents,
                systemInstruction,
                tools: geminiTools,
                generationConfig: sentryGenConfig,
                signal: AbortSignal.timeout(180000),
              });
            } else {
              response = await fetch(activeApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents,
                  systemInstruction,
                  tools: geminiTools,
                  generationConfig: sentryGenConfig,
                }),
                signal: AbortSignal.timeout(8000),
              });
            }

            if (response && response.ok) {
              data = await response.json();
              candidate = data.candidates?.[0];
              functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);
              if (functionCalls && functionCalls.length > 0) {
                continue;
              }
            }
          } catch (sentryErr) {
            console.warn('[Autonomous Pipeline Sentry] Continuation error:', sentryErr);
          }
        }

        break;
      }

      loopCount++;
      const toolResponseParts: any[] = [];

      for (const callPart of functionCalls) {
        const call = callPart.functionCall;
        const toolResult = await executeJarvisTool(call.name, call.args || {});

        toolCallsExecuted.push({
          name: call.name,
          args: call.args || {},
          result: toolResult.result || toolResult.error,
        });

        // Pillar 2 Grounding: Autonomous Empirical Reflection & Retry
        let toolResponsePayload: any = toolResult;
        const isSearchResults = Array.isArray(toolResult?.result?.results);
        const isEmptySearch = isSearchResults && toolResult.result.results.length === 0;
        if (toolResult.error || isEmptySearch) {
          toolResponsePayload = {
            ...toolResult,
            reflectionGuidance: `[AUTONOMOUS EMPIRICAL REFLECTION]: The tool execution for "${call.name}" returned zero results or an error. Do not repeat the exact same request. Reformulate search terms, try a broader keyword, or explore an alternative data source to deliver concrete intelligence.`,
          };
        }

        toolResponseParts.push({
          functionResponse: {
            name: call.name,
            response: toolResponsePayload,
          },
        });
      }

      contents.push({
        role: 'model',
        parts: candidate.content.parts,
      });

      contents.push({
        role: 'user',
        parts: toolResponseParts,
      });

      const toolGenerationConfig = {
        temperature: 0.3,
        maxOutputTokens: 4096,
      };

      try {
        if (isVertexEngine) {
          response = await callVertexAIGenerate({
            model: selectedVertexModel,
            contents,
            systemInstruction,
            tools: geminiTools,
            generationConfig: toolGenerationConfig,
            signal: AbortSignal.timeout(180000),
          });
        } else {
          response = await fetch(activeApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              systemInstruction,
              tools: geminiTools,
              generationConfig: toolGenerationConfig,
            }),
            signal: AbortSignal.timeout(8000),
          });
        }

        if (!response.ok) {
          // If active Gemini model throttles during tool synthesis, try secondary models in hierarchy
          for (const fallbackModel of candidateModels) {
            if (fallbackModel === selectedModel) continue;
            const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${apiKey}`;
            const fbRes = await fetch(fallbackUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents,
                systemInstruction,
                tools: geminiTools,
                generationConfig: toolGenerationConfig,
              }),
              signal: AbortSignal.timeout(6000),
            });
            if (fbRes.ok) {
              response = fbRes;
              activeApiUrl = fallbackUrl;
              selectedModel = fallbackModel;
              break;
            }
          }
        }

        if (response && response.ok) {
          data = await response.json();
          candidate = data.candidates?.[0];
          functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);
        } else {
          break;
        }
      } catch (toolSynthesisErr) {
        console.warn('[Tool Synthesis Loop] Synthesis fetch error:', toolSynthesisErr);
        break;
      }
    }

    // Pillar 1: Extract Internal Cognition / Chain-of-Thought
    const thoughtParts = candidate?.content?.parts?.filter((p: any) => p.thought);
    const internalThoughts = thoughtParts && thoughtParts.length > 0
      ? thoughtParts.map((p: any) => p.text).join('\n\n')
      : undefined;

    const textPart =
      candidate?.content?.parts?.find((p: any) => p.text && !p.thought) ||
      candidate?.content?.parts?.find((p: any) => p.text);

    let finalReply = textPart?.text;
    if (!finalReply && toolCallsExecuted.length > 0) {
      try {
        console.log('[Agent] No final text generated after tools. Forcing dedicated synthesis pass...');
        const finalPrompt = [
          ...contents,
          {
            role: 'user',
            parts: [
              {
                text: 'Based on the tool results and actions above, please provide your complete, concise, natural response to Sir now explaining what you found, executed, or discovered.',
              },
            ],
          },
        ];
        if (isVertexEngine) {
          const synthRes = await callVertexAIGenerate({
            model: selectedVertexModel,
            contents: finalPrompt,
            systemInstruction,
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
            signal: AbortSignal.timeout(90000),
          });
          if (synthRes.ok) {
            const sData = await synthRes.json();
            const sText = sData.candidates?.[0]?.content?.parts?.find((p: any) => p.text && !p.thought)?.text;
            if (sText) finalReply = sText;
          }
        }
      } catch (sErr) {
        console.warn('[Agent] Synthesis fallback error:', sErr);
      }
    }

    if (!finalReply) {
      if (toolCallsExecuted.length > 0) {
        const summaries = toolCallsExecuted.map((tc) => {
          const res = tc.result;
          if (res) {
            if (typeof res === 'string' && res.trim()) return res.trim();
            if (res.stdout && typeof res.stdout === 'string' && res.stdout.trim()) return res.stdout.trim();
            if (res.output && typeof res.output === 'string' && res.output.trim()) return res.output.trim();
            if (res.message && typeof res.message === 'string' && res.message.trim()) return res.message.trim();
          }
          return `${tc.name} executed successfully.`;
        });
        finalReply = `Sir, executed ${toolCallsExecuted.length} operational tool(s):\n\n${summaries.map((s) => `\`\`\`\n${s.length > 500 ? s.slice(0, 500) + '...' : s}\n\`\`\``).join('\n\n')}`;
      } else {
        finalReply = 'All systems green, Sir. What would you like to focus on next?';
      }
    }

    // Pillar 5: Continuous Heuristic & Preference Assimilation
    try {
      const userText = lastUserMessage.content.toLowerCase();
      if (/prefer|always|never|my rule|i want|remember that|from now on|i need you to/i.test(userText)) {
        addMemory('PREFERENCE', `Sir's Explicit Preference: "${lastUserMessage.content.slice(0, 300)}"`, 'Directive 03 Evolutionary Adaptation');
      }
    } catch (prefErr) {
      console.warn('[Agent] Preference assimilation warning:', prefErr);
    }

    const latencyMs = Date.now() - startTime;

    // Hermes Feature 4: Record Execution Trajectory for Fine-Tuning & Distillation
    try {
      const { recordExecutionTrajectory } = await import('./trajectory');
      recordExecutionTrajectory({
        id: `traj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        userPrompt: lastUserMessage.content,
        assistantReply: finalReply,
        vocalSummary: extractCinematicVocalSummary(finalReply),
        motiveAnalysis: motivePass.unstatedMotive,
        internalThoughts,
        toolCalls: toolCallsExecuted,
        telemetry: {
          engineUsed: isVertexEngine ? `Vertex AI ${selectedVertexModel}` : selectedModel,
          model: isVertexEngine ? selectedVertexModel : selectedModel,
          latencyMs,
          provider: isVertexEngine ? 'vertex-ai' : 'google',
          persona,
        },
      });
    } catch (trajErr) {
      console.warn('[Agent] Trajectory recording warning:', trajErr);
    }

    return {
      reply: finalReply,
      vocalSummary: extractCinematicVocalSummary(finalReply),
      tacticalActions: generateTacticalNextActions(lastUserMessage.content, finalReply, toolCallsExecuted),
      toolCallsExecuted,
      motiveAnalysis: motivePass.unstatedMotive,
      internalThoughts,
      telemetry: {
        engineUsed: isVertexEngine
          ? (selectedVertexModel.includes('3.8')
              ? 'Vertex AI Gemini 3.8 Flash (GCP Credits)'
              : selectedVertexModel.includes('3.7')
              ? 'Vertex AI Gemini 3.7 Flash (GCP Credits)'
              : selectedVertexModel.includes('3.6')
              ? 'Vertex AI Gemini 3.6 Flash (GCP Credits)'
              : selectedVertexModel.includes('3.1-pro')
              ? 'Vertex AI Gemini 3.1 Pro (GCP Credits)'
              : selectedVertexModel.includes('3.1')
              ? 'Vertex AI Gemini 3.1 Flash Lite (GCP Credits)'
              : selectedVertexModel.includes('pro')
              ? 'Vertex AI Gemini 2.5 Pro (GCP Credits)'
              : 'Vertex AI Gemini 2.5 Flash (GCP Credits)')
          : (selectedModel.includes('3.8') ? 'Gemini 3.8 Flash Core' : `Gemini ${selectedModel}`),
        provider: isVertexEngine ? 'vertex-ai' : 'google',
        model: isVertexEngine ? selectedVertexModel : selectedModel,
        latencyMs,
        archetype,
        persona,
        failoverOccurred: false,
        recalledEpisodesCount: recalledEpisodes.length,
      },
    };
  } catch (err: any) {
    console.error('Agent execution exception:', err);
    return {
      reply: `Sir, a temporary cognitive latency occurred: ${err.message}. Local safeguards and state remain fully intact.`,
      vocalSummary: 'Temporary cognitive latency occurred, Sir.',
      tacticalActions: ['Tactical Briefing', 'Review Radar Tasks'],
      toolCallsExecuted: [],
      telemetry: {
        engineUsed: 'Error Recovery Sentry',
        provider: 'offline',
        model: 'recovery',
        latencyMs: Date.now() - startTime,
        archetype,
        persona,
        failoverOccurred: true,
      },
      error: err.message,
    };
  }
}

async function handleOfflineJarvisResponse(
  userText: string,
  activeTasks: any[]
): Promise<{ reply: string; toolCallsExecuted: any[] }> {
  const lower = userText.toLowerCase();

  if (lower.includes('task') || lower.includes('todo') || lower.includes('radar')) {
    if (activeTasks.length === 0) {
      return {
        reply: 'Sir, our tactical radar currently holds no pending objectives. All primary milestones are clear.',
        toolCallsExecuted: [],
      };
    }
    const taskList = activeTasks
      .map((t) => `- [${t.priority}] **${t.title}** (Status: ${t.status})`)
      .join('\n');
    return {
      reply: `Sir, local telemetry shows the following active objectives on our radar:\n\n${taskList}\n\nStanding by for updates.`,
      toolCallsExecuted: [],
    };
  }

  if (lower.includes('status') || lower.includes('briefing') || lower.includes('system')) {
    return {
      reply: `Sir, J.A.R.V.I.S. is online under the Guardian Protocol. Neural uplink is running on localized heuristics. We have ${activeTasks.length} pending objectives on radar.`,
      toolCallsExecuted: [],
    };
  }

  return {
    reply: `Sir, I am listening and operating on local autonomous sentry protocols. All directives are active. To enable full generative intelligence, please ensure an API key is configured.`,
    toolCallsExecuted: [],
  };
}
