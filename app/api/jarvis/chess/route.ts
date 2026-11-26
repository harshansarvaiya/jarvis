import { NextRequest, NextResponse } from 'next/server';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';
import { callVertexAIGenerate, isVertexAIAvailable } from '@/lib/jarvis/vertex';
import { synthesizeMovieVoice } from '@/lib/jarvis/tts';
import { jsonrepair } from 'jsonrepair';

export const dynamic = 'force-dynamic';

interface ChessCoachRequest {
  fen: string;
  pgn?: string;
  lastMoveSan?: string;
  engineReplySan?: string;
  playerColor: 'w' | 'b';
  evalCp: number;
  cpLoss: number;
  verdict: string;
  bestMoveSan?: string;
  pvSan?: string[];
  sparringElo?: number;
  question?: string;
  speak?: boolean;
}

interface ChessCoachResponse {
  verdict: string;
  headline: string;
  explanation: string;
  gukeshPrinciple: string;
  challenge: string | null;
  model: string;
  audioBase64?: string | null;
}

function formatChessForSpeech(text: string): string {
  return text
    .replace(/\bO-O-O\b/g, 'castles queenside')
    .replace(/\bO-O\b/g, 'castles kingside')
    .replace(/\b([KQRBN])x([a-h][1-8])\+/g, (_, p, sq) => `${pieceWord(p)} takes ${sq}, check`)
    .replace(/\b([KQRBN])x([a-h][1-8])/g, (_, p, sq) => `${pieceWord(p)} takes ${sq}`)
    .replace(/\b([KQRBN])([a-h][1-8])\+/g, (_, p, sq) => `${pieceWord(p)} ${sq}, check`)
    .replace(/\b([KQRBN])([a-h][1-8])/g, (_, p, sq) => `${pieceWord(p)} ${sq}`)
    .replace(/\b([a-h])x([a-h][1-8])/g, '$1 takes $2');
}

function pieceWord(p: string): string {
  switch (p) {
    case 'K': return 'King';
    case 'Q': return 'Queen';
    case 'R': return 'Rook';
    case 'B': return 'Bishop';
    case 'N': return 'Knight';
    default: return p;
  }
}

async function attachCoachVoice(
  coachRes: ChessCoachResponse,
  speak?: boolean
): Promise<ChessCoachResponse> {
  if (!speak) return coachRes;
  try {
    const spokenRaw = [
      coachRes.explanation,
      coachRes.challenge ? coachRes.challenge : '',
    ]
      .filter(Boolean)
      .join(' ');
    const spokenText = formatChessForSpeech(spokenRaw);
    const buf = await synthesizeMovieVoice(spokenText, 'FRIDAY');
    if (buf && buf.length > 0) {
      return { ...coachRes, audioBase64: buf.toString('base64') };
    }
  } catch (err: any) {
    console.warn('[Chess Coach] TTS synthesis failed:', err?.message);
  }
  return { ...coachRes, audioBase64: null };
}

const GUKESH_SYSTEM_PROMPT = `You are F.R.I.D.A.Y., embodying a World-Champion Grandmaster chess coach inspired by Gukesh D's calm, deep-calculating, classical-meets-dynamic style, coaching Sir (Harshan Sarvaiya).

Rules:
- Address the player as "Sir" naturally, with composed intellectual rigor and zero fluff.
- Be concrete: reference actual squares, pieces, pawn structures, king safety, and candidate moves from the provided FEN/PGN and engine evaluation.
- Never invent illegal moves. When citing variations, stick to the provided bestMoveSan / pvSan or obvious legal responses.
- Keep "explanation" crisp (2-4 sentences max) so Sir can read it between moves without breaking flow.
- "gukeshPrinciple" must be 1 sharp, memorable Grandmaster heuristic relevant to this exact position (e.g., "Prophylaxis before aggression: ask what your opponent wants before launching an attack.").
- If cpLoss >= 90 (Inaccuracy, Mistake, or Blunder) and no custom question was asked, set "challenge" to a short Socratic prompt asking Sir to spot the stronger move or tactical threat (without giving away the exact move in the challenge text if possible, or guiding him to calculate). Otherwise set "challenge" to null.
- Return ONLY valid JSON with keys: headline, explanation, gukeshPrinciple, challenge.`;

