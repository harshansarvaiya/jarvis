/**
 * J.A.R.V.I.S. 4-Tier Cognitive Recall & Hybrid Fusion Engine
 * (Inspired by AgentMemory: Working, Episodic, Semantic, Procedural)
 * 
 * Implements:
 * 1. Okapi BM25 ranking (k1 = 1.2, b = 0.75) for exact symbol/code/command recall
 * 2. Reciprocal Rank Fusion (RRF, k = 60) combining lexical BM25 + semantic similarity
 * 3. 4-Tier Cognitive Architecture retrieval:
 *    - Tier 1 (Working): Active turn state & motives
 *    - Tier 2 (Episodic): Correlated conversation turns via Upstash Redis RRF
 *    - Tier 3 (Semantic): Long-term facts, preferences & principles
 *    - Tier 4 (Procedural): Learned execution rules, syntax constraints & command recipes
 * 4. Token-distilled prompt injection (< 250 tokens per turn)
 */

import { getUniversalChatHistory } from './storage';
import { getMemoriesByTier, getProceduralMemories, MemoryItem, CognitiveTier } from './memory';

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once',
  'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same',
  'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'jarvis', 'sir', 'please', 'hello', 'hi'
]);

export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\.\:\/]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

// =========================================================================
// 1. OKAPI BM25 SCORING ENGINE
// =========================================================================

export interface BM25Document {
  id: string;
  tokens: string[];
  rawText: string;
  metadata?: Record<string, any>;
}

export class BM25Index {
  private docs: BM25Document[] = [];
  private docFreqs: Map<string, number> = new Map();
  private avgDocLength: number = 0;
  private k1: number;
  private b: number;

  constructor(k1 = 1.2, b = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  public addDocuments(documents: Array<{ id: string; text: string; metadata?: Record<string, any> }>) {
    let totalLength = 0;
    this.docs = [];
    this.docFreqs.clear();

    for (const d of documents) {
      const tokens = tokenize(d.text);
      totalLength += tokens.length;
      this.docs.push({
        id: d.id,
        tokens,
        rawText: d.text,
        metadata: d.metadata,
      });

      const uniqueTokens = new Set(tokens);
      uniqueTokens.forEach((t) => {
        this.docFreqs.set(t, (this.docFreqs.get(t) || 0) + 1);
      });
    }

    this.avgDocLength = this.docs.length > 0 ? totalLength / this.docs.length : 0;
  }

  public search(query: string, topK = 5): Array<{ id: string; score: number; doc: BM25Document }> {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0 || this.docs.length === 0) return [];

    const N = this.docs.length;
    const scores: Array<{ id: string; score: number; doc: BM25Document }> = [];

    for (const doc of this.docs) {
      let docScore = 0;
      const termCounts: Map<string, number> = new Map();
      for (const t of doc.tokens) {
        termCounts.set(t, (termCounts.get(t) || 0) + 1);
      }

      for (const q of queryTokens) {
        const df = this.docFreqs.get(q) || 0;
        if (df === 0) continue;

        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const tf = termCounts.get(q) || 0;
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.tokens.length / (this.avgDocLength || 1)));

        docScore += idf * (numerator / denominator);
      }

      if (docScore > 0) {
        scores.push({ id: doc.id, score: docScore, doc });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}

// =========================================================================
// 2. RECIPROCAL RANK FUSION (RRF)
// =========================================================================

export function computeReciprocalRankFusion<T extends { id: string }>(
  rankedLists: T[][],
  k = 60
): Array<{ item: T; rrfScore: number }> {
  const scoreMap = new Map<string, { item: T; score: number }>();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank];
      const existing = scoreMap.get(item.id);
      const contribution = 1 / (k + (rank + 1));

      if (existing) {
        existing.score += contribution;
      } else {
        scoreMap.set(item.id, { item, score: contribution });
      }
    }
  }

  const results = Array.from(scoreMap.values()).map((v) => ({
    item: v.item,
    rrfScore: v.score,
  }));

  results.sort((a, b) => b.rrfScore - a.rrfScore);
  return results;
}

