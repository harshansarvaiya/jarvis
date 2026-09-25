import { NextRequest, NextResponse } from 'next/server';
import { wipeSensitiveKnowledge, wipeAllKnowledge } from '@/lib/jarvis/rag';
import { clearUniversalChatHistory, getUniversalStorage } from '@/lib/jarvis/storage';
import { getMemories } from '@/lib/jarvis/memory';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';

export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  if (auth.role === 'guest') {
    return NextResponse.json(
      { error: 'SECURITY GUARDIAN: System wipe and sanitization functions are permanently blocked in Guest Demonstration Mode.' },
      { status: 403 }
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'sensitive_only'; // 'sensitive_only' | 'nuclear_all'

    if (mode === 'nuclear_all') {
      // DEFCON 0: Complete system sanitization wipe
      const ragWipe = await wipeAllKnowledge();
      await clearUniversalChatHistory();

      // Reset memories to clean baseline
      const storage = getUniversalStorage();
      const state = await storage.getState();
      if (state) {
        state.tasks = [];
        state.memories = [];
        await storage.saveState(state);
      }

      return NextResponse.json({
        success: true,
        mode: 'nuclear_all',
        message: 'DEFCON 0 Emergency Wipe Complete. All knowledge records, chat logs, and custom memories have been permanently sanitized per Directive 01.',
        ragWipe,
      });
    }

    // Default: Directive 01 Guardian Sensitive Data Wipe
    const ragWipe = await wipeSensitiveKnowledge();

    // Sanitize any credential/sensitive items from Memory Vault
    const storage = getUniversalStorage();
    const state = await storage.getState();
    let sanitizedMemoriesCount = 0;

    if (state && Array.isArray(state.memories)) {
      const sensitiveKeywords = ['password', 'api_key', 'secret', 'token', 'pin', 'key', 'ghp_', 'gsk_', 'aizasy', 'private'];
      const initialCount = state.memories.length;
      
      state.memories = state.memories.filter((m) => {
        const text = `${m.content} ${m.context || ''}`.toLowerCase();
        const isSensitive = sensitiveKeywords.some((kw) => text.includes(kw));
        return !isSensitive;
      });

      sanitizedMemoriesCount = initialCount - state.memories.length;
      if (sanitizedMemoriesCount > 0) {
        await storage.saveState(state);
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'sensitive_only',
      message: `Directive 01 Guardian Wipe Executed. Sanitized ${ragWipe.chunksRemoved} sensitive knowledge chunks, ${ragWipe.docsRemoved} sensitive docs, and ${sanitizedMemoriesCount} credential memories.`,
      details: {
        ragChunksRemoved: ragWipe.chunksRemoved,
        ragDocsRemoved: ragWipe.docsRemoved,
        memoriesSanitized: sanitizedMemoriesCount,
      },
    });
  } catch (error: any) {
    console.error('API /api/jarvis/wipe error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute wipe protocol' },
      { status: 500 }
    );
  }
}
