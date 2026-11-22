import { useState, useMemo } from 'react';
import { Wrench, AlertCircle, CheckCircle2, RotateCcw, ShieldCheck, Gauge, Droplet, Disc, Sparkles } from 'lucide-react';
import type { CompletedTrip, DriverProfileData } from '../types/aurelia';

interface VehicleMaintenanceWidgetProps {
  completedTrips: CompletedTrip[];
  vehicle: DriverProfileData['vehicle'];
}

export function VehicleMaintenanceWidget({
  completedTrips,
  vehicle,
}: VehicleMaintenanceWidgetProps) {
  const [resetOffset, setResetOffset] = useState<number>(0);
  const [lastServiceDate, setLastServiceDate] = useState<string>('2026-10-15');
  const [serviceLoggedNotice, setServiceLoggedNotice] = useState<string | null>(null);

  // Cumulative kilometers driven across all completed trips
  const cumulativeTripKm = useMemo(() => {
    const raw = completedTrips.reduce((acc, t) => acc + (t.distanceMiles || 0), 0);
    return Math.round(raw * 10) / 10;
  }, [completedTrips]);

  // Baseline commercial odometer
  const baseOdometerKm = 18450;
  const currentOdometerKm = Math.round(baseOdometerKm + cumulativeTripKm);

  // Interval definitions (in kilometers)
  const OIL_CHANGE_INTERVAL_KM = 10000;
  const TIRE_ROTATION_INTERVAL_KM = 8000;
  const BRAKE_CHECK_INTERVAL_KM = 15000;

  // Calculate remaining distance based on cumulative trips + reset offset
  const effectiveDrivenKm = Math.max(0, cumulativeTripKm - resetOffset);

  // Remaining km calculations
  const oilDistanceRemaining = Math.max(
    0,
    OIL_CHANGE_INTERVAL_KM - (effectiveDrivenKm % OIL_CHANGE_INTERVAL_KM || 2450)
  );
  const oilPercentRemaining = Math.round((oilDistanceRemaining / OIL_CHANGE_INTERVAL_KM) * 100);

  const tireDistanceRemaining = Math.max(
    0,
    TIRE_ROTATION_INTERVAL_KM - (effectiveDrivenKm % TIRE_ROTATION_INTERVAL_KM || 1680)
  );
  const tirePercentRemaining = Math.round((tireDistanceRemaining / TIRE_ROTATION_INTERVAL_KM) * 100);

  const brakeDistanceRemaining = Math.max(
    0,
    BRAKE_CHECK_INTERVAL_KM - (effectiveDrivenKm % BRAKE_CHECK_INTERVAL_KM || 6300)
  );
  const brakePercentRemaining = Math.round((brakeDistanceRemaining / BRAKE_CHECK_INTERVAL_KM) * 100);

  const handleLogService = () => {
    setResetOffset(cumulativeTripKm);
    setLastServiceDate(new Date().toISOString().slice(0, 10));
    setServiceLoggedNotice('Service logged! Maintenance counters refreshed for oil change and tire rotation.');
  };

  return (
    <div
      data-testid="vehicle-maintenance-widget"
      className="p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-sm space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 dark:bg-amber-400/20 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-amber-300">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-[#D4AF63]">
                Fleet Health Telemetry
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                Optimal
              </span>
            </div>
            <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">
              Vehicle Maintenance & Service Intervals
            </h3>
          </div>
        </div>

        <div className="text-left sm:text-right font-mono-tabular">
          <p className="text-xs text-stone-500 dark:text-stone-400">Current Odometer</p>
          <p className="text-xl font-bold text-stone-900 dark:text-stone-50">
            {currentOdometerKm.toLocaleString()} km
          </p>
          <p className="text-[11px] text-amber-700 dark:text-[#D4AF63]">
            +{cumulativeTripKm} km logged via {completedTrips.length} trips
          </p>
        </div>
      </div>

      {serviceLoggedNotice && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-xs font-medium text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3"
        >
          <span>{serviceLoggedNotice}</span>
          <button
            type="button"
            onClick={() => setServiceLoggedNotice(null)}
            className="text-emerald-800 dark:text-emerald-300 font-semibold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3 Maintenance Item Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Engine Oil Change */}
        <div className="p-4 rounded-2xl bg-stone-50/90 dark:bg-[#080A0F]/90 border border-stone-200 dark:border-stone-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <Droplet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Oil & Filter Change</span>
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                oilDistanceRemaining > 1500
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
              }`}
            >
              {oilDistanceRemaining > 1500 ? 'Good' : 'Due Soon'}
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono-tabular">
              <span className="text-stone-500">Remaining</span>
              <span className="font-bold text-stone-900 dark:text-white">
                {oilDistanceRemaining.toLocaleString()} km
              </span>
            </div>
            <div className="h-2 w-full mt-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  oilPercentRemaining > 25 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${oilPercentRemaining}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-stone-500 font-mono-tabular">
            10,000 km synthetic cycle · Last service {lastServiceDate}
          </p>
        </div>

        {/* 2. Tire Rotation */}
        <div className="p-4 rounded-2xl bg-stone-50/90 dark:bg-[#080A0F]/90 border border-stone-200 dark:border-stone-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Tire Rotation & Balance</span>
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                tireDistanceRemaining > 1200
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
              }`}
            >
              {tireDistanceRemaining > 1200 ? 'Good' : 'Due Soon'}
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono-tabular">
              <span className="text-stone-500">Remaining</span>
              <span className="font-bold text-stone-900 dark:text-white">
                {tireDistanceRemaining.toLocaleString()} km
              </span>
            </div>
            <div className="h-2 w-full mt-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  tirePercentRemaining > 25 ? 'bg-sky-500' : 'bg-amber-500'
                }`}
                style={{ width: `${tirePercentRemaining}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-stone-500 font-mono-tabular">
            8,000 km rotation cycle · Tread wear normal
          </p>
        </div>

        {/* 3. Brake Pads & Fluid */}
        <div className="p-4 rounded-2xl bg-stone-50/90 dark:bg-[#080A0F]/90 border border-stone-200 dark:border-stone-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <Disc className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Brakes & Hydraulics</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
              Good
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono-tabular">
              <span className="text-stone-500">Remaining</span>
              <span className="font-bold text-stone-900 dark:text-white">
                {brakeDistanceRemaining.toLocaleString()} km
              </span>
            </div>
            <div className="h-2 w-full mt-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${brakePercentRemaining}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-stone-500 font-mono-tabular">
            15,000 km check · Pad thickness 8.2mm
          </p>
        </div>
      </div>

      {/* Footer Bar: Vehicle Model Info & Action */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-stone-200/70 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-3 text-stone-600 dark:text-stone-300 font-mono-tabular">
          <span>Vehicle: <strong>{vehicle.make} {vehicle.model}</strong></span>
          <span>•</span>
          <span>Plate: <strong>{vehicle.licensePlate}</strong></span>
          <span>•</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Karnataka PUC & FC Certified
          </span>
        </div>

        <button
          type="button"
          onClick={handleLogService}
          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-400/20 dark:hover:bg-amber-400/30 border border-amber-300 dark:border-amber-500/40 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Log Service & Reset Counters</span>
        </button>
      </div>
    </div>
  );
}
