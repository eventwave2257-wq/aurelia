import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bike,
  Car,
  Crosshair,
  HeartPulse,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { KARNATAKA_LANDMARKS, VEHICLE_TIER_OPTIONS } from '../data/karnatakaDistricts';
import { useGoogleMapsSdk } from '../context/GoogleMapsSdkContext';
import {
  useKarnatakaAutocomplete,
  useKarnatakaRouteCalculator,
  type AutocompleteOption,
} from '../hooks/useKarnatakaRoutePlanner';
import type {
  FareConditionId,
  PlannedRouteSummary,
  SelectedPlacePoint,
  VehicleTier,
} from '../types/aurelia';
import {
  calculateWinWinFareBreakdown,
  formatCurrency,
  getVehicleTierLabel,
} from '../utils/aureliaLogic';

interface PickupDropSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVehicleTier: VehicleTier;
  activeFareCondition?: FareConditionId;
  emergencyHospitalFirst: boolean;
  initialPlannedRoute: PlannedRouteSummary | null;
  onChangeVehicleTier: (tier: VehicleTier) => void;
  onToggleEmergencyPriority: (val: boolean) => void;
  onRouteComputed: (summary: PlannedRouteSummary, routeObj: google.maps.routes.Route | null) => void;
  onDispatchPlannedRoute: (summary: PlannedRouteSummary) => void;
}

