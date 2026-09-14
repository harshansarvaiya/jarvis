/**
 * J.A.R.V.I.S. Episodic History Recall Engine
 * 
 * Performs semantic correlation and context retrieval over past conversations
 * stored in Upstash Redis / Local Storage (RAG on Universal History).
 * 
 * Injects relatable past context into every model call so J.A.R.V.I.S.
 * never forgets prior discussions, decisions, credentials, or tactical plans.
 */

import { getUniversalChatHistory, ChatMessageRecord } from './storage';

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

function extractKeywords(text: string): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return Array.from(new Set(words));
}

export interface CorrelatedEpisode {
  id: string;
  timestamp: string;
  summary: string;
  relevanceScore: number;
  topics: string[];
}

/**
 * Searches universal chat history (Upstash / local) and identifies the top
 * correlated conversation episodes related to the current query.
 */
export async function findCorrelatedEpisodes(
  currentQuery: string,
  excludeIds: string[] = [],
  maxEpisodes = 3
): Promise<CorrelatedEpisode[]> {
  try {
    const history = await getUniversalChatHistory(80);
    if (!history || history.length === 0) return [];

    const queryKeywords = extractKeywords(currentQuery);
    if (queryKeywords.length === 0) return [];

    const excludeSet = new Set(excludeIds);
    const candidateEpisodes: CorrelatedEpisode[] = [];

    // Group history into User -> Assistant turn pairs
    for (let i = 0; i < history.length - 1; i++) {
      const userMsg = history[i];
      const assistantMsg = history[i + 1];

      if (userMsg.role === 'user' && assistantMsg.role === 'assistant') {
        if (excludeSet.has(userMsg.id) || excludeSet.has(assistantMsg.id)) {
          continue;
        }

        const combinedText = `${userMsg.content} ${assistantMsg.content}`;
        const episodeKeywords = extractKeywords(combinedText);

        // Compute lexical overlap
        let matchCount = 0;
        const matchedTopics: string[] = [];
        for (const qk of queryKeywords) {
          if (episodeKeywords.includes(qk)) {
            matchCount++;
            matchedTopics.push(qk);
          }
        }

        if (matchCount > 0) {
          // Base score = percentage of query keywords matched
          let score = matchCount / queryKeywords.length;

          // Bonus if assistant executed tools (concrete state change / action)
          if (assistantMsg.toolCalls && assistantMsg.toolCalls.length > 0) {
            score *= 1.4;
          }

          // Bonus if exact keyword phrases appear in user message
          for (const qk of queryKeywords) {
            if (userMsg.content.toLowerCase().includes(qk)) {
              score += 0.2;
            }
          }

          // Format clean episode summary
          const userPreview = userMsg.content.replace(/\n+/g, ' ').slice(0, 140);
          const assistantPreview = assistantMsg.content.replace(/\n+/g, ' ').slice(0, 160);

          candidateEpisodes.push({
            id: userMsg.id,
            timestamp: userMsg.timestamp || 'PRIOR_TURN',
            summary: `[User Request]: "${userPreview}" -> [J.A.R.V.I.S. Action/Resolution]: "${assistantPreview}"`,
            relevanceScore: score,
            topics: matchedTopics,
          });
        }
      }
    }

    // Sort by relevance score descending
    candidateEpisodes.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return candidateEpisodes.slice(0, maxEpisodes);
  } catch (err) {
    console.warn('[EpisodicRecall] Failed to retrieve correlated episodes:', err);
    return [];
  }
}

/**
 * Formats recalled episodes into a high-density, prompt-ready context block.
 */
export function formatRecalledEpisodesPrompt(episodes: CorrelatedEpisode[]): string {
  if (!episodes || episodes.length === 0) return '';

  return `
[CORRELATED HISTORICAL EPISODES & PRIOR RELEVANT CONVERSATIONS (RETRIEVED FROM UPSTASH)]:
${episodes
  .map(
    (e, idx) =>
      `Episode ${idx + 1} (${e.timestamp}, Correlated Topics: ${e.topics.join(', ') || 'General'}):\n${e.summary}`
  )
  .join('\n\n')}
(Directive: Seamlessly synthesize and build upon this prior historical context when relevant to Sir's current directive.)
`;
}
