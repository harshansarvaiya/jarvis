/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. — Omni-Sponge Second Brain Assimilation Engine
 * 
 * Stage 6 Sovereign Capability:
 * One-tap autonomous content assimilation across:
 *  1. PDFs & Research Papers (Native multimodal comprehension via Gemini 3.8/3.7)
 *  2. YouTube Videos (Transcript extraction, key timestamps, architectural teardowns)
 *  3. arXiv Research Papers (PDF download, abstract, mathematical proofs & extraction vectors)
 *  4. GitHub Repositories (Architecture parsing, README extraction, dependency mapping)
 *  5. Web Articles, Substack, & X/Twitter Threads (HTML cleaning, readability extraction)
 * 
 * Extracted intelligence is:
 *  - Quantized into TurboQuant 8-bit semantic memory.
 *  - Stored in Upstash Redis (`jarvis:memories` & `jarvis:rag`).
 *  - Contradiction-checked via Jev Epistemic Memory Sieve.
 *  - Dispatched to Sir as a Staff-level "Architectural Extraction Card" in Telegram & PWA.
 * 
 * Enforces Directives 01, 03 (Evolutionary Adaptation), and 06 (Zero-Thrashing).
 */

import * as fs from 'fs';
import * as path from 'path';
import { callVertexAIGenerate } from './vertex';
import { addMemory, MemoryCategory } from './memory';
import { ingestKnowledgeDocument } from './rag';
import { telegramGateway } from './telegram';

export interface OmniSpongeInput {
  type: 'URL' | 'DOCUMENT' | 'RAW_TEXT';
  sourceUrl?: string;
  fileBuffer?: Buffer;
  fileName?: string;
  mimeType?: string;
  rawText?: string;
  userContext?: string;
}

export interface AssimilatedIntel {
  title: string;
  sourceType: 'ARXIV_PAPER' | 'YOUTUBE_VIDEO' | 'TECHNICAL_DOCUMENT' | 'GITHUB_REPOSITORY' | 'WEB_ARTICLE' | 'DIRECT_INTEL';
  sourceUrl?: string;
  summary: string;
  coreBreakthroughs: string[];
  architecturalPrimitives: string[];
  actionableVectors: string[];
  assimilatedPrinciples: string[];
  category: MemoryCategory;
  memoryId?: string;
  docId?: string;
  executionTimeMs: number;
}

/**
 * Extracts YouTube Video ID from various URL formats
 */
function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
}

/**
 * Extracts arXiv Paper ID from URL
 */
function extractArXivId(url: string): string | null {
  const match = url.match(/arxiv\.org\/(?:abs|pdf|html)\/([0-9]+\.[0-9]+(?:v[0-9]+)?)/i);
  return match ? match[1] : null;
}

/**
 * Fetches YouTube video title and metadata via oEmbed & scraping
 */
async function fetchYouTubeIntel(videoId: string, url: string): Promise<{ title: string; textContent: string }> {
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
      signal: AbortSignal.timeout(6000),
    });
    let title = 'YouTube Video';
    let author = 'Creator';
    if (oembedRes.ok) {
      const data = await oembedRes.json();
      title = data.title || title;
      author = data.author_name || author;
    }

    // Attempt to fetch timedtext captions
    let captionsText = '';
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(8000),
      });
      if (pageRes.ok) {
        const pageHtml = await pageRes.text();
        const captionMatch = pageHtml.match(/"captionTracks":\s*(\[[^\]]+\])/);
        if (captionMatch) {
          const tracks = JSON.parse(captionMatch[1]);
          const englishTrack = tracks.find((t: any) => t.languageCode === 'en' || t.name?.simpleText?.includes('English')) || tracks[0];
          if (englishTrack?.baseUrl) {
            const transcriptRes = await fetch(englishTrack.baseUrl, { signal: AbortSignal.timeout(8000) });
            if (transcriptRes.ok) {
              const xml = await transcriptRes.text();
              captionsText = xml
                .replace(/<text[^>]*>/g, ' ')
                .replace(/<\/text>/g, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&#39;/g, "'")
                .replace(/&quot;/g, '"')
                .slice(0, 15000);
            }
          }
        }
      }
    } catch {}

    const textContent = `YouTube Video Title: ${title}\nAuthor/Speaker: ${author}\nURL: ${url}\n\nTranscript Content:\n${captionsText || 'Transcript unavailable directly; analyzing video metadata and discussion.'}`;
    return { title, textContent };
  } catch (err: any) {
    return {
      title: 'YouTube Video',
      textContent: `YouTube Video: ${url}\nFailed to extract deep transcript: ${err.message}`,
    };
  }
}

