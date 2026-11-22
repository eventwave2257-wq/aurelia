import { KARNATAKA_31_DISTRICTS, KARNATAKA_LANDMARKS, VEHICLE_TIER_OPTIONS } from '../data/karnatakaDistricts';
import type {
  CareAppointment,
  CareCategoryBreakdownItem,
  CategoryEarningsMetrics,
  ComparisonVehicleMode,
  CompetitorBrand,
  CompetitorPerKmQuote,
  CompletedTrip,
  DailyComparisonPoint,
  DistrictEmergencyContacts,
  DriverPayoutRecord,
  DriverPerformanceStats,
  DriverProfileData,
  DriverTripPhase,
  EarningsPeriod,
  FareConditionId,
  FlatRideTransferSummary,
  GeoPoint,
  InTripPayoutPreview,
  KarnatakaDistrict,
  LiveRideOrder,
  LiveRideStatus,
  LiveTrackingMetrics,
  NewCareBookingInput,
  PassengerMultiPointRating,
  PeakWindowMetric,
  PerRideTransferEntry,
  PricingModel,
  RideCategory,
  RideOffer,
  SelectedPlacePoint,
  SeparateEarningsSummary,
  SpeedLimitPolicy,
  SpeedViolationEvaluation,
  TripCompletionProgress,
  TripCompletionStep,
  TripDurationWarning,
  TrafficRiskEstimation,
  VehicleTier,
  WinWinFareEvaluation,
} from '../types/aurelia';

export const STANDARD_PLATFORM_FEE_RATE = 0.18;
export const CARE_PLATFORM_FEE_RATE = 0; // 0% commission on legacy care rides without per-km pricing
export const RATE_PER_KM_INR = 19; // ₹19 per km total ride rate
export const COMPANY_MAINTENANCE_FEE_PER_KM_INR = 3; // ₹3 per km to AURELIA company for maintenance & service
export const DRIVER_NET_PER_KM_INR = RATE_PER_KM_INR - COMPANY_MAINTENANCE_FEE_PER_KM_INR; // ₹16 per km driver earnings

export const BIKE_SPEED_LIMIT_KMH = 50;
export const BIKE_SPEED_FINE_INR = 40;
export const CAR_SPEED_LIMIT_KMH = 95;
export const CAR_SPEED_FINE_INR = 80;

export function getSpeedLimitPolicy(vehicleTier: VehicleTier): SpeedLimitPolicy {
  if (vehicleTier === 'bike') {
    return {
      maxSpeedKmh: BIKE_SPEED_LIMIT_KMH,
      fineInr: BIKE_SPEED_FINE_INR,
      categoryLabel: 'Bike',
    };
  }
  return {
    maxSpeedKmh: CAR_SPEED_LIMIT_KMH,
    fineInr: CAR_SPEED_FINE_INR,
    categoryLabel: 'Cars',
  };
}

export function evaluateSpeedViolation(
  speedKmh: number,
  vehicleTier: VehicleTier
): SpeedViolationEvaluation {
  const safeSpeed = Math.max(0, Math.round(speedKmh));
  const policy = getSpeedLimitPolicy(vehicleTier);
  const exceeded = safeSpeed > policy.maxSpeedKmh;
  return {
    exceeded,
    speedKmh: safeSpeed,
    maxSpeedKmh: policy.maxSpeedKmh,
    overByKmh: exceeded ? safeSpeed - policy.maxSpeedKmh : 0,
    fineInr: exceeded ? policy.fineInr : 0,
    categoryLabel: policy.categoryLabel,
  };
}

const DISTRICT_CONTACT_DIRECTORY: Record<
  string,
  {
    policeTitle: string;
    policeControlPhone: string;
    hospitalDeskPhone: string;
  }
> = {
  bagalkot: {
    policeTitle: 'Bagalkot District Police Control Room',
    policeControlPhone: '08354-235333',
    hospitalDeskPhone: '08354-235400',
  },
  ballari: {
    policeTitle: 'Ballari District Police Control Room',
    policeControlPhone: '08392-258100',
    hospitalDeskPhone: '08392-235200',
  },
  belagavi: {
    policeTitle: 'Belagavi City Police Commissionerate',
    policeControlPhone: '0831-2405231',
    hospitalDeskPhone: '0831-2473777',
  },
  'bengaluru-rural': {
    policeTitle: 'Bengaluru Rural District Police Control',
    policeControlPhone: '080-22256369',
    hospitalDeskPhone: '080-27681100',
  },
  'bengaluru-urban': {
    policeTitle: 'Bengaluru City Police Command Center',
    policeControlPhone: '080-22942222',
    hospitalDeskPhone: '080-25024444',
  },
  bidar: {
    policeTitle: 'Bidar District Police Control Room',
    policeControlPhone: '08482-226700',
    hospitalDeskPhone: '08482-229421',
  },
  chamarajanagar: {
    policeTitle: 'Chamarajanagar District Police Control',
    policeControlPhone: '08226-222383',
    hospitalDeskPhone: '08226-222108',
  },
  chikkaballapura: {
    policeTitle: 'Chikkaballapura District Police Control',
    policeControlPhone: '08156-277100',
    hospitalDeskPhone: '08156-272200',
  },
  chikkamagaluru: {
    policeTitle: 'Chikkamagaluru District Police Control',
    policeControlPhone: '08262-230540',
    hospitalDeskPhone: '08262-231108',
  },
  chitradurga: {
    policeTitle: 'Chitradurga District Police Control',
    policeControlPhone: '08194-222782',
    hospitalDeskPhone: '08194-222666',
  },
  'dakshina-kannada': {
    policeTitle: 'Mangaluru City & DK Police Control',
    policeControlPhone: '0824-2220500',
    hospitalDeskPhone: '0824-2445858',
  },
  davanagere: {
    policeTitle: 'Davanagere District Police Control',
    policeControlPhone: '08192-253400',
    hospitalDeskPhone: '08192-266300',
  },
  dharwad: {
    policeTitle: 'Hubballi-Dharwad Police Commissionerate',
    policeControlPhone: '0836-2233555',
    hospitalDeskPhone: '0836-2477777',
  },
  gadag: {
    policeTitle: 'Gadag District Police Control Room',
    policeControlPhone: '08372-238100',
    hospitalDeskPhone: '08372-237200',
  },
  hassan: {
    policeTitle: 'Hassan District Police Control Room',
    policeControlPhone: '08172-268845',
    hospitalDeskPhone: '08172-268200',
  },
  haveri: {
    policeTitle: 'Haveri District Police Control Room',
    policeControlPhone: '08375-232800',
    hospitalDeskPhone: '08375-233108',
  },
  kalaburagi: {
    policeTitle: 'Kalaburagi City Police Commissionerate',
    policeControlPhone: '08472-263604',
    hospitalDeskPhone: '08472-220108',
  },
  kodagu: {
    policeTitle: 'Kodagu (Madikeri) Police Control Room',
    policeControlPhone: '08272-228330',
    hospitalDeskPhone: '08272-225444',
  },
  kolar: {
    policeTitle: 'Kolar District Police Control Room',
    policeControlPhone: '08152-243066',
    hospitalDeskPhone: '08152-243333',
  },
  koppal: {
    policeTitle: 'Koppal District Police Control Room',
    policeControlPhone: '08539-230111',
    hospitalDeskPhone: '08539-221108',
  },
  mandya: {
    policeTitle: 'Mandya District Police Control Room',
    policeControlPhone: '08232-224888',
    hospitalDeskPhone: '08232-220108',
  },
  mysuru: {
    policeTitle: 'Mysuru City Police Command Center',
    policeControlPhone: '0821-2418339',
    hospitalDeskPhone: '0821-2568888',
  },
  raichur: {
    policeTitle: 'Raichur District Police Control Room',
    policeControlPhone: '08532-226100',
    hospitalDeskPhone: '08532-238488',
  },
  ramanagara: {
    policeTitle: 'Ramanagara District Police Control',
    policeControlPhone: '080-27271600',
    hospitalDeskPhone: '080-27272108',
  },
  shivamogga: {
    policeTitle: 'Shivamogga District Police Control',
    policeControlPhone: '08182-261400',
    hospitalDeskPhone: '08182-222299',
  },
  tumakuru: {
    policeTitle: 'Tumakuru District Police Control',
    policeControlPhone: '0816-2278000',
    hospitalDeskPhone: '0816-2200108',
  },
  udupi: {
    policeTitle: 'Udupi District Police Control Room',
    policeControlPhone: '0820-2526444',
    hospitalDeskPhone: '0820-2922761',
  },
  'uttara-kannada': {
    policeTitle: 'Uttara Kannada (Karwar) Police Control',
    policeControlPhone: '08382-226333',
    hospitalDeskPhone: '08382-226108',
  },
  vijayanagara: {
    policeTitle: 'Vijayanagara (Hosapete) Police Control',
    policeControlPhone: '08394-224100',
    hospitalDeskPhone: '08394-225108',
  },
  vijayapura: {
    policeTitle: 'Vijayapura District Police Control',
    policeControlPhone: '08352-250844',
    hospitalDeskPhone: '08352-262770',
  },
  yadgir: {
    policeTitle: 'Yadgir District Police Control Room',
    policeControlPhone: '08473-253711',
    hospitalDeskPhone: '08473-252108',
  },
};

export function getDistrictEmergencyContacts(districtId: string): DistrictEmergencyContacts {
  const district: KarnatakaDistrict =
    KARNATAKA_31_DISTRICTS.find((d) => d.id === districtId) ??
    KARNATAKA_31_DISTRICTS.find((d) => d.id === 'bengaluru-urban') ??
    KARNATAKA_31_DISTRICTS[0];

  const entry = DISTRICT_CONTACT_DIRECTORY[district.id] ?? {
    policeTitle: `${district.name} District Police Control Room`,
    policeControlPhone: '112',
    hospitalDeskPhone: '108',
  };

  return {
    districtId: district.id,
    districtName: district.name,
    headquarters: district.headquarters,
    division: district.division,
    highwayCode: district.highwayCode,
    police: {
      title: entry.policeTitle,
      emergencyDial: '112 / 100',
      controlRoomPhone: entry.policeControlPhone,
      jurisdiction: `${district.headquarters}, ${district.name} District`,
    },
    hospital: {
      name: district.medicalCenter,
      emergencyDial: '108',
      deskPhone: entry.hospitalDeskPhone,
      address: `${district.headquarters}, ${district.name}, Karnataka`,
    },
    emergencyServices: [
      {
        label: 'Arogya Kavacha Emergency Ambulance',
        phone: '108',
        detail: `24×7 ALS/BLS trauma & cardiac dispatch for ${district.name}`,
      },
      {
        label: 'Karnataka Highway Trauma Patrol',
        phone: '1033',
        detail: `Rapid roadside emergency support along ${district.highwayCode}`,
      },
      {
        label: 'Fire & Rescue Services',
        phone: '101',
        detail: `${district.headquarters} Fire & Extrication Station`,
      },
      {
        label: 'Karnataka Unified Emergency (ERSS)',
        phone: '112',
        detail: `Single-number police, medical & women safety triage`,
      },
    ],
  };
}

export function isCareCategory(category: RideCategory): boolean {
  return category !== 'standard';
}

export function getCategoryDisplayLabel(category: RideCategory): string {
  switch (category) {
    case 'standard':
      return 'Standard Ride';
    case 'care_wheelchair':
      return 'Wheelchair Mobility';
    case 'care_medical':
      return 'Medical & Dialysis';
    case 'care_sensory':
      return 'Sensory & Cognitive';
    case 'care_oxygen':
      return 'Post-Op & Oxygen';
  }
}

