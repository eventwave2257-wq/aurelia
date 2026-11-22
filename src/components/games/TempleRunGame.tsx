import { useCallback, useEffect, useRef, useState } from 'react';
import { Coins, Compass, Play, RotateCcw } from 'lucide-react';
import {
  checkRunnerEntityCollision,
  type RunnerAction,
  type RunnerEntity,
  type RunnerObstacleKind,
} from '../../utils/gameLogic';
import { arcadeSfx } from './arcadeAudio';

type Phase = 'title' | 'playing' | 'gameover';

interface TempleRunGameProps {
  onPhaseChange?: (phase: Phase) => void;
}

export function TempleRunGame({ onPhaseChange }: TempleRunGameProps) {
  const [phase, setPhase] = useState<Phase>('title');
  const [distance, setDistance] = useState<number>(0);
  const [coins, setCoins] = useState<number>(0);
  const [actionLabel, setActionLabel] = useState<RunnerAction>('run');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    lane: 1 as 0 | 1 | 2,
    action: 'run' as RunnerAction,
    actionTimer: 0,
    distance: 0,
    coins: 0,
    speed: 195,
    entities: [] as RunnerEntity[],
    spawnTimer: 0,
    seq: 1,
    scrollOffset: 0,
  });

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const triggerAction = useCallback((act: RunnerAction) => {
    if (act === 'run') return;
    stateRef.current.action = act;
    stateRef.current.actionTimer = 0.55;
    setActionLabel(act);
    if (act === 'jump') arcadeSfx.jump();
    else arcadeSfx.slide();
  }, []);

  const switchLane = useCallback((dir: -1 | 1) => {
    const next = Math.max(0, Math.min(2, stateRef.current.lane + dir)) as 0 | 1 | 2;
    stateRef.current.lane = next;
  }, []);

  const startGame = useCallback(() => {
    stateRef.current = {
      lane: 1,
      action: 'run',
      actionTimer: 0,
      distance: 0,
      coins: 0,
      speed: 205,
      entities: [
        { id: 1, lane: 1, y: 60, kind: 'coin' },
        { id: 2, lane: 0, y: 20, kind: 'barrier' },
      ],
      spawnTimer: 0,
      seq: 3,
      scrollOffset: 0,
    };
    setDistance(0);
    setCoins(0);
    setActionLabel('run');
    setPhase('playing');
    arcadeSfx.victory();
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') switchLane(-1);
      else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') switchLane(1);
      else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w' || e.key === ' ') {
        e.preventDefault();
        triggerAction('jump');
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        triggerAction('slide');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, switchLane, triggerAction]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = stateRef.current;

      s.speed = Math.min(370, s.speed + dt * 5.2);
      s.distance += s.speed * dt * 0.12;
      s.scrollOffset = (s.scrollOffset + s.speed * dt) % 40;
      s.spawnTimer += dt;

      if (s.actionTimer > 0) {
        s.actionTimer -= dt;
        if (s.actionTimer <= 0) {
          s.action = 'run';
          setActionLabel('run');
        }
      }

      if (s.spawnTimer >= Math.max(0.45, 0.85 - (s.speed - 200) / 500)) {
        s.spawnTimer = 0;
        const lane = Math.floor(Math.random() * 3) as 0 | 1 | 2;
        const roll = Math.random();
        const kind: RunnerObstacleKind =
          roll < 0.45 ? 'coin' : roll < 0.75 ? 'barrier' : 'low_branch';
        s.entities.push({ id: s.seq++, lane, y: -24, kind });
      }

      const surviving: RunnerEntity[] = [];
      let crashed = false;
      for (const ent of s.entities) {
        ent.y += s.speed * dt;
        const hit = checkRunnerEntityCollision(s.lane, s.action, ent, 250, 22);
        if (hit === 'coin') {
          s.coins += 1;
          arcadeSfx.coin();
          continue;
        }
        if (hit === 'crash') {
          crashed = true;
        }
        if (ent.y < 340) surviving.push(ent);
      }
      s.entities = surviving;

      setDistance(Math.round(s.distance));
      setCoins(s.coins);

      // Render Temple Corridor
      ctx.fillStyle = '#1b140d';
      ctx.fillRect(0, 0, 420, 320);

      // Stone wall borders
      ctx.fillStyle = '#3b2b1a';
      ctx.fillRect(0, 0, 56, 320);
      ctx.fillRect(364, 0, 56, 320);

      // Scrolling stone lane lines
      const laneCenters = [110, 210, 310];
      ctx.strokeStyle = 'rgba(212, 175, 99, 0.35)';
      ctx.lineWidth = 3;
      ctx.setLineDash([20, 20]);
      ctx.lineDashOffset = -s.scrollOffset;
      for (const lx of [160, 260]) {
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, 320);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw entities
      for (const ent of s.entities) {
        const cx = laneCenters[ent.lane];
        if (ent.kind === 'coin') {
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(cx, ent.y, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ca8a04';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (ent.kind === 'barrier') {
          ctx.fillStyle = '#b45309';
          ctx.fillRect(cx - 26, ent.y - 12, 52, 24);
          ctx.fillStyle = '#fef3c7';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('JUMP', cx, ent.y + 4);
        } else {
          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(cx - 28, ent.y - 14, 56, 18);
          ctx.fillStyle = '#fecaca';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('SLIDE', cx, ent.y - 2);
        }
      }

      // Draw runner
      const px = laneCenters[s.lane];
      const py = s.action === 'jump' ? 228 : s.action === 'slide' ? 264 : 250;
      const radius = s.action === 'jump' ? 19 : s.action === 'slide' ? 12 : 16;

      ctx.fillStyle = s.action === 'jump' ? '#38bdf8' : s.action === 'slide' ? '#34d399' : '#D4AF63';
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      if (crashed) {
        arcadeSfx.error();
        setPhase('gameover');
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase]);

  if (phase === 'title') {
    return (
      <div className="w-full py-10 px-4 flex flex-col items-center text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
          <Compass className="w-8 h-8" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h2 className="font-display text-3xl font-bold text-stone-50">
            Temple Run · Hampi Ruins
          </h2>
          <p className="text-xs text-stone-400 leading-relaxed">
            Sprint down 3 ancient stone lanes, JUMP over stone barriers, SLIDE under low branches, and collect golden relics as speed climbs!
          </p>
        </div>
        <button
          type="button"
          data-start="true"
          data-testid="start-templerun-btn"
          onClick={startGame}
          className="min-h-[48px] px-7 rounded-2xl bg-[#D4AF63] hover:bg-[#E2C27D] text-stone-950 font-semibold text-sm flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <Play className="w-4 h-4" />
          <span>Play Temple Run</span>
        </button>
        <p className="text-[11px] text-stone-500 font-mono-tabular">
          Controls: A/D switch lanes · W/Up Jump · S/Down Slide
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center bg-[#151821] p-2.5 rounded-2xl border border-white/10 font-mono-tabular">
        <div>
          <p className="text-[10px] text-stone-400 uppercase">Distance</p>
          <p data-testid="templerun-distance" className="text-base font-bold text-stone-100">{distance}m</p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase flex items-center justify-center gap-1">
            <Coins className="w-3 h-3 text-amber-400" /> Coins
          </p>
          <p className="text-base font-bold text-amber-300">{coins}</p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase">Stance</p>
          <p className="text-base font-bold uppercase text-sky-300">{actionLabel}</p>
        </div>
      </div>

      <div className="relative w-full flex justify-center bg-[#120d08] rounded-2xl overflow-hidden border border-white/10">
        <canvas ref={canvasRef} width={420} height={320} className="w-full max-w-[420px] h-[300px]" />

        {phase === 'gameover' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <p className="text-xs font-mono-tabular uppercase tracking-widest text-rose-400">Tripped on Ruins</p>
            <h3 className="font-display text-3xl font-bold text-white">Temple Run Ended</h3>
            <p className="text-sm font-mono-tabular text-amber-300">
              {distance}m Run · {coins} Gold Coins
            </p>
            <button
              type="button"
              onClick={startGame}
              className="min-h-[44px] px-6 rounded-2xl bg-[#D4AF63] hover:bg-[#E2C27D] text-stone-950 text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Run Again</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#151821] rounded-2xl border border-white/10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => switchLane(-1)}
            className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
          >
            ◀ Left
          </button>
          <button
            type="button"
            onClick={() => switchLane(1)}
            className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
          >
            Right ▶
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => triggerAction('jump')}
            className="min-h-[44px] px-4 rounded-xl bg-sky-600/30 border border-sky-400/50 text-sky-200 text-xs font-bold cursor-pointer"
          >
            Jump ▲
          </button>
          <button
            type="button"
            onClick={() => triggerAction('slide')}
            className="min-h-[44px] px-4 rounded-xl bg-emerald-600/30 border border-emerald-400/50 text-emerald-200 text-xs font-bold cursor-pointer"
          >
            Slide ▼
          </button>
        </div>
      </div>
    </div>
  );
}
