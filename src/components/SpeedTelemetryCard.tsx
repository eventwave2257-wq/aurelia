import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Gauge, RotateCcw } from 'lucide-react';
import type { VehicleTier } from '../types/aurelia';
import {
  BIKE_SPEED_FINE_INR,
  BIKE_SPEED_LIMIT_KMH,
  CAR_SPEED_FINE_INR,
  CAR_SPEED_LIMIT_KMH,
  evaluateSpeedViolation,
  formatCurrency,
  getSpeedLimitPolicy,
} from '../utils/aureliaLogic';

interface SpeedTelemetryCardProps {
  vehicleTier: VehicleTier;
}

export function SpeedTelemetryCard({ vehicleTier }: SpeedTelemetryCardProps) {
  const [speedKmh, setSpeedKmh] = useState<number>(42);
  const [violationCount, setViolationCount] = useState<number>(0);
  const [totalFinesInr, setTotalFinesInr] = useState<number>(0);
  const wasExceededRef = useRef<boolean>(false);

  const policy = getSpeedLimitPolicy(vehicleTier);
  const evaluation = evaluateSpeedViolation(speedKmh, vehicleTier);

  // Record the speed limit fine whenever crossing into an overspeed state
  useEffect(() => {
    if (evaluation.exceeded && !wasExceededRef.current) {
      setViolationCount((prev) => prev + 1);
      setTotalFinesInr((prev) => prev + evaluation.fineInr);
    }
    wasExceededRef.current = evaluation.exceeded;
  }, [evaluation.exceeded, evaluation.fineInr]);

  const handleResetFines = () => {
    setSpeedKmh(40);
    setViolationCount(0);
    setTotalFinesInr(0);
    wasExceededRef.current = false;
  };

  const quickPresets = [
    { label: '40 km/h', value: 40 },
    { label: '58 km/h', value: 58 },
    { label: '88 km/h', value: 88 },
    { label: '104 km/h', value: 104 },
  ];

  return (
    <section
      aria-label="Speed limit and fine monitor"
      data-testid="speed-telemetry-card"
      className={`p-4 rounded-2xl backdrop-blur-xl border shadow-sm space-y-3 transition-colors ${
        evaluation.exceeded
          ? 'bg-rose-50/95 dark:bg-rose-950/50 border-rose-400 dark:border-rose-500/70'
          : 'bg-white/85 dark:bg-[#101218]/85 border-stone-200/80 dark:border-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              evaluation.exceeded
                ? 'bg-rose-600 text-white'
                : 'bg-amber-50 dark:bg-amber-400/15 text-[#9A722A] dark:text-[#E6C77E]'
            }`}
          >
            <Gauge className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-stone-900 dark:text-white truncate">
              Speed Limit & Fine Monitor
            </h3>
            <p className="text-[11px] font-mono-tabular text-stone-600 dark:text-stone-300 truncate">
              Active ({policy.categoryLabel}): Max {policy.maxSpeedKmh} km/h · ₹{policy.fineInr}{' '}
              fine
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p
            data-testid="current-speed-readout"
            className={`text-lg font-bold font-mono-tabular leading-none ${
              evaluation.exceeded
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-stone-900 dark:text-white'
            }`}
          >
            {evaluation.speedKmh} km/h
          </p>
          <p
            data-testid="speed-fines-summary"
            className="text-[10px] font-mono-tabular text-stone-500 dark:text-stone-400 mt-1"
          >
            Fines ({violationCount}): {formatCurrency(totalFinesInr)}
          </p>
        </div>
      </div>

      {/* Warning Alert when speed limit exceeded */}
      {evaluation.exceeded && (
        <div
          role="alert"
          data-testid="speed-limit-warning"
          className="p-3 rounded-xl bg-rose-600 text-white text-xs space-y-1 shadow-md"
        >
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              WARNING: Speed Limit Exceeded ({evaluation.speedKmh} km/h &gt;{' '}
              {evaluation.maxSpeedKmh} km/h)
            </span>
          </div>
          <p className="text-rose-50 leading-snug">
            Slow down immediately. Exceeding {evaluation.maxSpeedKmh} km/h in{' '}
            {evaluation.categoryLabel} carries a{' '}
            <strong className="font-mono-tabular underline">
              ₹{evaluation.fineInr} speed limit fine
            </strong>
            .
          </p>
        </div>
      )}

      {/* Interactive Speed Slider & Presets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-400">
          <label htmlFor="aurelia-speed-slider" className="font-medium">
            Speed Telemetry Control (0–130 km/h)
          </label>
          <span className="font-mono-tabular">
            Bike {BIKE_SPEED_LIMIT_KMH} km/h (₹{BIKE_SPEED_FINE_INR}) · Cars{' '}
            {CAR_SPEED_LIMIT_KMH} km/h (₹{CAR_SPEED_FINE_INR})
          </span>
        </div>

        <input
          id="aurelia-speed-slider"
          data-testid="speed-slider"
          type="range"
          min={0}
          max={130}
          step={1}
          value={speedKmh}
          onChange={(e) => setSpeedKmh(Number(e.target.value))}
          className={`w-full ${evaluation.exceeded ? 'accent-rose-600' : 'accent-[#D4AF63]'}`}
        />

        <div className="flex flex-wrap items-center gap-1.5">
          {quickPresets.map((preset) => {
            const active = speedKmh === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                data-testid={`speed-preset-${preset.value}`}
                onClick={() => setSpeedKmh(preset.value)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-mono-tabular font-semibold border transition-colors ${
                  active
                    ? 'bg-stone-900 dark:bg-[#E6C77E] text-white dark:text-stone-950 border-stone-900 dark:border-[#E6C77E]'
                    : 'bg-stone-50 dark:bg-white/[0.04] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-white/10 hover:bg-stone-100 dark:hover:bg-white/10'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          {violationCount > 0 && (
            <button
              type="button"
              onClick={handleResetFines}
              className="ml-auto min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-stone-200 dark:border-white/15 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/10 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
