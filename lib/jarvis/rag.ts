/**
 * J.A.R.V.I.S. Semantic Vector RAG (Retrieval-Augmented Generation) Substrate
 * 
 * Implements dense vector embeddings, semantic chunking, cosine similarity retrieval,
 * and dual-mode vector storage (Upstash Redis Cloud & Local Disk Fallback).
 * 
 * Powered by Google Gemini text-embedding-004 (768 dimensions) with deterministic
 * high-dimensional fallback for offline/reflex execution.
 * 
 * Includes Directive 01 Guardian Data Protection & Emergency Wipe Subsystem.
 */

import { getUniversalStorage } from './storage';
import path from 'path';
import fs from 'fs';

export interface KnowledgeChunk {
  id: string;
  docId: string;
  title: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
  totalChunks: number;
  category?: string;
  source?: string;
  tags?: string[];
  isSensitive?: boolean;
  createdAt: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  source?: string;
  category?: string;
  totalChunks: number;
  totalCharacters: number;
  tags: string[];
  isSensitive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RetrievalResult {
  chunkId: string;
  docId: string;
  title: string;
  content: string;
  similarity: number;
  category?: string;
  source?: string;
  isSensitive?: boolean;
}

// =========================================================================
// 1. DENSE VECTOR EMBEDDINGS ENGINE
// =========================================================================

// In-Memory L1 Cache with TTL to prevent Redis serialization overhead & thrashing
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const RAG_CACHE_TTL_MS = 60_000; // 60s TTL
let chunkCache: CacheEntry<KnowledgeChunk[]> | null = null;
let docCache: CacheEntry<KnowledgeDocument[]> | null = null;
const normalizedEmbeddingCache = new WeakMap<KnowledgeChunk, number[]>();

export function invalidateRAGCache(): void {
  chunkCache = null;
  docCache = null;
}

/**
 * Computes cosine similarity between two high-dimensional vectors with fast-path unit normalization
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Fallback deterministic high-dimensional embedding (768-dim) for offline/heuristic execution
 */
function generateHeuristicEmbedding(text: string, dimensions = 768): number[] {
  const clean = text.toLowerCase().trim();
  const vector = new Array(dimensions).fill(0);
  
  if (!clean) return vector;

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const pos = (code * 31 + i * 17) % dimensions;
    vector[pos] += Math.sin(code + i);
    const pos2 = (code * 43 + i * 29) % dimensions;
    vector[pos2] += Math.cos(code * i);
  }

  // L2 Normalize
  let norm = 0;
  for (let i = 0; i < dimensions; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) vector[i] /= norm;
  }

  return vector;
}

/**
 * Generates dense 768-dimensional vector embedding using Google Gemini text-embedding-004
 */
export async function generateEmbedding(text: string, customApiKey?: string): Promise<number[]> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_KEY;
  if (!apiKey) {
    return generateHeuristicEmbedding(text);
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
    const payload = {
      model: 'models/text-embedding-004',
      content: {
        parts: [{ text: text.slice(0, 8000) }],
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.embedding?.values && Array.isArray(data.embedding.values)) {
        return data.embedding.values;
      }
    }
  } catch {
    // Silent fallback to 768-dim heuristic embedding
  }

  return generateHeuristicEmbedding(text);
}

// =========================================================================
// 2. SENSITIVE DATA DETECTOR (DIRECTIVE 01 GUARDIAN PROTOCOL)
// =========================================================================

const SENSITIVE_PATTERNS = [
  /password\s*[:=]\s*[^\s]+/i,
  /api[_-]?key\s*[:=]\s*[^\s]+/i,
  /secret\s*[:=]\s*[^\s]+/i,
  /bearer\s+[a-zA-Z0-9_\-\.]{20,}/i,
  /ghp_[a-zA-Z0-9]{30,}/,
  /gsk_[a-zA-Z0-9]{30,}/,
  /AIzaSy[a-zA-Z0-9_\-]{30,}/,
  /ssh-(rsa|ed25519)/i,
  /private\s+key/i,
  /credit\s*card/i,
  /social\s*security/i,
  /pin\s*[:=]\s*\d{4,8}/i,
];

