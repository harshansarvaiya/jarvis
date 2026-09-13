import { NextRequest, NextResponse } from 'next/server';
import { runJarvisAgent } from '@/lib/jarvis/agent';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, apiKey, model } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required.' },
        { status: 400 }
      );
    }

    const result = await runJarvisAgent(messages, {
      apiKey: apiKey || process.env.GEMINI_API_KEY,
      model: model || 'gemini-2.0-flash',
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/jarvis/chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
