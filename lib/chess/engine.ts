import { Chess, Move, PieceSymbol, Color } from 'chess.js';

export type SparringElo = 1000 | 1400 | 1800 | 2200;

export type MoveVerdict =
  | 'Book'
  | 'Best'
  | 'Good'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Blunder';

export interface EngineEvalResult {
  /** Centipawns from White's perspective (+ = White better, - = Black better) */
  cp: number;
  /** Best move in SAN */
  bestMoveSan: string;
  /** Best move in UCI (e.g. e2e4) */
  bestMoveUci: string;
  /** From square */
  from: string;
  /** To square */
  to: string;
  /** Principal variation in SAN */
  pvSan: string[];
  /** Source of evaluation */
  source: 'lichess-cloud' | 'tactical-engine';
}

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables (from White's perspective, rank 8 down to rank 1)
const PAWN_PST = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 27, 27, 10,  5,  5,
  0,  0,  0, 24, 24,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-22,-22, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0,
];

const KNIGHT_PST = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 12, 16, 16, 12,  0,-30,
  -30,  5, 16, 20, 20, 16,  5,-30,
  -30,  0, 16, 20, 20, 16,  0,-30,
  -30,  5, 12, 16, 16, 12,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const BISHOP_PST = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  8, 12, 12,  8,  0,-10,
  -10,  5,  5, 12, 12,  5,  5,-10,
  -10,  0, 10, 12, 12, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const ROOK_PST = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 12, 12, 12, 12, 12, 12,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  6,  6,  0,  0,  0,
];

const QUEEN_PST = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
  0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];

const KING_MID_PST = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20,
];

const PST_MAP: Record<PieceSymbol, number[]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
  k: KING_MID_PST,
};

/**
 * Static evaluation in centipawns from White's perspective.
 */
export function staticEvalWhite(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
    return 0;
  }

  const board = chess.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const base = PIECE_VALUES[sq.type];
      const pstIndex = sq.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;
      const positional = PST_MAP[sq.type][pstIndex] ?? 0;
      const val = base + positional;
      score += sq.color === 'w' ? val : -val;
    }
  }

  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return moves.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    if (a.captured) {
      scoreA += 10 * PIECE_VALUES[a.captured] - PIECE_VALUES[a.piece];
    }
    if (b.captured) {
      scoreB += 10 * PIECE_VALUES[b.captured] - PIECE_VALUES[b.piece];
    }
    if (a.promotion) scoreA += PIECE_VALUES[a.promotion];
    if (b.promotion) scoreB += PIECE_VALUES[b.promotion];
    if (a.san.includes('+')) scoreA += 45;
    if (b.san.includes('+')) scoreB += 45;
    return scoreB - scoreA;
  });
}

function quiescence(
  chess: Chess,
  alpha: number,
  beta: number,
  maximizing: boolean,
  qDepth: number
): number {
  const standPat = staticEvalWhite(chess);
  if (qDepth <= 0) return standPat;

  if (maximizing) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;

    const captures = orderMoves(
      chess.moves({ verbose: true }).filter((m) => m.captured || m.promotion)
    );
    for (const move of captures) {
      chess.move(move);
      const score = quiescence(chess, alpha, beta, false, qDepth - 1);
      chess.undo();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  } else {
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;

    const captures = orderMoves(
      chess.moves({ verbose: true }).filter((m) => m.captured || m.promotion)
    );
    for (const move of captures) {
      chess.move(move);
      const score = quiescence(chess, alpha, beta, true, qDepth - 1);
      chess.undo();
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
    return beta;
  }
}

function alphabeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  useQuiescence: boolean
): number {
  if (chess.isGameOver()) {
    const raw = staticEvalWhite(chess);
    // Prefer faster checkmates
    if (raw > 90000) return raw + depth * 10;
    if (raw < -90000) return raw - depth * 10;
    return raw;
  }

  if (depth <= 0) {
    return useQuiescence
      ? quiescence(chess, alpha, beta, maximizing, 3)
      : staticEvalWhite(chess);
  }

  const moves = orderMoves(chess.moves({ verbose: true }));

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const ev = alphabeta(chess, depth - 1, alpha, beta, false, useQuiescence);
      chess.undo();
      if (ev > maxEval) maxEval = ev;
      if (ev > alpha) alpha = ev;
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const ev = alphabeta(chess, depth - 1, alpha, beta, true, useQuiescence);
      chess.undo();
      if (ev < minEval) minEval = ev;
      if (ev < beta) beta = ev;
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/**
 * Fetches Lichess Cloud Eval if position is cached in Lichess's 3000+ Elo database.
 * Graceful 1.5s timeout; returns null if unavailable or not cached.
 */
export async function fetchLichessCloudEval(fen: string): Promise<EngineEvalResult | null> {
  try {
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(1500),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const firstPv = data?.pvs?.[0];
    if (!firstPv || !firstPv.moves) return null;

    const uciMoves = String(firstPv.moves).trim().split(/\s+/);
    const firstUci = uciMoves[0];
    if (!firstUci || firstUci.length < 4) return null;

    const chess = new Chess(fen);
    const pvSan: string[] = [];
    for (const uci of uciMoves.slice(0, 5)) {
      const m = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? (uci[4] as PieceSymbol) : undefined,
      });
      if (!m) break;
      pvSan.push(m.san);
    }

    if (pvSan.length === 0) return null;

    let cp = 0;
    if (typeof firstPv.cp === 'number') {
      cp = firstPv.cp;
    } else if (typeof firstPv.mate === 'number') {
      cp = firstPv.mate > 0 ? 9999 : -9999;
    }

    return {
      cp,
      bestMoveSan: pvSan[0],
      bestMoveUci: firstUci,
      from: firstUci.slice(0, 2),
      to: firstUci.slice(2, 4),
      pvSan,
      source: 'lichess-cloud',
    };
  } catch {
    return null;
  }
}

