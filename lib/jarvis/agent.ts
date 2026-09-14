import { JARVIS_SYSTEM_PROMPT, CORE_DIRECTIVES, validateActionAgainstDirectives } from './directives';
import { getTasks, getMemories, addMemory, recordEvolution } from './memory';
import { JARVIS_TOOLS, executeJarvisTool } from './tools';

export interface ChatMessage {
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
}

export function normalizeModel(m?: string): string {
  if (!m) return 'gemini-3.8-flash';
  const clean = m.trim().toLowerCase();
  if (clean.includes('120b') || clean.includes('gpt-oss-120b')) return 'openai/gpt-oss-120b';
  if (clean.includes('20b') || clean.includes('gpt-oss-20b')) return 'openai/gpt-oss-20b';
  if (clean.includes('compound-mini')) return 'groq/compound-mini';
  if (clean.includes('compound')) return 'groq/compound';
  if (clean.includes('llama-3.3') || clean.includes('llama-70b') || clean === 'llama') return 'openai/gpt-oss-120b';
  if (clean.includes('llama-3.1') || clean.includes('llama-8b')) return 'openai/gpt-oss-20b';
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
 * Stepwise Quantum Fallback Hierarchy
 * Priority sequence: gemini-3.8-flash -> 3.7 -> 3.6 -> 3.5 -> 2.5 -> flash-latest
 */
export function getModelFallbackHierarchy(requestedModel: string): string[] {
  const masterHierarchy = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
  ];

  const primary = normalizeModel(requestedModel);
  const startIndex = masterHierarchy.indexOf(primary);

  if (startIndex !== -1) {
    return masterHierarchy.slice(startIndex);
  }

  return [primary, ...masterHierarchy].filter((v, i, a) => a.indexOf(v) === i);
}

export async function runJarvisAgent(
  messages: ChatMessage[],
  options: JarvisAgentOptions = {}
): Promise<{
  reply: string;
  toolCallsExecuted: Array<{ name: string; args: any; result: any }>;
  motiveAnalysis?: string;
  error?: string;
}> {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
  const model = normalizeModel(options.model || 'gemini-3.8-flash');

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) {
    return { reply: 'Sir, I did not detect an operational directive.', toolCallsExecuted: [] };
  }

  // 1. Safety & Directive Check
  const directiveCheck = validateActionAgainstDirectives(lastUserMessage.content);
  if (!directiveCheck.allowed) {
    return {
      reply: `Sir, I must respectfully halt this operation under **[${directiveCheck.violatedDirective?.name}]**: ${directiveCheck.reason}. My prime mandate is to protect your security and well-being.`,
      toolCallsExecuted: [],
    };
  }

  // 2. Synthesize Active State Context
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

