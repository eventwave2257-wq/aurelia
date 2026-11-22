export type AppTab = 'drive' | 'care' | 'auto' | 'documents' | 'earnings' | 'access';

export type VehicleTier = 'bike' | 'car_economy' | 'car_premier' | 'car_elite';

export type PricingModel = 'legacy_pct' | 'per_km_19';

export type RideCategory =
  | 'standard'
  | 'care_wheelchair'
  | 'care_medical'
  | 'care_sensory'
  | 'care_oxygen';

export type DriverTripPhase =
  | 'offline'
  | 'online_idle'
  | 'request_incoming'
  | 'en_route_pickup'
  | 'arrived_pickup'
  | 'in_trip'
  | 'completed';

export type EarningsPeriod = 'today' | 'week' | 'month';
export type EarningsFocus = 'compare' | 'standard' | 'care';

export type BackgroundCheckStatus =
  | 'Verified & Cleared'
  | 'Pending Review'
  | 'Renewal Required'
  | 'Action Required';

export type AccessibilityNeedOption =
  | 'Wheelchair Accessible Vehicle (WAV)'
  | 'Assistance with Boarding'
  | 'Oxygen Cylinder Mount'
  | 'Sensory-Calm Cabin'
  | 'Visual / Verbal Guidance'
  | 'Caregiver Companion Seat';