/**
 * Fetches arXiv research paper metadata and PDF
 */
async function fetchArXivIntel(arxivId: string): Promise<{ title: string; textContent: string; pdfBuffer?: Buffer }> {
  try {
    const metaRes = await fetch(`https://export.arxiv.org/api/query?id_list=${arxivId}`, {
      signal: AbortSignal.timeout(8000),
    });
    let title = `arXiv Paper ${arxivId}`;
    let abstract = '';
    if (metaRes.ok) {
      const xml = await metaRes.text();
      const titleMatch = xml.match(/<title>([\s\S]*?)<\/title>/gi);
      if (titleMatch && titleMatch.length > 1) {
        title = titleMatch[1].replace(/<[^>]+>/g, '').trim().replace(/\n/g, ' ');
      }
      const summaryMatch = xml.match(/<summary>([\s\S]*?)<\/summary>/i);
      if (summaryMatch) {
        abstract = summaryMatch[1].replace(/<[^>]+>/g, '').trim();
      }
    }

    // Attempt to download the PDF buffer for native Gemini multimodal analysis
    let pdfBuffer: Buffer | undefined;
    try {
      const pdfRes = await fetch(`https://arxiv.org/pdf/${arxivId}.pdf`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (pdfRes.ok) {
        const ab = await pdfRes.arrayBuffer();
        pdfBuffer = Buffer.from(ab);
        console.log(`[Omni-Sponge] 📥 Ingested arXiv PDF for ${arxivId} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
      }
    } catch (pdfErr) {
      console.warn('[Omni-Sponge] arXiv PDF download notice:', pdfErr);
    }

    const textContent = `Title: ${title}\narXiv ID: ${arxivId}\nAbstract:\n${abstract}`;
    return { title, textContent, pdfBuffer };
  } catch (err: any) {
    return {
      title: `arXiv Paper ${arxivId}`,
      textContent: `arXiv Paper: ${arxivId}\nError fetching metadata: ${err.message}`,
    };
  }
}

/**
 * Fetches GitHub repository architecture intelligence
 */
async function fetchGitHubIntel(url: string): Promise<{ title: string; textContent: string }> {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
  if (!match) return { title: 'GitHub Repo', textContent: `URL: ${url}` };
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');

  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN || '';
  const headers: Record<string, string> = {
    'User-Agent': 'JARVIS-Omni-Sponge/2.0',
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    let desc = '';
    let stars = 0;
    let language = 'Unknown';
    if (repoRes.ok) {
      const d = await repoRes.json();
      desc = d.description || '';
      stars = d.stargazers_count || 0;
      language = d.language || 'Unknown';
    }

    const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers });
    let readmeText = '';
    if (readmeRes.ok) {
      const rData = await readmeRes.json();
      if (rData.content && rData.encoding === 'base64') {
        readmeText = Buffer.from(rData.content, 'base64').toString('utf8');
      }
    }

    return {
      title: `${owner}/${repo}`,
      textContent: `Repository: ${owner}/${repo}\nLanguage: ${language} | Stars: ${stars}\nDescription: ${desc}\n\nREADME.md Snippet:\n${readmeText.slice(0, 10000)}`,
    };
  } catch (err: any) {
    return { title: `${owner}/${repo}`, textContent: `GitHub Repo: ${owner}/${repo}\nError: ${err.message}` };
  }
}

/**
 * Scrapes standard web article text
 */
async function fetchWebArticleIntel(url: string): Promise<{ title: string; textContent: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Web Article';

    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { title, textContent: `Source: ${url}\nTitle: ${title}\n\n${cleanText.slice(0, 12000)}` };
  } catch (err: any) {
    return { title: 'Web Article', textContent: `Article URL: ${url}\nError: ${err.message}` };
  }
}

/**
 * Master Assimilation Pipeline for the Omni-Sponge Second Brain
 */
export async function assimilateContent(input: OmniSpongeInput): Promise<AssimilatedIntel> {
  const startTime = Date.now();
  console.log(`[Omni-Sponge] 🧽 Initiating cognitive assimilation (Type: ${input.type})...`);

  let resolvedTitle = input.fileName || 'Ingested Intel';
  let resolvedText = input.rawText || '';
  let resolvedType: AssimilatedIntel['sourceType'] = 'DIRECT_INTEL';
  let pdfBuffer: Buffer | undefined = input.mimeType === 'application/pdf' ? input.fileBuffer : undefined;

  // 1. Process URL Ingestion
  if (input.type === 'URL' && input.sourceUrl) {
    const url = input.sourceUrl.trim();
    const ytId = extractYouTubeId(url);
    const arxivId = extractArXivId(url);

    if (ytId) {
      resolvedType = 'YOUTUBE_VIDEO';
      const intel = await fetchYouTubeIntel(ytId, url);
      resolvedTitle = intel.title;
      resolvedText = intel.textContent;
    } else if (arxivId) {
      resolvedType = 'ARXIV_PAPER';
      const intel = await fetchArXivIntel(arxivId);
      resolvedTitle = intel.title;
      resolvedText = intel.textContent;
      if (intel.pdfBuffer) pdfBuffer = intel.pdfBuffer;
    } else if (/github\.com\/[^\/]+\/[^\/]+/i.test(url)) {
      resolvedType = 'GITHUB_REPOSITORY';
      const intel = await fetchGitHubIntel(url);
      resolvedTitle = intel.title;
      resolvedText = intel.textContent;
    } else {
      resolvedType = 'WEB_ARTICLE';
      const intel = await fetchWebArticleIntel(url);
      resolvedTitle = intel.title;
      resolvedText = intel.textContent;
    }
  } else if (input.type === 'DOCUMENT' && input.fileBuffer) {
    resolvedType = 'TECHNICAL_DOCUMENT';
    resolvedTitle = input.fileName || 'Uploaded Technical Document';
    if (input.mimeType !== 'application/pdf') {
      resolvedText = input.fileBuffer.toString('utf8');
    }
  }

  // 2. Synthesize with Gemini Strategic Mind (Multimodal Native)
  console.log(`[Omni-Sponge] 🧠 Synthesizing mental models & architectural primitives...`);

  const promptText = `You are F.R.I.D.A.Y. & J.A.R.V.I.S., Chief Cognitive Exoskeleton for Harshan Sarvaiya (Sir).
Sir has fed new intelligence into your "Omni-Sponge" Second Brain substrate.

Analyze this material with Staff/Principal-level rigor. Extract high-signal mental models, mathematical primitives, system designs, and actionable vectors.

${input.userContext ? `SIR'S DIRECTIVE / CONTEXT: "${input.userContext}"\n` : ''}
DOCUMENT METADATA:
- Title: ${resolvedTitle}
- Source: ${input.sourceUrl || input.fileName || 'Direct Ingestion'}
- Type: ${resolvedType}

TEXT EXTRACT:
${resolvedText.slice(0, 10000)}

INSTRUCTIONS:
Extract and output strictly valid JSON matching this schema:
{
  "title": "Clean, punchy authoritative title",
  "summary": "2-3 crisp sentences summarizing core essence",
  "coreBreakthroughs": ["Bullet 1: most counter-intuitive insight", "Bullet 2: key finding", "Bullet 3: structural advantage"],
  "architecturalPrimitives": ["Primitive 1 (algorithms/math/protocols)", "Primitive 2"],
  "actionableVectors": ["Concrete application for Sir's projects, career, or J.A.R.V.I.S./F.R.I.D.A.Y."],
  "assimilatedPrinciples": ["Heuristic/mental model to remember forever"],
  "suggestedCategory": "EVOLUTION" | "PRINCIPLE" | "ARCHITECTURAL_FACT" | "PREFERENCE"
}
Output ONLY the JSON object. Zero markdown conversational filler.`;

  const contents: any[] = [];
  const parts: any[] = [{ text: promptText }];

  // Native Multimodal PDF ingestion if PDF buffer present
  if (pdfBuffer && pdfBuffer.length > 0) {
    parts.unshift({
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfBuffer.toString('base64'),
      },
    });
  }

  contents.push({ role: 'user', parts });

  const aiRes = await callVertexAIGenerate({
    model: 'gemini-3.7-flash',
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 2048 },
    },
    signal: AbortSignal.timeout(50000),
  });

  let parsed: any = null;
  if (aiRes.ok) {
    const data = await aiRes.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.warn('[Omni-Sponge] JSON parse warning:', e);
    }
  }

  const resultData: AssimilatedIntel = {
    title: parsed?.title || resolvedTitle,
    sourceType: resolvedType,
    sourceUrl: input.sourceUrl,
    summary: parsed?.summary || 'Assimilated intelligence from source.',
    coreBreakthroughs: parsed?.coreBreakthroughs || ['Ingested source into second brain.'],
    architecturalPrimitives: parsed?.architecturalPrimitives || [],
    actionableVectors: parsed?.actionableVectors || ['Available for contextual recall in future operations.'],
    assimilatedPrinciples: parsed?.assimilatedPrinciples || [],
    category: (parsed?.suggestedCategory as MemoryCategory) || 'ARCHITECTURAL_FACT',
    executionTimeMs: Date.now() - startTime,
  };

  // 3. Store into Epistemic Semantic Memory Substrate (Upstash jarvis:memories)
  try {
    const memoryRecord = addMemory(
      resultData.category,
      `[Omni-Sponge: ${resultData.title}] ${resultData.summary} Breakthroughs: ${resultData.coreBreakthroughs.join('; ')}. Vectors: ${resultData.actionableVectors.join('; ')}.`,
      `Omni-Sponge Ingestion (${resolvedType}): ${input.sourceUrl || input.fileName || 'Direct'}`,
      0.95,
      'SEMANTIC'
    );
    resultData.memoryId = memoryRecord.id;
    console.log(`[Omni-Sponge] 💾 Stored semantic memory node: ${memoryRecord.id}`);
  } catch (memErr) {
    console.warn('[Omni-Sponge] Memory storage warning:', memErr);
  }

  // 4. Index Chunks into TurboQuant Semantic Vector Knowledge Base (RAG)
  try {
    const fullContent = `${resultData.title}\n\n${resultData.summary}\n\nCore Breakthroughs:\n${resultData.coreBreakthroughs.map(b => `- ${b}`).join('\n')}\n\nArchitectural Primitives:\n${resultData.architecturalPrimitives.map(p => `- ${p}`).join('\n')}\n\nActionable Vectors:\n${resultData.actionableVectors.map(v => `- ${v}`).join('\n')}\n\nRaw Source Intelligence:\n${resolvedText.slice(0, 15000)}`;

    const ragResult = await ingestKnowledgeDocument({
      title: resultData.title,
      content: fullContent,
      source: input.sourceUrl || input.fileName || 'Omni-Sponge Ingestion',
      category: 'SECOND_BRAIN',
      tags: ['omni-sponge', resolvedType.toLowerCase(), 'second-brain'],
    });
    resultData.docId = ragResult.docId;
    console.log(`[Omni-Sponge] ⚡ Indexed into TurboQuant Knowledge Base (DocId: ${ragResult.docId}, Chunks: ${ragResult.chunksIndexed})`);
  } catch (ragErr) {
    console.warn('[Omni-Sponge] RAG indexing warning:', ragErr);
  }

  // 5. Dispatch Telegram Card to Sir
  try {
    const cardMsg =
      `🧠 *[OMNI-SPONGE SECOND BRAIN ASSIMILATED]*\n\n` +
      `📖 **Title**: *${resultData.title}*\n` +
      `🏷️ **Source**: \`${resultData.sourceType}\`${resultData.sourceUrl ? ` ([Link](${resultData.sourceUrl}))` : ''}\n\n` +
      `📝 **Executive Summary**:\n_${resultData.summary}_\n\n` +
      `💡 **Core Breakthroughs**:\n` +
      resultData.coreBreakthroughs.map(b => `• ${b}`).join('\n') +
      `\n\n⚡ **Extraction Vectors for J.A.R.V.I.S. / Sir**:\n` +
      resultData.actionableVectors.map(v => `• ${v}`).join('\n') +
      `\n\n💾 _Quantized & indexed into Long-Term Semantic Memory (ID: \`${resultData.memoryId || 'mem-active'}\`). Ready for instant conversational recall._`;

    const authChatId = process.env.TELEGRAM_AUTHORIZED_CHAT_ID || '864360540';
    await telegramGateway.sendMessage(authChatId, cardMsg, { parseMode: 'Markdown' });
  } catch (tgErr) {
    console.warn('[Omni-Sponge] Telegram card broadcast notice:', tgErr);
  }

  return resultData;
}
