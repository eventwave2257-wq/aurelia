import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  ComparisonVehicleMode,
  FareConditionId,
} from '../types/aurelia';
import {
  evaluateWinWinConditionFare,
  FARE_CONDITION_OPTIONS,
  formatCurrency,
} from '../utils/aureliaLogic';

interface FareComparisonOptimizerProps {
  selectedMode?: ComparisonVehicleMode;
  activeCondition: FareConditionId;
  distanceKm?: number;
  compact?: boolean;
  onSelectCondition: (conditionId: FareConditionId) => void;
  onSelectMode?: (mode: ComparisonVehicleMode) => void;
  onDistanceChange?: (km: number) => void;
}

const VEHICLE_MODES: { id: ComparisonVehicleMode; label: string }[] = [
  { id: 'bike', label: 'Bike' },
  { id: 'auto', label: 'Auto' },
  { id: 'car_economy', label: 'Car Economy' },
  { id: 'car_premier', label: 'Car Premier' },
  { id: 'car_elite', label: 'Car Elite' },
];

export function FareComparisonOptimizer({
  selectedMode = 'car_premier',
  activeCondition,
  distanceKm = 12,
  compact = false,
  onSelectCondition,
  onSelectMode,
  onDistanceChange,
}: FareComparisonOptimizerProps) {
  const [localMode, setLocalMode] = useState<ComparisonVehicleMode>(selectedMode);
  const [localDistance, setLocalDistance] = useState<number>(distanceKm);

  const effectiveMode = onSelectMode ? selectedMode : localMode;
  const effectiveDistance = onDistanceChange ? distanceKm : localDistance;

  const evaluation = useMemo(
    () =>
      evaluateWinWinConditionFare({
        vehicleMode: effectiveMode,
        conditionId: activeCondition,
        distanceKm: effectiveDistance,
      }),
    [effectiveMode, activeCondition, effectiveDistance]
  );

  const handleModePick = (mode: ComparisonVehicleMode) => {
    if (onSelectMode) onSelectMode(mode);
    else setLocalMode(mode);
  };

  const handleDistancePick = (km: number) => {
    if (onDistanceChange) onDistanceChange(km);
    else setLocalDistance(km);
  };

  return (
    <section
      data-testid="fare-comparison-optimizer"
      className="p-4 sm:p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-amber-400/20 shadow-sm space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-stone-200/70 dark:border-white/10 pb-3.5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9A722A] dark:text-[#E6C77E]">
            Live Competitor Per-Km Benchmark · Uber · Rapido · Ola · Namma Yatri
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-50 mt-0.5">
            Win-Win Condition Fare Optimizer
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5">
            Reduces customer ₹/km by trimming company platform fee instead of driver payout — keeping both rider & chauffeur ahead.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right font-mono-tabular">
            <p className="text-[11px] text-stone-500 dark:text-stone-400">Trip Distance</p>
            <p className="text-sm font-bold text-stone-900 dark:text-white">
              {evaluation.distanceKm} km
            </p>
          </div>
          <input
            type="range"
            min={2}
            max={45}
            step={1}
            value={effectiveDistance}
            aria-label="Comparison trip distance in km"
            onChange={(e) => handleDistancePick(Number(e.target.value))}
            className="w-28 sm:w-36 accent-[#D4AF63]"
          />
        </div>
      </div>

      {/* Vehicle Mode Switcher */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Vehicle comparison category">
        {VEHICLE_MODES.map((m) => {
          const active = effectiveMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              data-testid={`compare-mode-${m.id}`}
              onClick={() => handleModePick(m.id)}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-stone-900 dark:bg-[#E6C77E] text-white dark:text-stone-950 shadow-sm'
                  : 'bg-stone-100 dark:bg-white/[0.06] text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-white/10'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Condition Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {FARE_CONDITION_OPTIONS.map((cond) => {
          const isSelected = activeCondition === cond.id;
          return (
            <button
              key={cond.id}
              type="button"
              data-testid={`condition-btn-${cond.id}`}
              onClick={() => onSelectCondition(cond.id)}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                isSelected
                  ? 'bg-amber-50/90 dark:bg-amber-400/15 border-[#B48A3E] dark:border-[#E6C77E] shadow-sm'
                  : 'bg-stone-50/70 dark:bg-[#080A0F]/70 border-stone-200/80 dark:border-white/10 hover:border-amber-300 dark:hover:border-amber-400/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  {cond.shortLabel}
                </span>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-snug line-clamp-2">
                {cond.summary}
              </p>
            </button>
          );
        })}
      </div>

      {/* Win-Win Outcome Highlight Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-500/30 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Customer Happy Price</span>
          </p>
          <p
            data-testid="optimizer-reduced-rate"
            className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 font-mono-tabular"
          >
            ₹{evaluation.aureliaReducedRatePerKm.toFixed(1)}/km
          </p>
          <p className="text-[11px] text-emerald-900/80 dark:text-emerald-200/80 font-mono-tabular">
            Trip total {formatCurrency(evaluation.customerTotalFare)} · Saves{' '}
            {formatCurrency(evaluation.customerSavingsVsAvgInr)} ({evaluation.customerSavingsPercentVsAvg}% vs market avg)
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-500/30 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9A722A] dark:text-[#E6C77E] flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Driver Happy Net Payout</span>
          </p>
          <p
            data-testid="optimizer-driver-net"
            className="text-2xl font-bold text-[#8A621E] dark:text-[#E6C77E] font-mono-tabular"
          >
            ₹{evaluation.aureliaDriverNetPerKm.toFixed(1)}/km
          </p>
          <p className="text-[11px] text-stone-700 dark:text-stone-300 font-mono-tabular">
            Driver receives {formatCurrency(evaluation.driverTotalNetPayout)} (
            {evaluation.driverAdvantageVsAvgPerKm > 0
              ? `+₹${evaluation.driverAdvantageVsAvgPerKm.toFixed(1)}/km vs competitor avg`
              : `₹${evaluation.aureliaDriverNetPerKm.toFixed(1)}/km fair net · fee trimmed`}
            )
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#D4AF63]" />
            <span>Aurelia Trimmed Fee</span>
          </p>
          <p className="text-2xl font-bold text-stone-900 dark:text-white font-mono-tabular">
            ₹{evaluation.aureliaPlatformFeePerKm.toFixed(1)}/km
          </p>
          <p className="text-[11px] text-stone-600 dark:text-stone-400 font-mono-tabular">
            Reduced from ₹3.0/km standard · Beats cheapest rival ({evaluation.cheapestCompetitorBrand})
          </p>
        </div>
      </div>

      {/* Competitor Table: Uber vs Rapido vs Ola vs Namma Yatri vs Aurelia */}
      {!compact && (
        <div className="overflow-x-auto rounded-2xl border border-stone-200/80 dark:border-white/10">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-stone-100/80 dark:bg-white/[0.04] border-b border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-300">
                <th className="py-2.5 px-3 text-left font-semibold">Platform</th>
                <th className="py-2.5 px-3 text-right font-semibold">Customer ₹/km</th>
                <th className="py-2.5 px-3 text-right font-semibold">App Cut</th>
                <th className="py-2.5 px-3 text-right font-semibold">Driver Net ₹/km</th>
                <th className="py-2.5 px-3 text-right font-semibold">
                  Est. {evaluation.distanceKm} km Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-white/5 font-mono-tabular">
              <tr className="bg-emerald-50/70 dark:bg-emerald-950/30 font-semibold">
                <td className="py-2.5 px-3 font-sans text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Aurelia ({evaluation.conditionLabel})</span>
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-300 font-bold">
                  ₹{evaluation.aureliaReducedRatePerKm.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-300">
                  ₹{evaluation.aureliaPlatformFeePerKm.toFixed(1)}/km
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-300 font-bold">
                  ₹{evaluation.aureliaDriverNetPerKm.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-800 dark:text-emerald-200 font-bold">
                  {formatCurrency(evaluation.customerTotalFare)}
                </td>
              </tr>

              {evaluation.competitors.map((comp) => (
                <tr key={comp.brand} className="hover:bg-stone-50/60 dark:hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3 font-sans text-stone-800 dark:text-stone-200">
                    {comp.brand}{' '}
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono-tabular">
                      · {comp.surgeNote}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-stone-900 dark:text-stone-100">
                    ₹{comp.customerRatePerKm.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400">
                    {comp.commissionPercent}% (₹{comp.platformCutPerKm.toFixed(1)})
                  </td>
                  <td className="py-2.5 px-3 text-right text-stone-700 dark:text-stone-300">
                    ₹{comp.driverNetPerKm.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-stone-900 dark:text-stone-100">
                    {formatCurrency(comp.customerRatePerKm * evaluation.distanceKm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600 dark:text-stone-400 pt-1">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            {evaluation.customerHappyReason} · {evaluation.driverHappyReason}
          </span>
        </span>
      </div>
    </section>
  );
}
