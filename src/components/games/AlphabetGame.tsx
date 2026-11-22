import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Play, RotateCcw, Sparkles } from 'lucide-react';
import {
  ALPHABET_LETTERS,
  ALPHABET_WORD_CHALLENGES,
  evaluateAlphabetPick,
} from '../../utils/gameLogic';
import { arcadeSfx } from './arcadeAudio';

type Phase = 'title' | 'playing' | 'gameover';

interface AlphabetGameProps {
  onPhaseChange?: (phase: Phase) => void;
}

export function AlphabetGame({ onPhaseChange }: AlphabetGameProps) {
  const [phase, setPhase] = useState<Phase>('title');
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(45);
  const [feedback, setFeedback] = useState<string>('Tap the missing letter to complete the word!');

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setPhase('gameover');
          arcadeSfx.victory();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const currentChallenge = useMemo(
    () => ALPHABET_WORD_CHALLENGES[roundIdx % ALPHABET_WORD_CHALLENGES.length],
    [roundIdx]
  );

  const targetLetter = currentChallenge.word[currentChallenge.missingIndex];

  const startGame = useCallback(() => {
    setScore(0);
    setStreak(0);
    setRoundIdx(0);
    setTimeLeft(45);
    setFeedback('Tap the missing letter from A–Z below!');
    setPhase('playing');
    arcadeSfx.coin();
  }, []);

  const handlePickLetter = (letter: string) => {
    if (phase !== 'playing') return;
    const result = evaluateAlphabetPick(targetLetter, letter);
    if (result.correct) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setScore((s) => s + result.points + nextStreak * 10);
      setFeedback(`Correct! "${currentChallenge.word}" completed (+${result.points + nextStreak * 10} pts).`);
      setRoundIdx((r) => r + 1);
      arcadeSfx.match(nextStreak);
    } else {
      setStreak(0);
      setScore((s) => Math.max(0, s + result.points));
      setFeedback(`Not "${letter}" — try again to complete "${currentChallenge.hint}"!`);
      arcadeSfx.error();
    }
  };

  if (phase === 'title') {
    return (
      <div className="w-full py-10 px-4 flex flex-col items-center text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
          <BookOpen className="w-8 h-8" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h2 className="font-display text-3xl font-bold text-stone-50">
            Alphabet · A–Z Blitz
          </h2>
          <p className="text-xs text-stone-400 leading-relaxed">
            Spot the missing letter in Karnataka &amp; Aurelia vocabulary words against a 45-second clock. Build combos for bonus streaks!
          </p>
        </div>
        <button
          type="button"
          data-start="true"
          data-testid="start-alphabet-btn"
          onClick={startGame}
          className="min-h-[48px] px-7 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <Play className="w-4 h-4" />
          <span>Play Alphabet</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* HUD */}
      <div className="grid grid-cols-3 gap-2 text-center bg-[#151821] p-3 rounded-2xl border border-white/10 font-mono-tabular">
        <div>
          <p className="text-[10px] text-stone-400 uppercase">Score</p>
          <p data-testid="alphabet-score" className="text-lg font-bold text-amber-300">{score}</p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase">Streak</p>
          <p className="text-lg font-bold text-emerald-400">{streak}x</p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase">Time</p>
          <p className={`text-lg font-bold ${timeLeft <= 10 ? 'text-rose-400' : 'text-sky-300'}`}>{timeLeft}s</p>
        </div>
      </div>

      {phase === 'gameover' ? (
        <div className="py-12 px-6 rounded-2xl bg-[#11141d] border border-sky-500/30 text-center space-y-4">
          <Sparkles className="w-10 h-10 text-sky-400 mx-auto" />
          <h3 className="font-display text-3xl font-bold text-white">Time&apos;s Up!</h3>
          <p className="text-sm font-mono-tabular text-amber-300">
            Final Score: {score} · {roundIdx} words solved
          </p>
          <button
            type="button"
            onClick={startGame}
            className="min-h-[44px] px-6 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Prompt Display */}
          <div className="p-5 rounded-2xl bg-[#11141d] border border-white/10 text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">
              Hint: {currentChallenge.hint}
            </p>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
              {currentChallenge.word.split('').map((ch, idx) => {
                const isMissing = idx === currentChallenge.missingIndex;
                return (
                  <span
                    key={`${idx}-${ch}`}
                    className={`w-9 h-11 sm:w-11 sm:h-12 rounded-xl flex items-center justify-center font-mono-tabular text-xl font-bold ${
                      isMissing
                        ? 'bg-sky-500/20 border-2 border-dashed border-sky-400 text-sky-300'
                        : 'bg-[#1a1f2c] border border-white/10 text-white'
                    }`}
                  >
                    {isMissing ? '?' : ch}
                  </span>
                );
              })}
            </div>
            <p className="text-xs text-stone-300">{feedback}</p>
          </div>

          {/* Interactive A–Z Tile Board (>=44px tap targets) */}
          <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5">
            {ALPHABET_LETTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                data-testid={`alphabet-key-${letter}`}
                onClick={() => handlePickLetter(letter)}
                className="min-h-[44px] rounded-xl bg-[#181c28] hover:bg-sky-600/30 border border-white/10 hover:border-sky-400 text-sm font-bold text-stone-100 transition-colors cursor-pointer"
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