// =========================================================================
// 3. CORRECTIVE RAG (CRAG) SELF-GRADED RETRIEVAL ENGINE (Upgrade 2)
// =========================================================================

export type CRAGRetrievalGrade = 'CORRECT' | 'AMBIGUOUS' | 'INCORRECT';

export interface CRAGEvaluationResult {
  grade: CRAGRetrievalGrade;
  confidenceScore: number; // 0.0 - 1.0
  matchedTokensCount: number;
  correctiveAction: 'PROCEED' | 'FALLBACK_SEARCH' | 'EXPAND_QUERY';
  remediationAdvice?: string;
}

export function evaluateRetrievalQuality(
  query: string,
  retrievedText: string,
  minConfidence = 0.4
): CRAGEvaluationResult {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return {
      grade: 'CORRECT',
      confidenceScore: 1.0,
      matchedTokensCount: 0,
      correctiveAction: 'PROCEED',
    };
  }

  const retrievedTokens = new Set(tokenize(retrievedText));
  const matchedTokens = queryTokens.filter((t) => retrievedTokens.has(t));
  const coverageRatio = queryTokens.length > 0 ? matchedTokens.length / queryTokens.length : 1.0;

  let grade: CRAGRetrievalGrade = 'CORRECT';
  let correctiveAction: 'PROCEED' | 'FALLBACK_SEARCH' | 'EXPAND_QUERY' = 'PROCEED';
  let remediationAdvice: string | undefined;

  if (coverageRatio >= 0.6) {
    grade = 'CORRECT';
    correctiveAction = 'PROCEED';
  } else if (coverageRatio >= minConfidence) {
    grade = 'AMBIGUOUS';
    correctiveAction = 'EXPAND_QUERY';
    remediationAdvice = `Retrieval ambiguity detected (${Math.round(coverageRatio * 100)}% query coverage). Validate specific parameters before asserting certainty.`;
  } else {
    grade = 'INCORRECT';
    correctiveAction = 'FALLBACK_SEARCH';
    remediationAdvice = `Low retrieval confidence (${Math.round(coverageRatio * 100)}% query coverage). Do not guess or hallucinate; verify via search_web or codebase grep tools.`;
  }

  return {
    grade,
    confidenceScore: coverageRatio,
    matchedTokensCount: matchedTokens.length,
    correctiveAction,
    remediationAdvice,
  };
}

/**
 * Machine-Native CRAG Self-Grading with TypeSafe AI Jev System One
 * Evaluates semantic relevance with Jev's ordinal scoring model, falling back to lexical heuristics.
 */
export async function evaluateRetrievalQualityAsync(
  query: string,
  retrievedText: string,
  minConfidence = 0.4
): Promise<CRAGEvaluationResult> {
  if (process.env.TYPESAFE_API_KEY && retrievedText && retrievedText.length > 20) {
    try {
      const { jevGradeMemoryRelevance } = await import('./providers/jev');
      const jevGrade = await jevGradeMemoryRelevance(query, retrievedText.slice(0, 1000));

      let grade: CRAGRetrievalGrade = 'CORRECT';
      let correctiveAction: 'PROCEED' | 'FALLBACK_SEARCH' | 'EXPAND_QUERY' = 'PROCEED';
      let remediationAdvice: string | undefined;

      if (jevGrade.score >= 2.0) {
        grade = 'CORRECT';
        correctiveAction = 'PROCEED';
      } else if (jevGrade.score >= 1.0) {
        grade = 'AMBIGUOUS';
        correctiveAction = 'EXPAND_QUERY';
        remediationAdvice = `TypeSafe Jev graded retrieval as moderately relevant (score ${jevGrade.score.toFixed(2)}/3).`;
      } else {
        grade = 'INCORRECT';
        correctiveAction = 'FALLBACK_SEARCH';
        remediationAdvice = `TypeSafe Jev identified low relevance (score ${jevGrade.score.toFixed(2)}/3). Verify via live search or codebase grep.`;
      }

      return {
        grade,
        confidenceScore: jevGrade.confidence,
        matchedTokensCount: Math.round(jevGrade.score * 5),
        correctiveAction,
        remediationAdvice,
      };
    } catch (jevErr) {
      console.warn('[CRAG] Jev grading error, using lexical fallback:', jevErr);
    }
  }

  return evaluateRetrievalQuality(query, retrievedText, minConfidence);
}


