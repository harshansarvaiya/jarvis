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
  const { endpoint, apiKey, model, systemPrompt, temperature = 0.4, maxTokens = 1536, extraHeaders = {} } = options;

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

  // 2. Format conversation payload with lean token window (protecting against TPM spikes)
  const formattedMessages: OpenAICompatibleMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  const recent = messages.slice(-8);
  for (let i = 0; i < recent.length; i++) {
    const m = recent[i];
    const role = m.role === 'model' ? 'assistant' : (m.role as any);
    const isCurrent = i >= recent.length - 2;
    const content = isCurrent ? (m.content || '') : (m.content || '').slice(0, 1200);
    formattedMessages.push({
      role: role === 'assistant' ? 'assistant' : 'user',
      content,
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

      const requestBody: any = {
        model,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
      };

      if (formattedTools.length > 0 && !model.includes('compound-mini') && !model.includes('whisper')) {
        requestBody.tools = formattedTools;
        requestBody.tool_choice = 'auto';
      }

      let res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        if (requestBody.tools && (errText.includes('tool calling') || errText.includes('tools'))) {
          console.warn(`[OpenAICompatible] Model ${model} does not support tools. Retrying without tools...`);
          delete requestBody.tools;
          delete requestBody.tool_choice;
          res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(6000),
          });
          if (!res.ok) {
            const retryErr = await res.text().catch(() => '');
            console.error(`[OpenAICompatible] HTTP ${res.status} from ${endpoint}:`, retryErr);
            throw new Error(`Provider HTTP ${res.status}: ${retryErr.slice(0, 200)}`);
          }
        } else {
          console.error(`[OpenAICompatible] HTTP ${res.status} from ${endpoint}:`, errText);
          throw new Error(`Provider HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }
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
      reply: '',
      toolCallsExecuted,
      error: err.message,
    };
  }
}