function buildDeterministicFallback(body: ChessCoachRequest): ChessCoachResponse {
  const evalStr = `${body.evalCp >= 0 ? '+' : ''}${(body.evalCp / 100).toFixed(1)}`;
  if (body.question) {
    return {
      verdict: body.verdict || 'Analysis',
      headline: `Position Evaluation: ${evalStr}`,
      explanation: `Sir, the engine evaluates this position at ${evalStr}${body.bestMoveSan ? `, favoring ${body.bestMoveSan}` : ''}. Focus on king safety, piece activity, and checking your opponent's forcing moves (checks, captures, threats) before committing.`,
      gukeshPrinciple: 'Checks, captures, and threats first—calculate concrete forcing lines before relying on intuition.',
      challenge: null,
      model: 'LOCAL ENGINE HEURISTIC',
    };
  }

  const isBad = body.cpLoss >= 90;
  return {
    verdict: body.verdict,
    headline: isBad
      ? `${body.verdict}: ${body.lastMoveSan || 'Move'} (${evalStr})`
      : `${body.verdict}: ${body.lastMoveSan || 'Solid'} (${evalStr})`,
    explanation: isBad
      ? `Sir, ${body.lastMoveSan} conceded roughly ${(body.cpLoss / 100).toFixed(1)} pawns of advantage. ${body.bestMoveSan ? `The sharper continuation was ${body.bestMoveSan}.` : ''} Pause and scan for loose pieces or tactical counter-strikes.`
      : `Clean, purposeful play, Sir. ${body.engineReplySan ? `I responded with ${body.engineReplySan}. ` : ''}Evaluation stands at ${evalStr}. Look for ways to improve your worst-placed piece.`,
    gukeshPrinciple: isBad
      ? 'Blunder-check every move: before releasing the piece, ask what your opponent threatens next.'
      : 'Classical harmony: every piece should have a clear job—control the center, guard a weakness, or pressure a target.',
    challenge: isBad
      ? `Can you spot why ${body.lastMoveSan} slipped, and which candidate move kept the tension better?`
      : null,
    model: 'LOCAL ENGINE HEURISTIC',
  };
}

export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  let body: ChessCoachRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.fen) {
    return NextResponse.json({ error: 'FEN is required' }, { status: 400 });
  }

  const userPrompt = body.question
    ? `Current FEN: ${body.fen}
PGN so far: ${body.pgn || '(opening)'}
Sir is playing: ${body.playerColor === 'w' ? 'White' : 'Black'}
Engine eval (from White's view): ${(body.evalCp / 100).toFixed(2)}
Engine top move: ${body.bestMoveSan || 'N/A'} (PV: ${(body.pvSan || []).join(' ') || 'N/A'})
Sir asks: "${body.question}"

Answer Sir's question directly in JSON.`
    : `Current FEN: ${body.fen}
PGN so far: ${body.pgn || '(opening)'}
Sir is playing: ${body.playerColor === 'w' ? 'White' : 'Black'} (Sparring Elo: ${body.sparringElo || 1400})
Sir just played: ${body.lastMoveSan || 'N/A'}
Engine replied with: ${body.engineReplySan || 'N/A'}
Move classification: ${body.verdict} (centipawn loss: ${body.cpLoss})
Engine eval after move (White's view): ${(body.evalCp / 100).toFixed(2)}
Stronger alternative before Sir's move / current best: ${body.bestMoveSan || 'N/A'} (PV: ${(body.pvSan || []).join(' ') || 'N/A'})

Coach Sir on this exact moment in JSON.`;

  // 1. Primary: Vertex AI Gemini 3.8 Flash
  if (isVertexAIAvailable()) {
    try {
      const res = await callVertexAIGenerate({
        model: 'gemini-3.8-flash',
        systemInstruction: { parts: [{ text: GUKESH_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 700,
          responseMimeType: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json();
        const rawText =
          data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (rawText) {
          const parsed = JSON.parse(jsonrepair(rawText));
          const payload = await attachCoachVoice(
            {
              verdict: body.question ? 'Coach Q&A' : body.verdict,
              headline: parsed.headline || `${body.verdict}: ${body.lastMoveSan || ''}`,
              explanation: parsed.explanation || '',
              gukeshPrinciple: parsed.gukeshPrinciple || '',
              challenge: parsed.challenge || null,
              model: '🧠 GEMINI 3.8 FLASH',
            },
            body.speak
          );
          return NextResponse.json(payload);
        }
      }
    } catch (err: any) {
      console.warn('[Chess Coach] Vertex AI fallback triggered:', err?.message);
    }
  }

  // 2. Secondary: Groq LPU (openai/gpt-oss-120b)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          temperature: 0.35,
          max_tokens: 600,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: GUKESH_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        const rawText = data?.choices?.[0]?.message?.content || '';
        if (rawText) {
          const parsed = JSON.parse(jsonrepair(rawText));
          const payload = await attachCoachVoice(
            {
              verdict: body.question ? 'Coach Q&A' : body.verdict,
              headline: parsed.headline || `${body.verdict}: ${body.lastMoveSan || ''}`,
              explanation: parsed.explanation || '',
              gukeshPrinciple: parsed.gukeshPrinciple || '',
              challenge: parsed.challenge || null,
              model: '⚡ GROQ GPT-OSS 120B',
            },
            body.speak
          );
          return NextResponse.json(payload);
        }
      }
    } catch (err: any) {
      console.warn('[Chess Coach] Groq fallback triggered:', err?.message);
    }
  }

  // 3. Deterministic fallback
  const fallbackPayload = await attachCoachVoice(buildDeterministicFallback(body), body.speak);
  return NextResponse.json(fallbackPayload);
}