export function getVehicleTierLabel(tier: VehicleTier = 'car_elite'): string {
  return VEHICLE_TIER_OPTIONS.find((v) => v.id === tier)?.label ?? 'Car (Elite)';
}

export function calculatePerKmFareBreakdown(
  distanceKm: number,
  careStipend = 0,
  tip = 0
): {
  distanceKm: number;
  totalDistanceFare: number;
  companyMaintenanceFee: number;
  driverDistanceEarnings: number;
  netDriverPayout: number;
} {
  const safeKm = Math.max(0, Math.round(distanceKm * 10) / 10);
  const totalDistanceFare = roundCurrency(safeKm * RATE_PER_KM_INR);
  const companyMaintenanceFee = roundCurrency(safeKm * COMPANY_MAINTENANCE_FEE_PER_KM_INR);
  const driverDistanceEarnings = roundCurrency(totalDistanceFare - companyMaintenanceFee);
  const netDriverPayout = roundCurrency(driverDistanceEarnings + careStipend + tip);
  return {
    distanceKm: safeKm,
    totalDistanceFare,
    companyMaintenanceFee,
    driverDistanceEarnings,
    netDriverPayout,
  };
}

export function estimateRoadDistanceKm(from: GeoPoint, to: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineKm = R * c;
  // Road factor 1.25 approximates Karnataka highway/urban road curvature
  return Math.max(0.5, Math.round(straightLineKm * 1.25 * 10) / 10);
}

export function sortOffersByPriority(
  offers: RideOffer[],
  emergencyHospitalFirst: boolean
): RideOffer[] {
  return [...offers].sort((a, b) => {
    if (emergencyHospitalFirst) {
      const aEmergency = Boolean(a.isEmergencyHospitalVisit);
      const bEmergency = Boolean(b.isEmergencyHospitalVisit);
      if (aEmergency !== bEmergency) return aEmergency ? -1 : 1;
    }
    const aCare = isCareCategory(a.category);
    const bCare = isCareCategory(b.category);
    if (aCare !== bCare) return aCare ? -1 : 1;
    return 0;
  });
}

export function sortCareAppointmentsByPriority(
  appointments: CareAppointment[],
  emergencyHospitalFirst: boolean
): CareAppointment[] {
  return [...appointments].sort((a, b) => {
    if (emergencyHospitalFirst) {
      const aPriority = Boolean(a.isEmergencyHospitalVisit) || a.priorityLevel === 'Critical Care';
      const bPriority = Boolean(b.isEmergencyHospitalVisit) || b.priorityLevel === 'Critical Care';
      if (aPriority !== bPriority) return aPriority ? -1 : 1;
    }
    return a.scheduledTime.localeCompare(b.scheduledTime);
  });
}

export function searchKarnatakaDirectory(query: string, limit = 6): SelectedPlacePoint[] {
  const q = query.trim().toLowerCase();
  const landmarkMatches: SelectedPlacePoint[] = KARNATAKA_LANDMARKS.filter(
    (lm) =>
      !q ||
      lm.title.toLowerCase().includes(q) ||
      lm.subtitle.toLowerCase().includes(q) ||
      lm.district.toLowerCase().includes(q)
  ).map((lm) => ({
    label: lm.title,
    formattedAddress: lm.subtitle,
    location: { lat: lm.lat, lng: lm.lng },
    source: 'karnataka_directory',
  }));

  const districtMatches: SelectedPlacePoint[] = KARNATAKA_31_DISTRICTS.filter(
    (d) =>
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.headquarters.toLowerCase().includes(q) ||
      d.medicalCenter.toLowerCase().includes(q)
  ).map((d) => ({
    label: `${d.name} District Hub`,
    formattedAddress: `${d.headquarters}, ${d.name}, Karnataka`,
    location: { lat: d.lat, lng: d.lng },
    source: 'karnataka_directory',
  }));

  return [...landmarkMatches, ...districtMatches].slice(0, limit);
}

export function calculateAcceptanceRate(
  stats: Pick<DriverPerformanceStats, 'acceptedCount' | 'declinedCount'>
): number {
  const total = stats.acceptedCount + stats.declinedCount;
  if (total <= 0) return 100;
  return Math.round((stats.acceptedCount / total) * 100);
}

export function calculateTripFinancials(
  trip: Pick<CompletedTrip, 'category' | 'baseFare' | 'surgeBonus' | 'careStipend' | 'tip'> & {
    pricingModel?: PricingModel;
    distanceMiles?: number;
  }
): {
  grossBeforeTip: number;
  platformFee: number;
  netPayout: number;
} {
  const grossBeforeTip = roundCurrency(trip.baseFare + trip.surgeBonus + trip.careStipend);

  if (trip.pricingModel === 'per_km_19' && typeof trip.distanceMiles === 'number') {
    const companyMaintenance = roundCurrency(
      Math.max(0, trip.distanceMiles) * COMPANY_MAINTENANCE_FEE_PER_KM_INR
    );
    const platformFee = Math.min(companyMaintenance, trip.baseFare);
    const netPayout = roundCurrency(grossBeforeTip - platformFee + trip.tip);
    return { grossBeforeTip, platformFee, netPayout };
  }

  const feeRate = isCareCategory(trip.category) ? CARE_PLATFORM_FEE_RATE : STANDARD_PLATFORM_FEE_RATE;
  const feeableAmount = trip.baseFare + trip.surgeBonus;
  const platformFee = roundCurrency(feeableAmount * feeRate);
  const netPayout = roundCurrency(grossBeforeTip - platformFee + trip.tip);
  return { grossBeforeTip, platformFee, netPayout };
}

export function calculateOfferEstimatedNet(offer: RideOffer): number {
  const financials = calculateTripFinancials({
    category: offer.category,
    pricingModel: offer.pricingModel,
    distanceMiles: offer.distanceMiles,
    baseFare: offer.baseFare,
    surgeBonus: offer.surgeMultiplier > 1 ? roundCurrency(offer.baseFare * (offer.surgeMultiplier - 1)) : 0,
    careStipend: offer.careStipend,
    tip: offer.estimatedTip,
  });
  return financials.netPayout;
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  const hrs = Math.floor(mins / 60);
  const rem = Math.round(mins % 60);
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

export function filterTripsByPeriod(
  trips: CompletedTrip[],
  period: EarningsPeriod,
  referenceDateIso = '2026-11-14T23:59:59Z'
): CompletedTrip[] {
  const refDate = new Date(referenceDateIso);
  const refDayKey = toUtcDayKey(refDate);

  return trips.filter((trip) => {
    const tripDate = new Date(trip.completedAt);
    if (Number.isNaN(tripDate.getTime())) return false;
    if (period === 'today') {
      return toUtcDayKey(tripDate) === refDayKey;
    }
    const diffMs = refDate.getTime() - tripDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (period === 'week') {
      return diffDays >= 0 && diffDays <= 7;
    }
    return diffDays >= 0 && diffDays <= 30;
  });
}

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function aggregateMetrics(trips: CompletedTrip[]): CategoryEarningsMetrics {
  if (trips.length === 0) {
    return {
      tripCount: 0,
      activeMinutes: 0,
      totalMiles: 0,
      grossFares: 0,
      surgeBonuses: 0,
      careStipends: 0,
      tips: 0,
      platformFees: 0,
      netEarnings: 0,
      avgNetPerTrip: 0,
      hourlyRate: 0,
    };
  }

  let activeMinutes = 0;
  let totalMiles = 0;
  let grossFares = 0;
  let surgeBonuses = 0;
  let careStipends = 0;
  let tips = 0;
  let platformFees = 0;
  let netEarnings = 0;

  for (const trip of trips) {
    const fin = calculateTripFinancials(trip);
    activeMinutes += trip.durationMins;
    totalMiles += trip.distanceMiles;
    grossFares += trip.baseFare;
    surgeBonuses += trip.surgeBonus;
    careStipends += trip.careStipend;
    tips += trip.tip;
    platformFees += fin.platformFee;
    netEarnings += fin.netPayout;
  }

  const tripCount = trips.length;
  const roundedNet = roundCurrency(netEarnings);
  const hours = activeMinutes / 60;

  return {
    tripCount,
    activeMinutes: Math.round(activeMinutes),
    totalMiles: Math.round(totalMiles * 10) / 10,
    grossFares: roundCurrency(grossFares),
    surgeBonuses: roundCurrency(surgeBonuses),
    careStipends: roundCurrency(careStipends),
    tips: roundCurrency(tips),
    platformFees: roundCurrency(platformFees),
    netEarnings: roundedNet,
    avgNetPerTrip: roundCurrency(roundedNet / tripCount),
    hourlyRate: hours > 0 ? roundCurrency(roundedNet / hours) : 0,
  };
}

function computePeakWindows(trips: CompletedTrip[]): PeakWindowMetric[] {
  const buckets: PeakWindowMetric[] = [
    { id: 'morning', label: 'Morning Clinic Peak', timeRange: '06:00–10:59', standardNet: 0, careNet: 0, tripCount: 0 },
    { id: 'midday', label: 'Midday Therapy & Dialysis', timeRange: '11:00–14:59', standardNet: 0, careNet: 0, tripCount: 0 },
    { id: 'evening', label: 'Evening Metro Rush', timeRange: '15:00–19:59', standardNet: 0, careNet: 0, tripCount: 0 },
    { id: 'night', label: 'Evening Discharge', timeRange: '20:00–23:59', standardNet: 0, careNet: 0, tripCount: 0 },
  ];

  for (const trip of trips) {
    const d = new Date(trip.completedAt);
    const hour = Number.isNaN(d.getTime()) ? 12 : d.getUTCHours();
    const fin = calculateTripFinancials(trip);
    let idx = 3;
    if (hour >= 6 && hour < 11) idx = 0;
    else if (hour >= 11 && hour < 15) idx = 1;
    else if (hour >= 15 && hour < 20) idx = 2;

    buckets[idx].tripCount += 1;
    if (isCareCategory(trip.category)) {
      buckets[idx].careNet = roundCurrency(buckets[idx].careNet + fin.netPayout);
    } else {
      buckets[idx].standardNet = roundCurrency(buckets[idx].standardNet + fin.netPayout);
    }
  }

  return buckets;
}

function computeCareCategoryBreakdown(careTrips: CompletedTrip[]): CareCategoryBreakdownItem[] {
  const categories: Exclude<RideCategory, 'standard'>[] = [
    'care_wheelchair',
    'care_medical',
    'care_oxygen',
    'care_sensory',
  ];

  return categories.map((cat) => {
    const matching = careTrips.filter((t) => t.category === cat);
    const totalNet = matching.reduce(
      (sum, t) => sum + calculateTripFinancials(t).netPayout,
      0
    );
    const rounded = roundCurrency(totalNet);
    return {
      category: cat,
      label: getCategoryDisplayLabel(cat),
      tripCount: matching.length,
      netEarnings: rounded,
      avgPayout: matching.length > 0 ? roundCurrency(rounded / matching.length) : 0,
    };
  });
}

export function computeSeparateEarningsAnalysis(
  trips: CompletedTrip[],
  period: EarningsPeriod,
  referenceDateIso = '2026-11-14T23:59:59Z',
  openCareAppointments: CareAppointment[] = []
): SeparateEarningsSummary {
  const scoped = filterTripsByPeriod(trips, period, referenceDateIso);
  const standardTrips = scoped.filter((t) => !isCareCategory(t.category));
  const careTrips = scoped.filter((t) => isCareCategory(t.category));

  const combined = aggregateMetrics(scoped);
  const standard = aggregateMetrics(standardTrips);
  const care = aggregateMetrics(careTrips);

  const dayMap = new Map<string, DailyComparisonPoint>();
  for (const trip of scoped) {
    const dateKey = trip.completedAt.slice(0, 10);
    const fin = calculateTripFinancials(trip);
    const existing = dayMap.get(dateKey) ?? {
      dateKey,
      label: formatShortDayLabel(dateKey),
      standardNet: 0,
      careNet: 0,
      standardTrips: 0,
      careTrips: 0,
    };
    if (isCareCategory(trip.category)) {
      existing.careNet = roundCurrency(existing.careNet + fin.netPayout);
      existing.careTrips += 1;
    } else {
      existing.standardNet = roundCurrency(existing.standardNet + fin.netPayout);
      existing.standardTrips += 1;
    }
    dayMap.set(dateKey, existing);
  }

  const dailyComparison = Array.from(dayMap.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey)
  );

  const careSharePercent =
    combined.netEarnings > 0
      ? Math.round((care.netEarnings / combined.netEarnings) * 100)
      : 0;

  const openQueuePotential = roundCurrency(
    openCareAppointments
      .filter((a) => !a.completed)
      .reduce((sum, a) => sum + a.baseFare + a.careStipend + a.waitTimeProtectionBonus, 0)
  );

  const commissionSaved = roundCurrency(care.grossFares * STANDARD_PLATFORM_FEE_RATE);
  const hourlyAdvantage = roundCurrency(care.hourlyRate - standard.hourlyRate);
  const effectiveAvgCare = care.avgNetPerTrip > 0 ? care.avgNetPerTrip : 950;
  const projectedWeeklyPotential = roundCurrency(effectiveAvgCare * 14 + openQueuePotential * 0.5);

  return {
    period,
    combined,
    standard,
    care,
    dailyComparison,
    peakWindows: computePeakWindows(scoped),
    careSharePercent,
    specialAnalysis: {
      careSharePercent,
      hourlyAdvantage,
      commissionSaved,
      projectedWeeklyPotential,
      openQueuePotential,
      categoryBreakdown: computeCareCategoryBreakdown(careTrips),
    },
  };
}

function formatShortDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function filterCareAppointments(
  appointments: CareAppointment[],
  filterCategory: 'all' | 'claimed' | Exclude<RideCategory, 'standard'>,
  searchQuery: string
): CareAppointment[] {
  const q = searchQuery.trim().toLowerCase();
  return appointments.filter((apt) => {
    if (apt.completed) return false;
    if (filterCategory === 'claimed' && !apt.claimed) return false;
    if (
      filterCategory !== 'all' &&
      filterCategory !== 'claimed' &&
      apt.category !== filterCategory
    ) {
      return false;
    }
    if (!q) return true;
    const haystack = [
      apt.patientName,
      apt.patientConditionSummary,
      apt.mobilityEquipment,
      apt.pickupAddress,
      apt.destinationFacility,
      apt.assignedDriverName,
      ...apt.accessibilityNeeds,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function validateCareAppointmentInput(input: NewCareBookingInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.patientName.trim()) errors.patientName = 'Patient or rider name is required.';
  if (!input.patientConditionSummary.trim()) {
    errors.patientConditionSummary = 'Clinical or accessibility summary is required.';
  }
  if (!input.mobilityEquipment.trim()) {
    errors.mobilityEquipment = 'Specify required vehicle equipment or assistance.';
  }
  if (input.accessibilityNeeds.length === 0) {
    errors.accessibilityNeeds = 'Select at least one accessibility requirement.';
  }
  if (!input.pickupAddress.trim()) errors.pickupAddress = 'Pickup address is required.';
  if (!input.destinationFacility.trim()) {
    errors.destinationFacility = 'Destination clinic or address is required.';
  }
  if (!input.scheduledDate.trim()) errors.scheduledDate = 'Scheduled date is required.';
  if (!input.scheduledTime.trim()) errors.scheduledTime = 'Scheduled time is required.';

  const dist = Number(input.distanceMiles);
  if (!input.distanceMiles.trim() || Number.isNaN(dist) || dist <= 0) {
    errors.distanceMiles = 'Enter a valid trip distance in km (> 0).';
  }

  const fare = Number(input.baseFare);
  if (!input.baseFare.trim() || Number.isNaN(fare) || fare <= 0) {
    errors.baseFare = 'Enter a valid base fare (> ₹0).';
  }

  const stipend = Number(input.careStipend);
  if (input.careStipend.trim() === '' || Number.isNaN(stipend) || stipend < 0) {
    errors.careStipend = 'Enter a valid care stipend (₹0 or higher).';
  }

  if (!input.caregiverName.trim()) errors.caregiverName = 'Caregiver or clinic coordinator is required.';
  if (!input.caregiverPhone.trim()) errors.caregiverPhone = 'Contact phone number is required.';
  if (!input.boardingProtocol.trim()) {
    errors.boardingProtocol = 'Provide brief boarding or door-to-door instructions.';
  }
  return errors;
}

export function validateDriverProfileInput(profile: DriverProfileData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!profile.fullName.trim()) errors.fullName = 'Driver full name is required.';
  if (!profile.email.trim() || !profile.email.includes('@')) {
    errors.email = 'Valid email address is required.';
  }
  if (!profile.phone.trim()) errors.phone = 'Phone number is required.';
  if (!profile.vehicle.make.trim()) errors.vehicleMake = 'Vehicle make is required.';
  if (!profile.vehicle.model.trim()) errors.vehicleModel = 'Vehicle model is required.';
  if (
    !profile.vehicle.year ||
    profile.vehicle.year < 2005 ||
    profile.vehicle.year > 2028
  ) {
    errors.vehicleYear = 'Enter a valid model year (2005–2028).';
  }
  if (!profile.vehicle.licensePlate.trim()) {
    errors.licensePlate = 'License plate is required.';
  }
  if (profile.yearsExperience < 0 || profile.yearsExperience > 60) {
    errors.yearsExperience = 'Years of experience must be between 0 and 60.';
  }
  return errors;
}

export function appointmentToRideOffer(apt: CareAppointment): RideOffer {
  return {
    id: `offer-${apt.id}`,
    category: apt.category,
    vehicleTier: apt.vehicleTier ?? 'car_elite',
    isEmergencyHospitalVisit:
      Boolean(apt.isEmergencyHospitalVisit) || apt.priorityLevel === 'Critical Care',
    pricingModel: apt.pricingModel ?? 'per_km_19',
    serviceLabel: `${getCategoryDisplayLabel(apt.category)} · ${getVehicleTierLabel(
      apt.vehicleTier ?? 'car_elite'
    )}`,
    riderName: apt.patientName,
    riderRating: 5.0,
    pickupAddress: apt.pickupAddress,
    dropoffAddress: apt.destinationFacility,
    pickupCoords: apt.pickupCoords,
    dropoffCoords: apt.dropoffCoords,
    pickupLatLng: apt.pickupLatLng,
    dropoffLatLng: apt.dropoffLatLng,
    pickupEtaMins: 6,
    tripDurationMins: apt.estimatedDurationMins,
    distanceMiles: apt.distanceMiles,
    baseFare: apt.baseFare,
    surgeMultiplier: 1.0,
    careStipend: roundCurrency(apt.careStipend + apt.waitTimeProtectionBonus),
    estimatedTip: 0,
    accessibilityNotes: `${apt.patientConditionSummary}. Needs: ${apt.accessibilityNeeds.join(', ')}. ${apt.boardingProtocol}`,
    equipmentRequired: [apt.mobilityEquipment],
    caregiverContact: `${apt.caregiverName} (${apt.caregiverPhone})`,
    graceWaitMins: 10,
    checklist: [
      { id: 'chk-1', label: `Confirm equipment ready: ${apt.mobilityEquipment}`, checked: false },
      { id: 'chk-2', label: 'Door-to-door boarding assistance completed', checked: false },
      { id: 'chk-3', label: 'Secure restraint locks / oxygen mount verified', checked: false },
    ],
  };
}

export function computePassengerRatingAverage(
  rating: Pick<PassengerMultiPointRating, 'overall' | 'curbReadiness' | 'communication' | 'equipmentReadiness'>
): number {
  const avg = (rating.overall + rating.curbReadiness + rating.communication + rating.equipmentReadiness) / 4;
  return Math.round(avg * 10) / 10;
}

export function validatePassengerRatingInput(
  rating: Pick<PassengerMultiPointRating, 'overall' | 'curbReadiness' | 'communication' | 'equipmentReadiness' | 'privateCareNotes'>
): Record<string, string> {
  const errors: Record<string, string> = {};
  const checks: [keyof typeof rating, string][] = [
    ['overall', 'Overall rating'],
    ['curbReadiness', 'Curb readiness rating'],
    ['communication', 'Communication rating'],
    ['equipmentReadiness', 'Boarding / equipment readiness rating'],
  ];
  for (const [key, label] of checks) {
    const val = Number(rating[key]);
    if (Number.isNaN(val) || val < 1 || val > 5) {
      errors[key] = `${label} must be between 1 and 5.`;
    }
  }
  return errors;
}

export function tripsToCsv(trips: CompletedTrip[]): string {
  const headers = [
    'Trip ID',
    'Date',
    'Channel',
    'Vehicle Tier',
    'Service Type',
    'Rider / Patient',
    'Route',
    'Duration (min)',
    'Distance (km)',
    'Base Fare (INR)',
    'Surge (INR)',
    'Care Stipend (INR)',
    'Tip (INR)',
    'Company Fee / Maint (INR)',
    'Net Payout (INR)',
    'Passenger Multi-Point Avg',
    'Private Care Notes',
  ];

  const rows = trips.map((trip) => {
    const fin = calculateTripFinancials(trip);
    const channel = isCareCategory(trip.category) ? 'Care & Medical' : 'Standard';
    const avgRating = trip.driverPassengerRating
      ? computePassengerRatingAverage(trip.driverPassengerRating).toFixed(1)
      : '';
    const notes = trip.driverPassengerRating?.privateCareNotes ?? '';
    const cells = [
      trip.id,
      trip.completedAt.slice(0, 10),
      channel,
      getVehicleTierLabel(trip.vehicleTier),
      trip.serviceLabel,
      trip.riderOrPatientName,
      trip.routeSummary,
      String(trip.durationMins),
      String(trip.distanceMiles),
      trip.baseFare.toFixed(2),
      trip.surgeBonus.toFixed(2),
      trip.careStipend.toFixed(2),
      trip.tip.toFixed(2),
      fin.platformFee.toFixed(2),
      fin.netPayout.toFixed(2),
      avgRating,
      notes,
    ];
    return cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export interface TaxReportTotals {
  tripCount: number;
  totalDistanceKm: number;
  grossFares: number;
  surgeBonuses: number;
  careStipends: number;
  tips: number;
  deductibleFees: number;
  netTaxableIncome: number;
}

export function computeTaxReportTotals(trips: CompletedTrip[]): TaxReportTotals {
  let totalDistanceKm = 0;
  let grossFares = 0;
  let surgeBonuses = 0;
  let careStipends = 0;
  let tips = 0;
  let deductibleFees = 0;
  let netTaxableIncome = 0;

  for (const trip of trips) {
    const fin = calculateTripFinancials(trip);
    totalDistanceKm += trip.distanceMiles;
    grossFares += trip.baseFare;
    surgeBonuses += trip.surgeBonus;
    careStipends += trip.careStipend;
    tips += trip.tip;
    deductibleFees += fin.platformFee;
    netTaxableIncome += fin.netPayout;
  }

  return {
    tripCount: trips.length,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    grossFares: roundCurrency(grossFares),
    surgeBonuses: roundCurrency(surgeBonuses),
    careStipends: roundCurrency(careStipends),
    tips: roundCurrency(tips),
    deductibleFees: roundCurrency(deductibleFees),
    netTaxableIncome: roundCurrency(netTaxableIncome),
  };
}

export function tripsToTaxCsv(
  trips: CompletedTrip[],
  options: { periodLabel?: string; channelLabel?: string } = {}
): string {
  const baseCsv = tripsToCsv(trips);
  const totals = computeTaxReportTotals(trips);
  const periodLabel = options.periodLabel ?? 'Selected Period';
  const channelLabel = options.channelLabel ?? 'All Trips';

  const summaryRows = [
    '',
    '"TAX REPORTING & RECORD-KEEPING SUMMARY"',
    `"Reporting Scope","${periodLabel} (${channelLabel})"`,
    `"Completed Trips","${totals.tripCount}"`,
    `"Total Distance (km)","${totals.totalDistanceKm.toFixed(1)}"`,
    `"Gross Distance Fares (INR)","${totals.grossFares.toFixed(2)}"`,
    `"Surge Bonuses (INR)","${totals.surgeBonuses.toFixed(2)}"`,
    `"Care & Wait Stipends (INR)","${totals.careStipends.toFixed(2)}"`,
    `"Rider / Family Tips (INR)","${totals.tips.toFixed(2)}"`,
    `"Deductible Company Maint & Platform Fees (INR)","${totals.deductibleFees.toFixed(2)}"`,
    `"Net Taxable Driver Earnings (INR)","${totals.netTaxableIncome.toFixed(2)}"`,
  ];

  return [baseCsv, ...summaryRows].join('\n');
}

function toPdfAscii(input: string): string {
  return input
    .replaceAll('₹', 'INR ')
    .replaceAll('→', '->')
    .replaceAll('–', '-')
    .replaceAll('—', '-')
    .replaceAll('★', '*')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfString(text: string): string {
  return toPdfAscii(text)
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function truncateAscii(text: string, maxLen: number): string {
  const clean = toPdfAscii(text);
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(0, maxLen - 3))}...`;
}

export function tripsToPdfBytes(
  trips: CompletedTrip[],
  options: {
    periodLabel?: string;
    channelLabel?: string;
    generatedAt?: string;
  } = {}
): Uint8Array {
  const totals = computeTaxReportTotals(trips);
  const periodLabel = options.periodLabel ?? 'This Week';
  const channelLabel = options.channelLabel ?? 'All Trips';
  const generatedAt = options.generatedAt ?? '2026-11-14';

  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 36;

  // Split trips cleanly across A4 pages
  const firstPageRows = 19;
  const nextPageRows = 28;
  const chunks: CompletedTrip[][] = [];
  if (trips.length === 0) {
    chunks.push([]);
  } else {
    chunks.push(trips.slice(0, firstPageRows));
    for (let i = firstPageRows; i < trips.length; i += nextPageRows) {
      chunks.push(trips.slice(i, i + nextPageRows));
    }
  }

  const totalPages = chunks.length;
  const pageStreams: string[] = chunks.map((chunk, pageIndex) => {
    const cmds: string[] = [];
    const textCmd = (
      x: number,
      y: number,
      font: 'F1' | 'F2',
      size: number,
      value: string,
      rgb: [number, number, number] = [0.1, 0.1, 0.12]
    ) => {
      cmds.push(
        `BT /${font} ${size} Tf ${rgb[0]} ${rgb[1]} ${rgb[2]} rg 1 0 0 1 ${x} ${y} Tm (${escapePdfString(
          value
        )}) Tj ET`
      );
    };

    const rectFill = (
      x: number,
      y: number,
      w: number,
      h: number,
      rgb: [number, number, number]
    ) => {
      cmds.push(`${rgb[0]} ${rgb[1]} ${rgb[2]} rg ${x} ${y} ${w} ${h} re f`);
    };

    const line = (x1: number, y1: number, x2: number, y2: number) => {
      cmds.push(`0.82 0.82 0.84 RG 0.6 w ${x1} ${y1} m ${x2} ${y2} l S`);
    };

    // Dark luxury top masthead bar
    rectFill(0, pageHeight - 68, pageWidth, 68, [0.07, 0.08, 0.11]);
    textCmd(
      marginX,
      pageHeight - 30,
      'F2',
      15,
      'AURELIA CHAUFFEUR - TAX & TRIP STATEMENT',
      [0.9, 0.78, 0.49]
    );
    textCmd(
      marginX,
      pageHeight - 48,
      'F1',
      9,
      `Karnataka Operating Ledger | Scope: ${periodLabel} (${channelLabel}) | Generated: ${generatedAt}`,
      [0.86, 0.87, 0.9]
    );

    let cursorY = pageHeight - 92;

    if (pageIndex === 0) {
      // Tax Reporting Summary Box
      rectFill(marginX, cursorY - 96, pageWidth - marginX * 2, 102, [0.97, 0.96, 0.93]);
      textCmd(
        marginX + 12,
        cursorY - 12,
        'F2',
        10.5,
        'TAX REPORTING SUMMARY (INR)',
        [0.45, 0.34, 0.12]
      );

      textCmd(
        marginX + 12,
        cursorY - 30,
        'F1',
        9,
        `Completed Trips: ${totals.tripCount}   |   Total Distance: ${totals.totalDistanceKm.toFixed(
          1
        )} km`
      );
      textCmd(
        marginX + 12,
        cursorY - 46,
        'F1',
        9,
        `Gross Fares: INR ${totals.grossFares.toFixed(
          2
        )}   |   Surge: INR ${totals.surgeBonuses.toFixed(
          2
        )}   |   Care Stipends: INR ${totals.careStipends.toFixed(2)}`
      );
      textCmd(
        marginX + 12,
        cursorY - 62,
        'F1',
        9,
        `Tips: INR ${totals.tips.toFixed(
          2
        )}   |   Deductible Maint/Platform Fees: -INR ${totals.deductibleFees.toFixed(2)}`
      );
      textCmd(
        marginX + 12,
        cursorY - 82,
        'F2',
        11,
        `NET TAXABLE DRIVER EARNINGS: INR ${totals.netTaxableIncome.toFixed(2)}`,
        [0.05, 0.45, 0.31]
      );

      cursorY -= 124;
    }

    // Table Header
    rectFill(marginX, cursorY - 6, pageWidth - marginX * 2, 20, [0.13, 0.15, 0.2]);
    textCmd(marginX + 6, cursorY, 'F2', 8, 'DATE', [1, 1, 1]);
    textCmd(marginX + 64, cursorY, 'F2', 8, 'TRIP ID', [1, 1, 1]);
    textCmd(marginX + 122, cursorY, 'F2', 8, 'CHANNEL', [1, 1, 1]);
    textCmd(marginX + 206, cursorY, 'F2', 8, 'ROUTE', [1, 1, 1]);
    textCmd(marginX + 372, cursorY, 'F2', 8, 'DIST', [1, 1, 1]);
    textCmd(marginX + 414, cursorY, 'F2', 8, 'FEE/MAINT', [1, 1, 1]);
    textCmd(marginX + 474, cursorY, 'F2', 8, 'NET (INR)', [1, 1, 1]);

    cursorY -= 22;

    if (chunk.length === 0) {
      textCmd(
        marginX + 6,
        cursorY,
        'F1',
        9.5,
        '0 completed trips recorded in the selected period.',
        [0.35, 0.35, 0.4]
      );
    } else {
      for (let r = 0; r < chunk.length; r++) {
        const trip = chunk[r];
        const fin = calculateTripFinancials(trip);
        const channel = isCareCategory(trip.category) ? 'Care & Med' : 'Executive';
        if (r % 2 === 1) {
          rectFill(marginX, cursorY - 6, pageWidth - marginX * 2, 20, [0.97, 0.97, 0.98]);
        }
        textCmd(marginX + 6, cursorY, 'F1', 8, trip.completedAt.slice(0, 10));
        textCmd(marginX + 64, cursorY, 'F1', 8, truncateAscii(trip.id, 11));
        textCmd(marginX + 122, cursorY, 'F1', 8, `${channel}`);
        textCmd(marginX + 206, cursorY, 'F1', 8, truncateAscii(trip.routeSummary, 31));
        textCmd(marginX + 372, cursorY, 'F1', 8, `${trip.distanceMiles.toFixed(1)}km`);
        textCmd(marginX + 414, cursorY, 'F1', 8, `-${fin.platformFee.toFixed(2)}`);
        textCmd(marginX + 474, cursorY, 'F2', 8, fin.netPayout.toFixed(2));
        line(marginX, cursorY - 6, pageWidth - marginX, cursorY - 6);
        cursorY -= 22;
      }
    }

    // Footer
    textCmd(
      marginX,
      24,
      'F1',
      8,
      `AURELIA Karnataka Chauffeur Records - Page ${pageIndex + 1} of ${totalPages}`,
      [0.45, 0.45, 0.5]
    );

    return cmds.join('\n');
  });

  // Assemble PDF objects:
  // 1: Catalog, 2: Pages, 3: F1 Helvetica, 4: F2 Helvetica-Bold,
  // 5..(5 + N*2 - 1): alternating Page and Content Stream objects
  const objects: string[] = [];
  const pageObjNums: number[] = [];

  // Placeholder slots 1..4
  objects.push(''); // 1
  objects.push(''); // 2
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // 3
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'); // 4

  for (let i = 0; i < pageStreams.length; i++) {
    const stream = pageStreams[i];
    const pageObjNum = objects.length + 1;
    const contentObjNum = objects.length + 2;
    pageObjNums.push(pageObjNum);

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>`
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Generates a secure 4-digit verification OTP string between '1000' and '9999'.
 */
export function generateVerificationOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Normalizes a phone string into a 10-digit Indian mobile number when possible.
 */
export function normalizeIndianMobile(rawPhone: string): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits.slice(0, 10);
}

/**
 * Validates that a normalized mobile number is a 10-digit Indian mobile number (6-9 start).
 */
export function isValidIndianMobile(phone: string): boolean {
  const clean = normalizeIndianMobile(phone);
  return /^[6-9]\d{9}$/.test(clean);
}

/**
 * Masks a 10-digit Indian mobile number for secure display (+91 98*** **345).
 */
export function maskIndianPhoneNumber(phone: string): string {
  const clean = normalizeIndianMobile(phone);
  if (clean.length !== 10) {
    return '+91 ••••• •••••';
  }
  return `+91 ${clean.slice(0, 2)}*** **${clean.slice(7)}`;
}

/**
 * Strips non-numeric characters from OTP input and bounds to 6 digits.
 */
export function normalizeOtpInput(rawOtp: string): string {
  return (rawOtp || '').replace(/\D/g, '').slice(0, 6);
}

/**
 * Validates the entered OTP code against the expected OTP without leaking the expected code in errors.
 */
export function validateVerificationOtp(
  enteredOtp: string,
  expectedOtp: string
): { valid: boolean; error?: string } {
  const cleanEntered = (enteredOtp || '').replace(/\s+/g, '').trim();
  const cleanExpected = (expectedOtp || '').replace(/\s+/g, '').trim();
  if (!cleanEntered) {
    return { valid: false, error: 'Please enter the 4-digit verification code.' };
  }
  if (!/^\d{4}$/.test(cleanEntered)) {
    return { valid: false, error: 'Verification code must be exactly 4 digits.' };
  }
  if (cleanEntered !== cleanExpected) {
    return { valid: false, error: 'Invalid verification code. Please check your SMS messages and try again.' };
  }
  return { valid: true };
}

/**
 * Builds an SMS URI to dispatch or share the verification OTP to the target phone number.
 */
export function buildSmsShareUri(phone: string, otp: string): string {
  const cleanPhone = normalizeIndianMobile(phone);
  const message = `Your Aurelia Karnataka Chauffeur verification OTP is: ${otp}`;
  return `sms:+91${cleanPhone}?body=${encodeURIComponent(message)}`;
}

/**
 * Formats a 10-digit Indian mobile number for display.
 */
export function formatPhoneDisplay(phone: string): string {
  const clean = normalizeIndianMobile(phone);
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return `+91 ${clean}`;
}

export interface FareConditionDefinition {
  id: FareConditionId;
  label: string;
  shortLabel: string;
  summary: string;
  customerBenefitTag: string;
  driverBenefitTag: string;
}

export const FARE_CONDITION_OPTIONS: FareConditionDefinition[] = [
  {
    id: 'off_peak_corridor',
    label: 'Off-Peak / Return Corridor',
    shortLabel: 'Off-Peak Return',
    summary: 'Midday or return leg from outer hub — company trims fee to ₹0.50/km to fill empty return miles.',
    customerBenefitTag: 'Lowest per-km rate vs all 4 apps',
    driverBenefitTag: 'Higher net than Uber/Ola 25% cuts + zero empty return',
  },
  {
    id: 'high_earning_zone',
    label: 'High-Earning Dense Belt (Back-to-Back)',
    shortLabel: 'Dense Belt',
    summary: 'Indiranagar, Whitefield, Electronic City — instant next pickup cuts Aurelia fee to ₹0.50/km.',
    customerBenefitTag: 'Flat fair rate with zero surge markup',
    driverBenefitTag: 'Full ₹16/km+ take-home with back-to-back dispatches',
  },
  {
    id: 'long_distance',
    label: 'Long Distance & Airport Express (>12 km)',
    shortLabel: 'Long >12km',
    summary: 'Highway & KIA Airport runs cut platform margin so long-trip fares drop without squeezing driver earnings.',
    customerBenefitTag: 'Saves up to 22% on airport & inter-district rides',
    driverBenefitTag: 'Guaranteed high ₹/km payout over longer continuous distance',
  },
  {
    id: 'peak_traffic_fair',
    label: 'Peak Hour / Rain Anti-Surge Cap',
    shortLabel: 'Peak Anti-Surge',
    summary: 'Uber/Ola apply 1.4x–1.45x surge during rain/rush; Aurelia caps customer rate and lowers platform cut.',
    customerBenefitTag: 'Zero predatory surge — saves 25–35% in peak traffic',
    driverBenefitTag: 'Higher driver net ₹/km than standard ₹16/km base',
  },
  {
    id: 'care_priority',
    label: 'Medical & Disability Zero-Commission',
    shortLabel: '0% Care Fee',
    summary: 'Aurelia waives 100% of company maintenance fee (₹0/km) for hospital & special care rides.',
    customerBenefitTag: 'Full ₹3/km platform fee removed for patients',
    driverBenefitTag: '100% fare goes to driver + priority Care Stipend',
  },
  {
    id: 'standard_19',
    label: 'Standard Aurelia Tariff (Baseline)',
    shortLabel: 'Standard Base',
    summary: 'Standard baseline transparent rate (₹19/km for cars: ₹16 driver + ₹3 company maintenance).',
    customerBenefitTag: 'Predictable flat ₹/km with no hidden charges',
    driverBenefitTag: 'Transparent fixed payout across all 31 districts',
  },
];

interface ModeBenchmarkConfig {
  standardCustomerRate: number;
  standardFee: number;
  reducedRates: Record<Exclude<FareConditionId, 'standard_19'>, { customerRate: number; platformFee: number }>;
  competitors: {
    brand: CompetitorBrand;
    baseCustomerRate: number;
    commissionPercent: number;
    peakSurgeMultiplier: number;
  }[];
}

const MODE_BENCHMARKS: Record<ComparisonVehicleMode, ModeBenchmarkConfig> = {
  bike: {
    standardCustomerRate: 12.0,
    standardFee: 2.0,
    reducedRates: {
      off_peak_corridor: { customerRate: 10.4, platformFee: 0.3 },
      high_earning_zone: { customerRate: 10.6, platformFee: 0.3 },
      long_distance: { customerRate: 10.5, platformFee: 0.3 },
      peak_traffic_fair: { customerRate: 10.9, platformFee: 0.4 },
      care_priority: { customerRate: 10.5, platformFee: 0.0 },
    },
    competitors: [
      { brand: 'Uber', baseCustomerRate: 12.5, commissionPercent: 25, peakSurgeMultiplier: 1.4 },
      { brand: 'Ola', baseCustomerRate: 12.0, commissionPercent: 22, peakSurgeMultiplier: 1.35 },
      { brand: 'Rapido', baseCustomerRate: 11.5, commissionPercent: 18, peakSurgeMultiplier: 1.25 },
      { brand: 'Namma Yatri', baseCustomerRate: 11.0, commissionPercent: 5, peakSurgeMultiplier: 1.1 },
    ],
  },
  auto: {
    standardCustomerRate: 16.0,
    standardFee: 1.5,
    reducedRates: {
      off_peak_corridor: { customerRate: 14.9, platformFee: 0.3 },
      high_earning_zone: { customerRate: 15.0, platformFee: 0.3 },
      long_distance: { customerRate: 14.8, platformFee: 0.3 },
      peak_traffic_fair: { customerRate: 15.3, platformFee: 0.4 },
      care_priority: { customerRate: 14.8, platformFee: 0.0 },
    },
    competitors: [
      { brand: 'Uber', baseCustomerRate: 17.5, commissionPercent: 22, peakSurgeMultiplier: 1.4 },
      { brand: 'Ola', baseCustomerRate: 17.0, commissionPercent: 20, peakSurgeMultiplier: 1.35 },
      { brand: 'Rapido', baseCustomerRate: 16.0, commissionPercent: 15, peakSurgeMultiplier: 1.25 },
      { brand: 'Namma Yatri', baseCustomerRate: 15.5, commissionPercent: 4, peakSurgeMultiplier: 1.1 },
    ],
  },
  car_economy: {
    standardCustomerRate: 19.0,
    standardFee: 3.0,
    reducedRates: {
      off_peak_corridor: { customerRate: 16.5, platformFee: 0.4 },
      high_earning_zone: { customerRate: 16.8, platformFee: 0.4 },
      long_distance: { customerRate: 16.6, platformFee: 0.4 },
      peak_traffic_fair: { customerRate: 17.5, platformFee: 0.9 },
      care_priority: { customerRate: 16.2, platformFee: 0.0 },
    },
    competitors: [
      { brand: 'Uber', baseCustomerRate: 19.5, commissionPercent: 25, peakSurgeMultiplier: 1.45 },
      { brand: 'Ola', baseCustomerRate: 19.0, commissionPercent: 24, peakSurgeMultiplier: 1.4 },
      { brand: 'Rapido', baseCustomerRate: 18.0, commissionPercent: 16, peakSurgeMultiplier: 1.25 },
      { brand: 'Namma Yatri', baseCustomerRate: 17.5, commissionPercent: 5, peakSurgeMultiplier: 1.1 },
    ],
  },
  car_premier: {
    standardCustomerRate: 19.0,
    standardFee: 3.0,
    reducedRates: {
      off_peak_corridor: { customerRate: 17.5, platformFee: 0.5 },
      high_earning_zone: { customerRate: 18.0, platformFee: 0.5 },
      long_distance: { customerRate: 17.8, platformFee: 0.6 },
      peak_traffic_fair: { customerRate: 18.8, platformFee: 1.0 },
      care_priority: { customerRate: 16.0, platformFee: 0.0 },
    },
    competitors: [
      { brand: 'Uber', baseCustomerRate: 23.5, commissionPercent: 25, peakSurgeMultiplier: 1.45 },
      { brand: 'Ola', baseCustomerRate: 22.5, commissionPercent: 24, peakSurgeMultiplier: 1.4 },
      { brand: 'Rapido', baseCustomerRate: 21.0, commissionPercent: 16, peakSurgeMultiplier: 1.25 },
      { brand: 'Namma Yatri', baseCustomerRate: 20.5, commissionPercent: 5, peakSurgeMultiplier: 1.1 },
    ],
  },
  car_elite: {
    standardCustomerRate: 19.0,
    standardFee: 3.0,
    reducedRates: {
      off_peak_corridor: { customerRate: 17.8, platformFee: 0.6 },
      high_earning_zone: { customerRate: 18.2, platformFee: 0.6 },
      long_distance: { customerRate: 18.0, platformFee: 0.6 },
      peak_traffic_fair: { customerRate: 18.9, platformFee: 0.9 },
      care_priority: { customerRate: 16.0, platformFee: 0.0 },
    },
    competitors: [
      { brand: 'Uber', baseCustomerRate: 29.0, commissionPercent: 25, peakSurgeMultiplier: 1.45 },
      { brand: 'Ola', baseCustomerRate: 27.5, commissionPercent: 24, peakSurgeMultiplier: 1.4 },
      { brand: 'Rapido', baseCustomerRate: 25.5, commissionPercent: 16, peakSurgeMultiplier: 1.25 },
      { brand: 'Namma Yatri', baseCustomerRate: 24.5, commissionPercent: 5, peakSurgeMultiplier: 1.1 },
    ],
  },
};

export function getCompetitorPerKmQuotes(
  vehicleMode: ComparisonVehicleMode,
  conditionId: FareConditionId
): CompetitorPerKmQuote[] {
  const cfg = MODE_BENCHMARKS[vehicleMode];
  const isPeak = conditionId === 'peak_traffic_fair';
  return cfg.competitors.map((comp) => {
    const multiplier = isPeak ? comp.peakSurgeMultiplier : 1;
    const customerRatePerKm = roundCurrency(comp.baseCustomerRate * multiplier);
    const platformCutPerKm = roundCurrency(customerRatePerKm * (comp.commissionPercent / 100));
    const driverNetPerKm = roundCurrency(customerRatePerKm - platformCutPerKm);
    return {
      brand: comp.brand,
      customerRatePerKm,
      commissionPercent: comp.commissionPercent,
      platformCutPerKm,
      driverNetPerKm,
      surgeNote: isPeak ? `${comp.peakSurgeMultiplier.toFixed(2)}x Peak` : 'Normal tariff',
    };
  });
}

export function evaluateWinWinConditionFare(params: {
  vehicleMode: ComparisonVehicleMode;
  conditionId: FareConditionId;
  distanceKm: number;
}): WinWinFareEvaluation {
  const safeDistance = Math.max(1, Number(params.distanceKm) || 10);
  const cfg = MODE_BENCHMARKS[params.vehicleMode];
  const conditionMeta =
    FARE_CONDITION_OPTIONS.find((c) => c.id === params.conditionId) ?? FARE_CONDITION_OPTIONS[0];

  const competitors = getCompetitorPerKmQuotes(params.vehicleMode, params.conditionId);
  const marketAverageRatePerKm = roundCurrency(
    competitors.reduce((sum, c) => sum + c.customerRatePerKm, 0) / competitors.length
  );
  const avgDriverNetPerKm = roundCurrency(
    competitors.reduce((sum, c) => sum + c.driverNetPerKm, 0) / competitors.length
  );
  const cheapest = competitors.reduce(
    (min, cur) => (cur.customerRatePerKm < min.customerRatePerKm ? cur : min),
    competitors[0]
  );

  const aureliaStandardRatePerKm = cfg.standardCustomerRate;
  const activePricing =
    params.conditionId === 'standard_19'
      ? { customerRate: cfg.standardCustomerRate, platformFee: cfg.standardFee }
      : cfg.reducedRates[params.conditionId];

  const aureliaReducedRatePerKm = roundCurrency(activePricing.customerRate);
  const aureliaPlatformFeePerKm = roundCurrency(activePricing.platformFee);
  const aureliaDriverNetPerKm = roundCurrency(aureliaReducedRatePerKm - aureliaPlatformFeePerKm);

  const customerTotalFare = roundCurrency(safeDistance * aureliaReducedRatePerKm);
  const companyTotalFee = roundCurrency(safeDistance * aureliaPlatformFeePerKm);
  const driverTotalNetPayout = roundCurrency(customerTotalFare - companyTotalFee);

  const avgCompetitorTotal = roundCurrency(safeDistance * marketAverageRatePerKm);
  const cheapestCompetitorTotal = roundCurrency(safeDistance * cheapest.customerRatePerKm);
  const customerSavingsVsAvgInr = roundCurrency(avgCompetitorTotal - customerTotalFare);
  const customerSavingsPercentVsAvg =
    marketAverageRatePerKm > 0
      ? Math.round(((marketAverageRatePerKm - aureliaReducedRatePerKm) / marketAverageRatePerKm) * 100)
      : 0;
  const customerSavingsVsCheapestInr = roundCurrency(cheapestCompetitorTotal - customerTotalFare);
  const driverAdvantageVsAvgPerKm = roundCurrency(aureliaDriverNetPerKm - avgDriverNetPerKm);

  return {
    vehicleMode: params.vehicleMode,
    conditionId: params.conditionId,
    conditionLabel: conditionMeta.label,
    conditionSummary: conditionMeta.summary,
    distanceKm: roundCurrency(safeDistance),
    competitors,
    marketAverageRatePerKm,
    cheapestCompetitorBrand: cheapest.brand,
    cheapestCompetitorRatePerKm: cheapest.customerRatePerKm,
    aureliaStandardRatePerKm,
    aureliaReducedRatePerKm,
    aureliaPlatformFeePerKm,
    aureliaDriverNetPerKm,
    customerTotalFare,
    driverTotalNetPayout,
    companyTotalFee,
    customerSavingsVsAvgInr,
    customerSavingsPercentVsAvg,
    customerSavingsVsCheapestInr,
    driverAdvantageVsAvgPerKm,
    driverHappyReason: conditionMeta.driverBenefitTag,
    customerHappyReason: conditionMeta.customerBenefitTag,
  };
}

export function calculateWinWinFareBreakdown(
  distanceKm: number,
  vehicleTier: VehicleTier,
  conditionId: FareConditionId = 'off_peak_corridor',
  careStipend = 0,
  tip = 0
): {
  distanceKm: number;
  totalDistanceFare: number;
  companyMaintenanceFee: number;
  driverDistanceEarnings: number;
  netDriverPayout: number;
  effectiveRatePerKm: number;
  evaluation: WinWinFareEvaluation;
} {
  const evalResult = evaluateWinWinConditionFare({
    vehicleMode: vehicleTier,
    conditionId,
    distanceKm,
  });
  const totalDistanceFare = evalResult.customerTotalFare;
  const companyMaintenanceFee = evalResult.companyTotalFee;
  const driverDistanceEarnings = evalResult.driverTotalNetPayout;
  const netDriverPayout = roundCurrency(driverDistanceEarnings + careStipend + tip);
  return {
    distanceKm: evalResult.distanceKm,
    totalDistanceFare,
    companyMaintenanceFee,
    driverDistanceEarnings,
    netDriverPayout,
    effectiveRatePerKm: evalResult.aureliaReducedRatePerKm,
    evaluation: evalResult,
  };
}

export function validateUpiId(upiId: string): { valid: boolean; error?: string } {
  const clean = (upiId || '').trim();
  if (!clean) {
    return { valid: false, error: 'UPI ID is required for instant settlement.' };
  }
  if (!/^[a-zA-Z0-9.\-_]{2,120}@[a-zA-Z]{2,40}$/.test(clean)) {
    return {
      valid: false,
      error: 'Enter a valid UPI handle (e.g., vikram.rao@okicici or driver@ybl).',
    };
  }
  return { valid: true };
}

export function calculatePayoutLedgerTotals(payouts: DriverPayoutRecord[]): {
  reconciledTotal: number;
  pendingTotal: number;
  totalCompanyFees: number;
  reconciledCount: number;
  pendingCount: number;
} {
  let reconciledTotal = 0;
  let pendingTotal = 0;
  let totalCompanyFees = 0;
  let reconciledCount = 0;
  let pendingCount = 0;

  for (const p of payouts) {
    totalCompanyFees += p.companyFeeInr || 0;
    if (p.status === 'reconciled') {
      reconciledTotal += p.netPayoutInr;
      reconciledCount += 1;
    } else if (p.status === 'pending') {
      pendingTotal += p.netPayoutInr;
      pendingCount += 1;
    }
  }

  return {
    reconciledTotal: roundCurrency(reconciledTotal),
    pendingTotal: roundCurrency(pendingTotal),
    totalCompanyFees: roundCurrency(totalCompanyFees),
    reconciledCount,
    pendingCount,
  };
}

export const FLAT_PLATFORM_DEDUCTION_INR = 3;

export function calculateFlatRideTransfer(grossFareInr: number): {
  grossFareInr: number;
  deductedFeeInr: number;
  transferredNetInr: number;
} {
  const safeGross = Math.max(0, roundCurrency(Number(grossFareInr) || 0));
  const deductedFeeInr = roundCurrency(Math.min(FLAT_PLATFORM_DEDUCTION_INR, safeGross));
  const transferredNetInr = roundCurrency(Math.max(0, safeGross - deductedFeeInr));
  return {
    grossFareInr: safeGross,
    deductedFeeInr,
    transferredNetInr,
  };
}

export function computeFlatRideTransferSummary(
  trips: CompletedTrip[],
  payoutTarget: string,
  payouts: DriverPayoutRecord[] = []
): FlatRideTransferSummary {
  const cleanTarget = payoutTarget.trim() || 'Linked Mobile / UPI QR Account';
  const reconciledCount = payouts.filter((p) => p.status === 'reconciled').length;

  const entries: PerRideTransferEntry[] = trips.map((trip, index) => {
    const grossFareInr = roundCurrency(
      (trip.baseFare || 0) + (trip.surgeBonus || 0) + (trip.careStipend || 0) + (trip.tip || 0)
    );
    const split = calculateFlatRideTransfer(grossFareInr);
    return {
      tripId: trip.id,
      riderOrPatientName: trip.riderOrPatientName,
      completedAt: trip.completedAt,
      grossFareInr: split.grossFareInr,
      deductedFeeInr: split.deductedFeeInr,
      transferredNetInr: split.transferredNetInr,
      payoutTarget: cleanTarget,
      status: index < reconciledCount ? 'reconciled' : 'transferred',
    };
  });

  const totalGrossInr = roundCurrency(entries.reduce((s, e) => s + e.grossFareInr, 0));
  const totalDeductedFeeInr = roundCurrency(entries.reduce((s, e) => s + e.deductedFeeInr, 0));
  const totalTransferredNetInr = roundCurrency(
    entries.reduce((s, e) => s + e.transferredNetInr, 0)
  );

  return {
    totalTrips: entries.length,
    totalGrossInr,
    totalDeductedFeeInr,
    totalTransferredNetInr,
    payoutTarget: cleanTarget,
    entries,
  };
}

export function validatePasswordSetup(
  password: string,
  confirmPassword: string
): { valid: boolean; error?: string } {
  const pwd = password ?? '';
  const confirm = confirmPassword ?? '';
  if (pwd.length < 8) {
    return {
      valid: false,
      error: 'Password must be at least 8 characters long.',
    };
  }
  if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) {
    return {
      valid: false,
      error: 'Include at least 1 letter and 1 number for account protection.',
    };
  }
  if (pwd !== confirm) {
    return {
      valid: false,
      error: 'Password and confirm password do not match.',
    };
  }
  return { valid: true };
}

export async function hashPasswordSha256(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i];
    h1 = Math.imul(h1, 0x01000193);
    h2 = Math.imul(h2 ^ bytes[i], 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function validateQrPayloadOrImage(
  qrPayload?: string,
  qrDataUrl?: string
): { valid: boolean; normalizedPayload: string; error?: string } {
  const trimmed = (qrPayload || '').trim();
  const hasImage = Boolean(qrDataUrl && qrDataUrl.startsWith('data:image/'));
  if (!trimmed && !hasImage) {
    return {
      valid: false,
      normalizedPayload: '',
      error: 'Upload a payment QR code image or enter your UPI QR link/ID.',
    };
  }
  if (trimmed && !trimmed.startsWith('upi://') && !trimmed.includes('@')) {
    return {
      valid: false,
      normalizedPayload: trimmed,
      error: 'Enter a valid UPI QR link (upi://pay?pa=...) or UPI handle.',
    };
  }
  const normalizedPayload = trimmed.startsWith('upi://')
    ? trimmed
    : trimmed
      ? `upi://pay?pa=${encodeURIComponent(trimmed)}&cu=INR`
      : 'QR Image Linked';
  return { valid: true, normalizedPayload };
}

export function generateDeterministicQrMatrix(payload: string, size = 21): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const placeFinder = (startR: number, startC: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (startR + r < size && startC + c < size) {
          grid[startR + r][startC + c] = isBorder || isInner;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  let seed = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    seed ^= payload.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;
      seed ^= (r * 31 + c * 17 + 7) >>> 0;
      seed = Math.imul(seed, 1664525) + 1013904223;
      grid[r][c] = ((seed >>> 24) & 1) === 1;
    }
  }

  return grid;
}

export const PASSENGER_TIP_PRESETS_INR = [0, 20, 50, 100] as const;
export const MAX_PASSENGER_TIP_INR = 5000;

export function validatePassengerTipAmount(rawInput: string | number): {
  valid: boolean;
  amount: number;
  error?: string;
} {
  if (typeof rawInput === 'string' && rawInput.trim() === '') {
    return {
      valid: false,
      amount: 0,
      error: 'Enter a tip amount (₹0 – ₹5,000).',
    };
  }
  const parsed = Number(rawInput);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return {
      valid: false,
      amount: 0,
      error: 'Enter a valid numeric tip amount.',
    };
  }
  if (parsed < 0) {
    return {
      valid: false,
      amount: 0,
      error: 'Tip amount cannot be negative.',
    };
  }
  if (parsed > MAX_PASSENGER_TIP_INR) {
    return {
      valid: false,
      amount: 0,
      error: `Tip cannot exceed ₹${MAX_PASSENGER_TIP_INR.toLocaleString('en-IN')}.`,
    };
  }
  return {
    valid: true,
    amount: roundCurrency(parsed),
  };
}

export function calculateInTripPayoutPreview(params: {
  baseFareInr: number;
  surgeBonusInr?: number;
  careStipendInr?: number;
  tipInr?: number;
  category: RideCategory;
  pricingModel?: PricingModel;
  distanceKm?: number;
}): InTripPayoutPreview {
  const baseFareInr = Math.max(0, roundCurrency(params.baseFareInr || 0));
  const surgeBonusInr = Math.max(0, roundCurrency(params.surgeBonusInr ?? 0));
  const careStipendInr = Math.max(0, roundCurrency(params.careStipendInr ?? 0));
  const tipInr = Math.max(0, roundCurrency(params.tipInr ?? 0));

  const tripFin = calculateTripFinancials({
    category: params.category,
    pricingModel: params.pricingModel,
    distanceMiles: params.distanceKm,
    baseFare: baseFareInr,
    surgeBonus: surgeBonusInr,
    careStipend: careStipendInr,
    tip: tipInr,
  });

  const grossWithTipInr = roundCurrency(tripFin.grossBeforeTip + tipInr);
  const flat = calculateFlatRideTransfer(grossWithTipInr);

  return {
    baseFareInr,
    surgeBonusInr,
    careStipendInr,
    tipInr,
    grossBeforeTipInr: tripFin.grossBeforeTip,
    grossWithTipInr,
    platformFeeInr: tripFin.platformFee,
    netDriverPayoutInr: tripFin.netPayout,
    flatFeeDeductedInr: flat.deductedFeeInr,
    flatTransferredNetInr: flat.transferredNetInr,
  };
}

export function calculateLiveRideTotalsWithTip(
  ride: Pick<LiveRideOrder, 'fareInr' | 'driverNetInr' | 'companyFeeInr' | 'tipInr'>,
  overrideTipInr?: number
): {
  baseFareInr: number;
  companyFeeInr: number;
  tipInr: number;
  customerTotalWithTipInr: number;
  driverPayoutWithTipInr: number;
  flatFeeDeductedInr: number;
  flatTransferredNetInr: number;
} {
  const baseFareInr = Math.max(0, roundCurrency(ride.fareInr || 0));
  const companyFeeInr = Math.max(0, roundCurrency(ride.companyFeeInr || 0));
  const tipInr = Math.max(0, roundCurrency(overrideTipInr ?? ride.tipInr ?? 0));
  const customerTotalWithTipInr = roundCurrency(baseFareInr + tipInr);
  const driverPayoutWithTipInr = roundCurrency((ride.driverNetInr || 0) + tipInr);
  const flat = calculateFlatRideTransfer(customerTotalWithTipInr);
  return {
    baseFareInr,
    companyFeeInr,
    tipInr,
    customerTotalWithTipInr,
    driverPayoutWithTipInr,
    flatFeeDeductedInr: flat.deductedFeeInr,
    flatTransferredNetInr: flat.transferredNetInr,
  };
}

const ADMIN_PASSCODE_SHA256 =
  '550f337898fbfd33749fa9cf32a6f3cb48e694bb4060bfee17b27349b0253b95';

export async function verifyAdminPasscode(rawInput: string): Promise<boolean> {
  const normalized = (rawInput || '').trim();
  if (!normalized) return false;
  const digest = await hashPasswordSha256(`aurelia-admin-v1:${normalized}`);
  return digest === ADMIN_PASSCODE_SHA256;
}

const TRIP_PHASE_STEPS: {
  phase: TripCompletionStep['phase'];
  shortLabel: string;
  label: string;
  subtitle: string;
  percent: number;
}[] = [
  {
    phase: 'en_route_pickup',
    shortLabel: 'En Route',
    label: 'En Route to Pickup',
    subtitle: 'Proceeding along Karnataka dispatch corridor to passenger pickup pin.',
    percent: 25,
  },
  {
    phase: 'arrived_pickup',
    shortLabel: 'Arrived',
    label: 'Arrived & Boarding',
    subtitle: 'At pickup portico · verify safety checklist & assist boarding.',
    percent: 50,
  },
  {
    phase: 'in_trip',
    shortLabel: 'In Trip',
    label: 'Trip in Progress',
    subtitle: 'Active passenger transit · live GPS & fair-rate telemetry synced.',
    percent: 75,
  },
  {
    phase: 'completed',
    shortLabel: 'Completed',
    label: 'Trip Completed',
    subtitle: 'Destination reached · flat ₹3 settled & net payout transferred.',
    percent: 100,
  },
];

export function getTripCompletionProgress(phase: DriverTripPhase): TripCompletionProgress {
  const activeIndex = TRIP_PHASE_STEPS.findIndex((s) => s.phase === phase);
  if (activeIndex < 0) {
    return {
      isVisible: false,
      phase,
      percent: 0,
      activeStepIndex: -1,
      totalSteps: TRIP_PHASE_STEPS.length,
      statusLabel: phase === 'offline' ? 'Offline' : phase === 'request_incoming' ? 'Incoming Offer' : 'Online Radar',
      subtitle: 'Accept a dispatch request to track real-time trip progress.',
      steps: TRIP_PHASE_STEPS.map((s) => ({
        phase: s.phase,
        shortLabel: s.shortLabel,
        label: s.label,
        percent: s.percent,
        completed: false,
        active: false,
      })),
    };
  }

  const current = TRIP_PHASE_STEPS[activeIndex];
  const isCompletedPhase = phase === 'completed';

  return {
    isVisible: true,
    phase,
    percent: current.percent,
    activeStepIndex: activeIndex,
    totalSteps: TRIP_PHASE_STEPS.length,
    statusLabel: current.label,
    subtitle: current.subtitle,
    steps: TRIP_PHASE_STEPS.map((s, idx) => ({
      phase: s.phase,
      shortLabel: s.shortLabel,
      label: s.label,
      percent: s.percent,
      completed: isCompletedPhase ? idx <= activeIndex : idx < activeIndex,
      active: idx === activeIndex,
    })),
  };
}

export function getCcavenuePaymentOption(
  method: LiveRideOrder['paymentMethod']
): 'OPTUPI' | 'OPTCRDC' | 'OPTNBK' | 'CASH' {
  switch (method) {
    case 'ccavenue_upi':
      return 'OPTUPI';
    case 'ccavenue_card':
      return 'OPTCRDC';
    case 'ccavenue_netbanking':
      return 'OPTNBK';
    default:
      return 'CASH';
  }
}

export function formatPaymentMethodLabel(method: LiveRideOrder['paymentMethod'] | string): string {
  switch (method) {
    case 'ccavenue_upi':
      return 'CCAvenue UPI';
    case 'ccavenue_card':
      return 'CCAvenue Card';
    case 'ccavenue_netbanking':
      return 'CCAvenue NetBanking';
    case 'cash':
      return 'Cash on Arrival';
    default:
      return String(method).replace(/_/g, ' ').toUpperCase();
  }
}

export function validateCcavenueCheckoutInput(params: {
  method: LiveRideOrder['paymentMethod'];
  upiId?: string;
  cardLast4?: string;
  bankCode?: string;
}): { valid: boolean; error?: string } {
  if (params.method === 'ccavenue_upi') {
    const res = validateUpiId(params.upiId ?? '');
    if (!res.valid) {
      return { valid: false, error: res.error || 'Enter a valid UPI ID for CCAvenue OPTUPI.' };
    }
    return { valid: true };
  }
  if (params.method === 'ccavenue_card') {
    const clean4 = (params.cardLast4 ?? '').replace(/\D/g, '');
    if (clean4.length !== 4) {
      return { valid: false, error: 'Enter the 4-digit card suffix for Visa / Mastercard / RuPay.' };
    }
    return { valid: true };
  }
  if (params.method === 'ccavenue_netbanking') {
    if (!params.bankCode || params.bankCode.trim().length < 2) {
      return { valid: false, error: 'Select a bank for CCAvenue NetBanking.' };
    }
    return { valid: true };
  }
  return { valid: true };
}

export function resolveOfferGeoEndpoints(
  offer: Pick<RideOffer, 'pickupLatLng' | 'dropoffLatLng' | 'pickupCoords' | 'dropoffCoords'>,
  fallbackCenter: GeoPoint = { lat: 12.9716, lng: 77.5946 }
): { pickup: GeoPoint; dropoff: GeoPoint } {
  const hasValidPoint = (pt?: GeoPoint): pt is GeoPoint =>
    Boolean(pt && Number.isFinite(pt.lat) && Number.isFinite(pt.lng));

  const pickup: GeoPoint = hasValidPoint(offer.pickupLatLng)
    ? offer.pickupLatLng
    : {
        lat: Number((fallbackCenter.lat + (50 - (offer.pickupCoords?.y ?? 50)) * 0.002).toFixed(5)),
        lng: Number((fallbackCenter.lng + ((offer.pickupCoords?.x ?? 50) - 50) * 0.002).toFixed(5)),
      };

  const dropoff: GeoPoint = hasValidPoint(offer.dropoffLatLng)
    ? offer.dropoffLatLng
    : {
        lat: Number((fallbackCenter.lat + (50 - (offer.dropoffCoords?.y ?? 55)) * 0.002).toFixed(5)),
        lng: Number((fallbackCenter.lng + ((offer.dropoffCoords?.x ?? 55) - 50) * 0.002).toFixed(5)),
      };

  return { pickup, dropoff };
}

export function computeStaticRoutePreviewGeometry(
  pickup: GeoPoint,
  dropoff: GeoPoint
): {
  center: GeoPoint;
  zoom: number;
  approxDistanceKm: number;
  pickupSvg: { x: number; y: number };
  dropoffSvg: { x: number; y: number };
} {
  const center: GeoPoint = {
    lat: Number(((pickup.lat + dropoff.lat) / 2).toFixed(5)),
    lng: Number(((pickup.lng + dropoff.lng) / 2).toFixed(5)),
  };

  const span = Math.max(Math.abs(pickup.lat - dropoff.lat), Math.abs(pickup.lng - dropoff.lng));
  let zoom = 13;
  if (span > 2.5) zoom = 7;
  else if (span > 1.2) zoom = 8;
  else if (span > 0.6) zoom = 9;
  else if (span > 0.25) zoom = 10;
  else if (span > 0.1) zoom = 11;
  else if (span > 0.04) zoom = 12;
  else if (span < 0.01) zoom = 14;

  const approxDistanceKm = estimateRoadDistanceKm(pickup, dropoff);

  // Normalized 0..100 coordinates within a padded SVG frame [18..82]
  const dLat = dropoff.lat - pickup.lat;
  const dLng = dropoff.lng - pickup.lng;
  const maxAbs = Math.max(Math.abs(dLat), Math.abs(dLng), 0.0001);
  const scale = 28 / maxAbs;

  const pX = Number((50 - (dLng / 2) * scale).toFixed(1));
  const pY = Number((50 + (dLat / 2) * scale).toFixed(1));
  const dX = Number((50 + (dLng / 2) * scale).toFixed(1));
  const dY = Number((50 - (dLat / 2) * scale).toFixed(1));

  return {
    center,
    zoom,
    approxDistanceKm,
    pickupSvg: { x: Math.max(16, Math.min(84, pX)), y: Math.max(18, Math.min(82, pY)) },
    dropoffSvg: { x: Math.max(16, Math.min(84, dX)), y: Math.max(18, Math.min(82, dY)) },
  };
}

export function formatIndianE164Phone(rawPhone: string): string {
  const clean = normalizeIndianMobile(rawPhone);
  if (!isValidIndianMobile(clean)) return '';
  return `+91${clean}`;
}

export function isVerifiedFirebaseAuthUser(
  userLike: { emailVerified?: boolean; phoneNumber?: string | null } | null | undefined
): boolean {
  if (!userLike) return false;
  if (userLike.emailVerified === true) return true;
  if (typeof userLike.phoneNumber === 'string' && userLike.phoneNumber.trim().length >= 8) {
    return true;
  }
  return false;
}

export function classifyFirebasePhoneAuthError(err: unknown): {
  code: string;
  message: string;
  canFallbackToGateway: boolean;
  requiresConsoleSetup: boolean;
} {
  const rawCode =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  const rawMsg = err instanceof Error ? err.message : String(err ?? '');
  const combined = `${rawCode} ${rawMsg}`.toLowerCase();

  if (combined.includes('invalid-verification-code')) {
    return {
      code: rawCode || 'auth/invalid-verification-code',
      message: 'Invalid Firebase OTP code. Please double-check the 6-digit SMS code and try again.',
      canFallbackToGateway: false,
      requiresConsoleSetup: false,
    };
  }
  if (combined.includes('code-expired') || combined.includes('session-expired')) {
    return {
      code: rawCode || 'auth/code-expired',
      message: 'Firebase OTP expired. Request a fresh verification code.',
      canFallbackToGateway: false,
      requiresConsoleSetup: false,
    };
  }
  if (combined.includes('invalid-phone-number')) {
    return {
      code: rawCode || 'auth/invalid-phone-number',
      message: 'Enter a valid 10-digit +91 Indian mobile number.',
      canFallbackToGateway: false,
      requiresConsoleSetup: false,
    };
  }
  if (combined.includes('operation-not-allowed')) {
    return {
      code: rawCode || 'auth/operation-not-allowed',
      message:
        'Enable Phone Sign-in provider in Firebase Console (Authentication → Sign-in method → Phone).',
      canFallbackToGateway: true,
      requiresConsoleSetup: true,
    };
  }
  if (combined.includes('billing-not-enabled')) {
    return {
      code: rawCode || 'auth/billing-not-enabled',
      message:
        'Firebase real SMS requires Blaze billing or configured Firebase Test Phone Numbers in Console.',
      canFallbackToGateway: true,
      requiresConsoleSetup: true,
    };
  }
  if (combined.includes('unauthorized-domain')) {
    return {
      code: rawCode || 'auth/unauthorized-domain',
      message:
        'Add this app domain to Firebase Console → Authentication → Settings → Authorized domains.',
      canFallbackToGateway: true,
      requiresConsoleSetup: true,
    };
  }
  if (combined.includes('provider-already-linked') || combined.includes('credential-already-in-use')) {
    return {
      code: rawCode || 'auth/credential-already-in-use',
      message: 'This phone number is already linked to another Firebase account.',
      canFallbackToGateway: false,
      requiresConsoleSetup: false,
    };
  }
  if (combined.includes('too-many-requests') || combined.includes('quota-exceeded')) {
    return {
      code: rawCode || 'auth/too-many-requests',
      message: 'Firebase SMS rate limit reached for this number. Try again shortly or use fallback gateway.',
      canFallbackToGateway: true,
      requiresConsoleSetup: false,
    };
  }
  if (combined.includes('captcha') || combined.includes('timed out') || combined.includes('network')) {
    return {
      code: rawCode || 'auth/captcha-check-failed',
      message: 'Firebase reCAPTCHA check unavailable in preview — using Aurelia Secure SMS Gateway.',
      canFallbackToGateway: true,
      requiresConsoleSetup: false,
    };
  }

  return {
    code: rawCode || 'auth/phone-auth-unavailable',
    message: rawMsg || 'Firebase Phone OTP unavailable in current environment.',
    canFallbackToGateway: true,
    requiresConsoleSetup: false,
  };
}

export function evaluateDistrictTrafficRiskEstimation(
  districtName: string,
  distanceKm: number,
  estimatedDurationMins: number
): TrafficRiskEstimation {
  const cleanDistrict = (districtName || 'Bengaluru Urban').toLowerCase();
  const safeDist = Math.max(1, distanceKm);
  const safeEstMins = Math.max(5, estimatedDurationMins);

  // Machine Learning heuristic simulation based on historical district congestion weights
  let baseCongestion = 1.15;
  let corridorName = 'NH-44 / Outer Ring Corridor';

  if (cleanDistrict.includes('bengaluru urban') || cleanDistrict.includes('bengaluru')) {
    baseCongestion = 1.42;
    corridorName = 'Silk Board – Outer Ring Road & Hebbal Expressway';
  } else if (cleanDistrict.includes('dakshina kannada') || cleanDistrict.includes('mangaluru')) {
    baseCongestion = 1.28;
    corridorName = 'NH-66 Coastal Highway & Hampankatta Junction';
  } else if (cleanDistrict.includes('mysuru')) {
    baseCongestion = 1.22;
    corridorName = 'Mysuru Palace – Kuvempunagar Corridor';
  } else if (cleanDistrict.includes('dharwad') || cleanDistrict.includes('hubballi')) {
    baseCongestion = 1.25;
    corridorName = 'Hubballi Vidyanagar & NH-48 Bypass';
  } else if (cleanDistrict.includes('belagavi')) {
    baseCongestion = 1.18;
    corridorName = 'Nehru Nagar & NH-48 Corridor';
  }

  // Distance and time-of-day feature weighting
  const distFactor = Math.min(1.25, 1 + safeDist * 0.012);
  const congestionIndex = Number((baseCongestion * distFactor).toFixed(2));
  const predictedMins = Math.round(safeEstMins * congestionIndex);
  const riskScore = Math.min(98, Math.round((congestionIndex - 1.0) * 210));
  const isHighRisk = riskScore >= 35 || congestionIndex >= 1.30;

  return {
    isHighRisk,
    riskScore,
    congestionIndex,
    historicalAvgMins: safeEstMins,
    predictedMins,
    primaryCorridor: corridorName,
    riskLabel: isHighRisk ? 'High Traffic Risk (ML Congestion Alert)' : 'Moderate / Clear Flow',
    recommendation: isHighRisk
      ? `Historical ML model predicts +${predictedMins - safeEstMins} min delay due to peak bottleneck along ${corridorName}. Consider alternate arterial route or accept with buffer.`
      : `District traffic flow is stable along ${corridorName}. Standard arrival time expected.`,
  };
}


export function formatDurationMmSs(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function evaluateTripDurationWarning(
  elapsedSeconds: number,
  estimatedDurationMins: number
): TripDurationWarning {
  const safeElapsed = Math.max(0, Math.floor(elapsedSeconds));
  const safeEstMins = Math.max(1, Math.round(estimatedDurationMins));
  const estimatedSeconds = safeEstMins * 60;
  const thresholdSeconds = Math.round(estimatedSeconds * 1.2);
  const thresholdMins = Number((thresholdSeconds / 60).toFixed(1));
  const isExceeded = safeElapsed > thresholdSeconds;
  const overrunSeconds = Math.max(0, safeElapsed - estimatedSeconds);
  const overrunMinutes = Number((overrunSeconds / 60).toFixed(1));
  const overrunPercent = estimatedSeconds > 0 ? Math.round((overrunSeconds / estimatedSeconds) * 100) : 0;

  return {
    isExceeded,
    elapsedSeconds: safeElapsed,
    elapsedMins: Number((safeElapsed / 60).toFixed(1)),
    estimatedMins: safeEstMins,
    thresholdSeconds,
    thresholdMins,
    overrunSeconds,
    overrunMinutes,
    overrunPercent,
    elapsedFormatted: formatDurationMmSs(safeElapsed),
    estimatedFormatted: formatDurationMmSs(estimatedSeconds),
    title: isExceeded
      ? `Trip Duration Exceeded +${overrunPercent}% (+${overrunMinutes} min)`
      : `On Schedule · Est. ${safeEstMins} min`,
    message: isExceeded
      ? `Current trip time (${formatDurationMmSs(safeElapsed)}) has exceeded the original ${safeEstMins} min estimate by more than 20% (+${overrunMinutes} min). Keep the passenger informed of the updated arrival time.`
      : `Warning triggers automatically if duration exceeds ${thresholdMins} min (+20% threshold).`,
  };
}

export function interpolateLiveTrackingPosition(
  pickup: GeoPoint,
  dropoff: GeoPoint,
  progressRatio: number,
  phase: DriverTripPhase | LiveRideStatus
): GeoPoint {
  const t = Math.max(0, Math.min(1, progressRatio));

  if (phase === 'arrived_pickup' || phase === 'arrived') {
    return { lat: Number(pickup.lat.toFixed(5)), lng: Number(pickup.lng.toFixed(5)) };
  }
  if (phase === 'completed') {
    return { lat: Number(dropoff.lat.toFixed(5)), lng: Number(dropoff.lng.toFixed(5)) };
  }

  if (phase === 'en_route_pickup' || phase === 'en_route' || phase === 'matched') {
    const startApproach: GeoPoint = {
      lat: pickup.lat - 0.0085,
      lng: pickup.lng - 0.0065,
    };
    return {
      lat: Number((startApproach.lat + (pickup.lat - startApproach.lat) * t).toFixed(5)),
      lng: Number((startApproach.lng + (pickup.lng - startApproach.lng) * t).toFixed(5)),
    };
  }

  // 'in_trip' corridor interpolation pickup -> dropoff
  return {
    lat: Number((pickup.lat + (dropoff.lat - pickup.lat) * t).toFixed(5)),
    lng: Number((pickup.lng + (dropoff.lng - pickup.lng) * t).toFixed(5)),
  };
}

export function computeLiveTrackingMetrics(params: {
  currentPos: GeoPoint;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  phase: DriverTripPhase | LiveRideStatus;
  plannedDistanceKm?: number;
}): LiveTrackingMetrics {
  const { currentPos, pickup, dropoff, phase, plannedDistanceKm } = params;
  const isPickupPhase =
    phase === 'en_route_pickup' ||
    phase === 'arrived_pickup' ||
    phase === 'en_route' ||
    phase === 'matched' ||
    phase === 'arrived' ||
    phase === 'searching';

  const targetPos = isPickupPhase ? pickup : dropoff;
  const isAtStop =
    phase === 'arrived_pickup' || phase === 'arrived' || phase === 'completed';

  const rawRemainingKm = isAtStop
    ? 0
    : estimateRoadDistanceKm(currentPos, targetPos);
  const totalLegKm = isPickupPhase
    ? Math.max(0.8, estimateRoadDistanceKm({ lat: pickup.lat - 0.0085, lng: pickup.lng - 0.0065 }, pickup))
    : Math.max(0.8, plannedDistanceKm ?? estimateRoadDistanceKm(pickup, dropoff));

  const remainingKm = isAtStop ? 0 : Math.min(totalLegKm * 1.4, rawRemainingKm);
  const etaMins = isAtStop ? 0 : Math.max(1, Math.round((remainingKm / 26) * 60));

  const dLat = targetPos.lat - currentPos.lat;
  const dLng = targetPos.lng - currentPos.lng;
  const bearingRad = Math.atan2(dLng, dLat);
  const bearingDeg = Math.round(((bearingRad * 180) / Math.PI + 360) % 360);

  let progressFraction = 0;
  if (phase === 'completed') {
    progressFraction = 1;
  } else if (phase === 'arrived_pickup' || phase === 'arrived') {
    progressFraction = 0.04;
  } else if (isPickupPhase) {
    progressFraction = Math.max(0, Math.min(1, 1 - remainingKm / totalLegKm));
  } else {
    const legTotal = Math.max(0.5, estimateRoadDistanceKm(pickup, dropoff));
    progressFraction = Math.max(0, Math.min(0.99, 1 - rawRemainingKm / legTotal));
  }

  const phaseLabel =
    phase === 'completed'
      ? 'Arrived at Destination'
      : phase === 'arrived_pickup' || phase === 'arrived'
        ? 'Driver at Pickup Point'
        : isPickupPhase
          ? 'Driver Approaching Pickup'
          : 'Live En Route to Destination';

  return {
    currentPos,
    targetPos,
    remainingKm: Number(remainingKm.toFixed(1)),
    etaMins,
    bearingDeg,
    progressFraction: Number(progressFraction.toFixed(3)),
    phaseLabel,
  };
}