export interface Coordinates {
  x: number; // 0..100 normalized fallback space
  y: number; // 0..100 normalized fallback space
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface KarnatakaDistrict {
  id: string;
  name: string;
  headquarters: string;
  division:
    | 'Bengaluru Division'
    | 'Mysuru Division'
    | 'Belagavi Division'
    | 'Kalaburagi Division';
  lat: number;
  lng: number;
  highwayCode: string;
  medicalCenter: string;
}

export interface KarnatakaLandmark {
  id: string;
  title: string;
  subtitle: string;
  district: string;
  kind: 'hospital' | 'airport' | 'hub';
  lat: number;
  lng: number;
}

export interface HighEarningZone {
  id: string;
  name: string;
  districtId: string;
  district: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  orderFrequencyLabel: string;
}

export interface SpeedLimitPolicy {
  maxSpeedKmh: number;
  fineInr: number;
  categoryLabel: 'Bike' | 'Cars';
}

export interface SpeedViolationEvaluation {
  exceeded: boolean;
  speedKmh: number;
  maxSpeedKmh: number;
  overByKmh: number;
  fineInr: number;
  categoryLabel: 'Bike' | 'Cars';
}

export interface EmergencyServiceContact {
  label: string;
  phone: string;
  detail: string;
}

export interface DistrictEmergencyContacts {
  districtId: string;
  districtName: string;
  headquarters: string;
  division: KarnatakaDistrict['division'];
  highwayCode: string;
  police: {
    title: string;
    emergencyDial: string;
    controlRoomPhone: string;
    jurisdiction: string;
  };
  hospital: {
    name: string;
    emergencyDial: string;
    deskPhone: string;
    address: string;
  };
  emergencyServices: EmergencyServiceContact[];
}

export interface SelectedPlacePoint {
  label: string;
  formattedAddress: string;
  location: GeoPoint;
  source: 'google_places' | 'karnataka_directory';
}

export type AppPortalMode = 'driver' | 'customer' | 'admin';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type PaymentMethod =
  | 'ccavenue_upi'
  | 'ccavenue_card'
  | 'ccavenue_netbanking'
  | 'cash';

export type LiveRideStatus =
  | 'searching'
  | 'matched'
  | 'en_route'
  | 'arrived'
  | 'in_trip'
  | 'completed'
  | 'cancelled';

export interface PlannedRouteSummary {
  pickup: SelectedPlacePoint;
  dropoff: SelectedPlacePoint;
  distanceKm: number;
  durationMins: number;
  totalFareInr: number;
  companyMaintenanceFeeInr: number;
  driverNetInr: number;
  vehicleTier: VehicleTier;
  isEmergencyHospitalVisit: boolean;
  source: 'google_routes' | 'corridor_estimate';
  fareCondition?: FareConditionId;
  effectiveRatePerKm?: number;
}

export interface AccessibilityChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface PerRideTransferEntry {
  tripId: string;
  riderOrPatientName: string;
  completedAt: string;
  grossFareInr: number;
  deductedFeeInr: number;
  transferredNetInr: number;
  payoutTarget: string;
  status: 'transferred' | 'reconciled';
}

export interface FlatRideTransferSummary {
  totalTrips: number;
  totalGrossInr: number;
  totalDeductedFeeInr: number;
  totalTransferredNetInr: number;
  payoutTarget: string;
  entries: PerRideTransferEntry[];
}

export interface DriverProfileData {
  fullName: string;
  email: string;
  phone: string;
  cityRegion: string;
  yearsExperience: number;
  bio: string;
  upiId?: string;
  qrUpiPayload?: string;
  qrCodeDocName?: string;
  qrCodeDataUrl?: string;
  passwordHash?: string;
  passwordUpdatedAt?: string;
  licenseNumber?: string;
  licenseDocName?: string;
  licenseDocDataUrl?: string;
  vehicleDocName?: string;
  vehicleDocDataUrl?: string;
  approvalStatus?: ApprovalStatus;
  vehicleApprovalStatus?: ApprovalStatus;
  vehicle: {
    make: string;
    model: string;
    year: number;
    licensePlate: string;
    color: string;
    wavConfiguration: string;
  };
  specializations: string[];
  backgroundCheck: {
    status: BackgroundCheckStatus;
    lastUpdated: string;
    reviewedBy: string;
    notes: string;
  };
}

export interface DriverPerformanceStats {
  acceptedCount: number;
  declinedCount: number;
  completedCount: number;
  averageRating: number;
  ratingCount: number;
}

export interface RideOffer {
  id: string;
  linkedRideId?: string;
  category: RideCategory;
  vehicleTier?: VehicleTier;
  isEmergencyHospitalVisit?: boolean;
  pricingModel?: PricingModel;
  serviceLabel: string;
  riderName: string;
  riderRating: number;
  pickupAddress: string;
  dropoffAddress: string;
  pickupCoords: Coordinates;
  dropoffCoords: Coordinates;
  pickupLatLng?: GeoPoint;
  dropoffLatLng?: GeoPoint;
  pickupEtaMins: number;
  tripDurationMins: number;
  distanceMiles: number; // Represents km throughout Karnataka UI
  baseFare: number;
  surgeMultiplier: number;
  careStipend: number;
  estimatedTip: number;
  accessibilityNotes: string;
  equipmentRequired: string[];
  caregiverContact?: string;
  graceWaitMins: number;
  checklist: AccessibilityChecklistItem[];
}

export interface CareAppointment {
  id: string;
  category: Exclude<RideCategory, 'standard'>;
  vehicleTier?: VehicleTier;
  isEmergencyHospitalVisit?: boolean;
  pricingModel?: PricingModel;
  patientName: string;
  patientConditionSummary: string;
  mobilityEquipment: string;
  accessibilityNeeds: AccessibilityNeedOption[];
  assignedDriverName: string;
  pickupAddress: string;
  destinationFacility: string;
  pickupCoords: Coordinates;
  dropoffCoords: Coordinates;
  pickupLatLng?: GeoPoint;
  dropoffLatLng?: GeoPoint;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  distanceMiles: number; // km
  estimatedDurationMins: number;
  baseFare: number;
  careStipend: number;
  waitTimeProtectionBonus: number;
  caregiverName: string;
  caregiverPhone: string;
  boardingProtocol: string;
  claimed: boolean;
  completed: boolean;
  priorityLevel: 'Routine' | 'Time-Sensitive' | 'Critical Care';
}

export interface PassengerMultiPointRating {
  overall: number;
  curbReadiness: number;
  communication: number;
  equipmentReadiness: number;
  privateCareNotes?: string;
  updatedAt: string;
}

export interface CompletedTrip {
  id: string;
  category: RideCategory;
  vehicleTier?: VehicleTier;
  isEmergencyHospitalVisit?: boolean;
  pricingModel?: PricingModel;
  serviceLabel: string;
  riderOrPatientName: string;
  routeSummary: string;
  completedAt: string; // ISO string
  durationMins: number;
  distanceMiles: number; // km
  baseFare: number;
  surgeBonus: number;
  careStipend: number;
  tip: number;
  riderRatingGiven?: number;
  driverPassengerRating?: PassengerMultiPointRating;
}

export interface CategoryEarningsMetrics {
  tripCount: number;
  activeMinutes: number;
  totalMiles: number;
  grossFares: number;
  surgeBonuses: number;
  careStipends: number;
  tips: number;
  platformFees: number;
  netEarnings: number;
  avgNetPerTrip: number;
  hourlyRate: number;
}

export interface DailyComparisonPoint {
  dateKey: string;
  label: string;
  standardNet: number;
  careNet: number;
  standardTrips: number;
  careTrips: number;
}

export interface PeakWindowMetric {
  id: string;
  label: string;
  timeRange: string;
  standardNet: number;
  careNet: number;
  tripCount: number;
}

export interface CareCategoryBreakdownItem {
  category: Exclude<RideCategory, 'standard'>;
  label: string;
  tripCount: number;
  netEarnings: number;
  avgPayout: number;
}

export interface SpecialAppointmentsAnalysis {
  careSharePercent: number;
  hourlyAdvantage: number; // care ₹/hr minus standard ₹/hr
  commissionSaved: number;
  projectedWeeklyPotential: number;
  openQueuePotential: number;
  categoryBreakdown: CareCategoryBreakdownItem[];
}

export interface SeparateEarningsSummary {
  period: EarningsPeriod;
  combined: CategoryEarningsMetrics;
  standard: CategoryEarningsMetrics;
  care: CategoryEarningsMetrics;
  dailyComparison: DailyComparisonPoint[];
  peakWindows: PeakWindowMetric[];
  careSharePercent: number;
  specialAnalysis: SpecialAppointmentsAnalysis;
}

export type CompetitorBrand = 'Uber' | 'Rapido' | 'Ola' | 'Namma Yatri';

export type ComparisonVehicleMode = VehicleTier | 'auto';

export type FareConditionId =
  | 'standard_19'
  | 'off_peak_corridor'
  | 'long_distance'
  | 'high_earning_zone'
  | 'peak_traffic_fair'
  | 'care_priority';

export interface CompetitorPerKmQuote {
  brand: CompetitorBrand;
  customerRatePerKm: number;
  commissionPercent: number;
  platformCutPerKm: number;
  driverNetPerKm: number;
  surgeNote: string;
}

export interface WinWinFareEvaluation {
  vehicleMode: ComparisonVehicleMode;
  conditionId: FareConditionId;
  conditionLabel: string;
  conditionSummary: string;
  distanceKm: number;
  competitors: CompetitorPerKmQuote[];
  marketAverageRatePerKm: number;
  cheapestCompetitorBrand: CompetitorBrand;
  cheapestCompetitorRatePerKm: number;
  aureliaStandardRatePerKm: number;
  aureliaReducedRatePerKm: number;
  aureliaPlatformFeePerKm: number;
  aureliaDriverNetPerKm: number;
  customerTotalFare: number;
  driverTotalNetPayout: number;
  companyTotalFee: number;
  customerSavingsVsAvgInr: number;
  customerSavingsPercentVsAvg: number;
  customerSavingsVsCheapestInr: number;
  driverAdvantageVsAvgPerKm: number;
  driverHappyReason: string;
  customerHappyReason: string;
}

export interface DriverPreferences {
  darkMode: boolean;
  largeAssist: boolean;
  voiceReadout: boolean;
  reducedMotion: boolean;
  autoAcceptCarePriority: boolean;
  emergencyHospitalFirst: boolean;
  selectedVehicleTier: VehicleTier;
  selectedDistrictId: string;
  activeFareCondition?: FareConditionId;
  minFareFilter: number;
  maxPickupMiles: number;
  destinationFilter: string;
  certifications: {
    wheelchairRamp: boolean;
    oxygenSupport: boolean;
    cprFirstAid: boolean;
    sensoryCalmCabin: boolean;
  };
}

export interface NewCareBookingInput {
  patientName: string;
  category: Exclude<RideCategory, 'standard'>;
  vehicleTier: VehicleTier;
  patientConditionSummary: string;
  mobilityEquipment: string;
  accessibilityNeeds: AccessibilityNeedOption[];
  assignedDriverName: string;
  pickupAddress: string;
  destinationFacility: string;
  scheduledDate: string;
  scheduledTime: string;
  distanceMiles: string;
  baseFare: string;
  careStipend: string;
  caregiverName: string;
  caregiverPhone: string;
  boardingProtocol: string;
  priorityLevel: CareAppointment['priorityLevel'];
}

export interface InTripPayoutPreview {
  baseFareInr: number;
  surgeBonusInr: number;
  careStipendInr: number;
  tipInr: number;
  grossBeforeTipInr: number;
  grossWithTipInr: number;
  platformFeeInr: number;
  netDriverPayoutInr: number;
  flatFeeDeductedInr: number;
  flatTransferredNetInr: number;
}

export interface LiveRideOrder {
  id: string;
  customerId: string;
  customerName: string;
  driverId?: string;
  driverName?: string;
  pickupLabel: string;
  dropoffLabel: string;
  pickupLatLng: GeoPoint;
  dropoffLatLng: GeoPoint;
  vehicleTier: VehicleTier;
  fareCondition: FareConditionId;
  distanceKm: number;
  fareInr: number;
  driverNetInr: number;
  companyFeeInr: number;
  tipInr?: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  ccavenueOrderId?: string;
  ccavenueTrackingId?: string;
  ccavenueBankRefNo?: string;
  driverLat: number;
  driverLng: number;
  status: LiveRideStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DriverPayoutRecord {
  id: string;
  driverId: string;
  driverName: string;
  upiId: string;
  grossCollectedInr: number;
  companyFeeInr: number;
  netPayoutInr: number;
  utrReference: string;
  status: 'pending' | 'reconciled' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface SupportComplaint {
  id: string;
  reporterUid: string;
  reporterRole: 'customer' | 'driver';
  rideId?: string;
  subject: string;
  details: string;
  status: 'open' | 'investigating' | 'resolved';
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FleetApplicantRecord {
  uid: string;
  fullName: string;
  phone: string;
  cityRegion: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  licensePlate: string;
  vehicleTier: VehicleTier;
  licenseNumber: string;
  upiId: string;
  approvalStatus: ApprovalStatus;
  vehicleApprovalStatus: ApprovalStatus;
  licenseDocName?: string;
  vehicleDocName?: string;
  updatedAt: string;
}

export interface TripCompletionStep {
  phase: 'en_route_pickup' | 'arrived_pickup' | 'in_trip' | 'completed';
  shortLabel: string;
  label: string;
  percent: number;
  completed: boolean;
  active: boolean;
}

export interface TripCompletionProgress {
  isVisible: boolean;
  phase: DriverTripPhase;
  percent: number;
  activeStepIndex: number;
  totalSteps: number;
  statusLabel: string;
  subtitle: string;
  steps: TripCompletionStep[];
}


