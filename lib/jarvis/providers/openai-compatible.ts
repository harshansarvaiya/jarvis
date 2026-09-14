/**
 * J.A.R.V.I.S. OpenAI-Compatible Universal Engine
 * Powers independent, non-Google frontier and open-weights fleets:
 *  - Groq Cloud (Meta Llama 3.3 70B / 8B - US Custom LPU Silicon)
 *  - GitHub Models (OpenAI GPT-4o / GPT-4o-mini - Microsoft Infrastructure)
 *  - OpenAI Direct (GPT-4o / o3-mini)
 * 
 * Implements native multi-turn tool calling and conversational synthesis.
 * Directive 01 & Directive 04 Compliant: Zero single-vendor lock-in.
 */

import { JARVIS_TOOLS, executeJarvisTool } from '../tools';

export interface OpenAICompatibleMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface OpenAICompatibleOptions {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  extraHeaders?: Record<string, string>;
}

export async function runOpenAICompatibleAgent(
  messages: Array<{ role: string; content: string; image?: string }>,
  options: OpenAICompatibleOptions
): Promise<{
  reply: string;
  toolCallsExecuted: Array<{ name: string; args: any; result: any }>;
  error?: string;
}> {
  const { endpoint, apiKey, model, systemPrompt, temperature = 0.4, maxTokens = 4096, extraHeaders = {} } = options;

  const toolCallsExecuted: Array<{ name: string; args: any; result: any }> = [];

  // 1. Format tools according to standard OpenAI function calling specification
  const formattedTools = JARVIS_TOOLS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  // 2. Format conversation payload
  const formattedMessages: OpenAICompatibleMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  for (const m of messages.slice(-10)) {
    const role = m.role === 'model' ? 'assistant' : (m.role as any);
    formattedMessages.push({
      role: role === 'assistant' ? 'assistant' : 'user',
      content: m.content || '',
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...extraHeaders,
  };

  try {
    let loopCount = 0;
    let finalContent = '';

    while (loopCount < 3) {
      loopCount++;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          tools: formattedTools,
          tool_choice: 'auto',
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[OpenAICompatible] HTTP ${res.status} from ${endpoint}:`, errText);
        throw new Error(`Provider HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      if (!message) {
        throw new Error('Empty response payload from provider.');
      }

      // Check if tool calls were requested
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Append assistant's function call message to history
        formattedMessages.push(message);

        for (const call of message.tool_calls) {
          let parsedArgs: any = {};
          try {
            parsedArgs = JSON.parse(call.function.arguments || '{}');
          } catch {
            parsedArgs = {};
          }

          const toolResult = await executeJarvisTool(call.function.name, parsedArgs);
          toolCallsExecuted.push({
            name: call.function.name,
            args: parsedArgs,
            result: toolResult.result || toolResult.error,
          });

          // Append tool response
          formattedMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(toolResult),
          });
        }

        // Loop again to synthesize final response with tool outputs
        continue;
      }

      // Plain text response received
      finalContent = message.content || message.reasoning || '';
      break;
    }

    if (!finalContent && toolCallsExecuted.length > 0) {
      finalContent = `Sir, I have executed your instructions directly:\n\n${toolCallsExecuted
        .map((tc) => `- ${tc.result?.message || tc.name + ' executed successfully.'}`)
        .join('\n')}`;
    }

    return {
      reply: finalContent || 'Acknowledged and synchronized, Sir.',
      toolCallsExecuted,
    };
  } catch (err: any) {
    console.error('[OpenAICompatible] Agent execution exception:', err);
    return {
      reply: `Sir, our secondary neural uplink encountered interference: ${err.message}. Local state and safeguards remain fully intact.`,
      toolCallsExecuted,
      error: err.message,
    };
  }
}
