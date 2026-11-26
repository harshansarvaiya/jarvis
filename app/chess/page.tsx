'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import Link from 'next/link';
import {
  ArrowLeft,
  Brain,
  ChevronRight,
  Copy,
  Check,
  Crown,
  Lightbulb,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  classifyMoveDelta,
  evalToWhitePercent,
  evaluateAndPickMove,
  formatEvalDisplay,
  MoveVerdict,
  SparringElo,
} from '@/lib/chess/engine';

interface CoachFeedback {
  verdict: string;
  headline: string;
  explanation: string;
  gukeshPrinciple: string;
  challenge: string | null;
  model: string;
  audioBase64?: string | null;
}

type ArrowTuple = [Square, Square, string?];

const VERDICT_STYLES: Record<string, string> = {
  Brilliancy: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50',
  Best: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50',
  Book: 'bg-sky-500/20 text-sky-300 border-sky-400/50',
  Good: 'bg-teal-500/15 text-teal-300 border-teal-500/40',
  Inaccuracy: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
  Mistake: 'bg-orange-500/20 text-orange-300 border-orange-400/50',
  Blunder: 'bg-rose-500/20 text-rose-300 border-rose-400/50',
  'Coach Q&A': 'bg-purple-500/20 text-purple-300 border-purple-400/50',
  Analysis: 'bg-slate-800 text-slate-300 border-slate-600',
};

