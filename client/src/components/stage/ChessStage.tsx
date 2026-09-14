import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRoom } from '../../context/RoomContext';
import { Chess, Square } from 'chess.js';
import confetti from 'canvas-confetti';
import {
  Swords,
  Puzzle,
  Tv,
  RotateCcw,
  Flag,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  Trophy,
  UserPlus,
  UserMinus,
  Sparkles,
  Volume2,
  VolumeX,
  Lightbulb,
  Eye,
  SkipForward,
  Flame,
  Calendar,
  AlertCircle
} from 'lucide-react';

// Unicode Chess Pieces
const PIECE_SYMBOLS: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

const PIECE_NAMES: Record<string, string> = {
  p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King'
};

const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0
};

interface PuzzleData {
  game: {
    id: string;
    players: { name: string; color: string; rating?: number }[];
    pgn: string;
  };
  puzzle: {
    id: string;
    rating: number;
    plays: number;
    solution: string[];
    themes: string[];
    initialPly: number;
  };
}

function playChessSound(type: 'move' | 'capture' | 'check' | 'gameover' | 'wrong' | 'hint') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === 'move') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.07);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === 'capture') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'check') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.setValueAtTime(740, now + 0.08);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'gameover') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.12);
      osc.frequency.setValueAtTime(783.99, now + 0.24);
      osc.frequency.setValueAtTime(1046.50, now + 0.36);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.55);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.2);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'hint') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.linearRampToValueAtTime(900, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch {}
}