export function PickupDropSearchModal({
  isOpen,
  onClose,
  selectedVehicleTier,
  activeFareCondition = 'off_peak_corridor',
  emergencyHospitalFirst,
  initialPlannedRoute,
  onChangeVehicleTier,
  onToggleEmergencyPriority,
  onRouteComputed,
  onDispatchPlannedRoute,
}: PickupDropSearchModalProps) {
  const { hasApiKey, isFailed } = useGoogleMapsSdk();
  const mapsEnabled = hasApiKey && !isFailed;
  const [pickupQuery, setPickupQuery] = useState<string>(
    initialPlannedRoute?.pickup.label ?? ''
  );
  const [dropQuery, setDropQuery] = useState<string>(
    initialPlannedRoute?.dropoff.label ?? ''
  );
  const [activeField, setActiveField] = useState<'pickup' | 'drop'>('pickup');
  const [pickupPlace, setPickupPlace] = useState<SelectedPlacePoint | null>(
    initialPlannedRoute?.pickup ?? null
  );
  const [dropPlace, setDropPlace] = useState<SelectedPlacePoint | null>(
    initialPlannedRoute?.dropoff ?? null
  );
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [summary, setSummary] = useState<PlannedRouteSummary | null>(initialPlannedRoute);

  const pickupAutocomplete = useKarnatakaAutocomplete(pickupQuery);
  const dropAutocomplete = useKarnatakaAutocomplete(dropQuery);
  const { computeRoute } = useKarnatakaRouteCalculator();

  const computeRouteRef = useRef(computeRoute);
  computeRouteRef.current = computeRoute;
  const onRouteComputedRef = useRef(onRouteComputed);
  onRouteComputedRef.current = onRouteComputed;
  const emergencyPriorityRef = useRef(emergencyHospitalFirst);
  emergencyPriorityRef.current = emergencyHospitalFirst;
  const lastRouteKeyRef = useRef<string>('');

  useEffect(() => {
    if (!isOpen) return;
    if (initialPlannedRoute) {
      setPickupPlace(initialPlannedRoute.pickup);
      setDropPlace(initialPlannedRoute.dropoff);
      setPickupQuery(initialPlannedRoute.pickup.label);
      setDropQuery(initialPlannedRoute.dropoff.label);
      setSummary(initialPlannedRoute);
      lastRouteKeyRef.current = `${initialPlannedRoute.pickup.location.lat},${initialPlannedRoute.pickup.location.lng}->${initialPlannedRoute.dropoff.location.lat},${initialPlannedRoute.dropoff.location.lng}|${initialPlannedRoute.vehicleTier}`;
    }
  }, [isOpen, initialPlannedRoute]);

  useEffect(() => {
    if (!isOpen || !pickupPlace || !dropPlace) return;
    const effectiveCond: FareConditionId = emergencyHospitalFirst
      ? 'care_priority'
      : activeFareCondition;
    const routeKey = `${pickupPlace.location.lat},${pickupPlace.location.lng}->${dropPlace.location.lat},${dropPlace.location.lng}|${selectedVehicleTier}|${effectiveCond}`;
    if (lastRouteKeyRef.current === routeKey) return;
    lastRouteKeyRef.current = routeKey;

    let cancelled = false;
    setIsCalculating(true);

    computeRouteRef
      .current(pickupPlace.location, dropPlace.location, selectedVehicleTier)
      .then((metrics) => {
        if (cancelled) return;
        const fare = calculateWinWinFareBreakdown(
          metrics.distanceKm,
          selectedVehicleTier,
          effectiveCond
        );
        const computed: PlannedRouteSummary = {
          pickup: pickupPlace,
          dropoff: dropPlace,
          distanceKm: fare.distanceKm,
          durationMins: metrics.durationMins,
          totalFareInr: fare.totalDistanceFare,
          companyMaintenanceFeeInr: fare.companyMaintenanceFee,
          driverNetInr: fare.driverDistanceEarnings,
          vehicleTier: selectedVehicleTier,
          isEmergencyHospitalVisit: emergencyPriorityRef.current,
          source: metrics.source,
          fareCondition: effectiveCond,
          effectiveRatePerKm: fare.effectiveRatePerKm,
        };
        setSummary(computed);
        setIsCalculating(false);
        onRouteComputedRef.current(computed, metrics.routeObj);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, pickupPlace, dropPlace, selectedVehicleTier, activeFareCondition, emergencyHospitalFirst]);

  useEffect(() => {
    setSummary((prev) =>
      prev ? { ...prev, isEmergencyHospitalVisit: emergencyHospitalFirst } : prev
    );
  }, [emergencyHospitalFirst]);

  if (!isOpen) return null;

  const activeSuggestions =
    activeField === 'pickup' ? pickupAutocomplete.options : dropAutocomplete.options;
  const suggestionsLoading =
    activeField === 'pickup' ? pickupAutocomplete.isLoading : dropAutocomplete.isLoading;

  const handleSelectSuggestion = async (option: AutocompleteOption) => {
    const resolved =
      activeField === 'pickup'
        ? await pickupAutocomplete.resolveOptionToPlace(option)
        : await dropAutocomplete.resolveOptionToPlace(option);
    if (!resolved) return;

    if (activeField === 'pickup') {
      setPickupPlace(resolved);
      setPickupQuery(resolved.label);
      if (!dropPlace) setActiveField('drop');
    } else {
      setDropPlace(resolved);
      setDropQuery(resolved.label);
    }
  };

  const handleQuickFillLandmark = (
    landmarkId: string,
    target: 'pickup' | 'drop'
  ) => {
    const lm = KARNATAKA_LANDMARKS.find((item) => item.id === landmarkId);
    if (!lm) return;
    const point: SelectedPlacePoint = {
      label: lm.title,
      formattedAddress: lm.subtitle,
      location: { lat: lm.lat, lng: lm.lng },
      source: 'karnataka_directory',
    };
    if (target === 'pickup') {
      setPickupPlace(point);
      setPickupQuery(point.label);
      setActiveField('drop');
    } else {
      setDropPlace(point);
      setDropQuery(point.label);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search pickup and drop location across Karnataka"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white/95 dark:bg-[#101218]/95 border border-stone-200 dark:border-white/15 p-4 sm:p-6 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9A722A] dark:text-[#E6C77E]">
              {mapsEnabled
                ? 'Google Maps Route & Fare Estimator · Karnataka'
                : 'Karnataka Corridor Route & Fare Estimator'}
            </p>
            <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-white mt-0.5">
              Enter Pickup & Drop Location
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close location search"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl border border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pickup & Drop Inputs */}
        <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#07080B] border border-stone-200 dark:border-white/10 space-y-3">
          <div className="space-y-1">
            <label
              htmlFor="aurelia-pickup-input"
              className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#E6C77E]" />
                <span>Pickup Location</span>
              </span>
              {pickupPlace && (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono-tabular">
                  Pinned
                </span>
              )}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="aurelia-pickup-input"
                type="text"
                data-testid="pickup-search-input"
                value={pickupQuery}
                onFocus={() => setActiveField('pickup')}
                onChange={(e) => {
                  setActiveField('pickup');
                  setPickupQuery(e.target.value);
                  setPickupPlace(null);
                }}
                placeholder="Type pickup area, street, hospital, or district in Karnataka..."
                className="w-full min-h-[46px] pl-10 pr-3 rounded-xl bg-white dark:bg-[#13161D] border border-stone-300 dark:border-white/15 text-sm text-stone-900 dark:text-white placeholder:text-stone-400"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="aurelia-drop-input"
              className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Drop Location (Destination)</span>
              </span>
              {dropPlace && (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono-tabular">
                  Pinned
                </span>
              )}
            </label>
            <div className="relative">
              <Navigation className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="aurelia-drop-input"
                type="text"
                data-testid="drop-search-input"
                value={dropQuery}
                onFocus={() => setActiveField('drop')}
                onChange={(e) => {
                  setActiveField('drop');
                  setDropQuery(e.target.value);
                  setDropPlace(null);
                }}
                placeholder="Type destination hospital, airport, or city in Karnataka..."
                className="w-full min-h-[46px] pl-10 pr-3 rounded-xl bg-white dark:bg-[#13161D] border border-stone-300 dark:border-white/15 text-sm text-stone-900 dark:text-white placeholder:text-stone-400"
              />
            </div>
          </div>
        </div>

        {/* Autocomplete Suggestions List (Shown while active field is unpinned / being typed) */}
        {(activeField === 'pickup' ? !pickupPlace : !dropPlace) && (
          <div className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#0A0C10] overflow-hidden">
            <div className="px-3.5 py-2 border-b border-stone-100 dark:border-white/10 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500 dark:text-stone-400">
              <span>
                {activeField === 'pickup'
                  ? 'Suggested Pickup Locations'
                  : 'Suggested Drop Locations'}
              </span>
              <span>{suggestionsLoading ? 'Searching...' : 'Karnataka Bias'}</span>
            </div>

            <div
              data-testid="autocomplete-suggestions-list"
              className="divide-y divide-stone-100 dark:divide-white/5 max-h-44 overflow-y-auto"
            >
              {activeSuggestions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => void handleSelectSuggestion(opt)}
                  data-testid="autocomplete-suggestion-item"
                  className="w-full min-h-[48px] px-3.5 py-2.5 text-left hover:bg-amber-50/70 dark:hover:bg-white/[0.06] flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                      {opt.title}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                      {opt.subtitle}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono-tabular font-semibold uppercase text-[#9A722A] dark:text-[#E6C77E] shrink-0">
                    {opt.source === 'google_places' ? 'Places' : 'KA Hub'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Karnataka Hospital & Transit Presets */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500 dark:text-stone-400">
            Quick Fill {activeField === 'pickup' ? 'Pickup' : 'Drop'} (Hospitals & Hubs)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'lm-indiranagar-blr', label: 'Indiranagar BLR' },
              { id: 'lm-manipal-blr', label: 'Manipal Hospital BLR' },
              { id: 'lm-nimhans-blr', label: 'NIMHANS Bengaluru' },
              { id: 'lm-blr-airport', label: 'BLR Airport (T2)' },
              { id: 'lm-apollo-mys', label: 'Apollo BGS Mysuru' },
            ].map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => handleQuickFillLandmark(q.id, activeField)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-200 dark:border-white/15 bg-stone-50 dark:bg-white/[0.04] hover:bg-stone-100 dark:hover:bg-white/[0.09] text-xs font-medium text-stone-800 dark:text-stone-200"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicle Tier + Emergency Hospital Priority Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {VEHICLE_TIER_OPTIONS.map((tier) => {
            const active = selectedVehicleTier === tier.id;
            const Icon = tier.id === 'bike' ? Bike : Car;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => onChangeVehicleTier(tier.id)}
                className={`min-h-[48px] px-2.5 py-2 rounded-xl border text-left transition-colors flex flex-col justify-center ${
                  active
                    ? 'bg-stone-900 dark:bg-[#E6C77E] text-white dark:text-stone-950 border-stone-900 dark:border-[#E6C77E]'
                    : 'bg-stone-50 dark:bg-white/[0.03] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-white/10'
                }`}
              >
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tier.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        <label className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-950/25 cursor-pointer min-h-[48px]">
          <span className="flex items-center gap-2 text-xs font-semibold text-rose-900 dark:text-rose-200">
            <HeartPulse className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Emergency Hospital Visit — First Priority (#1 Queue Boost)</span>
          </span>
          <input
            type="checkbox"
            checked={emergencyHospitalFirst}
            onChange={(e) => onToggleEmergencyPriority(e.target.checked)}
            className="w-5 h-5 accent-rose-600 rounded shrink-0"
          />
        </label>

        {/* Computed Distance & Exact ₹19/km Fare Breakdown */}
        {summary && (
          <div
            data-testid="planned-route-summary"
            className="p-4 rounded-2xl bg-[#0B0D12] text-white border border-amber-400/30 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#E6C77E] font-semibold">
                  {isCalculating
                    ? mapsEnabled
                      ? 'Calculating Google Maps Route...'
                      : 'Calculating Corridor Route...'
                    : summary.source === 'google_routes'
                      ? 'Google Maps Route Distance'
                      : 'Karnataka Corridor Distance'}
                </p>
                <p className="text-sm font-semibold text-white mt-0.5">
                  {summary.pickup.label} → {summary.dropoff.label}
                </p>
              </div>
              <div className="text-right font-mono-tabular">
                <p className="text-2xl font-bold text-[#E6C77E]">
                  {summary.distanceKm} km
                </p>
                <p className="text-xs text-stone-400">
                  Est. {summary.durationMins} min · {getVehicleTierLabel(summary.vehicleTier)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs font-mono-tabular">
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                <p className="text-[10px] text-stone-400 font-sans">
                  Customer Fare (₹{(summary.effectiveRatePerKm ?? 19).toFixed(1)}/km)
                </p>
                <p className="text-base font-bold text-white mt-0.5">
                  {formatCurrency(summary.totalFareInr)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-[10px] text-emerald-300 font-sans">
                  Driver Net Payout
                </p>
                <p className="text-base font-bold text-emerald-300 mt-0.5">
                  {formatCurrency(summary.driverNetInr)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
                <p className="text-[10px] text-amber-200 font-sans">
                  Trimmed Co. Fee
                </p>
                <p className="text-base font-bold text-[#E6C77E] mt-0.5">
                  {formatCurrency(summary.companyMaintenanceFeeInr)}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <p className="text-[11px] text-stone-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-[#E6C77E] shrink-0" />
                <span>
                  Condition-reduced vs Uber/Rapido/Ola/Namma Yatri — lower rider fare &amp; higher driver net.
                </span>
              </p>
              <button
                type="button"
                data-testid="dispatch-planned-route-btn"
                onClick={() => {
                  onDispatchPlannedRoute(summary);
                  onClose();
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#E6C77E] hover:bg-[#D4AF63] text-stone-950 text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>Dispatch This Route</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
