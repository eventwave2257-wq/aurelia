import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Award,
  BookOpen,
  Compass,
  Flame,
  Gamepad2,
  Gem,
  Play,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { FreeFireGame } from './games/FreeFireGame';
import { AlphabetGame } from './games/AlphabetGame';
import { TempleRunGame } from './games/TempleRunGame';
import { CandyCrushGame } from './games/CandyCrushGame';

interface AureliaDrivingGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ArcadeGameId = 'freefire' | 'alphabet' | 'templerun' | 'candycrush' | 'dash';
type GameState = 'title' | 'playing' | 'gameover';

export function AureliaDrivingGameModal({ isOpen, onClose }: AureliaDrivingGameModalProps) {
  const [activeGame, setActiveGame] = useState<ArcadeGameId>('freefire');
  const [subPhase, setSubPhase] = useState<GameState>('title');

  // Chauffeur Dash state
  const [score, setScore] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(60);
  const [vehicle, setVehicle] = useState<'bike' | 'car'>('car');
  const [distance, setDistance] = useState<number>(0);
  const [fines, setFines] = useState<number>(0);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const stateRef = useRef({
    speed: 60,
    distance: 0,
    score: 0,
    fines: 0,
    vehicle: 'car' as 'bike' | 'car',
    lane: 1,
    isPlaying: false,
  });

  stateRef.current.speed = speed;
  stateRef.current.distance = distance;
  stateRef.current.score = score;
  stateRef.current.fines = fines;
  stateRef.current.vehicle = vehicle;

  // Expose semantic phase on document.body.dataset.state when modal is open
  useEffect(() => {
    if (!isOpen) {
      delete document.body.dataset.state;
      return;
    }
    const mapped =
      subPhase === 'title' ? 'TITLE_MENU' : subPhase === 'playing' ? 'PLAYING' : 'GAME_OVER';
    document.body.dataset.state = mapped;
    return () => {
      delete document.body.dataset.state;
    };
  }, [isOpen, subPhase]);

  const addLog = useCallback((msg: string) => {
    setLogMessages((prev) => [msg, ...prev.slice(0, 4)]);
  }, []);

  const startDashGame = (selectedVehicle: 'bike' | 'car') => {
    setVehicle(selectedVehicle);
    setScore(0);
    setDistance(0);
    setFines(0);
    setSpeed(selectedVehicle === 'bike' ? 45 : 85);
    setSubPhase('playing');
    stateRef.current.isPlaying = true;
    addLog(
      `Started Aurelia ${selectedVehicle === 'bike' ? 'Bike (50 km/h limit)' : 'Executive Car (95 km/h limit)'} Dash across Karnataka!`
    );
  };

  useEffect(() => {
    if (!isOpen || activeGame !== 'dash' || subPhase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const updateLoop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      if (stateRef.current.isPlaying) {
        const distInc = (stateRef.current.speed / 3600) * (dt * 60);
        const earned = distInc * 19;

        setDistance((d) => +(d + distInc).toFixed(2));
        setScore((s) => Math.round(s + earned));

        const limit = stateRef.current.vehicle === 'bike' ? 50 : 95;
        const fineAmount = stateRef.current.vehicle === 'bike' ? 40 : 80;

        if (stateRef.current.speed > limit && Math.random() < 0.02) {
          setFines((f) => f + fineAmount);
          setScore((s) => Math.max(0, s - fineAmount));
          addLog(
            `Speed limit exceeded (${stateRef.current.speed} km/h vs ${limit} limit)! Paid ₹${fineAmount} fine.`
          );
        }

        if (Math.random() < 0.01) {
          const bonus = 150;
          setScore((s) => s + bonus);
          addLog(`High Earning Area (Orange Zone) unlocked! +₹${bonus} surge bonus.`);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#D4AF63';
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 20]);
      ctx.beginPath();
      ctx.moveTo(canvas.width / 3, 0);
      ctx.lineTo(canvas.width / 3, canvas.height);
      ctx.moveTo((canvas.width / 3) * 2, 0);
      ctx.lineTo((canvas.width / 3) * 2, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(249, 115, 22, 0.18)';
      ctx.fillRect(0, 0, 30, canvas.height);
      ctx.fillRect(canvas.width - 30, 0, 30, canvas.height);

      const laneX =
        stateRef.current.lane === 0
          ? 80
          : stateRef.current.lane === 1
            ? canvas.width / 2
            : canvas.width - 80;
      const vehicleColor = stateRef.current.vehicle === 'bike' ? '#38bdf8' : '#D4AF63';

      ctx.fillStyle = vehicleColor;
      ctx.beginPath();
      ctx.roundRect(laneX - 22, canvas.height - 100, 44, 75, 12);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(laneX - 16, canvas.height - 85, 32, 22);

      requestRef.current = requestAnimationFrame(updateLoop);
    };

    requestRef.current = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isOpen, activeGame, subPhase, addLog]);

  useEffect(() => {
    if (!isOpen || activeGame !== 'dash' || subPhase !== 'playing') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        stateRef.current.lane = Math.max(0, stateRef.current.lane - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        stateRef.current.lane = Math.min(2, stateRef.current.lane + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'w') {
        setSpeed((s) => Math.min(stateRef.current.vehicle === 'bike' ? 75 : 130, s + 10));
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        setSpeed((s) => Math.max(20, s - 10));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeGame, subPhase]);

  if (!isOpen) return null;

  const gameTabs: { id: ArcadeGameId; label: string; icon: typeof Flame }[] = [
    { id: 'freefire', label: 'Free Fire', icon: Flame },
    { id: 'alphabet', label: 'Alphabet', icon: BookOpen },
    { id: 'templerun', label: 'Temple Run', icon: Compass },
    { id: 'candycrush', label: 'Candy Crush', icon: Gem },
    { id: 'dash', label: 'Chauffeur Dash', icon: Trophy },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aurelia Arcade Games"
      className="fixed inset-0 z-50 bg-black/80 flex items-start sm:items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div
        className={`w-full ${
          activeGame === 'freefire' ? 'max-w-4xl' : 'max-w-2xl'
        } max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0D0F16] border border-amber-500/40 flex flex-col shadow-2xl text-stone-100 my-auto transition-[max-width] duration-200`}
      >
        {/* Arcade Header */}
        <div className="px-5 py-3.5 bg-[#151821] border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-stone-50">
                Aurelia Driver Lounge · 5-Game Arcade
              </h3>
              <p className="text-xs text-amber-300/80 font-mono-tabular">
                Free Fire Bermuda · Alphabet · Temple Run · Candy Crush · Chauffeur Dash
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close game"
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-stone-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game Switcher Tabs */}
        <div className="px-4 py-2.5 bg-[#10131b] border-b border-white/10 flex items-center gap-1.5 overflow-x-auto">
          {gameTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeGame === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`arcade-tab-${tab.id}`}
                onClick={() => {
                  stateRef.current.isPlaying = false;
                  setSubPhase('title');
                  setActiveGame(tab.id);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#D4AF63] text-stone-950 shadow-sm'
                    : 'bg-white/5 text-stone-300 hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Game Viewport */}
        <div className="p-4 bg-[#080A0F]">
          {activeGame === 'freefire' && <FreeFireGame onPhaseChange={setSubPhase} />}
          {activeGame === 'alphabet' && <AlphabetGame onPhaseChange={setSubPhase} />}
          {activeGame === 'templerun' && <TempleRunGame onPhaseChange={setSubPhase} />}
          {activeGame === 'candycrush' && <CandyCrushGame onPhaseChange={setSubPhase} />}

          {activeGame === 'dash' && (
            <div className="flex flex-col items-center">
              {subPhase === 'title' && (
                <div className="w-full py-10 flex flex-col items-center text-center space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
                    <Trophy className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-md">
                    <h2 className="font-display text-3xl font-bold text-stone-50">
                      Karnataka Chauffeur Dash
                    </h2>
                    <p className="text-xs text-stone-400 leading-relaxed">
                      Navigate Karnataka corridors, earn ₹19/km fares, enter orange High Earning Zones, and obey speed limits!
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => startDashGame('bike')}
                      className="min-h-[48px] px-6 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Start Bike (50 km/h)</span>
                    </button>
                    <button
                      type="button"
                      data-start="true"
                      onClick={() => startDashGame('car')}
                      className="min-h-[48px] px-6 rounded-2xl bg-[#D4AF63] hover:bg-[#E2C27D] text-stone-950 font-semibold text-sm flex items-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Play className="w-4 h-4" />
                      <span>Start Car (95 km/h)</span>
                    </button>
                  </div>
                </div>
              )}

              {subPhase === 'playing' && (
                <div className="w-full space-y-3">
                  <div className="grid grid-cols-4 gap-2 text-center bg-[#151821] p-2.5 rounded-2xl border border-white/10 font-mono-tabular">
                    <div>
                      <p className="text-[10px] text-stone-400 uppercase">Earnings</p>
                      <p className="text-base font-bold text-amber-300">₹{score}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-400 uppercase">Distance</p>
                      <p className="text-base font-bold text-stone-100">{distance} km</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-400 uppercase">Speed</p>
                      <p
                        className={`text-base font-bold ${
                          speed > (vehicle === 'bike' ? 50 : 95)
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {speed} km/h
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-400 uppercase">Fines</p>
                      <p className="text-base font-bold text-rose-400">₹{fines}</p>
                    </div>
                  </div>

                  <div className="relative w-full flex justify-center bg-stone-950 rounded-2xl overflow-hidden border border-white/10">
                    <canvas
                      ref={canvasRef}
                      width={420}
                      height={320}
                      className="w-full max-w-[420px] h-[280px] bg-stone-900"
                    />
                    <div className="absolute top-3 left-3 bg-orange-600/90 text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 shadow-md">
                      <Award className="w-3.5 h-3.5" /> High Earning Zone (Orange)
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#151821] rounded-2xl border border-white/10">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => (stateRef.current.lane = Math.max(0, stateRef.current.lane - 1))}
                        className="min-h-[40px] px-4 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold cursor-pointer"
                      >
                        ◀ Left
                      </button>
                      <button
                        type="button"
                        onClick={() => (stateRef.current.lane = Math.min(2, stateRef.current.lane + 1))}
                        className="min-h-[40px] px-4 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold cursor-pointer"
                      >
                        Right ▶
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSpeed((s) => Math.max(20, s - 10))}
                        className="min-h-[40px] px-3 rounded-xl bg-rose-600/30 border border-rose-500/40 text-xs font-semibold text-rose-300 cursor-pointer"
                      >
                        Brake
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSpeed((s) => Math.min(vehicle === 'bike' ? 75 : 130, s + 10))
                        }
                        className="min-h-[40px] px-3 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-xs font-semibold text-emerald-300 cursor-pointer"
                      >
                        Accel
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubPhase('title')}
                        className="min-h-[40px] px-3 rounded-xl bg-stone-800 text-xs font-semibold text-stone-300 cursor-pointer"
                      >
                        Quit
                      </button>
                    </div>
                  </div>

                  {logMessages.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-[#080A0F] border border-white/10 text-[11px] font-mono-tabular space-y-1 max-h-20 overflow-y-auto">
                      {logMessages.map((msg, idx) => (
                        <p key={idx} className="text-stone-300">
                          {msg}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
