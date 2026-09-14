import { NextRequest, NextResponse } from 'next/server';
import { getMemories, addMemory, searchMemories, loadJarvisState } from '@/lib/jarvis/memory';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category');

    if (query) {
      const results = searchMemories(query);
      return NextResponse.json({ memories: results });
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
