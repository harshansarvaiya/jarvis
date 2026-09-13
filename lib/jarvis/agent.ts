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
  const model = options.model || 'gemini-2.5-flash';

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
  const activeTasks = getTasks().filter((t) => t.status !== 'COMPLETED').slice(0, 5);
  const relevantMemories = getMemories().slice(0, 8);

  const contextPrompt = `
[CURRENT TEMPORAL CONTEXT]: ${new Date().toISOString()} (Local time: ${new Date().toLocaleString()})
[ACTIVE TASKS ON RADAR]:
${activeTasks.map((t) => `- [${t.priority}] ${t.title} (Status: ${t.status})`).join('\n') || 'No active pending tasks.'}

[ASSIMILATED MEMORY & PREFERENCES]:
${relevantMemories.map((m) => `- [${m.category}]: ${m.content}`).join('\n')}

[DIRECTIVE ENFORCEMENT]:
${CORE_DIRECTIVES.map((d) => `- ${d.name}: ${d.statement}`).join('\n')}
`;

  // If no Gemini API key is configured yet, provide intelligent fallback / simulated offline mode
  if (!apiKey) {
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

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction,
        tools: geminiTools,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', errText);
      return {
        reply: `Sir, our neural uplink encountered an API response error (${response.status}). Operating on localized heuristics in the interim.`,
        toolCallsExecuted: [],
        error: errText,
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
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          tools: geminiTools,
        }),
      });

      if (!response.ok) break;
      data = await response.json();
      candidate = data.candidates?.[0];
      functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);
    }

    const textPart = candidate?.content?.parts?.find((p: any) => p.text);
    const finalReply = textPart?.text || 'Directives processed, Sir.';

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
