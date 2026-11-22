import { useCallback, useEffect, useState } from 'react';
import { Gem, Play, RotateCcw, Sparkles } from 'lucide-react';
import {
  areAdjacent,
  CANDY_GEM_META,
  createMatch3Board,
  resolveMatchCascades,
  swapTiles,
  type CandyGemType,
  type GridCoord,
} from '../../utils/gameLogic';
import { arcadeSfx } from './arcadeAudio';

type Phase = 'title' | 'playing' | 'gameover';

interface CandyCrushGameProps {
  onPhaseChange?: (phase: Phase) => void;
}

const TARGET_SCORE = 450;
const INITIAL_MOVES = 15;

export function CandyCrushGame({ onPhaseChange }: CandyCrushGameProps) {
  const [phase, setPhase] = useState<Phase>('title');
  const [board, setBoard] = useState<(CandyGemType | null)[][]>(() => createMatch3Board(8, 8, 2026));
  const [selected, setSelected] = useState<GridCoord | null>(null);
  const [score, setScore] = useState<number>(0);
  const [movesLeft, setMovesLeft] = useState<number>(INITIAL_MOVES);
  const [statusNote, setStatusNote] = useState<string>('Select two adjacent gems to swap and match 3+!');

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const startGame = useCallback(() => {
    setBoard(createMatch3Board(8, 8, Date.now()));
    setSelected(null);
    setScore(0);
    setMovesLeft(INITIAL_MOVES);
    setStatusNote(`Swap adjacent gems · Reach ${TARGET_SCORE} pts in ${INITIAL_MOVES} moves!`);
    setPhase('playing');
    arcadeSfx.coin();
  }, []);

  const handleCellClick = (row: number, col: number) => {
    if (phase !== 'playing') return;
    if (!selected) {
      setSelected({ row, col });
      return;
    }

    if (selected.row === row && selected.col === col) {
      setSelected(null);
      return;
    }

    const target: GridCoord = { row, col };
    if (!areAdjacent(selected, target)) {
      setSelected(target);
      return;
    }

    const swapped = swapTiles(board, selected, target);
    const resolved = resolveMatchCascades(swapped, Date.now() + score);
    setSelected(null);

    if (resolved.clearedCount === 0) {
      setStatusNote('No 3-in-a-row match created — try another adjacent pair!');
      arcadeSfx.error();
      return;
    }

    const nextScore = score + resolved.scoreDelta;
    const nextMoves = Math.max(0, movesLeft - 1);
    setBoard(resolved.board);
    setScore(nextScore);
    setMovesLeft(nextMoves);
    setStatusNote(
      `Sweet! Cleared ${resolved.clearedCount} gems (${resolved.cascadeDepth}x cascade) · +${resolved.scoreDelta} pts!`
    );
    arcadeSfx.match(resolved.cascadeDepth);

    if (nextMoves === 0 || nextScore >= TARGET_SCORE) {
      if (nextScore >= TARGET_SCORE) arcadeSfx.victory();
      setPhase('gameover');
    }
  };

  if (phase === 'title') {
    return (
      <div className="w-full py-10 px-4 flex flex-col items-center text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-pink-300">
          <Gem className="w-8 h-8" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h2 className="font-display text-3xl font-bold text-stone-50">
            Candy Crush · Aurelia Gem Pop
          </h2>
          <p className="text-xs text-stone-400 leading-relaxed">
            Swap adjacent luxury gems to align 3 or more in a row or column. Trigger gravity cascades and reach {TARGET_SCORE} points in {INITIAL_MOVES} moves!
          </p>
        </div>
        <button
          type="button"
          data-start="true"
          data-testid="start-candycrush-btn"
          onClick={startGame}
          className="min-h-[48px] px-7 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <Play className="w-4 h-4" />
          <span>Play Candy Crush</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center bg-[#151821] p-2.5 rounded-2xl border border-white/10 font-mono-tabular">
        <div>
          <p className="text-[10px] text-stone-400 uppercase">Score</p>
          <p data-testid="candy-score" className="text-base font-bold text-pink-300">
            {score} / {TARGET_SCORE}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase">Moves Left</p>
          <p className="text-base font-bold text-white">{movesLeft}</p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase">Selected</p>
          <p className="text-base font-bold text-amber-300">
            {selected ? `${selected.row + 1},${selected.col + 1}` : 'None'}
          </p>
        </div>
      </div>

      {phase === 'gameover' ? (
        <div className="py-12 px-6 rounded-2xl bg-[#11141d] border border-pink-500/35 text-center space-y-4">
          <Sparkles className="w-10 h-10 text-pink-400 mx-auto" />
          <h3 className="font-display text-3xl font-bold text-white">
            {score >= TARGET_SCORE ? 'Sugar Crush Victory!' : 'Out of Moves'}
          </h3>
          <p className="text-sm font-mono-tabular text-pink-300">
            Final Score: {score} points
          </p>
          <button
            type="button"
            onClick={startGame}
            className="min-h-[44px] px-6 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-center text-xs text-stone-300">{statusNote}</p>
          <div className="w-full max-w-[368px] mx-auto grid grid-cols-8 gap-1.5 p-2.5 rounded-2xl bg-[#11141d] border border-white/10">
            {board.map((row, r) =>
              row.map((gem, c) => {
                const isSelected = selected?.row === r && selected?.col === c;
                const meta = CANDY_GEM_META[gem ?? 0];
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    data-testid={`candy-cell-${r}-${c}`}
                    onClick={() => handleCellClick(r, c)}
                    aria-label={`Row ${r + 1} Col ${c + 1} ${meta.name}`}
                    style={{
                      backgroundColor: meta.color,
                      boxShadow: isSelected ? `0 0 0 2px #ffffff, 0 0 12px ${meta.glow}` : undefined,
                    }}
                    className={`aspect-square rounded-lg flex items-center justify-center text-white text-sm sm:text-base font-bold transition-transform cursor-pointer ${
                      isSelected ? 'scale-110 ring-2 ring-white' : 'hover:scale-105'
                    }`}
                  >
                    {meta.symbol}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