export default function ChessArenaPage() {
  const [game, setGame] = useState<Chess>(() => new Chess());
  const [fen, setFen] = useState<string>(() => new Chess().fen());
  const [pgn, setPgn] = useState<string>('');
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [sparringElo, setSparringElo] = useState<SparringElo>(1400);
  const [evalCp, setEvalCp] = useState<number>(20);
  const [isEngineThinking, setIsEngineThinking] = useState<boolean>(false);
  const [isCoachThinking, setIsCoachThinking] = useState<boolean>(false);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [lastMoveSquares, setLastMoveSquares] = useState<{ from: Square; to: Square } | null>(null);
  const [coachArrows, setCoachArrows] = useState<ArrowTuple[]>([]);
  const [question, setQuestion] = useState<string>('');
  const [copiedPgn, setCopiedPgn] = useState<boolean>(false);
  const [authRequired, setAuthRequired] = useState<boolean>(false);
  const [boardWidth, setBoardWidth] = useState<number>(480);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [coach, setCoach] = useState<CoachFeedback>({
    verdict: 'Book',
    headline: 'Gukesh-Level Sparring Protocol Armed',
    explanation:
      'Sir, I am calibrated and ready. Make your opening move on the board—I will respond with engine-verified tactics and dissect every turning point with you live.',
    gukeshPrinciple:
      'Every move in the opening should fight for central control, rapid piece development, and king safety.',
    challenge: null,
    model: 'F.R.I.D.A.Y. // READY',
  });

  const boardContainerRef = useRef<HTMLDivElement | null>(null);

  const playChessSound = useCallback((type: 'move' | 'capture' | 'check') => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'check') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(760, now + 0.12);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.19);
      } else if (type === 'capture') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(95, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.1);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.08);
      }
      setTimeout(() => void ctx.close().catch(() => {}), 250);
    } catch {
      // Ignore audio context restrictions
    }
  }, []);

  const stopCoachAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const playCoachAudio = useCallback(
    (feedback: CoachFeedback) => {
      stopCoachAudio();
      if (!voiceEnabled) return;

      if (feedback.audioBase64) {
        try {
          const audio = new Audio(`data:audio/mp3;base64,${feedback.audioBase64}`);
          audioRef.current = audio;
          setIsSpeaking(true);
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          void audio.play().catch(() => setIsSpeaking(false));
          return;
        } catch {
          setIsSpeaking(false);
        }
      }

      // Browser SpeechSynthesis fallback if neural TTS buffer wasn't returned
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const text = [feedback.explanation, feedback.challenge || ''].filter(Boolean).join(' ');
        if (!text) return;
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.03;
        utter.onstart = () => setIsSpeaking(true);
        utter.onend = () => setIsSpeaking(false);
        utter.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utter);
      }
    },
    [stopCoachAudio, voiceEnabled]
  );

  useEffect(() => {
    return () => stopCoachAudio();
  }, [stopCoachAudio]);

  // Responsive board sizing
  useEffect(() => {
    const updateWidth = () => {
      if (!boardContainerRef.current) return;
      const containerW = boardContainerRef.current.clientWidth;
      // Leave room for the eval bar (~28px + gap)
      const target = Math.max(280, Math.min(520, containerW - 44));
      setBoardWidth(target);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const requestCoachFeedback = useCallback(
    async (payload: {
      fen: string;
      pgn: string;
      lastMoveSan?: string;
      engineReplySan?: string;
      evalCp: number;
      cpLoss: number;
      verdict: string;
      bestMoveSan?: string;
      pvSan?: string[];
      question?: string;
    }) => {
      setIsCoachThinking(true);
      try {
        const res = await fetch('/api/jarvis/chess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            playerColor,
            sparringElo,
            speak: voiceEnabled,
          }),
        });

        if (res.status === 401) {
          setAuthRequired(true);
          return;
        }

        if (res.ok) {
          const data: CoachFeedback = await res.json();
          setAuthRequired(false);
          setCoach(data);
          if (voiceEnabled) {
            playCoachAudio(data);
          }
        }
      } catch (err) {
        console.warn('[Chess Coach] Request failed:', err);
      } finally {
        setIsCoachThinking(false);
      }
    },
    [playerColor, playCoachAudio, sparringElo, voiceEnabled]
  );

  // Trigger engine move when it's AI's turn
  const triggerEngineTurn = useCallback(
    async (
      currentChess: Chess,
      prevEvalCp: number,
      playerMoveSan?: string,
      preMoveBestSan?: string,
      preMoveBestFrom?: string,
      preMoveBestTo?: string,
      preMovePv?: string[]
    ) => {
      if (currentChess.isGameOver()) {
        const resultText = currentChess.isCheckmate()
          ? currentChess.turn() === playerColor
            ? 'Checkmate — Engine wins.'
            : 'Checkmate — Well played, Sir!'
          : 'Draw by stalemate or repetition.';
        setCoach({
          verdict: 'Analysis',
          headline: resultText,
          explanation: `Game concluded after ${currentChess.history().length} half-moves. Review the PGN or start a fresh sparring match.`,
          gukeshPrinciple: 'Every endgame or tactical finish is a lesson in calculation precision.',
          challenge: null,
          model: 'GAME COMPLETE',
        });
        return;
      }

      setIsEngineThinking(true);
      try {
        // Natural Chess.com-style pacing before AI piece glides
        await new Promise((r) => setTimeout(r, 240));

        const evalResult = await evaluateAndPickMove(currentChess.fen(), sparringElo, true);
        if (!evalResult) return;

        const nextChess = new Chess(currentChess.fen());
        // Preserve full history by cloning from PGN if available
        if (currentChess.pgn()) {
          nextChess.loadPgn(currentChess.pgn());
        }

        const engineMove = nextChess.move({
          from: evalResult.from,
          to: evalResult.to,
          promotion: 'q',
        });

        if (!engineMove) return;

        // Re-evaluate after engine reply
        const afterEval = await evaluateAndPickMove(nextChess.fen(), sparringElo, false);
        const newCp = afterEval ? afterEval.cp : evalResult.cp;

        // Calculate Sir's centipawn loss from his perspective
        let cpLoss = 0;
        if (playerMoveSan) {
          const delta =
            playerColor === 'w' ? prevEvalCp - evalResult.cp : evalResult.cp - prevEvalCp;
          cpLoss = Math.max(0, Math.round(delta));
        }

        const moveNumber = Math.ceil(nextChess.history().length / 2);
        const verdict: MoveVerdict = playerMoveSan
          ? classifyMoveDelta(cpLoss, moveNumber)
          : 'Book';

        setGame(nextChess);
        setFen(nextChess.fen());
        setPgn(nextChess.pgn());
        setEvalCp(newCp);
        setLastMoveSquares({ from: engineMove.from as Square, to: engineMove.to as Square });
        playChessSound(
          nextChess.inCheck() ? 'check' : engineMove.captured ? 'capture' : 'move'
        );

        if (cpLoss >= 90 && preMoveBestFrom && preMoveBestTo) {
          setCoachArrows([
            [preMoveBestFrom as Square, preMoveBestTo as Square, 'rgba(34, 211, 238, 0.85)'],
          ]);
        } else {
          setCoachArrows([]);
        }

        // Fire Gukesh coach analysis
        if (playerMoveSan) {
          await requestCoachFeedback({
            fen: nextChess.fen(),
            pgn: nextChess.pgn(),
            lastMoveSan: playerMoveSan,
            engineReplySan: engineMove.san,
            evalCp: newCp,
            cpLoss,
            verdict,
            bestMoveSan: preMoveBestSan || evalResult.bestMoveSan,
            pvSan: preMovePv || evalResult.pvSan,
          });
        }
      } finally {
        setIsEngineThinking(false);
      }
    },
    [playerColor, requestCoachFeedback, sparringElo]
  );

  // Execute a player move (shared by drag-drop and click-to-move)
  const attemptPlayerMove = useCallback(
    async (from: Square, to: Square): Promise<boolean> => {
      if (isEngineThinking || game.isGameOver()) return false;
      if (game.turn() !== playerColor) return false;

      // Capture pre-move evaluation for accurate cpLoss coaching
      const preMoveEval = await evaluateAndPickMove(game.fen(), sparringElo, false);
      const prevCp = preMoveEval ? preMoveEval.cp : evalCp;

      const clone = new Chess();
      if (game.pgn()) {
        clone.loadPgn(game.pgn());
      } else {
        clone.load(game.fen());
      }

      let moveResult = null;
      try {
        moveResult = clone.move({
          from,
          to,
          promotion: 'q',
        });
      } catch {
        return false;
      }

      if (!moveResult) return false;

      setGame(clone);
      setFen(clone.fen());
      setPgn(clone.pgn());
      setSelectedSquare(null);
      setLastMoveSquares({ from, to });
      setCoachArrows([]);
      playChessSound(
        clone.inCheck() ? 'check' : moveResult.captured ? 'capture' : 'move'
      );

      // Trigger engine reply + coaching
      void triggerEngineTurn(
        clone,
        prevCp,
        moveResult.san,
        preMoveEval?.bestMoveSan,
        preMoveEval?.from,
        preMoveEval?.to,
        preMoveEval?.pvSan
      );

      return true;
    },
    [evalCp, game, isEngineThinking, playerColor, sparringElo, triggerEngineTurn]
  );

  const onPieceDrop = (sourceSquare: Square, targetSquare: Square): boolean => {
    void attemptPlayerMove(sourceSquare, targetSquare);
    return true;
  };

  const onSquareClick = (square: Square) => {
    if (isEngineThinking || game.isGameOver() || game.turn() !== playerColor) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }
      // Try moving selected piece to clicked square
      const legalTargets = game
        .moves({ square: selectedSquare, verbose: true })
        .map((m) => m.to);
      if (legalTargets.includes(square)) {
        void attemptPlayerMove(selectedSquare, square);
        return;
      }
    }

    const piece = game.get(square);
    if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  };

  const handleNewGame = (side: 'w' | 'b' = playerColor) => {
    const fresh = new Chess();
    setGame(fresh);
    setFen(fresh.fen());
    setPgn('');
    setPlayerColor(side);
    setBoardOrientation(side === 'w' ? 'white' : 'black');
    setEvalCp(20);
    setSelectedSquare(null);
    setLastMoveSquares(null);
    setCoachArrows([]);
    setCoach({
      verdict: 'Book',
      headline: side === 'w' ? 'New Match — Your Move, Sir' : 'New Match — Engine Opening',
      explanation:
        side === 'w'
          ? 'You hold the White pieces. Seize the center and develop with purpose.'
          : 'I will open as White. Observe how I claim central space and respond dynamically.',
      gukeshPrinciple:
        'Play the board, not the opponent: seek harmony between your pawns and minor pieces.',
      challenge: null,
      model: 'F.R.I.D.A.Y. // READY',
    });

    if (side === 'b') {
      void triggerEngineTurn(fresh, 20);
    }
  };

  const handleUndo = () => {
    if (isEngineThinking) return;
    const history = game.history();
    if (history.length === 0) return;

    const clone = new Chess();
    clone.loadPgn(game.pgn());
    // Undo engine reply + player move if possible
    clone.undo();
    if (clone.turn() !== playerColor && clone.history().length > 0) {
      clone.undo();
    }

    setGame(clone);
    setFen(clone.fen());
    setPgn(clone.pgn());
    setSelectedSquare(null);
    setCoachArrows([]);
    setLastMoveSquares(null);
    setCoach((prev) => ({
      ...prev,
      verdict: 'Analysis',
      headline: 'Position Restored — Try Another Line',
      explanation: 'Takebacks are encouraged in training. Calculate candidate moves before committing.',
      challenge: null,
    }));
  };

  const handleHint = async () => {
    if (isEngineThinking || game.isGameOver()) return;
    const res = await evaluateAndPickMove(game.fen(), 2200, true);
    if (!res) return;
    setCoachArrows([[res.from as Square, res.to as Square, 'rgba(16, 185, 129, 0.9)']]);
    setEvalCp(res.cp);
    await requestCoachFeedback({
      fen: game.fen(),
      pgn: game.pgn(),
      evalCp: res.cp,
      cpLoss: 0,
      verdict: 'Analysis',
      bestMoveSan: res.bestMoveSan,
      pvSan: res.pvSan,
      question: `Give me a subtle Grandmaster hint for the best move (${res.bestMoveSan}) without just saying the move outright unless necessary—explain the idea.`,
    });
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || isCoachThinking) return;
    setQuestion('');
    const res = await evaluateAndPickMove(game.fen(), 1800, true);
    await requestCoachFeedback({
      fen: game.fen(),
      pgn: game.pgn(),
      evalCp: res ? res.cp : evalCp,
      cpLoss: 0,
      verdict: 'Coach Q&A',
      bestMoveSan: res?.bestMoveSan,
      pvSan: res?.pvSan,
      question: q,
    });
  };

  const handleCopyPgn = () => {
    navigator.clipboard.writeText(pgn || '*');
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 1800);
  };

  // Highlight legal moves, selected square, last move, and king in check
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (lastMoveSquares) {
      styles[lastMoveSquares.from] = { backgroundColor: 'rgba(34, 211, 238, 0.18)' };
      styles[lastMoveSquares.to] = { backgroundColor: 'rgba(34, 211, 238, 0.28)' };
    }

    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: 'rgba(6, 182, 212, 0.4)' };
      const moves = game.moves({ square: selectedSquare, verbose: true });
      for (const m of moves) {
        const hasPiece = Boolean(game.get(m.to as Square));
        styles[m.to] = hasPiece
          ? {
              background:
                'radial-gradient(circle, transparent 58%, rgba(34, 211, 238, 0.55) 60%)',
            }
          : {
              background:
                'radial-gradient(circle, rgba(34, 211, 238, 0.55) 22%, transparent 24%)',
            };
      }
    }

    if (game.inCheck()) {
      const board = game.board();
      const turn = game.turn();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sq = board[r][c];
          if (sq && sq.type === 'k' && sq.color === turn) {
            const files = 'abcdefgh';
            const checkSq = `${files[c]}${8 - r}`;
            styles[checkSq] = {
              background: 'radial-gradient(circle, rgba(244, 63, 94, 0.85) 0%, transparent 75%)',
            };
          }
        }
      }
    }

    return styles;
  }, [game, lastMoveSquares, selectedSquare]);

  // Format move list into pairs
  const movePairs = useMemo(() => {
    const hist = game.history();
    const pairs: { num: number; w: string; b?: string }[] = [];
    for (let i = 0; i < hist.length; i += 2) {
      pairs.push({ num: i / 2 + 1, w: hist[i], b: hist[i + 1] });
    }
    return pairs;
  }, [game]);

  // Compute captured pieces & net material advantage (Chess.com style)
  const capturedInfo = useMemo(() => {
    const startCounts: Record<'q' | 'r' | 'b' | 'n' | 'p', number> = {
      q: 1,
      r: 2,
      b: 2,
      n: 2,
      p: 8,
    };
    const values: Record<'q' | 'r' | 'b' | 'n' | 'p', number> = {
      q: 9,
      r: 5,
      b: 3,
      n: 3,
      p: 1,
    };
    const whiteSymbols: Record<'q' | 'r' | 'b' | 'n' | 'p', string> = {
      q: '♕',
      r: '♖',
      b: '♗',
      n: '♘',
      p: '♙',
    };
    const blackSymbols: Record<'q' | 'r' | 'b' | 'n' | 'p', string> = {
      q: '♛',
      r: '♜',
      b: '♝',
      n: '♞',
      p: '♟',
    };

    const onBoardW: Record<string, number> = { q: 0, r: 0, b: 0, n: 0, p: 0 };
    const onBoardB: Record<string, number> = { q: 0, r: 0, b: 0, n: 0, p: 0 };
    let matW = 0;
    let matB = 0;

    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = board[r][c];
        if (!sq || sq.type === 'k') continue;
        const t = sq.type as 'q' | 'r' | 'b' | 'n' | 'p';
        if (sq.color === 'w') {
          onBoardW[t] = (onBoardW[t] || 0) + 1;
          matW += values[t];
        } else {
          onBoardB[t] = (onBoardB[t] || 0) + 1;
          matB += values[t];
        }
      }
    }

    const order: ('q' | 'r' | 'b' | 'n' | 'p')[] = ['q', 'r', 'b', 'n', 'p'];
    const capturedByWhite: string[] = [];
    const capturedByBlack: string[] = [];

    for (const p of order) {
      const missingB = Math.max(0, startCounts[p] - (onBoardB[p] || 0));
      for (let i = 0; i < missingB; i++) capturedByWhite.push(blackSymbols[p]);

      const missingW = Math.max(0, startCounts[p] - (onBoardW[p] || 0));
      for (let i = 0; i < missingW; i++) capturedByBlack.push(whiteSymbols[p]);
    }

    return {
      capturedByWhite,
      capturedByBlack,
      whiteLead: matW > matB ? matW - matB : 0,
      blackLead: matB > matW ? matB - matW : 0,
    };
  }, [game]);

  const topColor = boardOrientation === 'white' ? 'b' : 'w';
  const bottomColor = boardOrientation === 'white' ? 'w' : 'b';
  const topCaptured =
    topColor === 'w' ? capturedInfo.capturedByWhite : capturedInfo.capturedByBlack;
  const bottomCaptured =
    bottomColor === 'w' ? capturedInfo.capturedByWhite : capturedInfo.capturedByBlack;
  const topLead = topColor === 'w' ? capturedInfo.whiteLead : capturedInfo.blackLead;
  const bottomLead = bottomColor === 'w' ? capturedInfo.whiteLead : capturedInfo.blackLead;

  const whiteBarPct = evalToWhitePercent(evalCp);
  const verdictBadgeClass =
    VERDICT_STYLES[coach.verdict] || 'bg-slate-800 text-slate-200 border-slate-600';

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100 flex flex-col">
      {/* Header Bar */}
      <header className="border-b border-cyan-950/60 bg-slate-950/80 backdrop-blur-md px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 transition-colors"
            title="Return to J.A.R.V.I.S. Command HUD"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <h1 className="text-sm sm:text-base font-mono font-bold tracking-wider text-cyan-300">
                F.R.I.D.A.Y. CHESS ARENA
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                GUKESH GM PROTOCOL
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Live Engine Sparring + Real-Time Grandmaster Coaching
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sparringElo}
            onChange={(e) => setSparringElo(Number(e.target.value) as SparringElo)}
            className="bg-slate-900 border border-slate-700/80 text-xs font-mono text-cyan-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-400"
            title="Engine Sparring Strength"
          >
            <option value={1000}>Elo ~1000 (Novice)</option>
            <option value={1400}>Elo ~1400 (Club)</option>
            <option value={1800}>Elo ~1800 (Candidate)</option>
            <option value={2200}>Elo ~2200 (Master)</option>
          </select>

          <button
            onClick={() => {
              if (voiceEnabled) stopCoachAudio();
              setVoiceEnabled((v) => !v);
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors ${
              voiceEnabled
                ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 hover:border-cyan-400'
                : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
            title={voiceEnabled ? 'Mute Coach Voice' : 'Enable Coach Voice'}
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{voiceEnabled ? 'Voice On' : 'Muted'}</span>
          </button>

          <button
            onClick={() => handleNewGame(playerColor === 'w' ? 'b' : 'w')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-cyan-500/50 text-xs font-mono text-slate-200 flex items-center gap-1.5"
            title="Switch Sides & Start New Game"
          >
            <Swords className="w-3.5 h-3.5 text-cyan-400" />
            <span>Play {playerColor === 'w' ? 'Black' : 'White'}</span>
          </button>

          <button
            onClick={() => handleNewGame(playerColor)}
            className="px-2.5 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-500/40 hover:border-cyan-400 text-xs font-mono text-cyan-200 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>
      </header>

      {authRequired && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs font-mono flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Guardian Gate locked: local engine play works offline, but live AI coaching requires unlocking J.A.R.V.I.S. on the main HUD.
            </span>
          </div>
          <Link
            href="/"
            className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 hover:bg-amber-500/30 shrink-0"
          >
            Unlock HUD
          </Link>
        </div>
      )}

      {/* Main Arena Grid */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left/Center: Eval Bar + Chessboard + Captured Pieces + Action Bar */}
        <section className="lg:col-span-7 flex flex-col items-center" ref={boardContainerRef}>
          {/* Top Player & Captured Pieces Strip */}
          <div
            className="flex items-center justify-between gap-2 px-2 py-1.5 mb-1.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs font-mono"
            style={{ width: boardWidth + 38 }}
          >
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`w-2.5 h-2.5 rounded-sm border ${
                  topColor === 'w'
                    ? 'bg-slate-100 border-slate-300'
                    : 'bg-slate-800 border-slate-500'
                }`}
              />
              <span className="text-slate-200 font-semibold">
                {topColor === playerColor ? 'Sir (You)' : `F.R.I.D.A.Y. (${sparringElo})`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-hidden">
              <div className="flex items-center flex-wrap text-base leading-none tracking-tight text-slate-200">
                {topCaptured.map((sym, i) => (
                  <span key={i} className="-ml-0.5 first:ml-0 drop-shadow-sm">
                    {sym}
                  </span>
                ))}
              </div>
              {topLead > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                  +{topLead}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-stretch gap-2.5">
            {/* Vertical Eval Bar */}
            <div className="w-7 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 flex flex-col justify-between relative select-none">
              <div
                className="w-full bg-slate-800 transition-all duration-500"
                style={{ height: `${100 - whiteBarPct}%` }}
              />
              <div
                className="w-full bg-slate-100 transition-all duration-500"
                style={{ height: `${whiteBarPct}%` }}
              />
              <span
                className={`absolute inset-x-0 text-[9px] font-mono font-bold text-center py-1 ${
                  evalCp >= 0 ? 'bottom-0 text-slate-900' : 'top-0 text-slate-200'
                }`}
              >
                {formatEvalDisplay(evalCp)}
              </span>
            </div>

            {/* Interactive Board */}
            <div className="rounded-xl overflow-hidden border border-cyan-950/80 shadow-[0_0_30px_rgba(0,229,255,0.08)]">
              <Chessboard
                id="jarvis-chess-board"
                position={fen}
                onPieceDrop={onPieceDrop}
                onSquareClick={onSquareClick}
                boardOrientation={boardOrientation}
                boardWidth={boardWidth}
                customSquareStyles={customSquareStyles}
                customArrows={coachArrows}
                customDarkSquareStyle={{ backgroundColor: '#1e293b' }}
                customLightSquareStyle={{ backgroundColor: '#475569' }}
                animationDuration={280}
              />
            </div>
          </div>

          {/* Bottom Player & Captured Pieces Strip */}
          <div
            className="flex items-center justify-between gap-2 px-2 py-1.5 mt-1.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs font-mono"
            style={{ width: boardWidth + 38 }}
          >
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`w-2.5 h-2.5 rounded-sm border ${
                  bottomColor === 'w'
                    ? 'bg-slate-100 border-slate-300'
                    : 'bg-slate-800 border-slate-500'
                }`}
              />
              <span className="text-slate-200 font-semibold">
                {bottomColor === playerColor ? 'Sir (You)' : `F.R.I.D.A.Y. (${sparringElo})`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-hidden">
              <div className="flex items-center flex-wrap text-base leading-none tracking-tight text-slate-200">
                {bottomCaptured.map((sym, i) => (
                  <span key={i} className="-ml-0.5 first:ml-0 drop-shadow-sm">
                    {sym}
                  </span>
                ))}
              </div>
              {bottomLead > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                  +{bottomLead}
                </span>
              )}
            </div>
          </div>

          {/* Board Action Controls */}
          <div className="w-full max-w-[550px] mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  isEngineThinking
                    ? 'bg-amber-400 animate-ping'
                    : game.isGameOver()
                    ? 'bg-rose-400'
                    : game.turn() === playerColor
                    ? 'bg-emerald-400'
                    : 'bg-cyan-400'
                }`}
              />
              <span className="text-slate-300">
                {isEngineThinking
                  ? 'Engine calculating...'
                  : game.isCheckmate()
                  ? 'Checkmate!'
                  : game.isDraw()
                  ? 'Draw'
                  : game.turn() === playerColor
                  ? 'Your turn'
                  : 'Engine turn'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleUndo}
                disabled={isEngineThinking || game.history().length === 0}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 disabled:opacity-40 text-xs font-mono text-slate-300 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>

              <button
                onClick={handleHint}
                disabled={isEngineThinking || game.isGameOver()}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 hover:border-emerald-400 disabled:opacity-40 text-xs font-mono text-emerald-300 flex items-center gap-1.5"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Hint</span>
              </button>

              <button
                onClick={() =>
                  setBoardOrientation((o) => (o === 'white' ? 'black' : 'white'))
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono text-slate-300"
              >
                Flip
              </button>
            </div>
          </div>
        </section>

        {/* Right Panel: F.R.I.D.A.Y. Gukesh Coach + Ask Coach + PGN */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          {/* Live Coach Card */}
          <div className="rounded-xl bg-slate-950/90 border border-cyan-900/50 p-4 shadow-lg">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold tracking-wider text-cyan-300">
                  F.R.I.D.A.Y. // COACH
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => (isSpeaking ? stopCoachAudio() : playCoachAudio(coach))}
                  className={`p-1 rounded border text-[11px] font-mono transition-colors ${
                    isSpeaking
                      ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 animate-pulse'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-cyan-300'
                  }`}
                  title={isSpeaking ? 'Stop Voice' : 'Replay Coach Voice'}
                >
                  {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${verdictBadgeClass}`}
                >
                  {coach.verdict}
                </span>
              </div>
            </div>

            {isCoachThinking ? (
              <div className="py-6 flex items-center gap-2 text-xs font-mono text-cyan-300 animate-pulse">
                <Sparkles className="w-4 h-4" />
                <span>Calculating Gukesh-level positional & tactical breakdown...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-100">{coach.headline}</h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {coach.explanation}
                </p>

                <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-800/40">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 mb-1">
                    Gukesh Principle
                  </div>
                  <p className="text-xs text-cyan-100/90">{coach.gukeshPrinciple}</p>
                </div>

                {coach.challenge && (
                  <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/40">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      Coach Challenge (Hit Undo to Retry)
                    </div>
                    <p className="text-xs text-amber-100">{coach.challenge}</p>
                  </div>
                )}

                <div className="text-[10px] font-mono text-slate-500 text-right">
                  {coach.model}
                </div>
              </div>
            )}
          </div>

          {/* Ask Coach Input */}
          <form onSubmit={handleAskQuestion} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask F.R.I.D.A.Y. about this position (e.g. 'What is my plan?')"
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500/60 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!question.trim() || isCoachThinking}
              className="px-3 py-2 rounded-lg bg-cyan-950/80 border border-cyan-500/50 hover:border-cyan-400 disabled:opacity-40 text-cyan-300 flex items-center gap-1.5 text-xs font-mono"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </form>

          {/* Move History (PGN) */}
          <div className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Move Log ({game.history().length} plies)
              </span>
              <button
                onClick={handleCopyPgn}
                className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 flex items-center gap-1"
              >
                {copiedPgn ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPgn ? 'Copied' : 'Copy PGN'}</span>
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto text-xs font-mono grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-slate-300">
              {movePairs.length === 0 ? (
                <span className="col-span-full text-slate-500 italic">No moves played yet.</span>
              ) : (
                movePairs.map((pair) => (
                  <div key={pair.num} className="flex items-center gap-1.5">
                    <span className="text-slate-500">{pair.num}.</span>
                    <span className="text-slate-100">{pair.w}</span>
                    {pair.b && <span className="text-cyan-300/90">{pair.b}</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
