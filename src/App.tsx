import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  Car,
  FileCheck,
  Gamepad2,
  HeartPulse,
  Lock,
  Navigation,
  Power,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import { AccessProfileView } from './components/AccessProfileView';
import { AdminLockGate } from './components/AdminLockGate';
import { AdminPanelView } from './components/AdminPanelView';
import { AiChatbotModal } from './components/AiChatbotModal';
import { AureliaDrivingGameModal } from './components/AureliaDrivingGameModal';
import { AutoDriversView } from './components/AutoDriversView';
import { CareAppointmentsView } from './components/CareAppointmentsView';
import { CustomerBookingView } from './components/CustomerBookingView';
import { DocumentVerificationView } from './components/DocumentVerificationView';
import { DriveCockpit } from './components/DriveCockpit';
import { DriverOnboardingModal } from './components/DriverOnboardingModal';
import { EarningsAnalyticsView } from './components/EarningsAnalyticsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PassengerRatingModal } from './components/PassengerRatingModal';
import { OfflineIndicator, PWAInstallButton } from './components/PwaInstallButton';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
import { GoogleMapsSdkProvider } from './context/GoogleMapsSdkContext';
import { KARNATAKA_31_DISTRICTS } from './data/karnatakaDistricts';
import {
  INITIAL_CARE_APPOINTMENTS,
  INITIAL_COMPLETED_TRIPS,
  INITIAL_DRIVER_PERFORMANCE,
  INITIAL_DRIVER_PREFERENCES,
  INITIAL_DRIVER_PROFILE,
  QUEUED_RIDE_OFFERS,
} from './data/seedData';
import { BOOTSTRAPPED_ADMIN_EMAIL } from './firebase';
import type {
  AppPortalMode,
  AppTab,
  CareAppointment,
  CompletedTrip,
  DriverPerformanceStats,
  DriverPreferences,
  DriverProfileData,
  DriverTripPhase,
  GeoPoint,
  KarnatakaDistrict,
  LiveRideOrder,
  LiveTrackingSource,
  PassengerMultiPointRating,
  PlannedRouteSummary,
  RideOffer,
} from './types/aurelia';
import {
  appointmentToRideOffer,
  calculateFlatRideTransfer,
  computeSeparateEarningsAnalysis,
  getVehicleTierLabel,
  interpolateLiveTrackingPosition,
  resolveOfferGeoEndpoints,
  roundCurrency,
  sortOffersByPriority,
} from './utils/aureliaLogic';

const STORAGE_KEY = 'aurelia_driver_state_v4';

interface PersistedState {
  appointments: CareAppointment[];
  completedTrips: CompletedTrip[];
  preferences: DriverPreferences;
  driverProfile: DriverProfileData;
  performanceStats: DriverPerformanceStats;
}

function loadInitialState(): PersistedState {
  const defaults: PersistedState = {
    appointments: INITIAL_CARE_APPOINTMENTS,
    completedTrips: INITIAL_COMPLETED_TRIPS,
    preferences: INITIAL_DRIVER_PREFERENCES,
    driverProfile: INITIAL_DRIVER_PROFILE,
    performanceStats: INITIAL_DRIVER_PERFORMANCE,
  };

  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      appointments:
        Array.isArray(parsed.appointments) && parsed.appointments.length > 0
          ? parsed.appointments
          : defaults.appointments,
      completedTrips:
        Array.isArray(parsed.completedTrips) && parsed.completedTrips.length > 0
          ? parsed.completedTrips
          : defaults.completedTrips,
      preferences: parsed.preferences
        ? { ...defaults.preferences, ...parsed.preferences }
        : defaults.preferences,
      driverProfile: parsed.driverProfile
        ? { ...defaults.driverProfile, ...parsed.driverProfile }
        : defaults.driverProfile,
      performanceStats: parsed.performanceStats
        ? { ...defaults.performanceStats, ...parsed.performanceStats }
        : defaults.performanceStats,
    };
  } catch {
    return defaults;
  }
}

