import { NextRequest, NextResponse } from 'next/server';
import {
  ingestKnowledgeDocument,
  queryKnowledgeBase,
  getAllKnowledgeDocs,
  deleteKnowledgeDocument,
} from '@/lib/jarvis/rag';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';

export async function GET(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category') || undefined;
    const topK = parseInt(searchParams.get('topK') || '5', 10);

    if (query) {
      const results = await queryKnowledgeBase(query, { topK, category });
      return NextResponse.json({ success: true, query, count: results.length, results });
    }

    const docs = await getAllKnowledgeDocs();
    return NextResponse.json({ success: true, count: docs.length, documents: docs });
  } catch (error: any) {
    console.error('API /api/jarvis/knowledge GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve knowledge base records' },
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
    const { title, content, source, category, tags } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Document title and text content are required for RAG ingestion.' },
        { status: 400 }
      );
    }

    const result = await ingestKnowledgeDocument({
      title,
      content,
      source,
      category,
      tags,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully indexed "${title}" (${result.chunksIndexed} semantic chunks, ${result.totalCharacters} chars).`,
      ...result,
    });
  } catch (error: any) {
    console.error('API /api/jarvis/knowledge POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to ingest knowledge document' },
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
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('id');

    if (!docId) {
      return NextResponse.json({ error: 'docId parameter is required for deletion' }, { status: 400 });
    }

    await deleteKnowledgeDocument(docId);
    return NextResponse.json({ success: true, message: `Knowledge document ${docId} purged.` });
  } catch (error: any) {
    console.error('API /api/jarvis/knowledge DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete knowledge document' },
      { status: 500 }
    );
  }
}
