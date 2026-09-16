import { NextRequest, NextResponse } from 'next/server';
import { runJarvisAgent } from '@/lib/jarvis/agent';
import {
  getUniversalChatHistory,
  appendAgentChatMessage,
  ChatMessageRecord,
} from '@/lib/jarvis/storage';
import { transcribeAudioBuffer } from '@/lib/jarvis/audio';
import { verifyMasterKey } from '@/lib/jarvis/auth';

export const dynamic = 'force-dynamic';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-master-pin, authorization',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

/**
 * Universal Mobile Hardware & Siri Bridge (GET & POST)
 * 
 * Supports zero-friction iOS Shortcuts, Action Button, Back Tap, and Siri queries.
 */
async function handleShortcutDirective(userPrompt: string, pin: string, isVoice = false) {
  if (!userPrompt) {
    return NextResponse.json(
      {
        spokenText: 'I received an empty transmission, Sir. Please speak or type your directive.',
        reply: 'Empty prompt received.',
        error: 'Missing prompt',
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  // Guardian Sentry: Verify Master PIN if provided
  if (pin && !verifyMasterKey(pin)) {
    return NextResponse.json(
      {
        spokenText: 'Authentication failure. Access denied.',
        reply: 'Guardian Protocol: Invalid Master PIN.',
        error: 'Unauthorized',
      },
      { status: 401, headers: corsHeaders() }
    );
  }

  // 1. Pull recent chat history for seamless continuity across devices
  const rawHistory = await getUniversalChatHistory(10);
  const contextMessages = rawHistory.map((h) => ({
    id: h.id,
    role: h.role,
    content: h.content,
    image: h.image,
  }));

  // Append User Record
  const userMsgRecord: ChatMessageRecord = {
    id: `msg-${Date.now()}-u`,
    role: 'user',
    content: isVoice ? `🎙️ [Mobile Voice]: "${userPrompt}"` : userPrompt,
    timestamp: new Date().toISOString(),
    source: 'jarvis',
    channel: 'shortcut',
  };

  contextMessages.push({
    id: userMsgRecord.id,
    role: userMsgRecord.role,
    content: userMsgRecord.content,
    image: undefined,
  });

  // 2. Execute J.A.R.V.I.S. Core Engine
  const result = await runJarvisAgent(contextMessages, {
    model: 'gemini-3.7-flash',
    orchestrationMode: 'auto',
  });

  // 3. Persist Assistant Record to Universal Brain
  const assistantMsgRecord: ChatMessageRecord = {
    id: `msg-${Date.now()}-a`,
    role: 'assistant',
    content: result.reply,
    vocalSummary: result.vocalSummary,
    tacticalActions: result.tacticalActions,
    toolCalls: result.toolCallsExecuted,
    telemetry: result.telemetry,
    timestamp: new Date().toISOString(),
    source: 'jarvis',
    channel: 'shortcut',
  };

  await Promise.all([
    appendAgentChatMessage(userMsgRecord, 'jarvis', 'shortcut'),
    appendAgentChatMessage(assistantMsgRecord, 'jarvis', 'shortcut'),
  ]);

  // Prepare speech-friendly text for Siri "Speak Text"
  let spokenText = result.vocalSummary || result.reply;
  spokenText = spokenText
    .replace(/[*#`_~\[\]\(\)]/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  return NextResponse.json(
    {
      status: 'success',
      spokenText,
      reply: result.reply,
      vocalSummary: result.vocalSummary,
      tacticalActions: result.tacticalActions,
      telemetry: result.telemetry,
    },
    { headers: corsHeaders() }
  );
}

/**
 * GET Handler — Zero-Config Apple Shortcut Pipeline
 * URL format: https://jarvis-iota-beige.vercel.app/api/jarvis/shortcut?prompt=hello&pin=1010
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const prompt = searchParams.get('prompt') || searchParams.get('text') || searchParams.get('q') || '';
    const pin = searchParams.get('pin') || req.headers.get('x-master-pin') || '';
    const isVoice = searchParams.get('voice') !== 'false';

    return await handleShortcutDirective(prompt.trim(), pin.trim(), isVoice);
  } catch (err: any) {
    console.error('[Shortcut GET Error]:', err);
    return NextResponse.json(
      {
        spokenText: 'A temporary cognitive error occurred while processing your request, Sir.',
        reply: `Error: ${err.message}`,
        error: err.message,
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * POST Handler — Structured JSON / Multimodal Form-Data
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let userPrompt = '';
    let isVoice = true;
    let pinHeader = req.headers.get('x-master-pin') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      userPrompt = (body.prompt || body.text || body.query || '').trim();
      if (body.pin) pinHeader = body.pin;
      if (typeof body.isVoice === 'boolean') isVoice = body.isVoice;

      if (body.audioBase64) {
        const buffer = Buffer.from(body.audioBase64, 'base64');
        const transcript = await transcribeAudioBuffer(buffer, 'voice.m4a', 'audio/mp4');
        if (transcript.text) {
          userPrompt = transcript.text;
          isVoice = true;
        }
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const text = formData.get('text') as string;
      const file = formData.get('file') as Blob;
      const pin = formData.get('pin') as string;
      if (pin) pinHeader = pin;

      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const transcript = await transcribeAudioBuffer(buffer, 'mobile-audio.m4a', file.type || 'audio/mp4');
        if (transcript.text) {
          userPrompt = transcript.text;
          isVoice = true;
        }
      } else if (text) {
        userPrompt = text.trim();
      }
    } else {
      userPrompt = (await req.text()).trim();
    }

    return await handleShortcutDirective(userPrompt, pinHeader, isVoice);
  } catch (err: any) {
    console.error('[Shortcut POST Error]:', err);
    return NextResponse.json(
      {
        spokenText: 'A temporary cognitive error occurred while processing your request, Sir.',
        reply: `Error: ${err.message}`,
        error: err.message,
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}
