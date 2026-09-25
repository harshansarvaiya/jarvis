import { NextRequest, NextResponse } from 'next/server';
import {
  getUniversalChatHistory,
  appendUniversalChatMessage,
  clearUniversalChatHistory,
  ChatMessageRecord,
} from '@/lib/jarvis/storage';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';

export async function GET(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '80', 10);
    if (auth.role === 'guest') {
      const demoMessages = [
        {
          id: 'demo-welcome-1',
          role: 'assistant',
          content: `⚡ **Welcome to J.A.R.V.I.S. & F.R.I.D.A.Y. Sovereign Guest Showcase**\n\nYou are interacting directly with the Stage 5 Autonomous Multi-Engine Substrate created by **Harshan Sarvaiya (Sir)**.\n\n### Active Capabilities You Can Test:\n- **Ultra-Fast Conversational Reflex**: Ask anything to benchmark sub-200ms responses on Groq US LPU silicon.\n- **Deep Engineering Sparring**: Ask Friday to design a distributed system, analyze an algorithm, or review code.\n- **Full-Duplex Live Voice**: Tap the **LIVE CALL** button in the header or the Arc Reactor orb below to speak with live audio and instant barge-in interruption.\n- **Tactical Radar & Code Graph**: Explore the interactive visualizers in the tabs above.\n\n_How may we assist you today?_`,
          timestamp: 'Just now',
          vocalSummary: 'Welcome to J.A.R.V.I.S. and F.R.I.D.A.Y. Guest Showcase. How may we assist you today?',
        },
      ];
      return NextResponse.json({ messages: demoMessages, isDemoMode: true });
    }

    const messages = await getUniversalChatHistory(limit);
    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('API /api/jarvis/chat/history GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve chat history' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { message } = body;

    if (!message || !message.role || !message.content) {
      return NextResponse.json(
        { error: 'Valid chat message object is required' },
        { status: 400 }
      );
    }

    const record: ChatMessageRecord = {
      id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: message.role,
      content: message.content,
      image: message.image,
      toolCalls: message.toolCalls,
      timestamp: message.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      telemetry: message.telemetry,
    };

    await appendUniversalChatMessage(record);
    return NextResponse.json({ success: true, message: record });
  } catch (error: any) {
    console.error('API /api/jarvis/chat/history POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to append chat message' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    await clearUniversalChatHistory();
    return NextResponse.json({ success: true, message: 'Shared chat transmissions purged.' });
  } catch (error: any) {
    console.error('API /api/jarvis/chat/history DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to purge chat history' },
      { status: 500 }
    );
  }
}