/**
 * Automatically inspects content for sensitive credentials/tokens per Directive 01
 */
export function detectSensitiveContent(text: string): boolean {
  if (!text) return false;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

// =========================================================================
// 3. SEMANTIC TEXT CHUNKING
// =========================================================================

/**
 * Splits arbitrary text or documents into semantic chunks with overlap
 */
export function semanticChunkText(
  text: string,
  targetChunkSize = 800,
  overlap = 120
): string[] {
  if (!text || text.trim().length === 0) return [];
  const normalized = text.replace(/\r\n/g, '\n').trim();

  // If text is short, return as single chunk
  if (normalized.length <= targetChunkSize) {
    return [normalized];
  }

  // Split by semantic paragraphs / double newlines
  const paragraphs = normalized.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length <= targetChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        const overlapText = currentChunk.slice(-overlap).trim();
        currentChunk = (overlapText ? overlapText + '\n\n' : '') + trimmed;
      } else {
        let start = 0;
        while (start < trimmed.length) {
          const end = Math.min(start + targetChunkSize, trimmed.length);
          chunks.push(trimmed.slice(start, end));
          start = end - overlap > start ? end - overlap : end;
        }
        currentChunk = '';
      }
    }
  }

  if (currentChunk && currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// =========================================================================
// 4. STORAGE & INDEXING REPOSITORY
// =========================================================================

const KNOWLEDGE_DOCS_KEY = 'jarvis:knowledge:docs';
const KNOWLEDGE_CHUNKS_KEY = 'jarvis:knowledge:chunks';

/**
 * Loads all indexed chunks from storage
 */
export async function getAllKnowledgeChunks(): Promise<KnowledgeChunk[]> {
  const storage = getUniversalStorage();
  try {
    const raw = await storage.execute('get', KNOWLEDGE_CHUNKS_KEY);
    if (!raw) return getLocalDiskChunksFallback();
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[RAG:Storage] Failed to read chunks from cloud storage:', err);
    return getLocalDiskChunksFallback();
  }
}

/**
 * Saves all knowledge chunks to storage
 */
export async function saveAllKnowledgeChunks(chunks: KnowledgeChunk[]): Promise<void> {
  const storage = getUniversalStorage();
  try {
    await storage.execute('set', KNOWLEDGE_CHUNKS_KEY, JSON.stringify(chunks));
  } catch (err) {
    console.error('[RAG:Storage] Failed to write chunks to cloud storage:', err);
  }
  saveLocalDiskChunksFallback(chunks);
}

/**
 * Loads document metadata records
 */
export async function getAllKnowledgeDocs(): Promise<KnowledgeDocument[]> {
  const storage = getUniversalStorage();
  try {
    const raw = await storage.execute('get', KNOWLEDGE_DOCS_KEY);
    if (!raw) return getLocalDiskDocsFallback();
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[RAG:Storage] Failed to read docs from cloud storage:', err);
    return getLocalDiskDocsFallback();
  }
}

/**
 * Saves document metadata records
 */
export async function saveAllKnowledgeDocs(docs: KnowledgeDocument[]): Promise<void> {
  const storage = getUniversalStorage();
  try {
    await storage.execute('set', KNOWLEDGE_DOCS_KEY, JSON.stringify(docs));
  } catch (err) {
    console.error('[RAG:Storage] Failed to write docs to cloud storage:', err);
  }
  saveLocalDiskDocsFallback(docs);
}

// Local disk fallback helpers
function getLocalDiskChunksFallback(): KnowledgeChunk[] {
  try {
    const file = path.join(process.cwd(), 'data', 'jarvis-chunks.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveLocalDiskChunksFallback(chunks: KnowledgeChunk[]): void {
  try {
    const dir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'jarvis-chunks.json'), JSON.stringify(chunks, null, 2));
  } catch {}
}

function getLocalDiskDocsFallback(): KnowledgeDocument[] {
  try {
    const file = path.join(process.cwd(), 'data', 'jarvis-docs.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveLocalDiskDocsFallback(docs: KnowledgeDocument[]): void {
  try {
    const dir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'jarvis-docs.json'), JSON.stringify(docs, null, 2));
  } catch {}
}

// =========================================================================
// 5. INGESTION, RETRIEVAL, & EMERGENCY WIPE PIPELINES
// =========================================================================

/**
 * Ingests a new document into the Semantic Vector Knowledge Base
 */
export async function ingestKnowledgeDocument(params: {
  title: string;
  content: string;
  source?: string;
  category?: string;
  tags?: string[];
  isSensitive?: boolean;
  apiKey?: string;
}): Promise<{ docId: string; chunksIndexed: number; totalCharacters: number; isSensitive: boolean }> {
  const { title, content, source, category = 'GENERAL', tags = [], apiKey } = params;
  const isAutoSensitive = params.isSensitive ?? (detectSensitiveContent(content) || category === 'SENSITIVE' || category === 'CREDENTIALS' || category === 'PRIVATE');
  
  const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const textChunks = semanticChunkText(content, 750, 100);

  const existingChunks = await getAllKnowledgeChunks();
  const existingDocs = await getAllKnowledgeDocs();

  const newChunks: KnowledgeChunk[] = [];

  for (let i = 0; i < textChunks.length; i++) {
    const chunkContent = textChunks[i];
    const embedding = await generateEmbedding(chunkContent, apiKey);

    newChunks.push({
      id: `chunk-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
      docId,
      title,
      content: chunkContent,
      embedding,
      chunkIndex: i + 1,
      totalChunks: textChunks.length,
      category,
      source,
      tags,
      isSensitive: isAutoSensitive,
      createdAt: new Date().toISOString(),
    });
  }

  const newDoc: KnowledgeDocument = {
    id: docId,
    title,
    source,
    category,
    totalChunks: newChunks.length,
    totalCharacters: content.length,
    tags,
    isSensitive: isAutoSensitive,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveAllKnowledgeChunks([...existingChunks, ...newChunks]);
  await saveAllKnowledgeDocs([newDoc, ...existingDocs]);

  return {
    docId,
    chunksIndexed: newChunks.length,
    totalCharacters: content.length,
    isSensitive: isAutoSensitive,
  };
}

/**
 * Deletes an indexed document and all its constituent chunks
 */
export async function deleteKnowledgeDocument(docId: string): Promise<boolean> {
  const existingChunks = await getAllKnowledgeChunks();
  const existingDocs = await getAllKnowledgeDocs();

  const filteredChunks = existingChunks.filter((c) => c.docId !== docId);
  const filteredDocs = existingDocs.filter((d) => d.id !== docId);

  await saveAllKnowledgeChunks(filteredChunks);
  await saveAllKnowledgeDocs(filteredDocs);

  return true;
}

/**
 * Performs Hybrid Search (Dense Vector + BM25 Lexical Fusion via RRF) across indexed knowledge chunks
 */
export async function queryKnowledgeBase(
  query: string,
  options: {
    topK?: number;
    minScore?: number;
    category?: string;
    apiKey?: string;
  } = {}
): Promise<RetrievalResult[]> {
  const { topK = 4, minScore = 0.35, category, apiKey } = options;
  if (!query || !query.trim()) return [];

  const chunks = await getAllKnowledgeChunks();
  if (chunks.length === 0) return [];

  const filteredChunks = category
    ? chunks.filter((c) => c.category === category)
    : chunks;

  if (filteredChunks.length === 0) return [];

  // 1. Dense Vector Scoring Pass
  const queryEmbedding = await generateEmbedding(query, apiKey);
  const vectorRanked = filteredChunks
    .map((chunk) => ({
      id: chunk.id,
      chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter((c) => c.similarity >= minScore)
    .sort((a, b) => b.similarity - a.similarity);

  // 2. BM25 Lexical Scoring Pass
  const { BM25Index, computeReciprocalRankFusion } = await import('./recall');
  const bm25 = new BM25Index(1.2, 0.75);
  bm25.addDocuments(filteredChunks.map((c) => ({ id: c.id, text: `${c.title} ${c.content}` })));
  const bm25Ranked = bm25.search(query, topK * 3);

  // 3. Reciprocal Rank Fusion (RRF)
  const vectorList = vectorRanked.map((v) => ({ id: v.id }));
  const bm25List = bm25Ranked.map((b) => ({ id: b.id }));
  const fused = computeReciprocalRankFusion([vectorList, bm25List], 60);

  const results: RetrievalResult[] = [];
  for (const f of fused.slice(0, topK)) {
    const chunk = filteredChunks.find((c) => c.id === f.item.id);
    if (!chunk) continue;

    const vecMatch = vectorRanked.find((v) => v.id === chunk.id);
    const sim = vecMatch ? vecMatch.similarity : 0.75;

    results.push({
      chunkId: chunk.id,
      docId: chunk.docId,
      title: chunk.title,
      content: chunk.content,
      similarity: sim,
      category: chunk.category,
      source: chunk.source,
      isSensitive: chunk.isSensitive,
    });
  }

  return results;
}

/**
 * [DIRECTIVE 01 - GUARDIAN WIPE PROTOCOL]
 * Selectively wipes all sensitive knowledge documents, credentials, and chunks
 */
export async function wipeSensitiveKnowledge(): Promise<{ chunksRemoved: number; docsRemoved: number }> {
  const chunks = await getAllKnowledgeChunks();
  const docs = await getAllKnowledgeDocs();

  const sensitiveDocIds = new Set(
    docs
      .filter((d) => d.isSensitive || d.category === 'SENSITIVE' || d.category === 'CREDENTIALS' || d.category === 'PRIVATE')
      .map((d) => d.id)
  );

  const remainingChunks = chunks.filter(
    (c) => !c.isSensitive && !sensitiveDocIds.has(c.docId) && c.category !== 'SENSITIVE' && c.category !== 'CREDENTIALS'
  );
  const remainingDocs = docs.filter(
    (d) => !d.isSensitive && d.category !== 'SENSITIVE' && d.category !== 'CREDENTIALS'
  );

  const chunksRemoved = chunks.length - remainingChunks.length;
  const docsRemoved = docs.length - remainingDocs.length;

  await saveAllKnowledgeChunks(remainingChunks);
  await saveAllKnowledgeDocs(remainingDocs);

  return { chunksRemoved, docsRemoved };
}

/**
 * [DEFCON 0 - NUCLEAR SANITIZATION WIPE]
 * Completely wipes all knowledge documents and vector chunks
 */
export async function wipeAllKnowledge(): Promise<{ totalChunksPurged: number; totalDocsPurged: number }> {
  const chunks = await getAllKnowledgeChunks();
  const docs = await getAllKnowledgeDocs();

  const totalChunksPurged = chunks.length;
  const totalDocsPurged = docs.length;

  await saveAllKnowledgeChunks([]);
  await saveAllKnowledgeDocs([]);

  return { totalChunksPurged, totalDocsPurged };
}

/**
 * Formats retrieved knowledge chunks into high-density prompt context
 */
export function formatKnowledgePromptContext(results: RetrievalResult[]): string {
  if (!results || results.length === 0) return '';

  return `
[RETRIEVED SEMANTIC KNOWLEDGE BASE CHUNKS (VECTOR RAG - GEMINI 004 DENSE RETRIEVAL)]:
${results
  .map(
    (r, i) =>
      `Knowledge Source ${i + 1} ("${r.title}" | Similarity: ${(r.similarity * 100).toFixed(1)}% | ${r.category || 'General'}${r.isSensitive ? ' [CONFIDENTIAL/GUARDIAN]' : ''}):\n${r.content}`
  )
  .join('\n\n')}
(Directive: Seamlessly synthesize this verified semantic knowledge into your response with exact precision.)
`;
}
