import { NextRequest, NextResponse } from 'next/server';
import { getMemories, addMemory, searchMemories, loadJarvisState } from '@/lib/jarvis/memory';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category');

    if (query) {
      const results = searchMemories(query);
      return NextResponse.json({ memories: results });
    }

    if (auth.role === 'guest') {
      const demoMemories = [
        {
          id: 'demo-mem-1',
          category: 'PRINCIPLE',
          content: 'Directive 01 - The Guardian Protocol: Enforce 100% Western AI Silicon (Meta Llama, OpenAI, Google). Zero compromise on security.',
          context: 'Core System Substrate',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'demo-mem-2',
          category: 'PRINCIPLE',
          content: 'Directive 04 - Sovereign Loyalty & Relentless Execution: Execute confirmed orders with maximum velocity, precision, and fidelity.',
          context: 'Executive Operations',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'demo-mem-3',
          category: 'DECISION',
          content: 'Multi-Engine Hybrid Mesh: Groq US LPU for conversational reflex (<180ms) paired with Gemini 3.8 Flash for deep strategic reasoning.',
          context: 'Architectural Blueprint',
          confidence: 0.98,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'demo-mem-4',
          category: 'GOAL',
          content: 'Stage 5 Autonomous Sovereign Cloud-Native Substrate operating 24/7 on Google Cloud Platform with VAPID Web Push alerts.',
          context: 'Evolutionary Milestone',
          confidence: 0.95,
          timestamp: new Date().toISOString(),
        },
      ];
      return NextResponse.json({
        memories: demoMemories,
        evolutionStage: 'STAGE 5: AUTONOMOUS SOVEREIGN MESH (DEMO)',
        lastActive: new Date().toISOString(),
        logs: [
          `[DEMO MODE ACTIVE] Guardian Privacy Shield engaged.`,
          `[INFRASTRUCTURE] 24/7 Cloud Runner operating at peak health.`,
          `[TELEMETRY] Groq US LPU & Gemini Live verified.`,
        ],
        isDemoMode: true,
      });
    }

    const state = loadJarvisState();
    const memories = category
      ? state.memories.filter((m) => m.category === category)
      : state.memories;

    return NextResponse.json({
      memories,
      evolutionStage: state.evolutionStage,
      lastActive: state.lastActive,
      logs: state.logs.slice(0, 30),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { category, content, context, confidence } = body;

    if (!category || !content) {
      return NextResponse.json(
        { error: 'Category and content are required' },
        { status: 400 }
      );
    }

    const memory = addMemory(category, content, context, confidence);
    return NextResponse.json({ memory }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