/**
 * Evaluates the position and selects the best move for the requested sparring Elo.
 */
export async function evaluateAndPickMove(
  fen: string,
  elo: SparringElo = 1400,
  useCloud: boolean = true
): Promise<EngineEvalResult | null> {
  const chess = new Chess(fen);
  const legalMoves = orderMoves(chess.moves({ verbose: true }));
  if (legalMoves.length === 0) return null;

  // For Master tier (2200) or evaluation, try Lichess Cloud Eval first
  if (useCloud && elo >= 1800) {
    const cloud = await fetchLichessCloudEval(fen);
    if (cloud) return cloud;
  }

  const maximizing = chess.turn() === 'w';
  const depth = elo <= 1000 ? 2 : elo <= 1400 ? 2 : elo <= 1800 ? 3 : 3;
  const useQuiescence = elo >= 1400;

  const scoredMoves: { move: Move; score: number }[] = [];
  for (const move of legalMoves) {
    chess.move(move);
    const score = alphabeta(
      chess,
      depth - 1,
      -Infinity,
      Infinity,
      !maximizing,
      useQuiescence
    );
    chess.undo();
    scoredMoves.push({ move, score });
  }

  scoredMoves.sort((a, b) => (maximizing ? b.score - a.score : a.score - b.score));

  // Add slight human-like imperfection at 1000 Elo
  let chosen = scoredMoves[0];
  if (elo === 1000 && scoredMoves.length > 1) {
    const topTwo = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
    const withinMargin = topTwo.filter((m) => Math.abs(m.score - chosen.score) < 120);
    if (withinMargin.length > 1 && Math.random() < 0.35) {
      chosen = withinMargin[Math.floor(Math.random() * withinMargin.length)];
    }
  }

  const best = scoredMoves[0];
  const from = chosen.move.from;
  const to = chosen.move.to;

  return {
    cp: best.score,
    bestMoveSan: chosen.move.san,
    bestMoveUci: `${from}${to}${chosen.move.promotion || ''}`,
    from,
    to,
    pvSan: [chosen.move.san],
    source: 'tactical-engine',
  };
}

/**
 * Classifies a player's move based on centipawn loss.
 */
export function classifyMoveDelta(cpLoss: number, moveNumber: number): MoveVerdict {
  if (moveNumber <= 3 && cpLoss <= 35) return 'Book';
  if (cpLoss <= 20) return 'Best';
  if (cpLoss <= 65) return 'Good';
  if (cpLoss <= 140) return 'Inaccuracy';
  if (cpLoss <= 280) return 'Mistake';
  return 'Blunder';
}

export function formatEvalDisplay(cp: number): string {
  if (Math.abs(cp) >= 9000) {
    return cp > 0 ? '+M' : '-M';
  }
  const pawns = cp / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

/**
 * Computes percentage (0-100) for White's side of the eval bar.
 */
export function evalToWhitePercent(cp: number): number {
  if (cp >= 9000) return 98;
  if (cp <= -9000) return 2;
  // Smooth sigmoid-like clamp around +-600cp
  const clamped = Math.max(-800, Math.min(800, cp));
  return Math.round(50 + (clamped / 800) * 45);
}

export function getMoveHistorySan(pgn: string): string[] {
  const c = new Chess();
  try {
    c.loadPgn(pgn);
    return c.history();
  } catch {
    return [];
  }
}

export function getSideToMove(fen: string): Color {
  return new Chess(fen).turn();
}
