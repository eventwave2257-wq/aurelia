import { useEffect, useState } from 'react';
import {
  Accessibility,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  HeartPulse,
  MapPin,
  Navigation,
  PhoneCall,
  Power,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { KARNATAKA_31_DISTRICTS, VEHICLE_TIER_OPTIONS } from '../data/karnatakaDistricts';
import { CARE_MOBILITY_IMG_PATH, EXECUTIVE_FLEET_IMG_PATH } from '../data/seedData';
import type {
  CareAppointment,
  DriverPreferences,
  DriverTripPhase,
  KarnatakaDistrict,
  LiveRideOrder,
  PlannedRouteSummary,
  RideOffer,
  VehicleTier,
} from '../types/aurelia';
import {
  calculateInTripPayoutPreview,
  calculateOfferEstimatedNet,
  COMPANY_MAINTENANCE_FEE_PER_KM_INR,
  DRIVER_NET_PER_KM_INR,
  evaluateWinWinConditionFare,
  formatCurrency,
  getTripCompletionProgress,
  getVehicleTierLabel,
  RATE_PER_KM_INR,
  resolveOfferGeoEndpoints,
  roundCurrency,
} from '../utils/aureliaLogic';
import { ActiveTripMiniMap } from './ActiveTripMiniMap';
import { DispatchMap } from './DispatchMap';
import { EmergencySosModal } from './EmergencySosModal';
import { FareComparisonOptimizer } from './FareComparisonOptimizer';
import { PassengerTipSelector } from './PassengerTipSelector';
import { PickupDropSearchModal } from './PickupDropSearchModal';
import { SpeedTelemetryCard } from './SpeedTelemetryCard';
import { SmartRoutingWidget } from './SmartRoutingWidget';
import { VehicleTierGraphic } from './VehicleTierGraphic';

interface DriveCockpitProps {
  phase: DriverTripPhase;
  activeOffer: RideOffer | null;
  careAppointments: CareAppointment[];
  incomingCustomerRides?: LiveRideOrder[];
  preferences: DriverPreferences;
  plannedRoute: PlannedRouteSummary | null;
  plannedRouteObj: google.maps.routes.Route | null;
  onToggleOnline: () => void;
  onSimulateOffer: (preferredKind?: 'emergency_hospital' | 'care' | 'standard') => void;
  onAcceptCustomerRide?: (ride: LiveRideOrder) => void;
  onAcceptOffer: () => void;
  onDeclineOffer: () => void;
  onAdvanceTripPhase: () => void;
  onReturnToRadar?: () => void;
  onOpenCompletedRating?: () => void;
  onUpdateTripTip: (tipInr: number) => void;
  onToggleChecklistItem: (itemId: string) => void;
  onUpdatePreferences: (partial: Partial<DriverPreferences>) => void;
  onSelectDistrict: (district: KarnatakaDistrict) => void;
  onRouteComputed: (summary: PlannedRouteSummary, routeObj: google.maps.routes.Route | null) => void;
  onDispatchPlannedRoute: (summary: PlannedRouteSummary) => void;
  onGoToCareHub: () => void;
}

export function DriveCockpit({
  phase,
  activeOffer,
  careAppointments,
  incomingCustomerRides = [],
  preferences,
  plannedRoute,
  plannedRouteObj,
  onToggleOnline,
  onSimulateOffer,
  onAcceptCustomerRide,
  onAcceptOffer,
  onDeclineOffer,
  onAdvanceTripPhase,
  onReturnToRadar,
  onOpenCompletedRating,
  onUpdateTripTip,
  onToggleChecklistItem,
  onUpdatePreferences,
  onSelectDistrict,
  onRouteComputed,
  onDispatchPlannedRoute,
  onGoToCareHub,
}: DriveCockpitProps) {
  const [countdown, setCountdown] = useState<number>(18);
  const [showRadarPanel, setShowRadarPanel] = useState<boolean>(false);
  const [showFareOptimizer, setShowFareOptimizer] = useState<boolean>(false);
  const [showSafetyDrawer, setShowSafetyDrawer] = useState<boolean>(false);
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [graceSecondsElapsed, setGraceSecondsElapsed] = useState<number>(0);

  const activeFareEval = evaluateWinWinConditionFare({
    vehicleMode: preferences.selectedVehicleTier,
    conditionId: preferences.activeFareCondition ?? 'off_peak_corridor',
    distanceKm: 10,
  });

  useEffect(() => {
    if (phase !== 'request_incoming') {
      setCountdown(18);
      return;
    }
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, activeOffer?.id]);

  useEffect(() => {
    if (phase !== 'arrived_pickup') {
      setGraceSecondsElapsed(0);
      return;
    }
    const timer = window.setInterval(() => {
      setGraceSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!preferences.voiceReadout || phase !== 'request_incoming' || !activeOffer) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const net = calculateOfferEstimatedNet(activeOffer);
      const isEmerg = Boolean(activeOffer.isEmergencyHospitalVisit);
      const isCare = activeOffer.category !== 'standard';
      const utterance = new SpeechSynthesisUtterance(
        `${isEmerg ? 'Priority 1 Emergency Hospital Visit' : isCare ? 'Priority Care Ride' : 'Executive Ride'}. ${activeOffer.serviceLabel}. Estimated payout ${Math.round(
          net
        )} rupees. Pickup ${activeOffer.pickupEtaMins} minutes away.`
      );
      utterance.rate = 0.98;
      window.speechSynthesis.speak(utterance);
    }
  }, [phase, activeOffer, preferences.voiceReadout]);

  const isCareOffer = activeOffer ? activeOffer.category !== 'standard' : false;
  const isEmergencyOffer = Boolean(activeOffer?.isEmergencyHospitalVisit);
  const inTripPreview = activeOffer
    ? calculateInTripPayoutPreview({
        baseFareInr: activeOffer.baseFare,
        surgeBonusInr:
          activeOffer.surgeMultiplier > 1
            ? roundCurrency(activeOffer.baseFare * (activeOffer.surgeMultiplier - 1))
            : 0,
        careStipendInr: activeOffer.careStipend,
        tipInr: activeOffer.estimatedTip,
        category: activeOffer.category,
        pricingModel: activeOffer.pricingModel,
        distanceKm: activeOffer.distanceMiles,
      })
    : null;
  const offerNet = inTripPreview ? inTripPreview.netDriverPayoutInr : activeOffer ? calculateOfferEstimatedNet(activeOffer) : 0;
  const offerCompanyMaintFee =
    activeOffer?.pricingModel === 'per_km_19'
      ? roundCurrency(activeOffer.distanceMiles * COMPANY_MAINTENANCE_FEE_PER_KM_INR)
      : 0;

  const allChecklistDone =
    activeOffer && activeOffer.checklist.length > 0
      ? activeOffer.checklist.every((item) => item.checked)
      : true;

  const claimedCareCount = careAppointments.filter((a) => a.claimed && !a.completed).length;
  const activeDistrictObj =
    KARNATAKA_31_DISTRICTS.find((d) => d.id === preferences.selectedDistrictId) ??
    KARNATAKA_31_DISTRICTS[0];
  const activeDistrictName = activeDistrictObj.name;
  const tripProgress = getTripCompletionProgress(phase);
  const activeOfferEndpoints = activeOffer
    ? resolveOfferGeoEndpoints(activeOffer, {
        lat: activeDistrictObj.lat,
        lng: activeDistrictObj.lng,
      })
    : null;
  const fleetBackdropImg =
    preferences.emergencyHospitalFirst || preferences.selectedVehicleTier === 'car_elite'
      ? CARE_MOBILITY_IMG_PATH
      : EXECUTIVE_FLEET_IMG_PATH;

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Top Gen Z Command Strip: Search Box + Vehicle Tiers + Emergency Hospital #1 Preference */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* Interactive Pickup & Drop Search Box Trigger */}
        <button
          type="button"
          onClick={() => setShowSearchModal(true)}
          data-testid="open-route-search-btn"
          className="xl:col-span-5 min-h-[58px] px-4 py-3 rounded-2xl bg-white/90 dark:bg-[#101218]/90 backdrop-blur-xl border border-stone-200/80 dark:border-amber-400/25 hover:border-[#B48A3E] dark:hover:border-[#E6C77E] text-left flex items-center justify-between gap-3 shadow-sm transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-400/15 border border-amber-200 dark:border-amber-400/30 flex items-center justify-center shrink-0">
              <Search className="w-4 h-4 text-[#9A722A] dark:text-[#E6C77E]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                {plannedRoute
                  ? `${plannedRoute.pickup.label} → ${plannedRoute.dropoff.label}`
                  : 'Search Pickup & Drop Location (Karnataka)'}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate font-mono-tabular">
                {plannedRoute
                  ? `${plannedRoute.distanceKm} km · Est. ${formatCurrency(plannedRoute.totalFareInr)} (₹${DRIVER_NET_PER_KM_INR}/km net + ₹${COMPANY_MAINTENANCE_FEE_PER_KM_INR}/km maint.)`
                  : `Tap to enter Pickup & Drop · ₹${RATE_PER_KM_INR}/km tariff (₹${DRIVER_NET_PER_KM_INR} driver + ₹${COMPANY_MAINTENANCE_FEE_PER_KM_INR} company)`}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#9A722A] dark:text-[#E6C77E] shrink-0" />
        </button>

        {/* Vehicle Class Selector: Bike, Car (Economy), Car (Premier), Car (Elite) */}
        <div
          role="group"
          aria-label="Select vehicle option"
          className="xl:col-span-4 p-1.5 rounded-2xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 grid grid-cols-4 gap-1 shadow-sm"
        >
          {VEHICLE_TIER_OPTIONS.map((tier) => {
            const active = preferences.selectedVehicleTier === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                data-testid={`tier-btn-${tier.id}`}
                aria-pressed={active}
                onClick={() =>
                  onUpdatePreferences({ selectedVehicleTier: tier.id as VehicleTier })
                }
                className={`min-h-[46px] px-1.5 py-1.5 rounded-xl text-[11px] font-bold transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  active
                    ? 'bg-stone-900 dark:bg-[#E6C77E] text-white dark:text-stone-950 shadow-sm'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/[0.06]'
                }`}
              >
                <VehicleTierGraphic tier={tier.id} className="w-7 h-4 shrink-0" />
                <span className="truncate max-w-full">{tier.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Direct Preference Toggle: Emergency Hospital Visit First Priority */}
        <button
          type="button"
          data-testid="emergency-priority-toggle"
          aria-pressed={preferences.emergencyHospitalFirst}
          onClick={() =>
            onUpdatePreferences({
              emergencyHospitalFirst: !preferences.emergencyHospitalFirst,
            })
          }
          className={`xl:col-span-3 min-h-[58px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-xl text-left flex items-center justify-between gap-2.5 transition-colors shadow-sm ${
            preferences.emergencyHospitalFirst
              ? 'bg-rose-600/95 dark:bg-rose-500/20 border-rose-500 dark:border-rose-400/60 text-white dark:text-rose-200'
              : 'bg-white/85 dark:bg-[#101218]/85 border-stone-200/80 dark:border-white/10 text-stone-700 dark:text-stone-300'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <HeartPulse
              className={`w-4 h-4 shrink-0 ${
                preferences.emergencyHospitalFirst
                  ? 'text-white dark:text-rose-400'
                  : 'text-rose-500'
              }`}
            />
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">Emergency Hospital Visit</p>
              <p
                className={`text-[10px] font-mono-tabular truncate ${
                  preferences.emergencyHospitalFirst
                    ? 'text-rose-100 dark:text-rose-300'
                    : 'text-stone-500 dark:text-stone-400'
                }`}
              >
                {preferences.emergencyHospitalFirst
                  ? 'FIRST PRIORITY · #1 QUEUE'
                  : 'Standard Queue Order'}
              </p>
            </div>
          </div>
          <span
            className={`text-[10px] font-mono-tabular font-bold px-2 py-1 rounded-lg shrink-0 ${
              preferences.emergencyHospitalFirst
                ? 'bg-white/20 text-white dark:bg-rose-500 dark:text-white'
                : 'bg-stone-200 dark:bg-white/10 text-stone-600 dark:text-stone-300'
            }`}
          >
            {preferences.emergencyHospitalFirst ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Main Split Workspace: Left Google Maps + 31 Districts | Right Driver Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch">
        {/* Left Column: Earnings Strip + Google Maps + 31 Districts */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Compact Rate & Quick Dispatch Highlight Banner */}
          <div
            data-testid="cockpit-highlight-banner"
            className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-sm"
          >
            <button
              type="button"
              onClick={() => setShowFareOptimizer((p) => !p)}
              data-testid="toggle-fare-optimizer-btn"
              className="min-w-0 text-left flex flex-col justify-center rounded-xl hover:bg-amber-50/60 dark:hover:bg-white/[0.04] p-1 transition-colors cursor-pointer"
            >
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 truncate">
                Win-Win Rate · Fair Split
              </p>
              <p
                data-testid="banner-earn-per-km"
                className="text-sm sm:text-[15px] xl:text-base font-bold text-stone-900 dark:text-white font-mono-tabular truncate"
              >
                ₹{activeFareEval.aureliaReducedRatePerKm.toFixed(1)}/km · Net ₹
                {activeFareEval.aureliaDriverNetPerKm.toFixed(1)}
              </p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                Saves {activeFareEval.customerSavingsPercentVsAvg}% vs 4 apps · Tap to tune
              </p>
            </button>

            <button
              type="button"
              data-testid="banner-fast-ride-booking"
              onClick={() => setShowSearchModal(true)}
              className="sm:border-l border-stone-200 dark:border-white/10 sm:pl-3 text-left rounded-xl sm:rounded-none hover:bg-amber-50/70 dark:hover:bg-white/[0.04] p-1.5 sm:py-0.5 transition-colors flex flex-col justify-center min-h-[44px]"
            >
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#9A722A] dark:text-[#E6C77E]" />
                <span>Total Executive</span>
              </p>
              <p className="text-base sm:text-lg font-bold text-[#9A722A] dark:text-[#E6C77E] leading-tight">
                Fast Ride Booking
              </p>
              <p className="text-[10px] text-stone-500 dark:text-stone-400">
                Tap for instant route
              </p>
            </button>

            <button
              type="button"
              data-testid="banner-quick-rider"
              onClick={() => {
                if (phase === 'offline') {
                  onToggleOnline();
                } else {
                  onSimulateOffer(preferences.emergencyHospitalFirst ? 'emergency_hospital' : 'standard');
                }
              }}
              className="sm:border-l border-stone-200 dark:border-white/10 sm:pl-3 text-left rounded-xl sm:rounded-none hover:bg-emerald-50/70 dark:hover:bg-white/[0.04] p-1.5 sm:py-0.5 transition-colors flex flex-col justify-center min-h-[44px]"
            >
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                <span>Executive &amp; Care</span>
              </p>
              <p className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 leading-tight">
                Quick Rider
              </p>
              <p className="text-[10px] text-stone-500 dark:text-stone-400">
                {phase === 'offline' ? 'Tap to go online fast' : 'Tap for quick dispatch'}
              </p>
            </button>
          </div>

          <DispatchMap
            phase={phase}
            activeOffer={activeOffer}
            plannedRoute={plannedRoute}
            plannedRouteObj={plannedRouteObj}
            careAppointments={careAppointments}
            selectedDistrictId={preferences.selectedDistrictId}
            onSelectDistrict={onSelectDistrict}
            onSelectCarePin={() => onGoToCareHub()}
          />
        </div>

        {/* Right Column: Driver Control Console */}
        <div className="lg:col-span-5 flex flex-col gap-3 sm:gap-4">
          {/* Quick Driver Toolbar */}
          <div className="grid grid-cols-3 sm:flex sm:items-center sm:justify-between gap-2 p-2.5 sm:p-3 rounded-2xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-sm">
            <button
              type="button"
              onClick={() => setShowRadarPanel((p) => !p)}
              aria-expanded={showRadarPanel}
              className="min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold border border-stone-200 dark:border-white/15 text-stone-800 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-white/[0.06] flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#9A722A] dark:text-[#E6C77E] shrink-0" />
              <span>Filters</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdatePreferences({ voiceReadout: !preferences.voiceReadout })}
              aria-pressed={preferences.voiceReadout}
              className={`min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                preferences.voiceReadout
                  ? 'bg-amber-50 dark:bg-amber-400/15 border-amber-300 dark:border-[#E6C77E]/60 text-amber-900 dark:text-[#E6C77E]'
                  : 'border-stone-200 dark:border-white/15 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-white/[0.06]'
              }`}
            >
              {preferences.voiceReadout ? (
                <Volume2 className="w-4 h-4 shrink-0" />
              ) : (
                <VolumeX className="w-4 h-4 shrink-0" />
              )}
              <span>Voice</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSafetyDrawer(true)}
              className="sm:ml-auto min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Safety SOS</span>
            </button>
          </div>

          {/* Expandable Dispatch Filters Drawer */}
          {showRadarPanel && (
            <div className="p-4 rounded-2xl bg-white/90 dark:bg-[#101218]/90 backdrop-blur-xl border border-stone-200 dark:border-amber-400/25 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                  Karnataka Chauffeur Radar & Tariff Rules
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRadarPanel(false)}
                  className="min-h-[36px] px-2 text-xs font-semibold text-stone-500 hover:text-stone-900 dark:hover:text-white"
                >
                  Done
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
                    Min Upfront Fare ({formatCurrency(preferences.minFareFilter)})
                  </span>
                  <input
                    type="range"
                    min={100}
                    max={2000}
                    step={50}
                    value={preferences.minFareFilter}
                    onChange={(e) =>
                      onUpdatePreferences({ minFareFilter: Number(e.target.value) })
                    }
                    className="w-full mt-2 accent-[#D4AF63]"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
                    Max Pickup Radius ({preferences.maxPickupMiles} km)
                  </span>
                  <input
                    type="range"
                    min={3}
                    max={50}
                    step={1}
                    value={preferences.maxPickupMiles}
                    onChange={(e) =>
                      onUpdatePreferences({ maxPickupMiles: Number(e.target.value) })
                    }
                    className="w-full mt-2 accent-[#D4AF63]"
                  />
                </label>
              </div>

              <label className="flex items-center justify-between gap-3 pt-2 border-t border-stone-100 dark:border-white/10 cursor-pointer min-h-[44px]">
                <span className="text-xs font-medium text-stone-800 dark:text-stone-200">
                  Emergency Hospital Visit First Priority (#1)
                </span>
                <input
                  type="checkbox"
                  checked={preferences.emergencyHospitalFirst}
                  onChange={(e) =>
                    onUpdatePreferences({ emergencyHospitalFirst: e.target.checked })
                  }
                  className="w-5 h-5 accent-rose-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between gap-3 pt-2 border-t border-stone-100 dark:border-white/10 cursor-pointer min-h-[44px]">
                <span className="text-xs font-medium text-stone-800 dark:text-stone-200">
                  Prioritize Disabled & Care Rides (₹16/km + Care Stipends)
                </span>
                <input
                  type="checkbox"
                  checked={preferences.autoAcceptCarePriority}
                  onChange={(e) =>
                    onUpdatePreferences({ autoAcceptCarePriority: e.target.checked })
                  }
                  className="w-5 h-5 accent-emerald-600 rounded"
                />
              </label>
            </div>
          )}

          {/* Speed Limit & Fine Monitor (Bike 50 km/h ₹40 | Cars 95 km/h ₹80) */}
          <SpeedTelemetryCard vehicleTier={preferences.selectedVehicleTier} />

          {/* Primary Cockpit State Card */}
          <div className="flex-1 p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.45)] flex flex-col justify-between gap-5">
            {/* OFFLINE STATE */}
            {phase === 'offline' && (
              <>
                <div className="space-y-3.5">
                  {/* Visual Fleet & Karnataka Corridor Preview Card */}
                  <div className="relative h-32 rounded-2xl overflow-hidden border border-stone-200/80 dark:border-white/10">
                    <img
                      src={fleetBackdropImg}
                      alt={`${getVehicleTierLabel(preferences.selectedVehicleTier)} active in ${activeDistrictName}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-[#0B0D12]/55 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2 text-white">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E6C77E] truncate">
                          {activeDistrictObj.name} · {activeDistrictObj.highwayCode}
                        </p>
                        <p className="text-xs font-bold truncate">{activeDistrictObj.medicalCenter}</p>
                      </div>
                      <VehicleTierGraphic
                        tier={preferences.selectedVehicleTier}
                        className="w-9 h-5 text-[#E6C77E] shrink-0"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9A722A] dark:text-[#E6C77E]">
                      {getVehicleTierLabel(preferences.selectedVehicleTier)} · Offline
                    </p>
                    <h2 className="font-display text-3xl font-bold text-stone-900 dark:text-white leading-tight mt-0.5">
                      Ready to Drive with AURELIA
                    </h2>
                  </div>
                  <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                    Active across all 31 districts of Karnataka at transparent{' '}
                    <strong className="text-stone-900 dark:text-white font-mono-tabular">
                      ₹{RATE_PER_KM_INR}/km
                    </strong>{' '}
                    pricing (₹{DRIVER_NET_PER_KM_INR}/km driver payout + ₹
                    {COMPANY_MAINTENANCE_FEE_PER_KM_INR}/km company maintenance &amp; service).
                  </p>

                  <div className="p-3 rounded-2xl bg-stone-50 dark:bg-white/[0.04] border border-stone-200/80 dark:border-white/10 flex items-center justify-between text-xs">
                    <span className="text-stone-600 dark:text-stone-300">
                      Claimed Special Care Slots
                    </span>
                    <button
                      type="button"
                      onClick={onGoToCareHub}
                      className="min-h-[36px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline font-mono-tabular cursor-pointer"
                    >
                      {claimedCareCount} Scheduled →
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onToggleOnline}
                  data-testid="go-online-btn"
                  className="w-full min-h-[54px] rounded-2xl bg-gradient-to-r from-[#B48A3E] to-[#9A722A] dark:from-[#E6C77E] dark:to-[#C59B47] hover:opacity-95 active:scale-[0.99] text-white dark:text-stone-950 font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer"
                >
                  <Power className="w-5 h-5" />
                  <span>Go Online</span>
                </button>
              </>
            )}

            {/* ONLINE IDLE / SEARCHING STATE */}
            {phase === 'online_idle' && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
                      Online · Karnataka Active
                    </span>
                    <span className="text-xs text-stone-500 dark:text-stone-400 font-mono-tabular">
                      ₹{RATE_PER_KM_INR}/km · ₹{DRIVER_NET_PER_KM_INR} net
                    </span>
                  </div>

                  <div>
                    <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-white">
                      {preferences.emergencyHospitalFirst
                        ? 'Priority #1: Emergency Hospital Radar'
                        : 'Scanning All 31 Karnataka Districts'}
                    </h2>
                    <p className="text-sm text-stone-600 dark:text-stone-300 mt-1">
                      {preferences.emergencyHospitalFirst
                        ? 'Emergency Hospital Visit dispatches rank first ahead of standard Bike and Car tiers.'
                        : `Active tier: ${getVehicleTierLabel(preferences.selectedVehicleTier)} across Karnataka.`}
                    </p>
                  </div>

                  {/* Dispatch Queue Triggers */}
                  <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#07080B] border border-stone-200 dark:border-white/10 space-y-2.5">
                    <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                      Dispatch Queue Preview
                    </p>

                    {incomingCustomerRides.length > 0 && onAcceptCustomerRide && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/40 space-y-2">
                        <p className="text-[11px] font-bold text-[#9A722A] dark:text-[#E6C77E]">
                          Live Customer Booking Ready ({incomingCustomerRides[0].distanceKm} km ·{' '}
                          {formatCurrency(incomingCustomerRides[0].fareInr)})
                        </p>
                        <p className="text-[11px] text-stone-700 dark:text-stone-300">
                          {incomingCustomerRides[0].customerName}:{' '}
                          {incomingCustomerRides[0].pickupLabel} →{' '}
                          {incomingCustomerRides[0].dropoffLabel}
                        </p>
                        <button
                          type="button"
                          data-testid="driver-accept-live-customer-btn"
                          onClick={() => onAcceptCustomerRide(incomingCustomerRides[0])}
                          className="w-full min-h-[40px] rounded-xl bg-[#B48A3E] dark:bg-[#E6C77E] text-white dark:text-stone-950 text-xs font-bold cursor-pointer"
                        >
                          Accept Customer Booking
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        data-testid="receive-emergency-hospital-btn"
                        onClick={() => onSimulateOffer('emergency_hospital')}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <HeartPulse className="w-4 h-4 shrink-0" />
                        <span>Receive Priority #1 Emergency Hospital Visit</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => onSimulateOffer('care')}
                          className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Accessibility className="w-4 h-4 shrink-0" />
                          <span>Care Ride</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSimulateOffer('standard')}
                          className="min-h-[44px] px-3 py-2 rounded-xl bg-stone-900 dark:bg-[#E6C77E] hover:opacity-90 text-white dark:text-stone-950 text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-4 h-4 shrink-0" />
                          <span>{getVehicleTierLabel(preferences.selectedVehicleTier)}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onToggleOnline}
                  className="w-full min-h-[48px] rounded-2xl border border-stone-300 dark:border-white/15 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06] font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Power className="w-4 h-4" />
                  <span>Go Offline</span>
                </button>
              </>
            )}

            {/* INCOMING RIDE REQUEST STATE */}
            {phase === 'request_incoming' && activeOffer && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold">
                      <span
                        className={
                          isEmergencyOffer
                            ? 'text-rose-600 dark:text-rose-400'
                            : isCareOffer
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-[#9A722A] dark:text-[#E6C77E]'
                        }
                      >
                        {isEmergencyOffer
                          ? 'Priority #1 · Emergency Hospital Visit'
                          : isCareOffer
                            ? 'Care & Medical Dispatch'
                            : 'Standard Dispatch'}
                      </span>
                      <span className="mx-1.5 text-stone-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-stone-700 dark:text-stone-300">
                        {getVehicleTierLabel(activeOffer.vehicleTier)}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-amber-700 dark:text-[#E6C77E] font-mono-tabular">
                      {countdown}s
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-stone-100 dark:border-white/10">
                    <div>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Chauffeur Net Payout
                      </p>
                      <p className="text-3xl font-bold text-stone-900 dark:text-white font-mono-tabular">
                        {formatCurrency(offerNet)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-stone-600 dark:text-stone-300 font-mono-tabular space-y-0.5">
                      <p>{activeOffer.pickupEtaMins} min away</p>
                      <p>
                        {activeOffer.distanceMiles} km · {activeOffer.tripDurationMins} min
                      </p>
                    </div>
                  </div>

                  {/* Exact ₹19/km Tariff Breakdown */}
                  <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-[#07080B] border border-stone-200/80 dark:border-white/10 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono-tabular text-stone-700 dark:text-stone-300">
                    <span>
                      Gross {formatCurrency(activeOffer.baseFare)} (₹{RATE_PER_KM_INR}/km)
                    </span>
                    {offerCompanyMaintFee > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#9A722A] dark:text-[#E6C77E]">
                          -{formatCurrency(offerCompanyMaintFee)} Maint. (₹
                          {COMPANY_MAINTENANCE_FEE_PER_KM_INR}/km)
                        </span>
                      </>
                    )}
                    {activeOffer.careStipend > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          +{formatCurrency(activeOffer.careStipend)} Care Stipend
                        </span>
                      </>
                    )}
                  </div>

                  {/* Route & Rider */}
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-[#B48A3E] dark:text-[#E6C77E] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          Pickup · {activeOffer.riderName} ({activeOffer.riderRating.toFixed(2)}★)
                        </p>
                        <p className="font-semibold text-stone-900 dark:text-white">
                          {activeOffer.pickupAddress}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-stone-500 dark:text-stone-400">Drop-off</p>
                        <p className="font-semibold text-stone-900 dark:text-white">
                          {activeOffer.dropoffAddress}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#07080B] border border-stone-200 dark:border-white/10 text-xs text-stone-700 dark:text-stone-200 space-y-1">
                    <p className="font-semibold">
                      Equipment: {activeOffer.equipmentRequired.join(' · ')}
                    </p>
                    <p className="text-stone-600 dark:text-stone-300">
                      {activeOffer.accessibilityNotes}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={onDeclineOffer}
                    className="col-span-1 min-h-[50px] rounded-2xl border border-stone-300 dark:border-white/15 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06] font-semibold text-sm"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={onAcceptOffer}
                    data-testid="accept-ride-btn"
                    className={`col-span-2 min-h-[50px] rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-md ${
                      isEmergencyOffer
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : isCareOffer
                          ? 'bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white'
                          : 'bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#E6C77E] dark:hover:bg-[#D4AF63] text-white dark:text-stone-950'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Accept Ride</span>
                  </button>
                </div>
              </>
            )}

            {/* ACTIVE & COMPLETED TRIP WORKFLOW WITH REAL-TIME VISUAL PROGRESS BAR */}
            {tripProgress.isVisible && activeOffer && (
              <>
                <div className="space-y-4">
                  {/* Real-Time Visual Trip Completion Progress Bar */}
                  <section
                    aria-label="Real-time trip completion status"
                    data-testid="trip-progress-container"
                    className={`p-3.5 rounded-2xl border space-y-3 ${
                      phase === 'completed'
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/35 border-emerald-300 dark:border-emerald-700/60'
                        : isEmergencyOffer
                          ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/40'
                          : 'bg-stone-50/90 dark:bg-[#080A0F] border-stone-200/90 dark:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">
                          Real-Time Trip Progress
                        </p>
                        <p
                          data-testid="trip-progress-status-label"
                          className={`text-sm font-bold truncate ${
                            phase === 'completed'
                              ? 'text-emerald-800 dark:text-emerald-300'
                              : isEmergencyOffer
                                ? 'text-rose-700 dark:text-rose-300'
                                : 'text-stone-900 dark:text-white'
                          }`}
                        >
                          {tripProgress.statusLabel}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          data-testid="trip-progress-percent"
                          className={`text-lg font-bold font-mono-tabular ${
                            phase === 'completed'
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : isEmergencyOffer
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-[#9A722A] dark:text-[#E6C77E]'
                          }`}
                        >
                          {tripProgress.percent}%
                        </span>
                        <p className="text-[10px] font-mono-tabular text-stone-500 dark:text-stone-400">
                          Stage {tripProgress.activeStepIndex + 1} of {tripProgress.totalSteps}
                        </p>
                      </div>
                    </div>

                    {/* Visual Progress Track + Moving Vehicle Marker */}
                    <div className="relative pt-1 pb-1">
                      <div
                        role="progressbar"
                        data-testid="trip-progress-bar"
                        aria-label="Real-time trip completion progress"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={tripProgress.percent}
                        className="h-3 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden"
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${
                            phase === 'completed'
                              ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                              : isEmergencyOffer
                                ? 'bg-gradient-to-r from-rose-600 via-amber-500 to-emerald-500'
                                : 'bg-gradient-to-r from-[#B48A3E] via-[#E6C77E] to-emerald-500'
                          }`}
                          style={{ width: `${tripProgress.percent}%` }}
                        />
                      </div>

                      {/* Moving Chauffeur Vehicle Indicator along the track */}
                      <div
                        aria-hidden="true"
                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-5 rounded-lg flex items-center justify-center shadow-md border transition-all duration-500 ease-out ${
                          phase === 'completed'
                            ? 'bg-emerald-700 border-emerald-400 text-white'
                            : isEmergencyOffer
                              ? 'bg-rose-600 border-rose-300 text-white'
                              : 'bg-stone-900 dark:bg-[#E6C77E] border-amber-300 dark:border-stone-900 text-white dark:text-stone-950'
                        }`}
                        style={{
                          left: `${Math.min(94, Math.max(8, tripProgress.percent))}%`,
                        }}
                      >
                        <VehicleTierGraphic
                          tier={activeOffer.vehicleTier ?? preferences.selectedVehicleTier}
                          className="w-6 h-3.5"
                        />
                      </div>
                    </div>

                    {/* 4 Milestone Stage Nodes */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {tripProgress.steps.map((step) => (
                        <div
                          key={step.phase}
                          data-testid={`trip-step-${step.phase}`}
                          className={`px-1.5 py-1.5 rounded-xl border text-center transition-colors ${
                            step.completed
                              ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                              : step.active
                                ? isEmergencyOffer
                                  ? 'bg-rose-600/15 border-rose-500/50 text-rose-800 dark:text-rose-200 font-bold'
                                  : 'bg-amber-500/15 border-[#B48A3E]/50 dark:border-[#E6C77E]/60 text-stone-900 dark:text-[#E6C77E] font-bold'
                                : 'bg-white/60 dark:bg-white/[0.02] border-stone-200/70 dark:border-white/10 text-stone-400 dark:text-stone-500'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1 text-[10px] font-bold truncate">
                            {step.completed ? (
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <span className="font-mono-tabular">{step.percent}%</span>
                            )}
                            <span className="truncate">{step.shortLabel}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-snug">
                      {tripProgress.subtitle}
                    </p>
                  </section>

                  {/* Rider & Route Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-white truncate">
                        {activeOffer.riderName}
                      </h2>
                      <p className="text-sm text-stone-600 dark:text-stone-300 mt-0.5 flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#E6C77E] shrink-0" />
                        <span className="truncate">
                          {phase === 'completed'
                            ? `Arrived at ${activeOffer.dropoffAddress}`
                            : phase === 'in_trip'
                              ? `Heading to ${activeOffer.dropoffAddress}`
                              : `Pickup at ${activeOffer.pickupAddress}`}
                        </span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        Chauffeur Net
                      </p>
                      <span
                        data-testid="cockpit-active-net-payout"
                        className="text-base font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400"
                      >
                        {formatCurrency(offerNet)}
                      </span>
                    </div>
                  </div>

                  {/* Static Google Maps SDK Route Visualization (Pickup → Dropoff) */}
                  {activeOfferEndpoints && (
                    <ActiveTripMiniMap
                      pickupLatLng={activeOfferEndpoints.pickup}
                      dropoffLatLng={activeOfferEndpoints.dropoff}
                      pickupLabel={activeOffer.pickupAddress}
                      dropoffLabel={activeOffer.dropoffAddress}
                      vehicleTier={activeOffer.vehicleTier ?? preferences.selectedVehicleTier}
                      isEmergencyOrCare={isEmergencyOffer || isCareOffer}
                      distanceKm={activeOffer.distanceMiles}
                      durationMins={activeOffer.tripDurationMins}
                      phase={phase}
                    />
                  )}

                  {phase === 'arrived_pickup' && (
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/60 text-xs">
                      <span className="flex items-center gap-2 font-medium text-amber-900 dark:text-[#E6C77E]">
                        <Clock className="w-4 h-4" />
                        Wait-Time Grace ({activeOffer.graceWaitMins} min included)
                      </span>
                      <span className="font-mono-tabular font-bold text-amber-900 dark:text-amber-100">
                        {formatTimer(graceSecondsElapsed)}
                      </span>
                    </div>
                  )}

                  {phase === 'arrived_pickup' && activeOffer.checklist.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-semibold text-stone-700 dark:text-stone-200">
                        Pre-Departure Safety &amp; Care Checklist
                      </p>
                      <div className="space-y-2">
                        {activeOffer.checklist.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-start gap-3 p-2.5 rounded-xl border border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/[0.04] cursor-pointer min-h-[44px]"
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => onToggleChecklistItem(item.id)}
                              className="w-5 h-5 mt-0.5 accent-emerald-600 rounded shrink-0"
                            />
                            <span className="text-xs text-stone-800 dark:text-stone-200 leading-snug">
                              {item.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {phase !== 'completed' && (
                    <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#07080B] border border-stone-200 dark:border-white/10 text-xs space-y-1.5">
                      <p className="text-stone-700 dark:text-stone-200">
                        <span className="font-semibold">Notes:</span> {activeOffer.accessibilityNotes}
                      </p>
                      {activeOffer.caregiverContact && (
                        <p className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                          <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                          <span>Caregiver: {activeOffer.caregiverContact}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Interactive In-Trip Passenger Tip Selection & Live Payout Preview */}
                {phase === 'in_trip' && inTripPreview && (
                  <PassengerTipSelector
                    mode="driver"
                    selectedTipInr={inTripPreview.tipInr}
                    baseFareInr={inTripPreview.baseFareInr}
                    careStipendInr={inTripPreview.careStipendInr}
                    surgeBonusInr={inTripPreview.surgeBonusInr}
                    platformFeeInr={inTripPreview.platformFeeInr}
                    netPayoutWithTipInr={inTripPreview.netDriverPayoutInr}
                    flatTransferNetInr={inTripPreview.flatTransferredNetInr}
                    passengerName={activeOffer.riderName}
                    onSelectTip={onUpdateTripTip}
                  />
                )}

                {/* Smart Routing suggestion tool during active trip */}
                {phase === 'in_trip' && <SmartRoutingWidget activeOffer={activeOffer} />}

                {/* Trip Completed Settlement & Actions */}
                {phase === 'completed' ? (
                  <div className="space-y-3 pt-1">
                    <div className="p-3.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/35 border border-emerald-300/80 dark:border-emerald-700/60 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-emerald-900 dark:text-emerald-200">
                          Settlement Reconciled (Flat ₹3 Fee)
                        </p>
                        <p className="text-emerald-800/80 dark:text-emerald-300/90 mt-0.5">
                          Logged to Trip History &amp; Analytics · Ready for next Karnataka dispatch
                        </p>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {onOpenCompletedRating && (
                        <button
                          type="button"
                          onClick={onOpenCompletedRating}
                          data-testid="completed-rate-passenger-btn"
                          className="min-h-[48px] px-4 rounded-2xl border border-amber-300 dark:border-[#E6C77E]/50 bg-amber-50/70 dark:bg-amber-400/10 text-amber-900 dark:text-[#E6C77E] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Star className="w-4 h-4" />
                          <span>Rate Passenger &amp; Care Notes</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onReturnToRadar}
                        data-testid="complete-return-radar-btn"
                        className={`min-h-[48px] px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer ${
                          onOpenCompletedRating ? '' : 'sm:col-span-2'
                        }`}
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Return to Online Radar</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Quick-Access Emergency SOS Button & Advance Trip CTA During Active Trips */
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      data-testid="active-trip-emergency-sos-btn"
                      onClick={() => setShowSafetyDrawer(true)}
                      className="w-full min-h-[46px] px-4 rounded-2xl bg-rose-600/15 hover:bg-rose-600/25 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 border border-rose-500/60 text-rose-700 dark:text-rose-200 font-bold text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>Emergency SOS</span>
                      </span>
                      <span className="text-[11px] font-mono-tabular px-2 py-0.5 rounded-lg bg-rose-600 text-white shrink-0">
                        {activeDistrictName} · 112 / 108
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={onAdvanceTripPhase}
                      disabled={phase === 'arrived_pickup' && !allChecklistDone}
                      data-testid="advance-trip-btn"
                      className={`w-full min-h-[52px] rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        phase === 'arrived_pickup' && !allChecklistDone
                          ? 'bg-stone-300 dark:bg-stone-800 text-stone-600 dark:text-stone-400 cursor-not-allowed'
                          : isEmergencyOffer
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : isCareOffer
                              ? 'bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white'
                              : 'bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#E6C77E] dark:hover:bg-[#D4AF63] text-white dark:text-stone-950'
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>
                        {phase === 'en_route_pickup' && 'Confirm Arrived at Pickup'}
                        {phase === 'arrived_pickup' &&
                          (allChecklistDone ? 'Start Trip' : 'Complete Checklist to Start Trip')}
                        {phase === 'in_trip' && 'Complete & Log Trip'}
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Inline Collapsible Competitor Per-Km Optimizer */}
      {showFareOptimizer && (
        <FareComparisonOptimizer
          selectedMode={preferences.selectedVehicleTier}
          activeCondition={preferences.activeFareCondition ?? 'off_peak_corridor'}
          onSelectCondition={(cond) =>
            onUpdatePreferences({ activeFareCondition: cond })
          }
          onSelectMode={(mode) => {
            if (mode !== 'auto') {
              onUpdatePreferences({ selectedVehicleTier: mode });
            }
          }}
        />
      )}

      {/* Pickup & Drop Location Search Modal */}
      <PickupDropSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        selectedVehicleTier={preferences.selectedVehicleTier}
        activeFareCondition={preferences.activeFareCondition}
        emergencyHospitalFirst={preferences.emergencyHospitalFirst}
        initialPlannedRoute={plannedRoute}
        onChangeVehicleTier={(tier) => onUpdatePreferences({ selectedVehicleTier: tier })}
        onToggleEmergencyPriority={(val) =>
          onUpdatePreferences({ emergencyHospitalFirst: val })
        }
        onRouteComputed={onRouteComputed}
        onDispatchPlannedRoute={onDispatchPlannedRoute}
      />

      {/* District-Aware Emergency SOS Modal (Police, Hospital & Emergency Services) */}
      <EmergencySosModal
        isOpen={showSafetyDrawer}
        selectedDistrictId={preferences.selectedDistrictId}
        phase={phase}
        activeOffer={activeOffer}
        onSelectDistrictId={(districtId) => {
          const found = KARNATAKA_31_DISTRICTS.find((d) => d.id === districtId);
          if (found) onSelectDistrict(found);
        }}
        onClose={() => setShowSafetyDrawer(false)}
      />
    </div>
  );
}