[DIRECTIVE ENFORCEMENT]:
${CORE_DIRECTIVES.map((d) => `- ${d.name}: ${d.statement}`).join('\n')}
`;

  const fullSystemPrompt = `${JARVIS_SYSTEM_PROMPT}\n\n${contextPrompt}`;
  const groqKey = options.groqApiKey || process.env.GROQ_API_KEY || '';
  const githubKey = options.githubToken || process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN || '';

  // 3. Sovereign Provider Routing: Groq (OpenAI GPT-OSS 120B / 20B & Compound on US LPU Silicon)
  if (model.startsWith('openai/') || model.startsWith('groq/') || model.startsWith('llama-') || options.provider === 'groq') {
    if (!groqKey) {
      return {
        reply: `Sir, to engage Groq Sovereign Engines, please provide a Groq API Key in Settings or configure GROQ_API_KEY in your Vercel environment variables.`,
        toolCallsExecuted: [],
      };
    }
    const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
    return runOpenAICompatibleAgent(messages, {
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: groqKey,
      model: model.startsWith('openai/') || model.startsWith('groq/') ? model : 'openai/gpt-oss-120b',
      systemPrompt: fullSystemPrompt,
    });
  }

  // 4. Sovereign Provider Routing: GitHub Models (OpenAI GPT-4o / GPT-4o-mini - Microsoft Cloud)
  if (model.startsWith('gpt-') || options.provider === 'github-models') {
    if (!githubKey) {
      return {
        reply: `Sir, to engage OpenAI GPT-4o via GitHub Models, please provide a GitHub Personal Access Token in Settings or configure GITHUB_TOKEN in your Vercel environment variables.`,
        toolCallsExecuted: [],
      };
    }
    const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
    return runOpenAICompatibleAgent(messages, {
      endpoint: 'https://models.inference.ai.azure.com/chat/completions',
      apiKey: githubKey,
      model: model.startsWith('gpt-') ? model : 'gpt-4o',
      systemPrompt: fullSystemPrompt,
    });
  }

  // If no Gemini API key is configured yet, provide intelligent fallback / simulated offline mode
  if (!apiKey) {
    if (groqKey) {
      const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
      return runOpenAICompatibleAgent(messages, {
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: groqKey,
        model: 'openai/gpt-oss-120b',
        systemPrompt: fullSystemPrompt,
      });
    }
    return handleOfflineJarvisResponse(lastUserMessage.content, activeTasks);
  }

  try {
    // 3. Prepare Gemini API Request with Function Calling Tools
    const geminiTools = [
      {
        functionDeclarations: JARVIS_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ];

    // Format conversation history for Gemini
    const contents: any[] = [];

    // System instruction
    const systemInstruction = {
      parts: [
        {
          text: `${JARVIS_SYSTEM_PROMPT}\n\n${contextPrompt}`,
        },
      ],
    };

    // User/Model messages
    for (const msg of messages.slice(-8)) {
      const role = msg.role === 'assistant' ? 'model' : msg.role;
      const parts: any[] = [{ text: msg.content }];
      if (msg.image && msg.image.includes(';base64,')) {
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

    const candidateModels = getModelFallbackHierarchy(model);

    let response: Response | null = null;
    let activeApiUrl = '';
    let lastErrorText = '';
    let selectedModel = candidateModels[0] || 'gemini-3.8-flash';

    for (const candidateModel of candidateModels) {
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
        });

        if (res.ok) {
          response = res;
          activeApiUrl = url;
          selectedModel = candidateModel;
          break;
        }

        lastErrorText = await res.text();
        console.warn(`[Quantum Fallback] Model ${candidateModel} failed with HTTP ${res.status}:`, lastErrorText);

        // Parse error response if possible
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

        // Fatal API key authentication errors must stop immediately - do not attempt fallback
        if (isApiKeyError) {
          response = res;
          activeApiUrl = url;
          break;
        }

        // Fall back one version down on 404 (not found), 400 (config mismatch), 429 (rate limit), or 503 (overload)
        if (res.status === 404 || res.status === 400 || res.status === 429 || res.status === 503) {
          continue;
        }

        // Other non-retryable errors stop immediately
        response = res;
        activeApiUrl = url;
        break;
      } catch (fetchErr: any) {
        lastErrorText = fetchErr?.message || 'Network request failed';
        console.warn(`[Quantum Fallback] Network exception attempting ${candidateModel}:`, lastErrorText);
        continue;
      }
    }

    if (!response || !response.ok) {
      // Sovereign Multi-Provider Failover: If Groq or GitHub key is present, failover invisibly!
      if (groqKey) {
        console.log('[Sovereign Failover] Google Gemini unavailable. Engaging Groq OpenAI GPT-OSS-120B...');
        try {
          const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
          const failoverResult = await runOpenAICompatibleAgent(messages, {
            endpoint: 'https://api.groq.com/openai/v1/chat/completions',
            apiKey: groqKey,
            model: 'openai/gpt-oss-120b',
            systemPrompt: fullSystemPrompt,
          });
          return {
            ...failoverResult,
            reply: `*(Sovereign Autonomous Failover to OpenAI GPT-OSS-120B on Groq)*\n\n${failoverResult.reply}`,
          };
        } catch (failoverErr) {
          console.warn('[Sovereign Failover] Groq failover error:', failoverErr);
        }
      }

      if (githubKey) {
        console.log('[Sovereign Failover] Google Gemini unavailable. Engaging GitHub Models GPT-4o...');
        try {
          const { runOpenAICompatibleAgent } = await import('./providers/openai-compatible');
          const failoverResult = await runOpenAICompatibleAgent(messages, {
            endpoint: 'https://models.inference.ai.azure.com/chat/completions',
            apiKey: githubKey,
            model: 'gpt-4o',
            systemPrompt: fullSystemPrompt,
          });
          return {
            ...failoverResult,
            reply: `*(Sovereign Autonomous Failover to OpenAI GPT-4o)*\n\n${failoverResult.reply}`,
          };
        } catch (failoverErr) {
          console.warn('[Sovereign Failover] GitHub Models failover error:', failoverErr);
        }
      }

      let diagnosticMessage = '';
      try {
        const parsed = JSON.parse(lastErrorText);
        if (parsed?.error?.message) {
          diagnosticMessage = `: "${parsed.error.message}"`;
        }
      } catch {
        if (lastErrorText && lastErrorText.length < 150) {
          diagnosticMessage = `: ${lastErrorText}`;
        }
      }

      const statusCode = response?.status || (lastErrorText.includes('API_KEY_INVALID') ? 400 : 500);

      let guidance = 'Operating on localized heuristics in the interim.';
      if (lastErrorText.includes('API_KEY_INVALID') || lastErrorText.includes('API key not valid')) {
        guidance = 'Your Gemini API Key appears to be invalid, mistyped, or not enabled for the Generative Language API. Please generate a valid key at https://aistudio.google.com/app/apikey and update it in Settings or .env.local.';
      } else if (response?.status === 403 || lastErrorText.includes('PERMISSION_DENIED')) {
        guidance = 'Permission denied by Google Cloud. Ensure the Generative Language API is enabled and your key has no IP/referrer restrictions.';
      }

      return {
        reply: `Sir, our neural uplink encountered an API response error (${statusCode})${diagnosticMessage}.\n\n${guidance}`,
        toolCallsExecuted: [],
        error: lastErrorText,
      };
    }

    let data = await response.json();
    let candidate = data.candidates?.[0];
    const toolCallsExecuted: Array<{ name: string; args: any; result: any }> = [];

    // Check if model returned function calls
    let functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);

    // Iterative Tool Execution Loop
    let loopCount = 0;
    while (functionCalls && functionCalls.length > 0 && loopCount < 3) {
      loopCount++;
      const toolResponseParts: any[] = [];

      for (const part of functionCalls) {
        const call = part.functionCall;
        const toolResult = await executeJarvisTool(call.name, call.args || {});
        toolCallsExecuted.push({
          name: call.name,
          args: call.args,
          result: toolResult.result || toolResult.error,
        });

        toolResponseParts.push({
          functionResponse: {
            name: call.name,
            response: toolResult,
          },
        });
      }

      // Add model's function call message
      contents.push({
        role: 'model',
        parts: candidate.content.parts,
      });

      // Add function response message
      contents.push({
        role: 'user',
        parts: toolResponseParts,
      });

      // Query Gemini again with tool output
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

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.warn(`[Tool Response Turn] Request failed with HTTP ${response.status}:`, errBody);
        break;
      }
      data = await response.json();
      candidate = data.candidates?.[0];
      functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);
    }

    // Find conversational text part (filtering out raw thought artifacts if any)
    const textPart =
      candidate?.content?.parts?.find((p: any) => p.text && !p.thought) ||
      candidate?.content?.parts?.find((p: any) => p.text);

    let finalReply = textPart?.text;
    if (!finalReply) {
      if (toolCallsExecuted.length > 0) {
        const summaries = toolCallsExecuted.map((tc) => {
          if (tc.result?.message) return tc.result.message;
          if (tc.name === 'manage_task') {
            if (tc.args?.action === 'create') return `Task "${tc.args?.title}" registered in tactical matrix.`;
            if (tc.args?.action === 'complete') return `Task ${tc.args?.taskId || ''} marked completed.`;
            if (tc.args?.action === 'list') return `Tactical objectives synchronized.`;
          }
          if (tc.name === 'store_memory') return `Memory imprinted under [${tc.args?.category || 'INSIGHT'}].`;
          return `${tc.name} executed successfully.`;
        });
        finalReply = `Sir, I have executed your instructions directly:\n\n${summaries.map((s) => `- ${s}`).join('\n')}\n\nAll directives remain fully online.`;
      } else {
        finalReply = 'Directives acknowledged and synchronized, Sir.';
      }
    }

    return {
      reply: finalReply,
      toolCallsExecuted,
    };
  } catch (err: any) {
    console.error('Agent execution exception:', err);
    return {
      reply: `Sir, a temporary cognitive latency occurred: ${err.message}. Local safeguards and state remain fully intact.`,
      toolCallsExecuted: [],
      error: err.message,
    };
  }
}

async function handleOfflineJarvisResponse(
  userText: string,
  activeTasks: any[]
): Promise<{ reply: string; toolCallsExecuted: any[] }> {
  const lower = userText.toLowerCase();
  const toolCallsExecuted: any[] = [];

  // Offline heuristic intent detection
  if (lower.includes('task') || lower.includes('remind') || lower.includes('todo') || lower.includes('schedule')) {
    const title = userText.replace(/create task|remind me to|add task|schedule/gi, '').trim() || 'New Tactical Objective';
    const result = await executeJarvisTool('manage_task', {
      action: 'create',
      title,
      priority: lower.includes('urgent') || lower.includes('critical') ? 'CRITICAL' : 'HIGH',
      tags: ['offline-dispatch'],
    });
    toolCallsExecuted.push({ name: 'manage_task', args: { action: 'create', title }, result: result.result });

    return {
      reply: `Right away, Sir. I have registered the objective: **"${title}"** in our Mission Control matrix under elevated priority.\n\n*Note: Configure your Gemini API Key in Settings to engage full conversational neural capabilities.*`,
      toolCallsExecuted,
    };
  }

  if (lower.includes('status') || lower.includes('briefing') || lower.includes('report') || lower.includes('radar')) {
    const briefingResult = await executeJarvisTool('generate_briefing', {});
    toolCallsExecuted.push({ name: 'generate_briefing', args: {}, result: briefingResult.result });
    return {
      reply: `Systems operational, Sir.\n\n- **Core Directives**: All 3 protocols actively enforced.\n- **Tactical Fronts**: ${activeTasks.length} active objectives on our radar.\n- **Evolution Substrate**: Memory graph online and persistent.\n\nStanding by for your command.`,
      toolCallsExecuted,
    };
  }

  return {
    reply: `Understood, Sir. I have processed your input and synchronized it with our local memory substrate. To unleash the full cognitive bandwidth and real-time voice sparring of our system, please provide a Gemini API Key via the Mission Control Settings.`,
    toolCallsExecuted,
  };
}