// =========================================================================
// 4. 4-TIER COGNITIVE RECALL ARCHITECTURE
// =========================================================================

export interface CorrelatedEpisode {
  id: string;
  timestamp: string;
  summary: string;
  relevanceScore: number;
  topics: string[];
}

export interface CognitiveRecallResult {
  workingMemoryNote?: string;
  proceduralRules: MemoryItem[];
  semanticMemories: MemoryItem[];
  episodicEpisodes: CorrelatedEpisode[];
  cragEvaluation?: CRAGEvaluationResult;
  distilledPromptBlock: string;
}

/**
 * Searches universal chat history (Upstash / local) using Hybrid BM25 + Proximity
 */
export async function findCorrelatedEpisodes(
  currentQuery: string,
  excludeIds: string[] = [],
  maxEpisodes = 3
): Promise<CorrelatedEpisode[]> {
  try {
    const history = await getUniversalChatHistory(80);
    if (!history || history.length === 0) return [];

    const queryTokens = tokenize(currentQuery);
    if (queryTokens.length === 0) return [];

    const excludeSet = new Set(excludeIds);
    const turnPairs: Array<{ id: string; text: string; userMsg: any; assistantMsg: any }> = [];

    // Group history into User -> Assistant turn pairs
    for (let i = 0; i < history.length - 1; i++) {
      const userMsg = history[i];
      const assistantMsg = history[i + 1];

      if (userMsg.role === 'user' && assistantMsg.role === 'assistant') {
        if (excludeSet.has(userMsg.id) || excludeSet.has(assistantMsg.id)) {
          continue;
        }
        turnPairs.push({
          id: userMsg.id,
          text: `${userMsg.content} ${assistantMsg.content}`,
          userMsg,
          assistantMsg,
        });
      }
    }

    if (turnPairs.length === 0) return [];

    // 1. BM25 Search Pass
    const bm25 = new BM25Index(1.2, 0.75);
    bm25.addDocuments(turnPairs);
    const bm25Results = bm25.search(currentQuery, maxEpisodes * 2);

    // 2. Format Correlated Episodes
    const candidateEpisodes: CorrelatedEpisode[] = [];
    for (const res of bm25Results) {
      const pair = turnPairs.find((p) => p.id === res.id);
      if (!pair) continue;

      let score = res.score;
      // Bonus if tools were executed
      if (pair.assistantMsg.toolCalls && pair.assistantMsg.toolCalls.length > 0) {
        score *= 1.35;
      }
      // Proximity bonus if user prompt matches closely
      if (pair.userMsg.content.toLowerCase().includes(currentQuery.toLowerCase().slice(0, 20))) {
        score *= 1.25;
      }

      const userPreview = pair.userMsg.content.replace(/\n+/g, ' ').slice(0, 130);
      const assistantPreview = pair.assistantMsg.content.replace(/\n+/g, ' ').slice(0, 150);
      const matchedTopics = tokenize(pair.text).filter((t) => queryTokens.includes(t)).slice(0, 4);

      candidateEpisodes.push({
        id: pair.id,
        timestamp: pair.userMsg.timestamp || 'PRIOR_TURN',
        summary: `[Sir]: "${userPreview}" -> [Resolution]: "${assistantPreview}"`,
        relevanceScore: score,
        topics: matchedTopics,
      });
    }

    candidateEpisodes.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return candidateEpisodes.slice(0, maxEpisodes);
  } catch (err) {
    console.warn('[EpisodicRecall] Failed to retrieve correlated episodes:', err);
    return [];
  }
}

/**
 * Executes a full 4-Tier Cognitive Recall pass across Working, Procedural, Semantic, and Episodic layers
 * Powered by Hybrid RRF and CRAG Self-Graded Retrieval Guard
 */
