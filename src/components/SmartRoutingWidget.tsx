import { useState, useEffect } from 'react';
import { Navigation, Zap, AlertTriangle, CheckCircle2, RefreshCw, ArrowRight, Route, Clock } from 'lucide-react';
import type { RideOffer } from '../types/aurelia';

interface SmartRoutingWidgetProps {
  activeOffer: RideOffer;
  onApplyRouteModification?: (suggestedName: string, minutesSaved: number) => void;
}

interface RouteAlternative {
  id: string;
  name: string;
  via: string;
  timeRemainingMins: number;
  minutesSaved: number;
  distanceKm: number;
  trafficStatus: 'Heavy Congestion' | 'Moderate Flow' | 'Clear Corridor';
  trafficColor: 'rose' | 'amber' | 'emerald';
  reason: string;
}

export function SmartRoutingWidget({
  activeOffer,
  onApplyRouteModification,
}: SmartRoutingWidgetProps) {
  const [scanning, setScanning] = useState<boolean>(false);
  const [applied, setApplied] = useState<boolean>(false);
  const [appliedRouteName, setAppliedRouteName] = useState<string | null>(null);
  const [trafficAlertDismissed, setTrafficAlertDismissed] = useState<boolean>(false);

  // Generate realistic alternative routes based on destination
  const alternative: RouteAlternative = {
    id: 'alt-1',
    name: 'Smart Bypass via Elevated Corridor',
    via: 'Inner Ring Road & Peripheral Flyover',
    timeRemainingMins: Math.max(8, activeOffer.tripDurationMins - 6),
    minutesSaved: 6,
    distanceKm: +(activeOffer.distanceMiles * 1.08).toFixed(1),
    trafficStatus: 'Clear Corridor',
    trafficColor: 'emerald',
    reason: 'Avoids bottleneck at arterial junction (+9 mins congestion)',
  };

  const handleApply = () => {
    setApplied(true);
    setAppliedRouteName(alternative.name);
    if (onApplyRouteModification) {
      onApplyRouteModification(alternative.name, alternative.minutesSaved);
    }
  };

  const handleScanTraffic = () => {
    setScanning(true);
    setApplied(false);
    setTimeout(() => {
      setScanning(false);
      setTrafficAlertDismissed(false);
    }, 800);
  };

  if (trafficAlertDismissed && !applied) {
    return (
      <div className="p-3 rounded-2xl bg-stone-100/90 dark:bg-[#07080B]/90 border border-stone-200 dark:border-white/10 flex items-center justify-between text-xs font-mono-tabular">
        <span className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
          <Route className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Real-Time Traffic Monitor: Monitoring corridor</span>
        </span>
        <button
          type="button"
          onClick={handleScanTraffic}
          className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold text-[11px] hover:bg-amber-500/30 transition-colors"
        >
          Check Faster Route
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="smart-routing-widget"
      className="p-4 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent dark:from-amber-400/15 dark:via-[#13110e] dark:to-transparent border border-amber-300/80 dark:border-amber-500/40 shadow-md space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 dark:bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-700 dark:text-amber-300">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Aurelia Smart Routing
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            </div>
            <h4 className="font-display text-sm font-bold text-stone-900 dark:text-stone-50">
              {applied ? 'Smart Route Active' : 'Faster Route Modification Available'}
            </h4>
          </div>
        </div>

        <button
          type="button"
          onClick={handleScanTraffic}
          disabled={scanning}
          title="Rescan real-time corridor traffic"
          className="p-2 rounded-xl bg-white/80 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin text-amber-500' : ''}`} />
        </button>
      </div>

      {/* Traffic Comparison */}
      {!applied ? (
        <>
          <div className="p-3 rounded-2xl bg-white/90 dark:bg-[#080A0F]/90 border border-stone-200/80 dark:border-white/10 space-y-2 text-xs">
            <div className="flex items-center justify-between font-mono-tabular">
              <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Heavy Bottleneck Ahead (+9m)</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] border border-emerald-300 dark:border-emerald-700">
                ⚡ Saves {alternative.minutesSaved} mins
              </span>
            </div>

            <p className="text-stone-700 dark:text-stone-300">
              Suggested: <strong className="text-stone-900 dark:text-white">{alternative.name}</strong> ({alternative.via}).
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1 font-mono-tabular text-[11px] text-stone-600 dark:text-stone-400">
              <div className="p-2 rounded-xl bg-stone-50 dark:bg-[#12141c] border border-stone-200 dark:border-stone-800">
                <p className="text-stone-400 text-[10px]">CURRENT PATH</p>
                <p className="font-bold text-stone-900 dark:text-stone-100">
                  {activeOffer.tripDurationMins}m · {activeOffer.distanceMiles} km
                </p>
                <p className="text-rose-500">Heavy Slowdown</p>
              </div>

              <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-300/60 dark:border-emerald-700/60">
                <p className="text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">SMART ROUTE</p>
                <p className="font-bold text-emerald-900 dark:text-emerald-100">
                  {alternative.timeRemainingMins}m · {alternative.distanceKm} km
                </p>
                <p className="text-emerald-700 dark:text-emerald-400">Clear Green Wave</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApply}
              data-testid="apply-smart-route-btn"
              className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Apply Smart Route (-{alternative.minutesSaved}m)</span>
            </button>

            <button
              type="button"
              onClick={() => setTrafficAlertDismissed(true)}
              className="min-h-[42px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-semibold text-xs"
            >
              Keep Current
            </button>
          </div>
        </>
      ) : (
        <div className="p-3 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2 font-mono-tabular">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Navigating via <strong>{appliedRouteName}</strong> · ETA updated (-{alternative.minutesSaved} mins).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setApplied(false)}
            className="text-emerald-800 dark:text-emerald-300 underline font-semibold shrink-0"
          >
            Revert
          </button>
        </div>
      )}
    </div>
  );
}