export const ChessStage: React.FC = () => {
  const {
    room,
    currentUser,
    sendChessSeat,
    sendChessMove,
    sendChessReset,
    sendChessResign
  } = useRoom();

  const [activeTab, setActiveTab] = useState<'1v1' | 'puzzles' | 'daily' | 'tv'>('puzzles');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // --- 1v1 Arena State ---
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [selectedTimeControl, setSelectedTimeControl] = useState<number>(600);

  // Lichess challenge generator
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const [challengeData, setChallengeData] = useState<{ id: string; url: string; urlWhite?: string; urlBlack?: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const gameState = room?.chessGameState;
  const fen = gameState?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const arenaChess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const arenaBoard = arenaChess.board();
  const isWhiteUser = gameState?.whitePlayer?.id === currentUser.id;
  const isBlackUser = gameState?.blackPlayer?.id === currentUser.id;
  const isPlayer = isWhiteUser || isBlackUser;

  useEffect(() => {
    if (isBlackUser && !isWhiteUser) {
      setIsFlipped(true);
    } else if (isWhiteUser) {
      setIsFlipped(false);
    }
  }, [isBlackUser, isWhiteUser]);

  // Sound feedback for 1v1 match
  const last1v1StateRef = useRef<{ isCheckmate?: boolean; lastMove?: string } | null>(null);
  useEffect(() => {
    if (!gameState) return;
    const prev = last1v1StateRef.current;
    if (soundEnabled && gameState.lastMove && prev?.lastMove !== gameState.lastMove.san) {
      if (gameState.isCheckmate) {
        playChessSound('gameover');
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } else if (gameState.isCheck) {
        playChessSound('check');
      } else if (gameState.lastMove.san?.includes('x')) {
        playChessSound('capture');
      } else {
        playChessSound('move');
      }
    }
    last1v1StateRef.current = {
      isCheckmate: gameState.isCheckmate,
      lastMove: gameState.lastMove?.san
    };
  }, [gameState, soundEnabled]);

  // --- Infinite Tactical Puzzles State ---
  const [puzzleData, setPuzzleData] = useState<PuzzleData | null>(null);
  const [puzzleLoading, setPuzzleLoading] = useState(false);
  const [puzzleError, setPuzzleError] = useState<string | null>(null);
  const [puzzleChess, setPuzzleChess] = useState<Chess | null>(null);
  const [puzzleStep, setPuzzleStep] = useState<number>(0);
  const [puzzleStatus, setPuzzleStatus] = useState<'playing' | 'correct' | 'wrong' | 'solved'>('playing');
  const [puzzleStreak, setPuzzleStreak] = useState<number>(() => {
    return parseInt(localStorage.getItem('wanpala_puzzle_streak') || '0', 10);
  });
  const [puzzleBestStreak, setPuzzleBestStreak] = useState<number>(() => {
    return parseInt(localStorage.getItem('wanpala_puzzle_best') || '0', 10);
  });
  const [puzzleHintSquare, setPuzzleHintSquare] = useState<Square | null>(null);
  const [opponentLastMove, setOpponentLastMove] = useState<{ from: string; to: string; san: string } | null>(null);
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [puzzlePendingPromotion, setPuzzlePendingPromotion] = useState<{ from: Square; to: Square } | null>(null);

  // Load a new puzzle from Lichess
  const loadNextPuzzle = useCallback(async (mode: 'next' | 'daily' = 'next') => {
    setPuzzleLoading(true);
    setPuzzleError(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setPuzzleHintSquare(null);
    setPuzzlePendingPromotion(null);
    setPuzzleStatus('playing');

    try {
      // Fetch via server proxy, fallback to direct Lichess
      let res: Response;
      try {
        res = await fetch(`/api/puzzle/${mode}`);
        if (!res.ok) throw new Error('Server proxy error');
      } catch {
        res = await fetch(`https://lichess.org/api/puzzle/${mode}`);
      }

      if (!res.ok) throw new Error('Failed to load puzzle');
      const data: PuzzleData = await res.json();
      setPuzzleData(data);

      // Setup chessboard with moves up to opponent's blunder
      const fullGame = new Chess();
      fullGame.loadPgn(data.game.pgn);
      const moves = fullGame.history({ verbose: true });

      const board = new Chess();
      for (let i = 0; i <= data.puzzle.initialPly && i < moves.length; i++) {
        board.move(moves[i]);
      }

      const oppMove = moves[data.puzzle.initialPly];
      setOpponentLastMove(oppMove ? { from: oppMove.from, to: oppMove.to, san: oppMove.san } : null);
      const colorToMove = board.turn();
      setPlayerColor(colorToMove);
      setIsFlipped(colorToMove === 'b'); // Auto-flip perspective to solver's side
      setPuzzleChess(board);
      setPuzzleStep(0);
    } catch (err: any) {
      console.error('Failed to load puzzle:', err);
      setPuzzleError(err.message || 'Could not fetch puzzle');
    } finally {
      setPuzzleLoading(false);
    }
  }, []);

  // Initial load when tab opened
  useEffect(() => {
    if (activeTab === 'puzzles' && !puzzleData && !puzzleLoading) {
      loadNextPuzzle('next');
    }
  }, [activeTab, puzzleData, puzzleLoading, loadNextPuzzle]);

  // Handle puzzle user move
  const handlePuzzleSquareClick = (square: Square) => {
    if (!puzzleChess || puzzleStatus === 'solved') return;
    if (!puzzleData || puzzleStep >= puzzleData.puzzle.solution.length) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      const isLegal = legalMoves.includes(square);
      if (isLegal) {
        const piece = puzzleChess.get(selectedSquare);
        const isPromotion =
          piece?.type === 'p' &&
          ((piece.color === 'w' && square.endsWith('8')) || (piece.color === 'b' && square.endsWith('1')));

        if (isPromotion) {
          setPuzzlePendingPromotion({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }

        executePuzzleMove(selectedSquare, square);
        return;
      }
    }

    const piece = puzzleChess.get(square);
    if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
      const moves = puzzleChess.moves({ square, verbose: true });
      setLegalMoves(moves.map(m => m.to as Square));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  const executePuzzleMove = (from: Square, to: Square, promotion: string = 'q') => {
    if (!puzzleChess || !puzzleData) return;
    setSelectedSquare(null);
    setLegalMoves([]);
    setPuzzleHintSquare(null);

    const userUci = `${from}${to}${promotion !== 'q' ? promotion : ''}`;
    const expectedUci = puzzleData.puzzle.solution[puzzleStep];

    const isMatch = userUci === expectedUci || userUci.startsWith(expectedUci) || expectedUci.startsWith(userUci);

    if (isMatch) {
      // Correct move!
      try {
        puzzleChess.move({ from, to, promotion });
        setPuzzleChess(new Chess(puzzleChess.fen()));

        const nextStep = puzzleStep + 1;
        setPuzzleStep(nextStep);

        if (nextStep >= puzzleData.puzzle.solution.length) {
          // PUZZLE SOLVED!
          setPuzzleStatus('solved');
          const newStreak = puzzleStreak + 1;
          setPuzzleStreak(newStreak);
          localStorage.setItem('wanpala_puzzle_streak', newStreak.toString());
          if (newStreak > puzzleBestStreak) {
            setPuzzleBestStreak(newStreak);
            localStorage.setItem('wanpala_puzzle_best', newStreak.toString());
          }
          if (soundEnabled) playChessSound('gameover');
          confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
        } else {
          // Play opponent response
          setPuzzleStatus('correct');
          if (soundEnabled) playChessSound('move');

          const counterUci = puzzleData.puzzle.solution[nextStep];
          setTimeout(() => {
            try {
              puzzleChess.move({
                from: counterUci.slice(0, 2),
                to: counterUci.slice(2, 4),
                promotion: counterUci[4] || 'q'
              });
              setPuzzleChess(new Chess(puzzleChess.fen()));
              setPuzzleStep(nextStep + 1);
              setPuzzleStatus('playing');
              if (soundEnabled) playChessSound('move');
            } catch (e) {
              console.error('Opponent counter move failed:', e);
            }
          }, 450);
        }
      } catch (err) {
        console.error('Move error:', err);
      }
    } else {
      // Wrong move
      setPuzzleStatus('wrong');
      setPuzzleStreak(0);
      localStorage.setItem('wanpala_puzzle_streak', '0');
      if (soundEnabled) playChessSound('wrong');
    }
  };

  const handlePuzzlePromotionSelect = (pieceChar: 'q' | 'r' | 'b' | 'n') => {
    if (!puzzlePendingPromotion) return;
    executePuzzleMove(puzzlePendingPromotion.from, puzzlePendingPromotion.to, pieceChar);
    setPuzzlePendingPromotion(null);
  };

  // Give Hint
  const handleGiveHint = () => {
    if (!puzzleData || puzzleStep >= puzzleData.puzzle.solution.length) return;
    const targetUci = puzzleData.puzzle.solution[puzzleStep];
    const fromSquare = targetUci.slice(0, 2) as Square;
    setPuzzleHintSquare(fromSquare);
    setSelectedSquare(fromSquare);
    if (puzzleChess) {
      const moves = puzzleChess.moves({ square: fromSquare, verbose: true });
      setLegalMoves(moves.map(m => m.to as Square));
    }
    if (soundEnabled) playChessSound('hint');
  };

  // Show Solution
  const handleShowSolution = () => {
    if (!puzzleChess || !puzzleData) return;
    let step = puzzleStep;
    const interval = setInterval(() => {
      if (step >= puzzleData.puzzle.solution.length) {
        clearInterval(interval);
        setPuzzleStatus('solved');
        return;
      }
      const uci = puzzleData.puzzle.solution[step];
      try {
        puzzleChess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci[4] || 'q'
        });
        setPuzzleChess(new Chess(puzzleChess.fen()));
        step++;
        setPuzzleStep(step);
        if (soundEnabled) playChessSound('move');
      } catch {
        clearInterval(interval);
      }
    }, 600);
  };

  // --- 1v1 Move Click Handler ---
  const handle1v1SquareClick = (square: Square) => {
    if (gameState?.winner) return;

    const currentTurn = arenaChess.turn();
    if (gameState?.whitePlayer && gameState?.blackPlayer) {
      if (currentTurn === 'w' && !isWhiteUser) return;
      if (currentTurn === 'b' && !isBlackUser) return;
    }

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      const isLegal = legalMoves.includes(square);
      if (isLegal) {
        const piece = arenaChess.get(selectedSquare);
        const isPromotion =
          piece?.type === 'p' &&
          ((piece.color === 'w' && square.endsWith('8')) || (piece.color === 'b' && square.endsWith('1')));

        if (isPromotion) {
          setPendingPromotion({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }

        sendChessMove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }
    }

    const piece = arenaChess.get(square);
    if (piece && piece.color === currentTurn) {
      if (isPlayer) {
        if (piece.color === 'w' && !isWhiteUser) return;
        if (piece.color === 'b' && !isBlackUser) return;
      }

      setSelectedSquare(square);
      const moves = arenaChess.moves({ square, verbose: true });
      setLegalMoves(moves.map(m => m.to as Square));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  const handle1v1PromotionSelect = (pieceChar: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    sendChessMove({
      from: pendingPromotion.from,
      to: pendingPromotion.to,
      promotion: pieceChar
    });
    setPendingPromotion(null);
  };

  // Material and captured pieces
  const captured1v1 = useMemo(() => {
    const startingCounts: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const currentCounts: Record<string, { w: number; b: number }> = {
      p: { w: 0, b: 0 },
      n: { w: 0, b: 0 },
      b: { w: 0, b: 0 },
      r: { w: 0, b: 0 },
      q: { w: 0, b: 0 }
    };

    arenaBoard.forEach(row => {
      row.forEach(sq => {
        if (sq && sq.type !== 'k') {
          currentCounts[sq.type][sq.color]++;
        }
      });
    });

    const whiteCapturedFromBlack: string[] = [];
    const blackCapturedFromWhite: string[] = [];
    let whiteScore = 0;
    let blackScore = 0;

    Object.keys(startingCounts).forEach(type => {
      const lostByBlack = startingCounts[type] - currentCounts[type].b;
      for (let i = 0; i < lostByBlack; i++) {
        whiteCapturedFromBlack.push(type);
        whiteScore += PIECE_VALUES[type];
      }

      const lostByWhite = startingCounts[type] - currentCounts[type].w;
      for (let i = 0; i < lostByWhite; i++) {
        blackCapturedFromWhite.push(type);
        blackScore += PIECE_VALUES[type];
      }
    });

    return {
      whiteCaptured: whiteCapturedFromBlack,
      blackCaptured: blackCapturedFromWhite,
      advantage: whiteScore - blackScore
    };
  }, [arenaBoard]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const createLichessChallenge = async () => {
    setIsCreatingChallenge(true);
    try {
      const res = await fetch('https://lichess.org/api/challenge/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rated: false,
          'clock.limit': 600,
          'clock.increment': 0,
          name: 'WAN PALA Lounge Match'
        })
      });
      const data = await res.json();
      if (data && data.url) {
        setChallengeData({
          id: data.challenge?.id || 'game',
          url: data.url,
          urlWhite: data.urlWhite,
          urlBlack: data.urlBlack
        });
      }
    } catch (err) {
      console.error('Failed to create Lichess challenge:', err);
    } finally {
      setIsCreatingChallenge(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const activeBoard = activeTab === 'puzzles' ? (puzzleChess?.board() || arenaBoard) : arenaBoard;
  const activeChess = activeTab === 'puzzles' ? (puzzleChess || arenaChess) : arenaChess;

  const squares = useMemo(() => {
    const list: { square: Square; row: number; col: number; isDark: boolean }[] = [];
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    const ranks = isFlipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
    const orderedFiles = isFlipped ? [...files].reverse() : files;

    ranks.forEach(rank => {
      orderedFiles.forEach(file => {
        const square = `${file}${rank}` as Square;
        const colIdx = files.indexOf(file);
        const rowIdx = 8 - rank;
        const isDark = (rowIdx + colIdx) % 2 === 1;
        list.push({ square, row: rowIdx, col: colIdx, isDark });
      });
    });

    return list;
  }, [isFlipped]);

  return (
    <div className="flex flex-col w-full h-full bg-slate-950/90 text-slate-100 overflow-hidden select-none">
      {/* Top Header & Tab Navigation - Responsive Mobile/Desktop */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-2.5 py-1.5 sm:px-4 sm:py-2 bg-slate-900/90 border-b border-white/10 backdrop-blur-md shrink-0 gap-1.5 sm:gap-3">
        {/* Title & Brand Row (with actions on mobile) */}
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/30 shadow-inner">
              ♟
            </div>
            <span className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Chess Lounge
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 hidden sm:inline">
                1v1 & Tactics
              </span>
            </span>
          </div>

          {/* Quick Header Controls (Sound, Flip, Streak) */}
          <div className="flex items-center gap-1.5">
            {activeTab === 'puzzles' && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-[11px] font-bold">
                <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>{puzzleStreak}</span>
              </div>
            )}

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1 sm:p-1.5 rounded-lg border transition ${
                soundEnabled
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  : 'text-slate-500 bg-white/5 border-white/10'
              }`}
              title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setIsFlipped(!isFlipped)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-white/10 transition"
              title="Flip Board Perspective"
            >
              <RotateCw className="w-3 h-3" />
              <span className="hidden sm:inline">Flip</span>
            </button>
          </div>
        </div>

        {/* Tab Switchers: 4 clean full-width or flex tabs */}
        <div className="grid grid-cols-4 sm:flex items-center gap-1 bg-slate-850/90 p-0.5 sm:p-1 rounded-xl border border-white/10 w-full sm:w-auto">
          <button
            onClick={() => {
              setActiveTab('puzzles');
              if (!puzzleData) loadNextPuzzle('next');
            }}
            className={`flex items-center justify-center gap-1 px-1.5 sm:px-3 py-1 rounded-lg text-[11px] font-semibold transition ${
              activeTab === 'puzzles'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Puzzle className="w-3 h-3" />
            <span>Puzzles</span>
          </button>

          <button
            onClick={() => setActiveTab('1v1')}
            className={`flex items-center justify-center gap-1 px-1.5 sm:px-3 py-1 rounded-lg text-[11px] font-semibold transition ${
              activeTab === '1v1'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Swords className="w-3 h-3" />
            <span>1v1 Arena</span>
          </button>

          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center justify-center gap-1 px-1.5 sm:px-3 py-1 rounded-lg text-[11px] font-semibold transition ${
              activeTab === 'daily'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Daily</span>
          </button>

          <button
            onClick={() => setActiveTab('tv')}
            className={`flex items-center justify-center gap-1 px-1.5 sm:px-3 py-1 rounded-lg text-[11px] font-semibold transition ${
              activeTab === 'tv'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Tv className="w-3 h-3" />
            <span>TV</span>
          </button>
        </div>
      </div>

      {/* Main Stage Body */}
      <div className="flex-1 min-h-0 w-full relative overflow-hidden">
        {/* ========================================================================= */}
        {/* TAB 1: INFINITE TACTICAL PUZZLES (INTERACTIVE SOLVER) */}
        {/* ========================================================================= */}
        {activeTab === 'puzzles' && (
          <div className="w-full h-full flex flex-col md:flex-row items-center justify-start md:justify-center p-2 sm:p-3 md:p-6 gap-2.5 md:gap-6 overflow-y-auto">
            {/* Left: The Puzzle Board */}
            <div className="flex flex-col items-center justify-center max-w-full flex-shrink-0">
              {/* Top Banner: Opponent / Status info */}
              <div className="w-full max-w-[420px] md:max-w-[480px] flex items-center justify-between px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-900/90 rounded-t-xl border border-b-0 border-white/10">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-xs sm:text-sm">{playerColor === 'w' ? '⚫' : '⚪'}</span>
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-300">
                    Opponent: <strong className="text-amber-300">{opponentLastMove?.san || '...'}</strong>
                  </span>
                </div>
                <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  Rating: <strong className="text-slate-200">{puzzleData?.puzzle.rating || '1500'}</strong>
                </span>
              </div>

              {/* 8x8 Board Container - Dynamic Sizing that never clips on phone screens */}
              <div className="relative aspect-square w-[min(92vw,360px)] md:w-[min(80vw,480px)] max-h-[calc(100dvh-320px)] md:max-h-[calc(100vh-280px)] border-2 border-slate-700/80 shadow-2xl overflow-hidden bg-slate-800">
                <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
                  {squares.map(({ square, row, col, isDark }) => {
                    const piece = activeChess.get(square);
                    const isSelected = selectedSquare === square;
                    const isLegal = legalMoves.includes(square);
                    const isOpponentLastMove = opponentLastMove?.from === square || opponentLastMove?.to === square;
                    const isHint = puzzleHintSquare === square;

                    return (
                      <div
                        key={square}
                        data-square={square}
                        onClick={() => handlePuzzleSquareClick(square)}
                        className={`relative flex items-center justify-center cursor-pointer transition-all duration-100 ${
                          isDark ? 'bg-[#769656] text-slate-900' : 'bg-[#eeeed2] text-slate-800'
                        } ${isOpponentLastMove ? 'ring-2 ring-inset ring-amber-400/60 bg-amber-200/40' : ''} ${
                          isSelected ? 'ring-4 ring-inset ring-brand-500 bg-amber-300/60 z-10' : ''
                        } ${isHint ? 'ring-4 ring-inset ring-cyan-400 bg-cyan-300/60 animate-bounce z-10' : ''}`}
                      >
                        {/* Edge Coordinates */}
                        {((isFlipped ? col === 7 : col === 0)) && (
                          <span className={`absolute top-0.5 left-1 text-[8px] sm:text-[9px] font-bold pointer-events-none ${isDark ? 'text-[#eeeed2]/60' : 'text-[#769656]/80'}`}>
                            {square[1]}
                          </span>
                        )}
                        {((isFlipped ? row === 0 : row === 7)) && (
                          <span className={`absolute bottom-0.5 right-1 text-[8px] sm:text-[9px] font-bold pointer-events-none ${isDark ? 'text-[#eeeed2]/60' : 'text-[#769656]/80'}`}>
                            {square[0]}
                          </span>
                        )}

                        {/* Piece Icon */}
                        {piece && (
                          <div
                            className={`w-full h-full flex items-center justify-center select-none text-3xl sm:text-4xl md:text-6xl pointer-events-none ${
                              piece.color === 'w'
                                ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'
                                : 'text-slate-950 drop-shadow-[0_1px_2px_rgba(255,255,255,0.4)]'
                            }`}
                          >
                            <span>{PIECE_SYMBOLS[piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase()]}</span>
                          </div>
                        )}

                        {/* Legal Move Hints */}
                        {isLegal && !piece && (
                          <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-slate-900/35 ring-1 ring-white/30 pointer-events-none" />
                        )}
                        {isLegal && piece && (
                          <div className="absolute inset-1 rounded-full ring-3 sm:ring-4 ring-inset ring-red-500/70 bg-red-500/20 pointer-events-none" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pawn Promotion Modal */}
                {puzzlePendingPromotion && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-30 animate-fadeIn">
                    <div className="bg-slate-900 border border-white/20 p-4 rounded-2xl shadow-2xl flex flex-col items-center">
                      <h3 className="text-xs font-bold text-amber-300 mb-3">Choose Promotion</h3>
                      <div className="flex items-center gap-3">
                        {(['q', 'r', 'b', 'n'] as const).map(p => (
                          <button
                            key={p}
                            onClick={() => handlePuzzlePromotionSelect(p)}
                            className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-amber-600 border border-white/10 text-3xl flex items-center justify-center text-white transition transform hover:scale-110 shadow-lg"
                            title={PIECE_NAMES[p]}
                          >
                            {PIECE_SYMBOLS[playerColor === 'w' ? p.toUpperCase() : p.toLowerCase()]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Solved Overlay */}
                {puzzleStatus === 'solved' && (
                  <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-center p-4 sm:p-6 z-20 animate-fadeIn">
                    <div className="bg-slate-900/90 border border-emerald-500/50 p-4 sm:p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-xs neon-glow">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-2">
                        <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />
                      </div>
                      <h2 className="text-base sm:text-lg font-black text-slate-100 mb-1">Puzzle Solved!</h2>
                      <p className="text-xs text-emerald-300 font-semibold mb-3 sm:mb-4">
                        +1 to Streak! Rating {puzzleData?.puzzle.rating}
                      </p>
                      <button
                        onClick={() => loadNextPuzzle('next')}
                        className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition transform hover:scale-105"
                      >
                        <SkipForward className="w-4 h-4" /> Next Puzzle
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Solver Bar */}
              <div className="w-full max-w-[420px] md:max-w-[480px] flex items-center justify-between px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-900/90 rounded-b-xl border border-t-0 border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm">{playerColor === 'w' ? '⚪' : '⚫'}</span>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-200 truncate">
                    Find move for {playerColor === 'w' ? 'White' : 'Black'}!
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] sm:text-xs text-amber-300 font-bold flex-shrink-0">
                  <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400 text-amber-400" />
                  Streak: {puzzleStreak}
                </div>
              </div>
            </div>

            {/* Right: Puzzle Info & Action Dashboard */}
            <div className="flex flex-col gap-2 sm:gap-3 w-full max-w-[420px] md:w-80 max-h-full flex-shrink-0 pb-2">
              {/* Feedback Alert Card */}
              <div className={`p-2.5 sm:p-3.5 rounded-2xl border shadow-xl flex items-center justify-between transition-all ${
                puzzleStatus === 'solved'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : puzzleStatus === 'wrong'
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-200 animate-shake'
                  : puzzleStatus === 'correct'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-slate-900/70 border-white/10 text-slate-200'
              }`}>
                <div className="flex items-center gap-2">
                  {puzzleStatus === 'solved' ? (
                    <Trophy className="w-4 h-4 text-emerald-400" />
                  ) : puzzleStatus === 'wrong' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="text-xs font-bold">
                    {puzzleStatus === 'solved'
                      ? 'Puzzle Completed!'
                      : puzzleStatus === 'wrong'
                      ? 'Incorrect move. Try again!'
                      : puzzleStatus === 'correct'
                      ? 'Best move! Continue...'
                      : `Step ${Math.floor(puzzleStep / 2) + 1} of ${Math.ceil((puzzleData?.puzzle.solution.length || 2) / 2)}`}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Next Puzzle / Hint / Solution */}
              <div className="bg-slate-900/70 border border-white/10 p-2.5 sm:p-3.5 rounded-2xl shadow-xl flex flex-col gap-2">
                <button
                  onClick={() => loadNextPuzzle('next')}
                  disabled={puzzleLoading}
                  className="flex items-center justify-center gap-2 w-full py-2 sm:py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg transition disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  <SkipForward className="w-3.5 h-3.5" /> Next Puzzle
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleGiveHint}
                    className="flex items-center justify-center gap-1.5 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-white/10 transition cursor-pointer active:scale-95"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Hint
                  </button>

                  <button
                    onClick={handleShowSolution}
                    className="flex items-center justify-center gap-1.5 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-white/10 transition cursor-pointer active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5" /> Solution
                  </button>
                </div>
              </div>

              {/* Stats & Metadata Card */}
              <div className="bg-slate-900/70 border border-white/10 p-2.5 sm:p-3.5 rounded-2xl shadow-xl flex flex-col gap-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                  <span className="text-[11px] font-bold text-slate-300">Puzzle #{puzzleData?.puzzle.id || '...'}</span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-slate-400">Rating: <strong className="text-white">{puzzleData?.puzzle.rating || 1500}</strong></span>
                    <span className="text-amber-300 font-bold">🔥 Best: {puzzleBestStreak}</span>
                  </div>
                </div>

                {/* Theme Tags */}
                <div className="flex flex-wrap gap-1">
                  {puzzleData?.puzzle.themes && puzzleData.puzzle.themes.length > 0 ? (
                    puzzleData.puzzle.themes.slice(0, 4).map(t => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-medium text-slate-300 border border-white/5">
                        #{t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">General Tactics</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: 1v1 IN-ROOM MULTIPLAYER ARENA */}
        {/* ========================================================================= */}
        {activeTab === '1v1' && (
          <div className="w-full h-full flex flex-col md:flex-row items-center justify-start md:justify-center p-2 sm:p-3 md:p-6 gap-2.5 md:gap-6 overflow-y-auto">
            {/* Left: 1v1 Board */}
            <div className="flex flex-col items-center justify-center max-w-full flex-shrink-0">
              {/* Top Player */}
              <div className="w-full max-w-[420px] md:max-w-[480px] flex items-center justify-between px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-900/90 rounded-t-xl border border-b-0 border-white/10">
                {(() => {
                  const topColor = isFlipped ? 'white' : 'black';
                  const player = isFlipped ? gameState?.whitePlayer : gameState?.blackPlayer;
                  const isTopTurn = (isFlipped && arenaChess.turn() === 'w') || (!isFlipped && arenaChess.turn() === 'b');
                  const capturedPieces = isFlipped ? captured1v1.blackCaptured : captured1v1.whiteCaptured;

                  return (
                    <>
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span className="text-xs sm:text-sm">{isFlipped ? '⚪' : '⚫'}</span>
                        {player ? (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-sm sm:text-base">{player.avatar}</span>
                            <span className="text-xs font-bold text-slate-200 truncate">{player.name}</span>
                            {player.id === currentUser.id && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold">You</span>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => sendChessSeat(topColor)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[10px] sm:text-[11px] font-semibold transition cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3" /> Play {isFlipped ? 'White' : 'Black'}
                          </button>
                        )}
                        <div className="flex items-center text-xs opacity-75 ml-1.5 tracking-tighter">
                          {capturedPieces.map((p, i) => (
                            <span key={i}>{PIECE_SYMBOLS[isFlipped ? p.toUpperCase() : p.toLowerCase()]}</span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isTopTurn && !gameState?.winner && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        )}
                        <span className={`text-[11px] sm:text-xs font-mono px-1.5 sm:px-2 py-0.5 rounded-md font-bold ${
                          isTopTurn && !gameState?.winner
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-400 border border-white/5'
                        }`}>
                          {formatTime(isFlipped ? (gameState?.whiteTime ?? 600) : (gameState?.blackTime ?? 600))}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* 1v1 Board Grid */}
              <div className="relative aspect-square w-[min(92vw,360px)] md:w-[min(80vw,480px)] max-h-[calc(100dvh-320px)] md:max-h-[calc(100vh-280px)] border-2 border-slate-700/80 rounded-b-none shadow-2xl overflow-hidden bg-slate-800">
                <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
                  {squares.map(({ square, row, col, isDark }) => {
                    const piece = arenaChess.get(square);
                    const isSelected = selectedSquare === square;
                    const isLegal = legalMoves.includes(square);
                    const isLastMove = gameState?.lastMove?.from === square || gameState?.lastMove?.to === square;

                    return (
                      <div
                        key={square}
                        data-square={square}
                        onClick={() => handle1v1SquareClick(square)}
                        className={`relative flex items-center justify-center cursor-pointer transition-all duration-100 ${
                          isDark ? 'bg-[#769656] text-slate-900' : 'bg-[#eeeed2] text-slate-800'
                        } ${isLastMove ? 'ring-2 ring-inset ring-amber-400/60 bg-amber-200/40' : ''} ${
                          isSelected ? 'ring-4 ring-inset ring-brand-500 bg-amber-300/60 z-10' : ''
                        }`}
                      >
                        {((isFlipped ? col === 7 : col === 0)) && (
                          <span className={`absolute top-0.5 left-1 text-[8px] sm:text-[9px] font-bold pointer-events-none ${isDark ? 'text-[#eeeed2]/60' : 'text-[#769656]/80'}`}>
                            {square[1]}
                          </span>
                        )}
                        {((isFlipped ? row === 0 : row === 7)) && (
                          <span className={`absolute bottom-0.5 right-1 text-[8px] sm:text-[9px] font-bold pointer-events-none ${isDark ? 'text-[#eeeed2]/60' : 'text-[#769656]/80'}`}>
                            {square[0]}
                          </span>
                        )}

                        {piece && (
                          <div
                            className={`w-full h-full flex items-center justify-center select-none text-3xl sm:text-4xl md:text-6xl pointer-events-none ${
                              piece.color === 'w'
                                ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'
                                : 'text-slate-950 drop-shadow-[0_1px_2px_rgba(255,255,255,0.4)]'
                            }`}
                          >
                            <span>{PIECE_SYMBOLS[piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase()]}</span>
                          </div>
                        )}

                        {isLegal && !piece && (
                          <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-slate-900/35 ring-1 ring-white/30 pointer-events-none" />
                        )}
                        {isLegal && piece && (
                          <div className="absolute inset-1 rounded-full ring-3 sm:ring-4 ring-inset ring-red-500/70 bg-red-500/20 pointer-events-none" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {pendingPromotion && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-30 animate-fadeIn">
                    <div className="bg-slate-900 border border-white/20 p-4 rounded-2xl shadow-2xl flex flex-col items-center">
                      <h3 className="text-xs font-bold text-amber-300 mb-3">Choose Promotion</h3>
                      <div className="flex items-center gap-3">
                        {(['q', 'r', 'b', 'n'] as const).map(p => (
                          <button
                            key={p}
                            onClick={() => handle1v1PromotionSelect(p)}
                            className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-amber-600 border border-white/10 text-3xl flex items-center justify-center text-white transition transform hover:scale-110 shadow-lg"
                            title={PIECE_NAMES[p]}
                          >
                            {PIECE_SYMBOLS[arenaChess.turn() === 'w' ? p.toUpperCase() : p.toLowerCase()]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {gameState?.winner && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-20 animate-fadeIn">
                    <div className="bg-slate-900/90 border border-amber-500/40 p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-xs">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 neon-glow">
                        <Trophy className="w-8 h-8" />
                      </div>
                      <h2 className="text-lg font-black text-slate-100 mb-1">
                        {gameState.winner === 'draw' ? 'Draw!' : `${gameState.winner === 'white' ? 'White ⚪' : 'Black ⚫'} Victory!`}
                      </h2>
                      <button
                        onClick={() => sendChessReset(selectedTimeControl)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg transition transform hover:scale-105"
                      >
                        <RotateCcw className="w-4 h-4" /> Rematch
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Player */}
              <div className="w-full max-w-[480px] flex items-center justify-between px-3 py-1.5 bg-slate-900/60 rounded-b-xl border border-t-0 border-white/10">
                {(() => {
                  const bottomColor = isFlipped ? 'black' : 'white';
                  const player = isFlipped ? gameState?.blackPlayer : gameState?.whitePlayer;
                  const isBottomTurn = (isFlipped && arenaChess.turn() === 'b') || (!isFlipped && arenaChess.turn() === 'w');
                  const capturedPieces = isFlipped ? captured1v1.whiteCaptured : captured1v1.blackCaptured;

                  return (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">{isFlipped ? '⚫' : '⚪'}</span>
                        {player ? (
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-base">{player.avatar}</span>
                            <span className="text-xs font-bold text-slate-200 truncate">{player.name}</span>
                            {player.id === currentUser.id && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold">You</span>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => sendChessSeat(bottomColor)}
                            className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-semibold transition"
                          >
                            <UserPlus className="w-3 h-3" /> Play {isFlipped ? 'Black' : 'White'}
                          </button>
                        )}
                        <div className="flex items-center text-xs opacity-75 ml-2 tracking-tighter">
                          {capturedPieces.map((p, i) => (
                            <span key={i}>{PIECE_SYMBOLS[isFlipped ? p.toLowerCase() : p.toUpperCase()]}</span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isBottomTurn && !gameState?.winner && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        )}
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-md font-bold ${
                          isBottomTurn && !gameState?.winner
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-400 border border-white/5'
                        }`}>
                          {formatTime(isFlipped ? (gameState?.blackTime ?? 600) : (gameState?.whiteTime ?? 600))}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Right: 1v1 Controls */}
            <div className="flex flex-col gap-3 w-full md:w-80 max-h-full">
              <div className="bg-slate-900/70 border border-white/10 p-3.5 rounded-2xl shadow-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    arenaChess.turn() === 'w' ? 'bg-white shadow-[0_0_8px_white]' : 'bg-slate-900 border border-slate-600'
                  }`} />
                  <span className="text-xs font-semibold text-slate-200">
                    {gameState?.winner ? 'Game Concluded' : `${arenaChess.turn() === 'w' ? 'White' : 'Black'}'s Turn`}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/70 border border-white/10 p-3.5 rounded-2xl shadow-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Clock Preset</span>
                  <div className="flex items-center gap-1">
                    {[
                      { label: '3m', sec: 180 },
                      { label: '5m', sec: 300 },
                      { label: '10m', sec: 600 },
                      { label: '∞', sec: 0 }
                    ].map(tc => (
                      <button
                        key={tc.label}
                        onClick={() => {
                          setSelectedTimeControl(tc.sec);
                          sendChessReset(tc.sec);
                        }}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition ${
                          (gameState?.timeControl ?? 600) === tc.sec
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tc.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => sendChessReset(selectedTimeControl)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> New Game
                  </button>

                  {isPlayer && !gameState?.winner ? (
                    <button
                      onClick={() => sendChessResign(isWhiteUser ? 'white' : 'black')}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-semibold border border-rose-500/30 transition"
                    >
                      <Flag className="w-3.5 h-3.5" /> Resign
                    </button>
                  ) : isPlayer ? (
                    <button
                      onClick={() => sendChessSeat('leave')}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-600/30 text-slate-300 hover:text-rose-200 text-xs font-semibold border border-white/10 transition"
                    >
                      <UserMinus className="w-3.5 h-3.5" /> Leave Seat
                    </button>
                  ) : (
                    <div className="flex items-center justify-center text-[11px] text-slate-500 font-medium">
                      Spectator Mode
                    </div>
                  )}
                </div>
              </div>

              {/* Move History */}
              <div className="bg-slate-900/70 border border-white/10 p-3.5 rounded-2xl shadow-xl flex-1 flex flex-col min-h-[140px] max-h-[180px]">
                <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
                  <span className="text-xs font-bold text-slate-300">Move Log</span>
                  <span className="text-[10px] text-slate-500">
                    {Math.ceil((gameState?.history?.length || 0) / 2)} moves
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs pr-1">
                  {gameState?.history && gameState.history.length > 0 ? (
                    Array.from({ length: Math.ceil(gameState.history.length / 2) }).map((_, i) => {
                      const whiteMove = gameState.history[i * 2];
                      const blackMove = gameState.history[i * 2 + 1];
                      return (
                        <div key={i} className="flex items-center px-1.5 py-0.5 rounded hover:bg-white/5">
                          <span className="w-7 text-slate-500 text-[11px]">{i + 1}.</span>
                          <span className="w-16 font-semibold text-slate-200">{whiteMove?.san}</span>
                          <span className="w-16 font-semibold text-slate-400">{blackMove?.san || ''}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 italic">
                      Moves will appear here as you play
                    </div>
                  )}
                </div>
              </div>

              {/* 1-Click Lichess Link */}
              <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 p-3 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-200">Play on Lichess.org</span>
                  <button
                    onClick={createLichessChallenge}
                    disabled={isCreatingChallenge}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold transition"
                  >
                    {isCreatingChallenge ? 'Creating...' : '⚔️ Instant 1v1 Link'}
                  </button>
                </div>
                {challengeData && (
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg">
                      <span className="text-[11px] text-slate-300">White Invite</span>
                      <button onClick={() => copyToClipboard(challengeData.urlWhite || challengeData.url, 'white')} className="p-1">
                        {copiedLink === 'white' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg">
                      <span className="text-[11px] text-slate-300">Black Invite</span>
                      <button onClick={() => copyToClipboard(challengeData.urlBlack || challengeData.url, 'black')} className="p-1">
                        {copiedLink === 'black' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: DAILY LICHESS EMBED FRAME */}
        {/* ========================================================================= */}
        {activeTab === 'daily' && (
          <div className="w-full h-full flex flex-col items-center justify-between p-2 md:p-4 gap-2">
            <div className="w-full max-w-4xl flex items-center justify-between px-3 py-1.5 bg-slate-900/80 rounded-xl border border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-200">Daily Lichess Puzzle Widget</span>
              </div>
              <a
                href="https://lichess.org/training"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition"
              >
                Open on Lichess <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="w-full max-w-4xl flex-1 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
              <iframe
                src="https://lichess.org/training/frame?theme=dark&bg=dark"
                title="Lichess Daily Puzzles"
                className="w-full h-full border-0"
                allow="autoplay"
              />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: LICHESS GRANDMASTER TV */}
        {/* ========================================================================= */}
        {activeTab === 'tv' && (
          <div className="w-full h-full flex flex-col items-center justify-between p-2 md:p-4 gap-2">
            <div className="w-full max-w-4xl flex items-center justify-between px-3 py-1.5 bg-slate-900/80 rounded-xl border border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-200">Lichess Grandmaster TV</span>
              </div>
              <a
                href="https://lichess.org/tv"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition"
              >
                Full TV on Lichess <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="w-full max-w-4xl flex-1 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
              <iframe
                src="https://lichess.org/tv/frame?theme=dark&bg=dark"
                title="Lichess TV"
                className="w-full h-full border-0"
                allow="autoplay"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