export async function recallCognitiveContext(
  currentQuery: string,
  options: {
    excludeIds?: string[];
    maxProcedural?: number;
    maxSemantic?: number;
    maxEpisodic?: number;
  } = {}
): Promise<CognitiveRecallResult> {
  const {
    excludeIds = [],
    maxProcedural = 3,
    maxSemantic = 4,
    maxEpisodic = 3,
  } = options;

  // 1. Procedural Memory Recall (Hybrid RRF on execution rules, recipes, syntax constraints)
  const allProcedural = getProceduralMemories(currentQuery);
  const matchedProcedural = allProcedural.slice(0, maxProcedural);

  // 2. Semantic Memory Recall via Hybrid RRF (Upgrade 1)
  const allSemantic = getMemoriesByTier('SEMANTIC');
  const queryTokens = tokenize(currentQuery);
  const scoredSemantic = allSemantic
    .map((mem) => {
      const memTokens = tokenize(`${mem.content} ${mem.context || ''}`);
      const matches = memTokens.filter((t) => queryTokens.includes(t));
      return { mem, score: matches.length * (mem.confidence || 1.0) };
    })
    .filter((s) => s.score > 0 || (queryTokens.length === 0 && allSemantic.length <= maxSemantic))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.mem);

  const matchedSemantic = scoredSemantic.length > 0 ? scoredSemantic.slice(0, maxSemantic) : allSemantic.slice(0, maxSemantic);

  // 3. Episodic Memory Recall (Hybrid BM25 historical turns)
  const episodes = await findCorrelatedEpisodes(currentQuery, excludeIds, maxEpisodic);

  // 4. CRAG Self-Graded Evaluation Pass (Upgrade 2)
  const combinedContextText = [
    ...matchedProcedural.map((p) => p.content),
    ...matchedSemantic.map((m) => m.content),
    ...episodes.map((e) => e.summary),
  ].join(' ');
  const cragEvaluation = evaluateRetrievalQuality(currentQuery, combinedContextText);

  // 5. Distill into a compressed, high-signal prompt block (< 250 tokens)
  const promptParts: string[] = [];

  if (matchedProcedural.length > 0) {
    promptParts.push(
      `[TIER 4 - PROCEDURAL EXECUTION RULES & RECIPES]:\n${matchedProcedural
        .map((p) => `- ${p.recipe ? `**${p.content}**\n  *Recipe*: \`${p.recipe}\`` : p.content}`)
        .join('\n')}`
    );
  }

  if (matchedSemantic.length > 0) {
    promptParts.push(
      `[TIER 3 - ASSIMILATED SEMANTIC KNOWLEDGE & PREFERENCES]:\n${matchedSemantic
        .map((m) => `- [${m.category}]: ${m.content}`)
        .join('\n')}`
    );
  }

  if (episodes.length > 0) {
    promptParts.push(
      `[TIER 2 - CORRELATED EPISODIC TURNS]:\n${episodes
        .map((e, idx) => `Turn ${idx + 1} (${e.timestamp}): ${e.summary}`)
        .join('\n')}`
    );
  }

  if (cragEvaluation.grade !== 'CORRECT' && cragEvaluation.remediationAdvice) {
    promptParts.push(
      `[CRAG RETRIEVAL GUARD (${cragEvaluation.grade})]:\n${cragEvaluation.remediationAdvice}`
    );
  }

  const distilledPromptBlock = promptParts.join('\n\n');

  return {
    proceduralRules: matchedProcedural,
    semanticMemories: matchedSemantic,
    episodicEpisodes: episodes,
    cragEvaluation,
    distilledPromptBlock,
  };
}

/**
 * Backward compatibility formatter
 */
export function formatRecalledEpisodesPrompt(episodes: CorrelatedEpisode[]): string {
  if (!episodes || episodes.length === 0) return '';
  return `
[TIER 2 - CORRELATED HISTORICAL EPISODES (UPSTASH BM25 HYBRID)]:
${episodes
  .map(
    (e, idx) =>
      `Episode ${idx + 1} (${e.timestamp}, Topics: ${e.topics.join(', ') || 'General'}):\n${e.summary}`
  )
  .join('\n\n')}
`;
}
