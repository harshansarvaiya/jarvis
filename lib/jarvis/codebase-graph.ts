/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. Mark II — AST-Level Semantic Code Graph Indexer
 * 
 * High-performance semantic codebase indexer powered by TypeScript AST parsing
 * and Google Cloud Vertex AI text-embedding-004 vectors.
 * 
 * Enables Friday & Jarvis to query symbol relationships, architecture topologies,
 * and semantic call-graphs with sub-50ms latency.
 * 
 * Complies with Directive 01 (Guardian Protocol), Directive 04 (Sovereign Loyalty),
 * and Directive 06 (Zero-Thrashing Infrastructure Integrity).
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { callVertexAIEmbeddings, isVertexAIAvailable } from './vertex';
import { getStorage } from './storage';

export type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum' | 'component' | 'route';

export interface CodeGraphSymbol {
  id: string;
  name: string;
  kind: SymbolKind;
  file: string;
  line: number;
  exported: boolean;
  signature: string;
  doc: string;
  dependencies: string[];
  embedding?: number[];
}

export interface CodeGraphDependency {
  sourceFile: string;
  targetModule: string;
  importedSymbols: string[];
}

export interface CodeGraphSummary {
  totalFiles: number;
  totalSymbols: number;
  symbolCounts: Record<SymbolKind, number>;
  topHubs: Array<{ file: string; importedCount: number; dependentCount: number }>;
  lastIndexed: string;
  embeddingCoverage: string;
}

export interface CodeGraphSearchResult {
  symbol: CodeGraphSymbol;
  score: number;
  matchReason: 'exact_name' | 'partial_name' | 'semantic_vector' | 'signature_match';
}

const REPO_ROOT = process.env.REPO_PATH || '/home/harshans279/jarvis';
const REDIS_SUMMARY_KEY = 'jarvis:codegraph:summary';
const REDIS_SYMBOLS_KEY = 'jarvis:codegraph:symbols';

// In-memory memory-tier cache for ultra-low latency (<5ms)
let cachedGraph: {
  symbols: CodeGraphSymbol[];
  dependencies: CodeGraphDependency[];
  summary: CodeGraphSummary | null;
  timestamp: number;
} = {
  symbols: [],
  dependencies: [],
  summary: null,
  timestamp: 0,
};

/**
 * Traverses directory recursively collecting source files (.ts, .tsx)
 */
function scanSourceFiles(dir: string, baseDir: string = dir): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === 'coverage' ||
        entry.name === 'scratch'
      ) {
        continue;
      }
      results.push(...scanSourceFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        results.push(relPath);
      }
    }
  }
  return results;
}

/**
 * Extracts JSDoc / comments preceding a node
 */
function extractDocComment(node: ts.Node, sourceFile: ts.SourceFile): string {
  const fullText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
  if (!ranges || ranges.length === 0) return '';

  return ranges
    .map((r) => fullText.slice(r.pos, r.end).trim())
    .join('\n')
    .replace(/^\/\*\*?|\*\/$/g, '')
    .replace(/^\s*\*\s?/gm, '')
    .trim();
}

/**
 * Calculates cosine similarity between two dense vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Parses a TypeScript file using AST and extracts symbols and import dependencies
 */
