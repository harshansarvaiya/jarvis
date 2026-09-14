import { NextRequest, NextResponse } from 'next/server';
import { runJarvisAgent } from '@/lib/jarvis/agent';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, apiKey, model, groqApiKey, githubToken, provider, orchestrationMode } = body;

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
      orchestrationMode: orchestrationMode || 'auto',
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

          // Directive 03: Autonomous Evolutionary Memory Assimilation
          const lower = lastUser.content.toLowerCase();
          const isExplicitPref =
            lower.includes('i prefer ') ||
            lower.includes('always ') ||
            lower.includes('never ') ||
            lower.includes('remember that ') ||
            lower.includes("don't use ");

          if (isExplicitPref && lastUser.content.length < 180) {
            import('@/lib/jarvis/memory')
              .then(({ addMemory }) => {
                addMemory('PREFERENCE', lastUser.content.trim(), 'Autonomous Directive 03 Assimilation', 0.9);
              })
              .catch(() => {});
          }
        }

        if (result && result.reply) {
          await appendUniversalChatMessage({
            id: `msg-${Date.now() + 1}-a`,
            role: 'assistant',
            content: result.reply,
            toolCalls: result.toolCallsExecuted,
            timestamp: nowStr,
            telemetry: result.telemetry,
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
