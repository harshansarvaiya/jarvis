import { NextRequest, NextResponse } from 'next/server';
import { runJarvisAgent } from '@/lib/jarvis/agent';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, apiKey, model, groqApiKey, githubToken, provider } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required.' },
        { status: 400 }
      );
    }

    const result = await runJarvisAgent(messages, {
      apiKey: apiKey || process.env.GEMINI_API_KEY,
      model: model || 'gemini-3.8-flash',
      groqApiKey: groqApiKey || process.env.GROQ_API_KEY,
      githubToken: githubToken || process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN,
      provider: provider || 'auto',
    });

    // Asynchronously record user message and assistant reply to universal shared history
    import('@/lib/jarvis/storage')
      .then(async ({ appendUniversalChatMessage }) => {
        const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (lastUser && lastUser.content) {
          await appendUniversalChatMessage({
            id: `msg-${Date.now()}-u`,
            role: 'user',
            content: lastUser.content,
            image: lastUser.image,
            timestamp: nowStr,
          });
        }

        if (result && result.reply) {
          await appendUniversalChatMessage({
            id: `msg-${Date.now() + 1}-a`,
            role: 'assistant',
            content: result.reply,
            toolCalls: result.toolCallsExecuted,
            timestamp: nowStr,
          });
        }
      })
      .catch((err) => console.warn('[Chat] Background history sync warning:', err));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/jarvis/chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
