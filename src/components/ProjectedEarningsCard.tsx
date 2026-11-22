import { useMemo } from 'react';
import { TrendingUp, Sparkles, Calendar, ArrowUpRight, Zap } from 'lucide-react';
import type { CompletedTrip } from '../types/aurelia';
import { formatCurrency } from '../utils/aureliaLogic';

interface ProjectedEarningsCardProps {
  trips: CompletedTrip[];
}

export function ProjectedEarningsCard({ trips }: ProjectedEarningsCardProps) {
  const projection = useMemo(() => {
    const totalPastEarnings = trips.reduce((acc, t) => acc + (t.baseFare + t.surgeBonus + t.careStipend + t.tip), 0);
    const avgPerTrip = trips.length > 0 ? totalPastEarnings / trips.length : 450;
    
    // Estimate upcoming week based on past trip frequency and surge patterns
    const estimatedTripsNextWeek = Math.max(15, trips.length * 1.25);
    const projectedGross = Math.round(estimatedTripsNextWeek * avgPerTrip);
    const projectedMaintenance = Math.round(projectedGross * 0.15); // ₹3/km equivalent ~15% maintenance
    const projectedNet = projectedGross - projectedMaintenance;

    const standardShare = Math.round(projectedNet * 0.68);
    const careShare = Math.round(projectedNet * 0.32);

    return {
      projectedNet,
      standardShare,
      careShare,
      estimatedTripsNextWeek: Math.round(estimatedTripsNextWeek),
      growthPercent: 18.5,
    };
  }, [trips]);

  return (
    <div
      data-testid="projected-earnings-card"
      className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-white via-emerald-50/20 to-emerald-100/30 dark:from-[#101218] dark:via-[#111915] dark:to-[#16221c] backdrop-blur-xl border border-emerald-300/60 dark:border-emerald-500/30 shadow-sm space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 dark:bg-emerald-400/20 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                AI Predictive Forecast
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300/70 dark:border-emerald-700/60">
                +{projection.growthPercent}% vs Last Week
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">
              Projected Earnings for Upcoming Week
            </h2>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-xs text-stone-500 dark:text-stone-400">Estimated Net Potential</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono-tabular">
            {formatCurrency(projection.projectedNet)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="p-3.5 rounded-2xl bg-white/90 dark:bg-[#080A0F]/80 border border-stone-200/80 dark:border-white/10 space-y-1">
          <p className="text-xs text-stone-500 dark:text-stone-400">Executive Channel</p>
          <p className="text-lg font-bold text-stone-900 dark:text-stone-100 font-mono-tabular">
            {formatCurrency(projection.standardShare)}
          </p>
          <p className="text-[11px] text-stone-500">Based on standard ₹19/km corridors</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/90 dark:bg-[#080A0F]/80 border border-stone-200/80 dark:border-white/10 space-y-1">
          <p className="text-xs text-stone-500 dark:text-stone-400">Special Care Appointments</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono-tabular">
            {formatCurrency(projection.careShare)}
          </p>
          <p className="text-[11px] text-stone-500">Includes medical & disability stipends</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/90 dark:bg-[#080A0F]/80 border border-stone-200/80 dark:border-white/10 space-y-1">
          <p className="text-xs text-stone-500 dark:text-stone-400">Estimated Trip Volume</p>
          <p className="text-lg font-bold text-stone-900 dark:text-stone-100 font-mono-tabular">
            ~{projection.estimatedTripsNextWeek} trips
          </p>
          <p className="text-[11px] text-stone-500">Optimized across peak hours</p>
        </div>
      </div>

      <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
        <Sparkles className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Habit Insight:</strong> Operating in High Earning Areas (orange zones) during morning peak (08:00–11:00) and medical appointment slots is projected to add ~₹3,200 in surge bonuses next week.
        </p>
      </div>
    </div>
  );
}
