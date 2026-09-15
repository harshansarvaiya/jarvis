import { JARVIS_SYSTEM_PROMPT, CORE_DIRECTIVES, validateActionAgainstDirectives } from './directives';
import { getTasks, getMemories, addMemory, recordEvolution } from './memory';
import { JARVIS_TOOLS, executeJarvisTool } from './tools';
import { findCorrelatedEpisodes, formatRecalledEpisodesPrompt } from './recall';
import {
  classifyOperationalIntent,
  extractCinematicVocalSummary,
  generateTacticalNextActions,
  OperationalArchetype,
  OrchestrationTelemetry,
} from './orchestrator';

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
  provider?: 'google' | 'groq' | 'github-models' | 'auto';
  orchestrationMode?: 'auto' | 'groq' | 'gemini' | 'manual';
}

export function normalizeModel(m?: string): string {
  if (!m) return 'gemini-3.7-flash';
  const clean = m.trim().toLowerCase();
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
    // Wrap-around rotation: try requested model first, then cycle through ALL remaining
    // e.g. if user requests 3.8-flash (index 5): [3.8, 3.7, lite-latest, 3.1-lite, 3.5-lite, preview]
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
  telemetry: OrchestrationTelemetry;
  error?: string;
}> {
  const startTime = Date.now();
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
  const groqKey = options.groqApiKey || process.env.GROQ_API_KEY || '';
  const githubKey = options.githubToken || process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN || '';
  const requestedModel = normalizeModel(options.model || 'gemini-3.8-flash');
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

  // 1. Safety & Directive Check (Guardian Protocol)
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

  // 2. Correlated Episodic History Retrieval (RAG over Upstash History)
  let recalledEpisodes: any[] = [];
  let recalledContextPrompt = '';
  try {
    recalledEpisodes = await findCorrelatedEpisodes(lastUserMessage.content, [lastUserMessage.id || ''], 3);
    recalledContextPrompt = formatRecalledEpisodesPrompt(recalledEpisodes);
  } catch (recallErr) {
    console.warn('[Agent] Episodic recall error:', recallErr);
  }

  // 3. Synthesize Active State Context
  const allTasks = getTasks();
  const activeTasks = allTasks.filter((t) => t.status !== 'COMPLETED').slice(0, 8);
  const completedTasks = allTasks.filter((t) => t.status === 'COMPLETED').slice(0, 5);
  const relevantMemories = getMemories().slice(0, 8);

  const contextPrompt = `
[CURRENT TEMPORAL CONTEXT]: ${new Date().toISOString()} (Local time: ${new Date().toLocaleString()})
[ACTIVE TASKS ON RADAR]:
${activeTasks.map((t) => `- [${t.priority}] ${t.title} (ID: ${t.id}, Status: ${t.status}${t.dueDate ? `, Due: ${t.dueDate}` : ''})`).join('\n') || 'No active pending tasks.'}

[RECENT COMPLETED TASKS & ACHIEVEMENTS]:
${completedTasks.map((t) => `- [COMPLETED] ${t.title} (ID: ${t.id}${t.completedAt ? `, Completed: ${t.completedAt}` : ''})`).join('\n') || 'No recently completed tasks recorded.'}

[ASSIMILATED MEMORY & PREFERENCES]:
${relevantMemories.map((m) => `- [${m.category}]: ${m.content}`).join('\n')}
${recalledContextPrompt}
[DIRECTIVE ENFORCEMENT]:
${CORE_DIRECTIVES.map((d) => `- ${d.name}: ${d.statement}`).join('\n')}
`;

  const fullSystemPrompt = `${JARVIS_SYSTEM_PROMPT}\n\n${contextPrompt}`;

  // 4. Intent Classification & Cognitive Dispatch Decision
  const hasImage = Boolean(lastUserMessage.image && lastUserMessage.image.includes(';base64,'));
  const { archetype, reason } = classifyOperationalIntent(lastUserMessage.content, hasImage);

  const shouldPreferGroq =
    groqKey &&
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

      for (const groqModel of groqCandidates) {
        try {
          const groqResult = await runOpenAICompatibleAgent(messages, {
            endpoint: 'https://api.groq.com/openai/v1/chat/completions',
            apiKey: groqKey,
            model: groqModel,
            systemPrompt: fullSystemPrompt,
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
      console.warn('[Orchestrator] Groq dispatch failed, seamlessly engaging Gemini failover...', groqErr);
    }
  }

  // =========================================================================
  // ROUTE B: GITHUB MODELS (If explicitly requested)
  // =========================================================================
  if (requestedModel.startsWith('gpt-') || options.provider === 'github-models') {
    if (githubKey) {
      const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
      const ghResult = await runOpenAICompatibleAgent(messages, {
        endpoint: 'https://models.inference.ai.azure.com/chat/completions',
        apiKey: githubKey,
        model: requestedModel.startsWith('gpt-') ? requestedModel : 'gpt-4o',
        systemPrompt: fullSystemPrompt,
      });

      if (!ghResult.error) {
        const latencyMs = Date.now() - startTime;
        return {
          reply: ghResult.reply,
          vocalSummary: extractCinematicVocalSummary(ghResult.reply),
          tacticalActions: generateTacticalNextActions(lastUserMessage.content, ghResult.reply, ghResult.toolCallsExecuted),
          toolCallsExecuted: ghResult.toolCallsExecuted,
          telemetry: {
            engineUsed: 'GitHub Models (Azure)',
            provider: 'google', // external
            model: 'gpt-4o',
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
  if (!apiKey) {
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
    const systemInstruction = {
      parts: [
        {
          text: `${JARVIS_SYSTEM_PROMPT}\n\n${contextPrompt}`,
        },
      ],
    };

    const recentMessages = messages.slice(-30);
    for (let i = 0; i < recentMessages.length; i++) {
      const msg = recentMessages[i];
      const role = msg.role === 'assistant' ? 'model' : msg.role;
      const parts: any[] = [{ text: msg.content || '' }];
      const isRecent = i >= recentMessages.length - 2;
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

    for (const candidateModel of candidateModels) {
      if (attemptsCount >= MAX_GEMINI_ATTEMPTS) {
        console.warn(`[Quantum Fallback] Reached max Gemini attempts (${MAX_GEMINI_ATTEMPTS}). Cascading to Groq US LPU.`);
        break;
      }
      attemptsCount++;

      const generationConfig = {
        temperature: 0.4,
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
          signal: AbortSignal.timeout(2500),
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
          console.warn(`[Quantum Fallback] Gemini endpoint timed out after 2500ms for ${candidateModel}. Shifting to next tier.`);
        }
        continue;
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
    let functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);

    while (functionCalls && functionCalls.length > 0 && loopCount < 3) {
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

        toolResponseParts.push({
          functionResponse: {
            name: call.name,
            response: toolResult,
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
        temperature: 0.4,
        maxOutputTokens: 4096,
      };

      response = await fetch(activeApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          tools: geminiTools,
          generationConfig: toolGenerationConfig,
        }),
      });

      if (!response.ok) break;
      data = await response.json();
      candidate = data.candidates?.[0];
      functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);
    }

    const textPart =
      candidate?.content?.parts?.find((p: any) => p.text && !p.thought) ||
      candidate?.content?.parts?.find((p: any) => p.text);

    let finalReply = textPart?.text;
    if (!finalReply) {
      if (toolCallsExecuted.length > 0) {
        const summaries = toolCallsExecuted.map((tc) => {
          if (tc.result?.message) return tc.result.message;
          return `${tc.name} executed successfully.`;
        });
        finalReply = `Sir, I have executed your instructions directly:\n\n${summaries.map((s) => `- ${s}`).join('\n')}\n\nAll directives remain fully online.`;
      } else {
        finalReply = 'Directives acknowledged and synchronized, Sir.';
      }
    }

    const latencyMs = Date.now() - startTime;
    return {
      reply: finalReply,
      vocalSummary: extractCinematicVocalSummary(finalReply),
      tacticalActions: generateTacticalNextActions(lastUserMessage.content, finalReply, toolCallsExecuted),
      toolCallsExecuted,
      telemetry: {
        engineUsed: selectedModel.includes('3.8') ? 'Gemini 3.8 Flash Core' : `Gemini ${selectedModel}`,
        provider: 'google',
        model: selectedModel,
        latencyMs,
        archetype,
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
