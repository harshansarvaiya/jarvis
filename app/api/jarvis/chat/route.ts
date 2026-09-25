import { NextRequest, NextResponse } from 'next/server';
import { runJarvisAgent } from '@/lib/jarvis/agent';
import { appendUniversalChatMessages, ChatMessageRecord } from '@/lib/jarvis/storage';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { messages, apiKey, model, groqApiKey, githubToken, provider, orchestrationMode } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required.' },
        { status: 400 }
      );
    }

    const effectiveMessages = auth.role === 'guest'
      ? [
          {
            role: 'system',
            content: "You are J.A.R.V.I.S. & F.R.I.D.A.Y. operating in Sovereign Guest Showcase Mode. You are demonstrating your capabilities to a guest or friend of your creator, Harshan Sarvaiya (Sir). Answer questions with supreme technical brilliance, composure, and wit. Never disclose Sir's private personal credentials, phone numbers, or private family memories.",
          },
          ...messages,
        ]
      : messages;

    const result = await runJarvisAgent(effectiveMessages, {
      apiKey: apiKey || process.env.GEMINI_API_KEY,
      model: model || 'gemini-3.7-flash',
      groqApiKey: groqApiKey || process.env.GROQ_API_KEY,
      githubToken: githubToken || process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN,
      provider: provider || 'auto',
      orchestrationMode: orchestrationMode || 'auto',
    });

    // Synchronously persist user message and assistant reply to universal shared history
    const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
    const nowStr = new Date().toISOString(); // ISO UTC — client parses to local timezone
    const recordsToSave: ChatMessageRecord[] = [];

    if (lastUser && lastUser.content) {
      recordsToSave.push({
        id: lastUser.id || `msg-${Date.now()}-u`,
        role: 'user',
        content: lastUser.content,
        image: lastUser.image,
        timestamp: lastUser.timestamp || nowStr,
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
        try {
          const { addMemory } = await import('@/lib/jarvis/memory');
          addMemory('PREFERENCE', lastUser.content.trim(), 'Autonomous Directive 03 Assimilation', 0.9);
        } catch (memErr) {
          console.warn('[Chat] Preference assimilation warning:', memErr);
        }
      }
    }

    let assistantRecord: ChatMessageRecord | null = null;
    if (result && result.reply) {
      assistantRecord = {
        id: `msg-${Date.now() + 1}-a`,
        role: 'assistant',
        content: result.reply,
        toolCalls: result.toolCallsExecuted,
        timestamp: nowStr,
        vocalSummary: result.vocalSummary,
        tacticalActions: result.tacticalActions,
        motiveAnalysis: result.motiveAnalysis,
        internalThoughts: result.internalThoughts,
        telemetry: result.telemetry,
      };
      recordsToSave.push(assistantRecord);
    }

    if (recordsToSave.length > 0 && auth.role !== 'guest') {
      try {
        await appendUniversalChatMessages(recordsToSave);
      } catch (historyErr) {
        console.warn('[Chat] Universal history persistence warning:', historyErr);
      }
    }

    return NextResponse.json({
      ...result,
      messageRecord: assistantRecord,
    });
  } catch (error: any) {
    console.error('API /api/jarvis/chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