function AureliaWorkspace() {
  const initial = useMemo(() => loadInitialState(), []);
  const firebase = useFirebase();

  const shouldAutostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  const [portalMode, setPortalMode] = useState<AppPortalMode>('driver');
  const [activeTab, setActiveTab] = useState<AppTab>('drive');
  const [appointments, setAppointments] = useState<CareAppointment[]>(initial.appointments);
  const [completedTrips, setCompletedTrips] = useState<CompletedTrip[]>(initial.completedTrips);
  const [preferences, setPreferences] = useState<DriverPreferences>(initial.preferences);
  const [driverProfile, setDriverProfile] = useState<DriverProfileData>(initial.driverProfile);
  const [performanceStats, setPerformanceStats] = useState<DriverPerformanceStats>(
    initial.performanceStats
  );

  const [phase, setPhase] = useState<DriverTripPhase>('offline');
  const [activeOffer, setActiveOffer] = useState<RideOffer | null>(null);
  const [activeCareAptId, setActiveCareAptId] = useState<string | null>(null);
  const [offerCursor, setOfferCursor] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingRatingTripId, setPendingRatingTripId] = useState<string | null>(null);
  const [lastCompletedTripId, setLastCompletedTripId] = useState<string | null>(null);
  const [plannedRoute, setPlannedRoute] = useState<PlannedRouteSummary | null>(null);
  const [plannedRouteObj, setPlannedRouteObj] = useState<google.maps.routes.Route | null>(null);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);
  const [chatbotOpen, setChatbotOpen] = useState<boolean>(false);
  const [gameOpen, setGameOpen] = useState<boolean>(false);
  const [onboardingVerified, setOnboardingVerified] = useState<boolean>(shouldAutostart);
  const [activeTripElapsedSeconds, setActiveTripElapsedSeconds] = useState<number>(0);
  const [liveTrackingSource, setLiveTrackingSource] = useState<LiveTrackingSource>('corridor_sim');
  const [driverLivePosition, setDriverLivePosition] = useState<GeoPoint | null>(null);
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem('aurelia_admin_unlocked') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Track real-time trip duration during 'in_trip' so >20% duration overrun alert triggers accurately
  useEffect(() => {
    if (phase !== 'in_trip' || !activeOffer) {
      setActiveTripElapsedSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setActiveTripElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, activeOffer?.id]);

  // Real-time GPS tracking loop during active trips (syncs Driver Cockpit + Customer Live Tracker)
  useEffect(() => {
    const isActiveTripPhase =
      phase === 'en_route_pickup' || phase === 'arrived_pickup' || phase === 'in_trip';
    if (!isActiveTripPhase || !activeOffer) {
      if (phase === 'completed' && activeOffer) {
        const district =
          KARNATAKA_31_DISTRICTS.find((d) => d.id === preferences.selectedDistrictId) ??
          KARNATAKA_31_DISTRICTS[0];
        const endpoints = resolveOfferGeoEndpoints(activeOffer, {
          lat: district.lat,
          lng: district.lng,
        });
        setDriverLivePosition(endpoints.dropoff);
      } else {
        setDriverLivePosition(null);
      }
      return;
    }

    const district =
      KARNATAKA_31_DISTRICTS.find((d) => d.id === preferences.selectedDistrictId) ??
      KARNATAKA_31_DISTRICTS[0];
    const endpoints = resolveOfferGeoEndpoints(activeOffer, {
      lat: district.lat,
      lng: district.lng,
    });
    const linkedRideId = activeOffer.linkedRideId;

    const pushPosition = (pos: GeoPoint) => {
      setDriverLivePosition(pos);
      if (linkedRideId) {
        void firebase.updateLiveRideStatus(linkedRideId, {
          driverLat: pos.lat,
          driverLng: pos.lng,
        });
      }
    };

    if (
      liveTrackingSource === 'device_gps' &&
      typeof navigator !== 'undefined' &&
      'geolocation' in navigator
    ) {
      const initialPos = interpolateLiveTrackingPosition(
        endpoints.pickup,
        endpoints.dropoff,
        0.15,
        phase
      );
      setDriverLivePosition(initialPos);
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          pushPosition({
            lat: Number(position.coords.latitude.toFixed(5)),
            lng: Number(position.coords.longitude.toFixed(5)),
          });
        },
        () => {
          setLiveTrackingSource('corridor_sim');
          setToastMessage('Device GPS permission unavailable — switched to Corridor Live Sync.');
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 8000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }

    let stepRatio = phase === 'in_trip' ? 0.14 : 0.18;
    const startPos = interpolateLiveTrackingPosition(
      endpoints.pickup,
      endpoints.dropoff,
      stepRatio,
      phase
    );
    pushPosition(startPos);

    if (phase === 'arrived_pickup') {
      return;
    }

    const intervalId = window.setInterval(() => {
      stepRatio = Math.min(0.94, stepRatio + 0.06);
      const nextPos = interpolateLiveTrackingPosition(
        endpoints.pickup,
        endpoints.dropoff,
        stepRatio,
        phase
      );
      pushPosition(nextPos);
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [phase, activeOffer?.id, activeOffer?.linkedRideId, liveTrackingSource, preferences.selectedDistrictId]);

  useEffect(() => {
    try {
      const payload: PersistedState = {
        appointments,
        completedTrips,
        preferences,
        driverProfile,
        performanceStats,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [appointments, completedTrips, preferences, driverProfile, performanceStats]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', preferences.darkMode);
    root.classList.toggle('large-assist', preferences.largeAssist);
    root.classList.toggle('reduced-motion', preferences.reducedMotion);
  }, [preferences.darkMode, preferences.largeAssist, preferences.reducedMotion]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const weekAnalysis = useMemo(
    () =>
      computeSeparateEarningsAnalysis(
        completedTrips,
        'week',
        '2026-11-14T23:59:59Z',
        appointments
      ),
    [completedTrips, appointments]
  );

  const incomingCustomerRides = useMemo(
    () => firebase.liveRides.filter((r) => r.status === 'searching'),
    [firebase.liveRides]
  );

  const syncedActiveOffer = useMemo(() => {
    if (!activeOffer) return null;
    if (!activeOffer.linkedRideId) return activeOffer;
    const linked = firebase.liveRides.find((r) => r.id === activeOffer.linkedRideId);
    if (linked && typeof linked.tipInr === 'number' && linked.tipInr !== activeOffer.estimatedTip) {
      return { ...activeOffer, estimatedTip: linked.tipInr };
    }
    return activeOffer;
  }, [activeOffer, firebase.liveRides]);

  const updatePreferences = (partial: Partial<DriverPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...partial }));
  };

  const handleToggleOnline = () => {
    if (phase === 'offline') {
      setPhase('online_idle');
      setToastMessage(
        preferences.emergencyHospitalFirst
          ? 'Online across all 31 Karnataka districts · Emergency Hospital Visit Priority #1.'
          : 'Online across all 31 Karnataka districts · Condition-Optimized Fare Tariff.'
      );
    } else if (phase === 'online_idle' || phase === 'request_incoming' || phase === 'completed') {
      setPhase('offline');
      setActiveOffer(null);
      setActiveCareAptId(null);
      setLastCompletedTripId(null);
    } else {
      setToastMessage('Complete your active trip before going offline.');
    }
  };

  const handleSimulateOffer = (preferredKind?: 'emergency_hospital' | 'care' | 'standard') => {
    const prioritized = sortOffersByPriority(
      QUEUED_RIDE_OFFERS,
      preferences.emergencyHospitalFirst
    );

    let pool = prioritized;
    if (preferredKind === 'emergency_hospital') {
      const emergencyPool = prioritized.filter((o) => o.isEmergencyHospitalVisit);
      if (emergencyPool.length > 0) pool = emergencyPool;
    } else if (preferredKind === 'care') {
      const carePool = prioritized.filter((o) => o.category !== 'standard');
      if (carePool.length > 0) pool = carePool;
    } else if (preferredKind === 'standard') {
      const stdPool = prioritized.filter((o) => o.category === 'standard');
      if (stdPool.length > 0) pool = stdPool;
    }

    const idx = preferredKind === 'emergency_hospital' ? 0 : offerCursor % pool.length;
    const chosen = pool[idx] ?? prioritized[0];
    if (preferredKind !== 'emergency_hospital') {
      setOfferCursor((c) => c + 1);
    }

    const appliedTier = chosen.isEmergencyHospitalVisit
      ? chosen.vehicleTier ?? preferences.selectedVehicleTier
      : preferences.selectedVehicleTier;

    setActiveOffer({
      ...chosen,
      vehicleTier: appliedTier,
      checklist: chosen.checklist.map((item) => ({ ...item, checked: false })),
    });
    setActiveCareAptId(null);
    setPhase('request_incoming');
  };

  const handleAcceptCustomerRide = async (ride: LiveRideOrder) => {
    const offer: RideOffer = {
      id: `live-${ride.id}`,
      linkedRideId: ride.id,
      category: 'standard',
      vehicleTier: ride.vehicleTier,
      isEmergencyHospitalVisit: ride.fareCondition === 'care_priority',
      pricingModel: 'per_km_19',
      serviceLabel: `Customer Booking · ${getVehicleTierLabel(ride.vehicleTier)}`,
      riderName: ride.customerName,
      riderRating: 4.96,
      pickupAddress: ride.pickupLabel,
      dropoffAddress: ride.dropoffLabel,
      pickupCoords: { x: 48, y: 66 },
      dropoffCoords: { x: 64, y: 74 },
      pickupLatLng: ride.pickupLatLng,
      dropoffLatLng: ride.dropoffLatLng,
      pickupEtaMins: 4,
      tripDurationMins: Math.max(12, Math.round(ride.distanceKm * 2.2)),
      distanceMiles: ride.distanceKm,
      baseFare: ride.fareInr,
      surgeMultiplier: 1.0,
      careStipend: 0,
      estimatedTip: ride.tipInr ?? 0,
      accessibilityNotes: `Live customer booking paid via ${ride.paymentMethod.toUpperCase()} (${ride.paymentStatus.toUpperCase()}). Condition: ${ride.fareCondition}.`,
      equipmentRequired: [`${getVehicleTierLabel(ride.vehicleTier)}`],
      graceWaitMins: 5,
      checklist: [
        { id: 'cust-1', label: `Confirm passenger ${ride.customerName} at pickup pin`, checked: false },
      ],
    };

    await firebase.updateLiveRideStatus(ride.id, {
      status: 'en_route',
      driverId: firebase.user?.uid ?? 'drv-vikram-01',
      driverName: driverProfile.fullName,
      driverLat: ride.pickupLatLng.lat - 0.004,
      driverLng: ride.pickupLatLng.lng - 0.003,
    });

    setActiveOffer(offer);
    setActiveCareAptId(null);
    setPhase('en_route_pickup');
    setPerformanceStats((prev) => ({ ...prev, acceptedCount: prev.acceptedCount + 1 }));
    setToastMessage(`Matched to customer ${ride.customerName} · En route to ${ride.pickupLabel}.`);
  };

  const handleSelectDistrict = (district: KarnatakaDistrict) => {
    updatePreferences({ selectedDistrictId: district.id });
    setToastMessage(
      `Karnataka Radar centered on ${district.name} District (${district.headquarters}) · ${district.medicalCenter}.`
    );
  };

  const handleRouteComputed = useCallback(
    (summary: PlannedRouteSummary, routeObj: google.maps.routes.Route | null) => {
      setPlannedRoute(summary);
      setPlannedRouteObj(routeObj);
      setPreferences((prev) => ({
        ...prev,
        selectedVehicleTier: summary.vehicleTier,
        emergencyHospitalFirst: summary.isEmergencyHospitalVisit
          ? true
          : prev.emergencyHospitalFirst,
      }));
    },
    []
  );

  const handleDispatchPlannedRoute = (summary: PlannedRouteSummary) => {
    const tierLabel = getVehicleTierLabel(summary.vehicleTier);
    const rateUsed = summary.effectiveRatePerKm ?? 19;
    const offer: RideOffer = {
      id: `route-${Date.now()}`,
      category: summary.isEmergencyHospitalVisit ? 'care_medical' : 'standard',
      vehicleTier: summary.vehicleTier,
      isEmergencyHospitalVisit: summary.isEmergencyHospitalVisit,
      pricingModel: 'per_km_19',
      serviceLabel: summary.isEmergencyHospitalVisit
        ? `Emergency Hospital Visit · ${tierLabel}`
        : `${tierLabel} · Karnataka Corridor`,
      riderName: summary.isEmergencyHospitalVisit
        ? 'Priority Clinical Dispatch'
        : 'Karnataka Executive Guest',
      riderRating: 4.98,
      pickupAddress: summary.pickup.label,
      dropoffAddress: summary.dropoff.label,
      pickupCoords: { x: 42, y: 68 },
      dropoffCoords: { x: 64, y: 74 },
      pickupLatLng: summary.pickup.location,
      dropoffLatLng: summary.dropoff.location,
      pickupEtaMins: 4,
      tripDurationMins: summary.durationMins,
      distanceMiles: summary.distanceKm,
      baseFare: summary.totalFareInr,
      surgeMultiplier: 1.0,
      careStipend: summary.isEmergencyHospitalVisit ? 450 : 0,
      estimatedTip: summary.isEmergencyHospitalVisit ? 150 : 100,
      accessibilityNotes: summary.isEmergencyHospitalVisit
        ? `Emergency Hospital Visit Priority #1 corridor from ${summary.pickup.formattedAddress} to ${summary.dropoff.formattedAddress}.`
        : `Optimized Karnataka route (${summary.distanceKm} km at ₹${rateUsed.toFixed(1)}/km).`,
      equipmentRequired: summary.isEmergencyHospitalVisit
        ? ['Priority Hospital Corridor', 'First-Aid & Boarding Assist']
        : [`${tierLabel} Dispatch`],
      graceWaitMins: summary.isEmergencyHospitalVisit ? 10 : 5,
      checklist: summary.isEmergencyHospitalVisit
        ? [
            { id: 'rt-1', label: 'Activate Priority Emergency Hospital Corridor', checked: false },
            { id: 'rt-2', label: 'Coordinate hospital ER / portico arrival', checked: false },
          ]
        : [],
    };

    setPlannedRoute(summary);
    setActiveOffer(offer);
    setActiveCareAptId(null);
    setPhase('request_incoming');
    setToastMessage(
      `Dispatched ${summary.distanceKm} km route (${tierLabel}) · ₹${rateUsed.toFixed(1)}/km.`
    );
  };

  const handleStartDemoCalibrationRide = () => {
    const tier = preferences.selectedVehicleTier;
    const tierLabel = getVehicleTierLabel(tier);
    const demoOffer: RideOffer = {
      id: `demo-calibration-${Date.now()}`,
      category: 'standard',
      vehicleTier: tier,
      isEmergencyHospitalVisit: false,
      pricingModel: 'per_km_19',
      serviceLabel: `Company Demo Ride · ${tierLabel}`,
      riderName: 'Company Telemetry Calibration (3 km)',
      riderRating: 5.0,
      pickupAddress: 'Vidhana Soudha, Bengaluru Urban',
      dropoffAddress: 'MG Road Metro Station, Bengaluru',
      pickupCoords: { x: 50, y: 65 },
      dropoffCoords: { x: 58, y: 70 },
      pickupLatLng: { lat: 12.9791, lng: 77.5913 },
      dropoffLatLng: { lat: 12.9756, lng: 77.6066 },
      pickupEtaMins: 2,
      tripDurationMins: 8,
      distanceMiles: 3.0,
      baseFare: 57,
      surgeMultiplier: 1.0,
      careStipend: 0,
      estimatedTip: 0,
      accessibilityNotes: 'Mandatory Company Free Demo Ride for 3.0 km telemetry calibration. Revenue ₹57 credited to driver.',
      equipmentRequired: [`${tierLabel} Certified`],
      graceWaitMins: 5,
      checklist: [
        { id: 'demo-chk-1', label: 'Verify GPS fix & road telemetry calibration', checked: true },
        { id: 'demo-chk-2', label: 'Confirm ₹19/km meter rate & safety limits', checked: true },
      ],
    };

    setActiveOffer(demoOffer);
    setActiveCareAptId(null);
    setPhase('in_trip');
    setActiveTripElapsedSeconds(0);
    setToastMessage('Started Free Company Demo Calibration Ride (3.0 km) · Vidhana Soudha to MG Road.');
  };

  const handleAcceptOffer = () => {
    if (!activeOffer) return;
    setPerformanceStats((prev) => ({
      ...prev,
      acceptedCount: prev.acceptedCount + 1,
    }));
    setPhase('en_route_pickup');
  };

  const handleDeclineOffer = () => {
    setPerformanceStats((prev) => ({
      ...prev,
      declinedCount: prev.declinedCount + 1,
    }));
    setActiveOffer(null);
    setActiveCareAptId(null);
    setPhase('online_idle');
  };

  const handleToggleChecklistItem = (itemId: string) => {
    if (!activeOffer) return;
    setActiveOffer({
      ...activeOffer,
      checklist: activeOffer.checklist.map((c) =>
        c.id === itemId ? { ...c, checked: !c.checked } : c
      ),
    });
  };

  const handleUpdateInTripTip = useCallback(
    (tipInr: number) => {
      const cleanTip = roundCurrency(Math.max(0, tipInr));
      setActiveOffer((prev) => (prev ? { ...prev, estimatedTip: cleanTip } : prev));
      if (activeOffer?.linkedRideId) {
        void firebase.updateLiveRideStatus(activeOffer.linkedRideId, { tipInr: cleanTip });
      }
      setToastMessage(
        cleanTip > 0
          ? `Passenger tip of ₹${cleanTip.toFixed(2)} added · Final earnings summary & total payout updated.`
          : 'Passenger tip cleared (₹0.00) · Final earnings summary updated.'
      );
    },
    [activeOffer?.linkedRideId, firebase]
  );

  const handleAdvanceTripPhase = () => {
    const currentOffer = syncedActiveOffer;
    if (!currentOffer) return;
    const linkedId = currentOffer.linkedRideId;

    if (phase === 'en_route_pickup') {
      setPhase('arrived_pickup');
      if (linkedId && currentOffer.pickupLatLng) {
        void firebase.updateLiveRideStatus(linkedId, {
          status: 'arrived',
          driverLat: currentOffer.pickupLatLng.lat,
          driverLng: currentOffer.pickupLatLng.lng,
        });
      }
      return;
    }

    if (phase === 'arrived_pickup') {
      setPhase('in_trip');
      if (linkedId && currentOffer.pickupLatLng && currentOffer.dropoffLatLng) {
        void firebase.updateLiveRideStatus(linkedId, {
          status: 'in_trip',
          driverLat: (currentOffer.pickupLatLng.lat + currentOffer.dropoffLatLng.lat) / 2,
          driverLng: (currentOffer.pickupLatLng.lng + currentOffer.dropoffLatLng.lng) / 2,
        });
      }
      return;
    }

    if (phase === 'in_trip') {
      const linkedRide = linkedId
        ? firebase.liveRides.find((r) => r.id === linkedId)
        : undefined;
      const finalTip = roundCurrency(linkedRide?.tipInr ?? currentOffer.estimatedTip ?? 0);

      if (linkedId && currentOffer.dropoffLatLng) {
        void firebase.updateLiveRideStatus(linkedId, {
          status: 'completed',
          paymentStatus: 'paid',
          tipInr: finalTip,
          driverLat: currentOffer.dropoffLatLng.lat,
          driverLng: currentOffer.dropoffLatLng.lng,
        });
      }

      const surgeBonus =
        currentOffer.surgeMultiplier > 1
          ? roundCurrency(currentOffer.baseFare * (currentOffer.surgeMultiplier - 1))
          : 0;
      const newTrip: CompletedTrip = {
        id: `TRP-${Math.floor(1000 + Math.random() * 8999)}`,
        category: currentOffer.category,
        vehicleTier: currentOffer.vehicleTier ?? preferences.selectedVehicleTier,
        isEmergencyHospitalVisit: currentOffer.isEmergencyHospitalVisit,
        pricingModel: currentOffer.pricingModel ?? 'per_km_19',
        serviceLabel: currentOffer.serviceLabel,
        riderOrPatientName: currentOffer.riderName,
        routeSummary: `${currentOffer.pickupAddress} -> ${currentOffer.dropoffAddress}`,
        completedAt: '2026-11-14T16:45:00Z',
        durationMins: currentOffer.tripDurationMins,
        distanceMiles: currentOffer.distanceMiles,
        baseFare: currentOffer.baseFare,
        surgeBonus,
        careStipend: currentOffer.careStipend,
        tip: finalTip,
        riderRatingGiven: 5.0,
      };
      setCompletedTrips((prev) => [newTrip, ...prev]);
      setPerformanceStats((prev) => ({
        ...prev,
        completedCount: prev.completedCount + 1,
      }));

      // Deduct flat ₹3 per completed ride and transfer the rest to the linked driver/rider account
      const grossTripFare = roundCurrency(
        newTrip.baseFare + newTrip.surgeBonus + newTrip.careStipend + newTrip.tip
      );
      const flatTransfer = calculateFlatRideTransfer(grossTripFare);
      const payoutTarget = driverProfile.upiId?.trim() || driverProfile.phone || 'vikram.rao@okicici';
      const nowIso = new Date().toISOString();
      void firebase.recordDriverPayout({
        id: `pay-${newTrip.id.toLowerCase()}-${Date.now()}`,
        driverId: firebase.user?.uid ?? 'drv-vikram-01',
        driverName: driverProfile.fullName,
        upiId: payoutTarget,
        grossCollectedInr: flatTransfer.grossFareInr,
        companyFeeInr: flatTransfer.deductedFeeInr,
        netPayoutInr: flatTransfer.transferredNetInr,
        utrReference: `UTR-3R-${newTrip.id}`,
        status: 'reconciled',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      if (activeCareAptId) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === activeCareAptId ? { ...a, completed: true } : a))
        );
      }

      setActiveCareAptId(null);
      setLastCompletedTripId(newTrip.id);
      setPhase('completed');
      setToastMessage(
        `Ride completed · ₹${flatTransfer.deductedFeeInr.toFixed(2)} deducted · ₹${flatTransfer.transferredNetInr.toFixed(2)} transferred to ${payoutTarget}.`
      );
    }
  };

  const handleReturnToRadar = () => {
    setActiveOffer(null);
    setActiveCareAptId(null);
    setLastCompletedTripId(null);
    setPhase('online_idle');
  };

  const handleSavePassengerRating = (tripId: string, rating: PassengerMultiPointRating) => {
    setCompletedTrips((prev) =>
      prev.map((t) => (t.id === tripId ? { ...t, driverPassengerRating: rating } : t))
    );
    setToastMessage('Multi-point passenger rating and care notes saved to Trip History.');
  };

  const handleToggleClaimAppointment = (id: string) => {
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === id ? { ...apt, claimed: !apt.claimed } : apt))
    );
  };

  const handleStartCareTrip = (appointment: CareAppointment) => {
    const offer = appointmentToRideOffer(appointment);
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointment.id ? { ...a, claimed: true } : a))
    );
    setActiveOffer(offer);
    setActiveCareAptId(appointment.id);
    setPhase('en_route_pickup');
    setPortalMode('driver');
    setActiveTab('drive');
    setToastMessage(`Special appointment trip dispatched for ${appointment.patientName}.`);
  };

  const handleCreateCareBooking = (created: CareAppointment) => {
    setAppointments((prev) => [created, ...prev]);
    setToastMessage(`Pre-scheduled Special Appointment for ${created.patientName}.`);
  };

  const handleResetDemoData = () => {
    setAppointments(INITIAL_CARE_APPOINTMENTS);
    setCompletedTrips(INITIAL_COMPLETED_TRIPS);
    setPreferences(INITIAL_DRIVER_PREFERENCES);
    setDriverProfile(INITIAL_DRIVER_PROFILE);
    setPerformanceStats(INITIAL_DRIVER_PERFORMANCE);
    setPlannedRoute(null);
    setPlannedRouteObj(null);
    setPhase('offline');
    setActiveOffer(null);
    setActiveCareAptId(null);
    window.localStorage.removeItem(STORAGE_KEY);
    setToastMessage('Karnataka 31-district sample data, optimizer defaults, and profile restored.');
  };

  const navItems: { id: AppTab; label: string; shortLabel: string; icon: typeof Navigation }[] = [
    { id: 'drive', label: 'Drive', shortLabel: 'Drive', icon: Navigation },
    { id: 'care', label: 'Special Care', shortLabel: 'Care', icon: HeartPulse },
    { id: 'auto', label: 'Auto Drivers', shortLabel: 'Auto', icon: Car },
    { id: 'documents', label: 'Docs Audit', shortLabel: 'Docs', icon: FileCheck },
    { id: 'earnings', label: 'Analytics', shortLabel: 'Pay', icon: BarChart3 },
    { id: 'access', label: 'Profile', shortLabel: 'Profile', icon: UserCheck },
  ];

  const isDriverActive = phase !== 'offline';

  return (
    <GoogleMapsSdkProvider quotaExceeded={mapsQuotaExceeded}>
      <div className="min-h-screen aurelia-genz-bg text-stone-900 dark:text-stone-100 flex flex-col">
        {mapsQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached (using built-in Karnataka 31-district fallback). If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Top Bar (Strict 3-Zone Contract on Desktop) */}
        <header className="sticky top-0 z-30 h-14 bg-white/75 dark:bg-[#0D0F16]/80 backdrop-blur-xl border-b border-stone-200/80 dark:border-white/10">
          <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                setPortalMode('driver');
                setActiveTab('drive');
              }}
              className="font-display text-xl font-bold tracking-[0.18em] text-stone-900 dark:text-[#E6C77E] whitespace-nowrap shrink-0 cursor-pointer"
            >
              AURELIA
            </button>

            <nav aria-label="Primary sections" className="hidden md:flex items-center gap-5">
              {portalMode === 'driver' &&
                navItems.map((item) => {
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`min-h-[44px] px-2 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                        active
                          ? 'border-[#B48A3E] text-[#9A722A] dark:border-[#D4AF63] dark:text-[#E6C77E]'
                          : 'border-transparent text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              {portalMode === 'customer' && (
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9A722A] dark:text-[#E6C77E] whitespace-nowrap">
                  Customer App · Fair Fare &amp; CCAvenue
                </span>
              )}
              {portalMode === 'admin' && (
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9A722A] dark:text-[#E6C77E] whitespace-nowrap">
                  Admin Operations · Approvals &amp; Reconciliation
                </span>
              )}
            </nav>

            <div className="flex items-center gap-2">
              <PWAInstallButton />

              <button
                type="button"
                onClick={() => setChatbotOpen(true)}
                className="min-h-[40px] px-3 py-1.5 rounded-2xl bg-amber-500/15 dark:bg-amber-400/20 border border-amber-300 dark:border-amber-500/40 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AI Chat</span>
              </button>

              <button
                type="button"
                onClick={() => setGameOpen(true)}
                className="min-h-[40px] px-3 py-1.5 rounded-2xl bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/15 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-200/70 dark:hover:bg-white/20 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Game</span>
              </button>

              <button
                type="button"
                onClick={handleToggleOnline}
                className={`min-h-[40px] px-4 py-1.5 rounded-2xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isDriverActive
                    ? 'bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white'
                    : 'bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isDriverActive ? 'Online' : 'Go Online'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Portal Switcher Strip (Driver App · Customer App · Admin Panel) */}
        <div className="bg-white/60 dark:bg-[#0D0F16]/60 backdrop-blur-md border-b border-stone-200/70 dark:border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Portal Switcher">
              <button
                type="button"
                role="tab"
                aria-selected={portalMode === 'driver'}
                data-testid="portal-driver-btn"
                onClick={() => setPortalMode('driver')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  portalMode === 'driver'
                    ? 'bg-stone-900 dark:bg-[#E6C77E] text-white dark:text-stone-950 shadow-sm'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-white/10'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Driver App</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={portalMode === 'customer'}
                data-testid="portal-customer-btn"
                onClick={() => setPortalMode('customer')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  portalMode === 'customer'
                    ? 'bg-stone-900 dark:bg-[#E6C77E] text-white dark:text-stone-950 shadow-sm'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-white/10'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Customer App</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={portalMode === 'admin'}
                data-testid="portal-admin-btn"
                onClick={() => setPortalMode('admin')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  portalMode === 'admin'
                    ? 'bg-stone-900 dark:bg-[#E6C77E] text-white dark:text-stone-950 shadow-sm'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-white/10'
                }`}
              >
                {adminUnlocked ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                <span>Admin Panel</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono-tabular text-stone-500 dark:text-stone-400 shrink-0">
              <span>
                {firebase.user
                  ? `Firebase: ${firebase.user.email || firebase.user.phoneNumber || firebase.user.uid.slice(0, 8)}`
                  : 'Local Sandbox Ready'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{incomingCustomerRides.length} Live Requests</span>
            </div>
          </div>
        </div>

        {/* Main Content Workspace */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-24 md:pb-8">
          {toastMessage && (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 px-4 py-3 rounded-2xl bg-[#101218]/90 backdrop-blur-xl border border-amber-500/30 text-stone-100 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 shadow-lg"
            >
              <span>{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-[#D4AF63] hover:text-white text-xs font-semibold shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {portalMode === 'customer' && (
            <CustomerBookingView
              activeCondition={preferences.activeFareCondition ?? 'off_peak_corridor'}
              liveRides={firebase.liveRides}
              currentUserUid={firebase.user?.uid}
              verifiedPhoneNumber={firebase.verifiedPhoneNumber}
              onSendFirebasePhoneOtp={firebase.sendPhoneOtpViaFirebase}
              onVerifyFirebasePhoneOtp={firebase.verifyPhoneOtpViaFirebase}
              onChangeCondition={(cond) => updatePreferences({ activeFareCondition: cond })}
              onCreateRide={firebase.createLiveRideOrder}
              onUpdateRideStatus={firebase.updateLiveRideStatus}
              onSubmitComplaint={firebase.submitSupportComplaint}
              onNotify={(msg) => setToastMessage(msg)}
            />
          )}

          {portalMode === 'admin' &&
            (adminUnlocked ? (
              <AdminPanelView
                isAuthenticatedAdmin={firebase.isAdminUser}
                adminEmailHint={BOOTSTRAPPED_ADMIN_EMAIL}
                applicants={firebase.fleetApplicants}
                liveRides={firebase.liveRides}
                payouts={firebase.payouts}
                complaints={firebase.complaints}
                onApproveApplicant={firebase.updateApplicantApprovalAdmin}
                onUpdateRideStatus={firebase.updateLiveRideStatus}
                onReconcilePayout={firebase.reconcilePayoutAdmin}
                onResolveComplaint={firebase.updateComplaintStatusAdmin}
                onLockAdmin={() => {
                  try {
                    window.sessionStorage.removeItem('aurelia_admin_unlocked');
                  } catch {
                    // Ignore storage error
                  }
                  setAdminUnlocked(false);
                  setToastMessage('Admin Panel locked.');
                }}
                onNotify={(msg) => setToastMessage(msg)}
              />
            ) : (
              <AdminLockGate
                onUnlock={() => {
                  try {
                    window.sessionStorage.setItem('aurelia_admin_unlocked', '1');
                  } catch {
                    // Ignore storage error
                  }
                  setAdminUnlocked(true);
                  setToastMessage('Admin Panel unlocked.');
                }}
                onCancel={() => setPortalMode('driver')}
              />
            ))}

          {portalMode === 'driver' && (
            <>
              {activeTab === 'drive' && (
                <DriveCockpit
                  phase={phase}
                  activeOffer={syncedActiveOffer}
                  careAppointments={appointments}
                  incomingCustomerRides={incomingCustomerRides}
                  preferences={preferences}
                  plannedRoute={plannedRoute}
                  plannedRouteObj={plannedRouteObj}
                  driverLivePosition={driverLivePosition}
                  liveTrackingSource={liveTrackingSource}
                  elapsedTripSeconds={activeTripElapsedSeconds}
                  onToggleLiveTrackingSource={() =>
                    setLiveTrackingSource((prev) =>
                      prev === 'device_gps' ? 'corridor_sim' : 'device_gps'
                    )
                  }
                  onNotify={(msg) => setToastMessage(msg)}
                  onTripDurationOverrunAlert={(warning) =>
                    setToastMessage(
                      `Duration Warning (+${warning.overrunPercent}%): Trip exceeded ${warning.estimatedMins}m estimate. Notify rider.`
                    )
                  }
                  onToggleOnline={handleToggleOnline}
                  onSimulateOffer={handleSimulateOffer}
                  onAcceptCustomerRide={(ride) => void handleAcceptCustomerRide(ride)}
                  onAcceptOffer={handleAcceptOffer}
                  onDeclineOffer={handleDeclineOffer}
                  onAdvanceTripPhase={handleAdvanceTripPhase}
                  onReturnToRadar={handleReturnToRadar}
                  onOpenCompletedRating={
                    lastCompletedTripId ? () => setPendingRatingTripId(lastCompletedTripId) : undefined
                  }
                  onUpdateTripTip={handleUpdateInTripTip}
                  onToggleChecklistItem={handleToggleChecklistItem}
                  onUpdatePreferences={updatePreferences}
                  onSelectDistrict={handleSelectDistrict}
                  onRouteComputed={handleRouteComputed}
                  onDispatchPlannedRoute={handleDispatchPlannedRoute}
                  onGoToCareHub={() => setActiveTab('care')}
                  onStartDemoRide={handleStartDemoCalibrationRide}
                />
              )}

              {activeTab === 'care' && (
                <CareAppointmentsView
                  appointments={appointments}
                  careNetThisWeek={weekAnalysis.care.netEarnings}
                  careTripsThisWeek={weekAnalysis.care.tripCount}
                  emergencyHospitalFirst={preferences.emergencyHospitalFirst}
                  onToggleClaim={handleToggleClaimAppointment}
                  onStartCareTrip={handleStartCareTrip}
                  onCreateBooking={handleCreateCareBooking}
                  onOpenCareAnalytics={() => setActiveTab('earnings')}
                />
              )}

              {activeTab === 'auto' && (
                <AutoDriversView
                  driverProfile={driverProfile}
                  selectedDistrictId={preferences.selectedDistrictId}
                />
              )}

              {activeTab === 'documents' && (
                <DocumentVerificationView
                  driverProfile={driverProfile}
                  onUpdateDocuments={(patch) => {
                    const updated = { ...driverProfile, ...patch };
                    setDriverProfile(updated);
                    void firebase.syncDriverAccountToFirestore(updated, preferences);
                  }}
                />
              )}

              {activeTab === 'earnings' && (
                <EarningsAnalyticsView
                  trips={completedTrips}
                  openAppointments={appointments}
                  performanceStats={performanceStats}
                  driverId={firebase.user?.uid ?? 'drv-vikram-01'}
                  driverName={driverProfile.fullName}
                  driverPhone={driverProfile.phone}
                  driverUpiId={driverProfile.upiId ?? 'vikram.rao@okicici'}
                  driverQrPayload={driverProfile.qrUpiPayload}
                  driverQrDataUrl={driverProfile.qrCodeDataUrl}
                  payouts={firebase.payouts}
                  onRecordPayout={firebase.recordDriverPayout}
                  onSavePassengerRating={handleSavePassengerRating}
                />
              )}

              {activeTab === 'access' && (
                <AccessProfileView
                  profile={driverProfile}
                  preferences={preferences}
                  completedTrips={completedTrips}
                  firebaseUser={firebase.user}
                  verifiedPhoneNumber={firebase.verifiedPhoneNumber}
                  isAdminUser={firebase.isAdminUser}
                  connectionOk={firebase.connectionOk}
                  onSignInGoogle={firebase.signInWithGoogle}
                  onSignOut={firebase.signOutUser}
                  onSendFirebasePhoneOtp={firebase.sendPhoneOtpViaFirebase}
                  onVerifyFirebasePhoneOtp={firebase.verifyPhoneOtpViaFirebase}
                  onSaveProfile={(updated) => {
                    setDriverProfile(updated);
                    void firebase.syncDriverAccountToFirestore(updated, preferences);
                  }}
                  onUpdatePreferences={updatePreferences}
                  onResetDemoData={handleResetDemoData}
                />
              )}
            </>
          )}

          {pendingRatingTripId && (() => {
            const tripToRate = completedTrips.find((t) => t.id === pendingRatingTripId);
            if (!tripToRate) return null;
            return (
              <PassengerRatingModal
                trip={tripToRate}
                onClose={() => setPendingRatingTripId(null)}
                onSave={(id, rating) => {
                  handleSavePassengerRating(id, rating);
                  setPendingRatingTripId(null);
                }}
              />
            );
          })()}
        </main>

        {/* Mobile Bottom Thumb-Zone Navigation Bar */}
        {portalMode === 'driver' && (
          <nav
            aria-label="Mobile bottom navigation"
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/85 dark:bg-[#0D0F16]/90 backdrop-blur-xl border-t border-stone-200/80 dark:border-white/10 grid grid-cols-6 items-center"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                    active
                      ? 'text-[#9A722A] dark:text-[#E6C77E]'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="whitespace-nowrap">{item.shortLabel}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Driver Onboarding & Demo Ride Modal */}
        {!onboardingVerified && (
          <DriverOnboardingModal
            verifiedPhoneNumber={firebase.verifiedPhoneNumber}
            onSendFirebasePhoneOtp={firebase.sendPhoneOtpViaFirebase}
            onVerifyFirebasePhoneOtp={firebase.verifyPhoneOtpViaFirebase}
            onSwitchPortal={(target) => {
              setPortalMode(target);
              setOnboardingVerified(true);
            }}
            onComplete={(profile, tier) => {
              setDriverProfile(profile);
              const nextPrefs: DriverPreferences = {
                ...preferences,
                selectedVehicleTier: tier === 'auto' ? 'car_economy' : tier,
              };
              setPreferences(nextPrefs);
              void firebase.syncDriverAccountToFirestore(profile, nextPrefs);
              setOnboardingVerified(true);
              setToastMessage('Driver onboarding, document upload & demo ride submitted for approval!');
            }}
          />
        )}

        {/* Gemini AI Chatbot Modal */}
        <AiChatbotModal isOpen={chatbotOpen} onClose={() => setChatbotOpen(false)} />

        {/* Aurelia Driving Game Modal */}
        <AureliaDrivingGameModal isOpen={gameOpen} onClose={() => setGameOpen(false)} />

        {/* Offline Connectivity Indicator */}
        <OfflineIndicator />
      </div>
    </GoogleMapsSdkProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <AureliaWorkspace />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
