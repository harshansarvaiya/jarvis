import { NextResponse } from 'next/server';
import {
  getCodeGraphSummary,
  getAllCodeGraphSymbols,
  searchCodeGraph,
  traceSymbolDependencies,
  indexCodebaseGraph,
  SymbolKind,
} from '@/lib/jarvis/codebase-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');
    const target = searchParams.get('target');
    const kind = searchParams.get('kind') as SymbolKind | null;
    const fileFilter = searchParams.get('fileFilter') || undefined;

    // 1. Target Dependency & Caller Trace
    if (target) {
      const trace = traceSymbolDependencies(target);
      return NextResponse.json({
        success: true,
        trace,
      });
    }

    // 2. Semantic & Vector Symbol Search
    if (query && query.trim().length > 0) {
      const results = await searchCodeGraph(query, {
        limit: 25,
        kind: kind || undefined,
        fileFilter,
      });
      return NextResponse.json({
        success: true,
        query,
        count: results.length,
        results: results.map((r) => ({
          id: r.symbol.id,
          name: r.symbol.name,
          kind: r.symbol.kind,
          file: r.symbol.file,
          line: r.symbol.line,
          exported: r.symbol.exported,
          signature: r.symbol.signature,
          doc: r.symbol.doc,
          score: Math.round(r.score * 100) / 100,
          matchReason: r.matchReason,
        })),
      });
    }

    // 3. Full Graph Summary & Complete Node Topologies
    const summary = await getCodeGraphSummary();
    const symbols = await getAllCodeGraphSymbols();

    return NextResponse.json({
      success: true,
      summary,
      symbolsCount: symbols.length,
      symbols: symbols.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        file: s.file,
        line: s.line,
        exported: s.exported,
        signature: s.signature,
        doc: s.doc,
        dependencies: s.dependencies,
      })),
      topHubs: summary.topHubs,
    });
  } catch (err: any) {
    console.error('[CodeGraph API] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to retrieve code graph' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'reindex', forceEmbed = true } = body;

    if (action === 'reindex') {
      const summary = await indexCodebaseGraph({ embedWithVertex: forceEmbed });
      return NextResponse.json({
        success: true,
        message: 'AST Semantic Code Graph successfully reindexed.',
        summary,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[CodeGraph API POST] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to execute code graph action' },
      { status: 500 }
    );
  }
}