function parseSourceFileAST(
  relPath: string,
  fullPath: string
): { symbols: CodeGraphSymbol[]; dependencies: CodeGraphDependency[] } {
  const symbols: CodeGraphSymbol[] = [];
  const dependencies: CodeGraphDependency[] = [];

  let sourceCode = '';
  try {
    sourceCode = fs.readFileSync(fullPath, 'utf8');
  } catch {
    return { symbols, dependencies };
  }

  const sourceFile = ts.createSourceFile(
    relPath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    relPath.endsWith('.tsx') || relPath.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  function visit(node: ts.Node) {
    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const lineNumber = lineAndChar.line + 1;
    const doc = extractDocComment(node, sourceFile);

    // 1. Import Declarations
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
      const importedSymbols: string[] = [];

      if (node.importClause) {
        if (node.importClause.name) {
          importedSymbols.push(node.importClause.name.getText(sourceFile));
        }
        if (node.importClause.namedBindings) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            for (const elem of node.importClause.namedBindings.elements) {
              importedSymbols.push(elem.name.getText(sourceFile));
            }
          } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
            importedSymbols.push(`* as ${node.importClause.namedBindings.name.getText(sourceFile)}`);
          }
        }
      }

      dependencies.push({
        sourceFile: relPath,
        targetModule: moduleSpecifier,
        importedSymbols,
      });
    }

    // 2. Function Declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.getText(sourceFile);
      const isExported = Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
      const sig = node.getText(sourceFile).split('{')[0].trim();

      symbols.push({
        id: `${relPath}#${name}`,
        name,
        kind: relPath.includes('component') || /^[A-Z]/.test(name) ? 'component' : 'function',
        file: relPath,
        line: lineNumber,
        exported: isExported,
        signature: sig,
        doc,
        dependencies: [],
      });
    }

    // 3. Class Declarations
    if (ts.isClassDeclaration(node) && node.name) {
      const name = node.name.getText(sourceFile);
      const isExported = Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
      const sig = `class ${name}` + (node.heritageClauses ? ` ${node.heritageClauses.map((h) => h.getText(sourceFile)).join(' ')}` : '');

      symbols.push({
        id: `${relPath}#${name}`,
        name,
        kind: 'class',
        file: relPath,
        line: lineNumber,
        exported: isExported,
        signature: sig,
        doc,
        dependencies: [],
      });
    }

    // 4. Interface Declarations
    if (ts.isInterfaceDeclaration(node)) {
      const name = node.name.getText(sourceFile);
      const isExported = Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
      const sig = `interface ${name}` + (node.heritageClauses ? ` ${node.heritageClauses.map((h) => h.getText(sourceFile)).join(' ')}` : '');

      symbols.push({
        id: `${relPath}#${name}`,
        name,
        kind: 'interface',
        file: relPath,
        line: lineNumber,
        exported: isExported,
        signature: sig,
        doc,
        dependencies: [],
      });
    }

    // 5. Type Alias Declarations
    if (ts.isTypeAliasDeclaration(node)) {
      const name = node.name.getText(sourceFile);
      const isExported = Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
      const sig = `type ${name} = ...`;

      symbols.push({
        id: `${relPath}#${name}`,
        name,
        kind: 'type',
        file: relPath,
        line: lineNumber,
        exported: isExported,
        signature: sig,
        doc,
        dependencies: [],
      });
    }

    // 6. Enum Declarations
    if (ts.isEnumDeclaration(node)) {
      const name = node.name.getText(sourceFile);
      const isExported = Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
      const sig = `enum ${name}`;

      symbols.push({
        id: `${relPath}#${name}`,
        name,
        kind: 'enum',
        file: relPath,
        line: lineNumber,
        exported: isExported,
        signature: sig,
        doc,
        dependencies: [],
      });
    }

    // 7. Exported Variable / Arrow Function / Const Declarations
    if (ts.isVariableStatement(node)) {
      const isExported = Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
      if (isExported) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            const name = decl.name.getText(sourceFile);
            const isFn = decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer));
            const sig = `export const ${name}${decl.type ? `: ${decl.type.getText(sourceFile)}` : isFn ? ' = (...)' : ''}`;

            symbols.push({
              id: `${relPath}#${name}`,
              name,
              kind: isFn ? (relPath.includes('component') || /^[A-Z]/.test(name) ? 'component' : 'function') : 'variable',
              file: relPath,
              line: lineNumber,
              exported: true,
              signature: sig,
              doc,
              dependencies: [],
            });
          }
        }
      }
    }

    // Route identification for Next.js App Router (app/api/**/route.ts)
    if (relPath.startsWith('app/') && relPath.endsWith('route.ts') && ts.isFunctionDeclaration(node) && node.name) {
      const method = node.name.getText(sourceFile);
      if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        symbols.push({
          id: `${relPath}#${method}`,
          name: `${method} /${relPath.replace(/^app\//, '').replace(/\/route\.ts$/, '')}`,
          kind: 'route',
          file: relPath,
          line: lineNumber,
          exported: true,
          signature: `export async function ${method}(req: Request)`,
          doc,
          dependencies: [],
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { symbols, dependencies };
}

/**
 * Builds the complete AST Semantic Code Graph and indexes with Vertex AI Embeddings
 */
export async function indexCodebaseGraph(options: {
  embedWithVertex?: boolean;
  repoRoot?: string;
} = {}): Promise<CodeGraphSummary> {
  const root = options.repoRoot || REPO_ROOT;
  const embed = options.embedWithVertex !== false && isVertexAIAvailable();

  const searchDirs = ['lib', 'components', 'app', 'scripts'].map((d) => path.join(root, d));
  const allFiles: string[] = [];

  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      allFiles.push(...scanSourceFiles(dir, root));
    }
  }

  const allSymbols: CodeGraphSymbol[] = [];
  const allDependencies: CodeGraphDependency[] = [];

  for (const relPath of allFiles) {
    const fullPath = path.join(root, relPath);
    const { symbols, dependencies } = parseSourceFileAST(relPath, fullPath);
    allSymbols.push(...symbols);
    allDependencies.push(...dependencies);
  }

  // Count symbols by kind
  const symbolCounts: Record<SymbolKind, number> = {
    function: 0,
    class: 0,
    interface: 0,
    type: 0,
    variable: 0,
    enum: 0,
    component: 0,
    route: 0,
  };

  for (const s of allSymbols) {
    if (symbolCounts[s.kind] !== undefined) {
      symbolCounts[s.kind]++;
    }
  }

  // Calculate dependency hubs
  const moduleInDegree: Record<string, number> = {};
  const moduleOutDegree: Record<string, number> = {};

  for (const dep of allDependencies) {
    moduleOutDegree[dep.sourceFile] = (moduleOutDegree[dep.sourceFile] || 0) + 1;
    moduleInDegree[dep.targetModule] = (moduleInDegree[dep.targetModule] || 0) + 1;
  }

  const topHubs = Object.keys(moduleOutDegree)
    .map((file) => ({
      file,
      importedCount: moduleOutDegree[file] || 0,
      dependentCount: moduleInDegree[file] || 0,
    }))
    .sort((a, b) => b.importedCount + b.dependentCount - (a.importedCount + a.dependentCount))
    .slice(0, 10);

  // Compute Vertex AI dense vector embeddings for top/exported symbols
  let embeddedCount = 0;
  if (embed && allSymbols.length > 0) {
    try {
      // Prioritize exported symbols and major interfaces
      const toEmbed = allSymbols.filter((s) => s.exported || s.kind === 'interface' || s.kind === 'function');
      const textsToEmbed = toEmbed.map(
        (s) => `[${s.kind.toUpperCase()}] ${s.name} in ${s.file}\nSignature: ${s.signature}\nDoc: ${s.doc || 'N/A'}`
      );

      const embeddings = await callVertexAIEmbeddings(textsToEmbed);
      for (let i = 0; i < toEmbed.length; i++) {
        if (embeddings[i] && embeddings[i].length > 0) {
          toEmbed[i].embedding = embeddings[i];
          embeddedCount++;
        }
      }
    } catch (embErr) {
      console.warn('[CodebaseGraph] Vertex embedding generation warning:', embErr);
    }
  }

  const summary: CodeGraphSummary = {
    totalFiles: allFiles.length,
    totalSymbols: allSymbols.length,
    symbolCounts,
    topHubs,
    lastIndexed: new Date().toISOString(),
    embeddingCoverage: `${embeddedCount}/${allSymbols.length} (${Math.round((embeddedCount / (allSymbols.length || 1)) * 100)}%)`,
  };

  // Update in-memory cache
  cachedGraph = {
    symbols: allSymbols,
    dependencies: allDependencies,
    summary,
    timestamp: Date.now(),
  };

  // Persist summary to Upstash Redis
  try {
    const storage = getStorage();
    await storage.execute('SET', REDIS_SUMMARY_KEY, JSON.stringify(summary));
    // Persist a lightweight symbol table (without full embeddings to save Redis bandwidth)
    const lightSymbols = allSymbols.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      file: s.file,
      line: s.line,
      exported: s.exported,
      signature: s.signature,
    }));
    await storage.execute('SET', REDIS_SYMBOLS_KEY, JSON.stringify(lightSymbols));
  } catch (storeErr) {
    console.warn('[CodebaseGraph] Upstash sync warning:', storeErr);
  }

  return summary;
}

