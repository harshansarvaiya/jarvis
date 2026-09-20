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
