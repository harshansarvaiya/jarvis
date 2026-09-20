/**
 * J.A.R.V.I.S. / F.R.I.D.A.Y. Mark II — Codebase Memory MCP Bridge
 * 
 * Invokes the zero-dependency C binary `codebase-memory-mcp` to perform
 * sub-second graph traversals, AST symbol searches, and architectural breakdowns
 * over the local project repository.
 * 
 * Complies with Directive 01 (Guardian Protocol) & Directive 04 (Sovereign Loyalty).
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const CBM_BINARY = process.env.CBM_BINARY_PATH || `${process.env.HOME}/.local/bin/codebase-memory-mcp`;
const PROJECT_NAME = 'home-harshans279-jarvis';
const REPO_PATH = '/home/harshans279/jarvis';

export interface GraphQueryResult {
  success: boolean;
  output: any;
  latencyMs: number;
  error?: string;
}

/**
 * Execute a one-shot CLI command via codebase-memory-mcp
 */
async function runCBMTool(toolName: string, flags: string = ''): Promise<GraphQueryResult> {
  const startTime = Date.now();
  try {
    const cmd = `${CBM_BINARY} cli ${toolName} ${flags} --json`;
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: REPO_PATH,
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
    });

    let jsonResult: any = null;
    try {
      jsonResult = JSON.parse(stdout.trim());
    } catch {
      jsonResult = stdout.trim();
    }

    return {
      success: true,
      output: jsonResult,
      latencyMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      success: false,
      output: null,
      error: err.message || String(err),
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Search the codebase knowledge graph for symbols, functions, and interfaces matching a query
 */
export async function searchCodebaseGraph(query: string): Promise<GraphQueryResult> {
  const safeQuery = query.replace(/["']/g, '');
  const cbmRes = await runCBMTool('search_graph', `--query="${safeQuery}" --project="${PROJECT_NAME}"`);
  if (cbmRes.success && cbmRes.output) {
    return cbmRes;
  }

  // Graceful fallback to pure TypeScript AST Semantic Code Graph with Vertex vector embeddings
  try {
    const { searchCodeGraph } = await import('./codebase-graph');
    const matches = await searchCodeGraph(query, { limit: 6 });
    return {
      success: true,
      output: matches.map((m) => ({
        id: m.symbol.id,
        name: m.symbol.name,
        kind: m.symbol.kind,
        file: m.symbol.file,
        line: m.symbol.line,
        signature: m.symbol.signature,
        score: m.score,
        matchReason: m.matchReason,
      })),
      latencyMs: cbmRes.latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      output: null,
      error: err.message || String(err),
      latencyMs: cbmRes.latencyMs,
    };
  }
}

/**
 * Get high-level architectural domain overview (nodes, edges, HTTP routes, language distribution)
 */
export async function getCodebaseArchitecture(): Promise<GraphQueryResult> {
  const cbmRes = await runCBMTool('get_architecture', `--project="${PROJECT_NAME}"`);
  if (cbmRes.success && cbmRes.output) {
    return cbmRes;
  }

  try {
    const { getCodeGraphSummary } = await import('./codebase-graph');
    const summary = await getCodeGraphSummary();
    return {
      success: true,
      output: summary,
      latencyMs: cbmRes.latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      output: null,
      error: err.message || String(err),
      latencyMs: cbmRes.latencyMs,
    };
  }
}

/**
 * Get file symbol outline (functions, interfaces, variables)
 */
export async function getFileOutline(filePath: string): Promise<GraphQueryResult> {
  const safePath = path.isAbsolute(filePath) ? path.relative(REPO_PATH, filePath) : filePath;
  const cbmRes = await runCBMTool('get_file_outline', `--file="${safePath}" --project="${PROJECT_NAME}"`);
  if (cbmRes.success && cbmRes.output) {
    return cbmRes;
  }

  try {
    const { searchCodeGraph } = await import('./codebase-graph');
    const matches = await searchCodeGraph('', { fileFilter: safePath, limit: 30 });
    return {
      success: true,
      output: matches.map((m) => m.symbol),
      latencyMs: cbmRes.latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      output: null,
      error: err.message || String(err),
      latencyMs: cbmRes.latencyMs,
    };
  }
}

/**
 * Trace call path and graph connections for a target symbol
 */
export async function traceCodePath(symbol: string): Promise<GraphQueryResult> {
  const safeSymbol = symbol.replace(/["']/g, '');
  const cbmRes = await runCBMTool('trace_path', `--target="${safeSymbol}" --project="${PROJECT_NAME}"`);
  if (cbmRes.success && cbmRes.output) {
    return cbmRes;
  }

  try {
    const { traceSymbolDependencies } = await import('./codebase-graph');
    const trace = traceSymbolDependencies(safeSymbol);
    return {
      success: true,
      output: trace,
      latencyMs: cbmRes.latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      output: null,
      error: err.message || String(err),
      latencyMs: cbmRes.latencyMs,
    };
  }
}

/**
 * Trigger incremental index update on the repository
 */
export async function updateCodebaseIndex(): Promise<GraphQueryResult> {
  const cbmRes = await runCBMTool('index_repository', `'{"repo_path":"${REPO_PATH}"}'`);
  if (cbmRes.success && cbmRes.output) {
    return cbmRes;
  }

  try {
    const { indexCodebaseGraph } = await import('./codebase-graph');
    const summary = await indexCodebaseGraph({ embedWithVertex: true });
    return {
      success: true,
      output: summary,
      latencyMs: cbmRes.latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      output: null,
      error: err.message || String(err),
      latencyMs: cbmRes.latencyMs,
    };
  }
}