/**
 * Searches the Code Graph using hybrid Lexical + AST Symbol + Dense Semantic Vector similarity
 */
export async function searchCodeGraph(
  query: string,
  options: { limit?: number; kind?: SymbolKind; fileFilter?: string } = {}
): Promise<CodeGraphSearchResult[]> {
  const limit = options.limit || 8;

  // Auto-index if memory graph is empty
  if (cachedGraph.symbols.length === 0) {
    await indexCodebaseGraph({ embedWithVertex: true });
  }

  const cleanQuery = query.trim().toLowerCase();
  const results: CodeGraphSearchResult[] = [];

  // Compute query embedding via Vertex AI if available
  let queryEmbedding: number[] | null = null;
  if (isVertexAIAvailable()) {
    try {
      const embRes = await callVertexAIEmbeddings([query]);
      if (embRes && embRes[0] && embRes[0].length > 0) {
        queryEmbedding = embRes[0];
      }
    } catch {
      // Graceful fallback to lexical/AST matching
    }
  }

  for (const sym of cachedGraph.symbols) {
    if (options.kind && sym.kind !== options.kind) continue;
    if (options.fileFilter && !sym.file.includes(options.fileFilter)) continue;

    const symNameLower = sym.name.toLowerCase();
    let score = 0;
    let matchReason: CodeGraphSearchResult['matchReason'] = 'signature_match';

    // 1. Exact Name Match (Highest priority)
    if (symNameLower === cleanQuery) {
      score += 10.0;
      matchReason = 'exact_name';
    } else if (symNameLower.includes(cleanQuery) || cleanQuery.includes(symNameLower)) {
      score += 5.0;
      matchReason = 'partial_name';
    }

    // 2. Signature and Docstring token match
    const sigLower = sym.signature.toLowerCase();
    const docLower = sym.doc.toLowerCase();
    const queryTokens = cleanQuery.split(/\s+/).filter((t) => t.length > 2);

    for (const token of queryTokens) {
      if (sigLower.includes(token)) score += 1.5;
      if (docLower.includes(token)) score += 1.0;
      if (sym.file.toLowerCase().includes(token)) score += 0.8;
    }

    // 3. Dense Vector Cosine Similarity (Semantic reasoning boost)
    if (queryEmbedding && sym.embedding && sym.embedding.length > 0) {
      const sim = cosineSimilarity(queryEmbedding, sym.embedding);
      if (sim > 0.5) {
        score += sim * 4.0;
        if (score > 6.0 && matchReason === 'signature_match') {
          matchReason = 'semantic_vector';
        }
      }
    }

    if (score > 0.5) {
      results.push({ symbol: sym, score, matchReason });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Finds all incoming and outgoing dependencies for a given symbol or file
 */
export function traceSymbolDependencies(symbolOrFileName: string): {
  symbol?: CodeGraphSymbol;
  importedBy: string[];
  imports: string[];
  relatedSymbols: CodeGraphSymbol[];
} {
  const cleanTarget = symbolOrFileName.trim().toLowerCase();

  const sym = cachedGraph.symbols.find(
    (s) => s.name.toLowerCase() === cleanTarget || s.id.toLowerCase().includes(cleanTarget)
  );

  const importedBy: string[] = [];
  const imports: string[] = [];

  for (const dep of cachedGraph.dependencies) {
    if (dep.sourceFile.toLowerCase().includes(cleanTarget)) {
      imports.push(`${dep.targetModule} (${dep.importedSymbols.join(', ')})`);
    }
    if (
      dep.targetModule.toLowerCase().includes(cleanTarget) ||
      dep.importedSymbols.some((s) => s.toLowerCase() === cleanTarget)
    ) {
      importedBy.push(`${dep.sourceFile} (${dep.importedSymbols.join(', ')})`);
    }
  }

  const relatedSymbols = cachedGraph.symbols.filter(
    (s) => sym && s.file === sym.file && s.name !== sym.name
  ).slice(0, 5);

  return {
    symbol: sym,
    importedBy,
    imports,
    relatedSymbols,
  };
}

/**
 * Retrieves the current summary of the codebase knowledge graph
 */
export async function getCodeGraphSummary(): Promise<CodeGraphSummary> {
  if (cachedGraph.summary) return cachedGraph.summary;

  try {
    const raw = await getStorage().execute('GET', REDIS_SUMMARY_KEY);
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed as CodeGraphSummary;
    }
  } catch {}

  return indexCodebaseGraph({ embedWithVertex: true });
}

/**
 * Retrieves all indexed code symbols from cache, Redis, or triggers dynamic parse
 */
export async function getAllCodeGraphSymbols(): Promise<CodeGraphSymbol[]> {
  if (cachedGraph.symbols && cachedGraph.symbols.length > 0) {
    return cachedGraph.symbols;
  }
  try {
    const raw = await getStorage().execute('GET', REDIS_SYMBOLS_KEY);
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedGraph.symbols = parsed as CodeGraphSymbol[];
        return cachedGraph.symbols;
      }
    }
  } catch {}

  await indexCodebaseGraph({ embedWithVertex: false });
  return cachedGraph.symbols;
}

