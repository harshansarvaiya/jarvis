/**
 * J.A.R.V.I.S. / F.R.I.D.A.Y. Mark II — Codebase Memory MCP Bridge & TurboQuant Compression
 * 
 * Invokes the zero-dependency C binary `codebase-memory-mcp` or pure AST graph with
 * TurboQuant 8-bit data-oblivious vector compression (ryancodrai/turbovec pattern)
 * to perform sub-second graph traversals, AST symbol searches, and architectural breakdowns.
 * 
 * Complies with Directive 01 (Guardian Protocol) & Directive 04 (Sovereign Loyalty).
 */

import { exec } from 'child_process';
import { promisify } from 'util';

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
 * TurboQuant 8-bit Data-Oblivious Vector Compression & Quantization Engine
 * Compresses dense AST embeddings (768d/1536d) by 4x for sub-millisecond in-memory similarity search
 * with zero codebook training overhead.
 */
export interface QuantizedVector {
  dim: number;
  packed: Uint8Array;
  scale: number;
  offset: number;
}

export function quantizeVectorInt8(vector: number[]): QuantizedVector {
  const dim = vector.length;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < dim; i++) {
    const v = vector[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1e-6;
  const scale = range / 255;
  const offset = min;
  const packed = new Uint8Array(dim);
  for (let i = 0; i < dim; i++) {
    packed[i] = Math.round((vector[i] - offset) / scale);
  }
  return { dim, packed, scale, offset };
}

export function dequantizeVectorInt8(qv: QuantizedVector): number[] {
  const out = new Array<number>(qv.dim);
  for (let i = 0; i < qv.dim; i++) {
    out[i] = qv.packed[i] * qv.scale + qv.offset;
  }
  return out;
}

export function dotProductQuantized(a: QuantizedVector, b: QuantizedVector): number {
  if (a.dim !== b.dim) return 0;
  let rawSum = 0;
  let sumA = 0;
  let sumB = 0;
  const len = a.dim;
  for (let i = 0; i < len; i++) {
    const valA = a.packed[i];
    const valB = b.packed[i];
    rawSum += valA * valB;
    sumA += valA;
    sumB += valB;
  }
  return (
    a.scale * b.scale * rawSum +
    a.scale * b.offset * sumA +
    b.scale * a.offset * sumB +
    len * a.offset * b.offset
  );
}

/**
 * Execute a one-shot CLI command via codebase-memory-mcp
 */
async function runCBMTool(toolName: string, flags: string = ''): Promise<GraphQueryResult> {
  const startTime = Date.now();
  try {
    const cmd = `${CBM_BINARY} cli ${toolName} ${flags} --json`;
    const { stdout } = await execAsync(cmd, {
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
 * Get high-level architectural hub breakdown
 */
export async function getCodebaseArchitecture(): Promise<GraphQueryResult> {
  const cbmRes = await runCBMTool('architecture', `--project="${PROJECT_NAME}"`);
  if (cbmRes.success && cbmRes.output) {
    return cbmRes;
  }

  try {
    const { getCodeGraphSummary } = await import('./codebase-graph');
    const summary = getCodeGraphSummary();
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
 * Outline file definitions, symbols, and hierarchy
 */
export async function getFileOutline(filePath: string): Promise<GraphQueryResult> {
  const safePath = filePath.replace(/["']/g, '');
  const cbmRes = await runCBMTool('file_outline', `--file="${safePath}" --project="${PROJECT_NAME}"`);
  if (cbmRes.success && cbmRes.output) {
    return cbmRes;
  }

  try {
    const { searchCodeGraph } = await import('./codebase-graph');
    const matches = await searchCodeGraph('', { fileFilter: safePath, limit: 50 });
    return {
      success: true,
      output: {
        file: safePath,
        symbols: matches.map((m) => ({
          name: m.symbol.name,
          kind: m.symbol.kind,
          line: m.symbol.line,
          signature: m.symbol.signature,
        })),
      },
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
