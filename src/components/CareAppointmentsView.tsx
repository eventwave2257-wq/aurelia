import { useMemo, useState } from 'react';
import {
  Accessibility,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Search,
  UserCheck,
} from 'lucide-react';
import { VEHICLE_TIER_OPTIONS } from '../data/karnatakaDistricts';
import {
  ALL_ACCESSIBILITY_NEED_OPTIONS,
  CARE_MOBILITY_IMG_PATH,
  TRAINED_CARE_DRIVERS,
} from '../data/seedData';
import type {
  AccessibilityNeedOption,
  CareAppointment,
  NewCareBookingInput,
  RideCategory,
  VehicleTier,
} from '../types/aurelia';
import {
  COMPANY_MAINTENANCE_FEE_PER_KM_INR,
  DRIVER_NET_PER_KM_INR,
  filterCareAppointments,
  formatCurrency,
  getCategoryDisplayLabel,
  getVehicleTierLabel,
  RATE_PER_KM_INR,
  roundCurrency,
  sortCareAppointmentsByPriority,
  validateCareAppointmentInput,
} from '../utils/aureliaLogic';

interface CareAppointmentsViewProps {
  appointments: CareAppointment[];
  careNetThisWeek: number;
  careTripsThisWeek: number;
  emergencyHospitalFirst: boolean;
  onToggleClaim: (id: string) => void;
  onStartCareTrip: (appointment: CareAppointment) => void;
  onCreateBooking: (appointment: CareAppointment) => void;
  onOpenCareAnalytics: () => void;
}

type CareFilter = 'all' | 'claimed' | Exclude<RideCategory, 'standard'>;

const FILTER_OPTIONS: { id: CareFilter; label: string }[] = [
  { id: 'all', label: 'All Care' },
  { id: 'claimed', label: 'My Claimed' },
  { id: 'care_wheelchair', label: 'Wheelchair' },
  { id: 'care_medical', label: 'Medical & Dialysis' },
  { id: 'care_oxygen', label: 'Post-Op & Oxygen' },
  { id: 'care_sensory', label: 'Sensory Assist' },
];

const EMPTY_FORM: NewCareBookingInput = {
  patientName: '',
  category: 'care_wheelchair',
  vehicleTier: 'car_elite',
  patientConditionSummary: '',
  mobilityEquipment: '',
  accessibilityNeeds: ['Wheelchair Accessible Vehicle (WAV)', 'Assistance with Boarding'],
  assignedDriverName: TRAINED_CARE_DRIVERS[0],
  pickupAddress: '',
  destinationFacility: '',
  scheduledDate: '2026-11-14',
  scheduledTime: '16:00',
  distanceMiles: '',
  baseFare: '',
  careStipend: '550',
  caregiverName: '',
  caregiverPhone: '',
  boardingProtocol: '',
  priorityLevel: 'Critical Care',
};

export function CareAppointmentsView({
  appointments,
  careNetThisWeek,
  careTripsThisWeek,
  emergencyHospitalFirst,
  onToggleClaim,
  onStartCareTrip,
  onCreateBooking,
  onOpenCareAnalytics,
}: CareAppointmentsViewProps) {
  const [filter, setFilter] = useState<CareFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [protocolApt, setProtocolApt] = useState<CareAppointment | null>(null);
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [formState, setFormState] = useState<NewCareBookingInput>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const visibleAppointments = useMemo(() => {
    const filtered = filterCareAppointments(appointments, filter, searchQuery);
    return sortCareAppointmentsByPriority(filtered, emergencyHospitalFirst);
  }, [appointments, filter, searchQuery, emergencyHospitalFirst]);

  const openAppointments = appointments.filter((a) => !a.completed);
  const claimedCount = openAppointments.filter((a) => a.claimed).length;
  const totalCarePotential = openAppointments.reduce(
    (sum, a) => sum + a.baseFare + a.careStipend + a.waitTimeProtectionBonus,
    0
  );

  const toggleAccessibilityNeed = (need: AccessibilityNeedOption) => {
    const exists = formState.accessibilityNeeds.includes(need);
    const updated = exists
      ? formState.accessibilityNeeds.filter((n) => n !== need)
      : [...formState.accessibilityNeeds, need];
    setFormState({ ...formState, accessibilityNeeds: updated });
  };

  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateCareAppointmentInput(formState);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const dist = Number(formState.distanceMiles);
    const created: CareAppointment = {
      id: `care-${Date.now()}`,
      category: formState.category,
      vehicleTier: formState.vehicleTier,
      isEmergencyHospitalVisit: formState.priorityLevel === 'Critical Care',
      pricingModel: 'per_km_19',
      patientName: formState.patientName.trim(),
      patientConditionSummary: formState.patientConditionSummary.trim(),
      mobilityEquipment: formState.mobilityEquipment.trim(),
      accessibilityNeeds: formState.accessibilityNeeds,
      assignedDriverName: formState.assignedDriverName,
      pickupAddress: formState.pickupAddress.trim(),
      destinationFacility: formState.destinationFacility.trim(),
      pickupCoords: { x: 66, y: 71 },
      dropoffCoords: { x: 73, y: 72 },
      pickupLatLng: { lat: 12.9716, lng: 77.5946 },
      dropoffLatLng: { lat: 12.9592, lng: 77.6480 },
      scheduledDate: formState.scheduledDate,
      scheduledTime: formState.scheduledTime,
      distanceMiles: roundCurrency(dist),
      estimatedDurationMins: Math.max(15, Math.round(dist * 2.5)),
      baseFare: roundCurrency(Number(formState.baseFare)),
      careStipend: roundCurrency(Number(formState.careStipend)),
      waitTimeProtectionBonus: 250,
      caregiverName: formState.caregiverName.trim(),
      caregiverPhone: formState.caregiverPhone.trim(),
      boardingProtocol: formState.boardingProtocol.trim(),
      claimed: true,
      completed: false,
      priorityLevel: formState.priorityLevel,
    };

    onCreateBooking(created);
    setFormState(EMPTY_FORM);
    setFormErrors({});
    setShowBookingModal(false);
    setFilter('all');
  };

  return (
    <div className="space-y-5">
      {/* Header & Summary Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-sm">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
            Special Appointments · Emergency Hospital Priority #1
          </p>
          <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-white">
            Special Appointments Hub
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-300 max-w-2xl">
            Pre-schedule wheelchair-accessible transfers, boarding assistance, and priority hospital
            visits across all 31 Karnataka districts at ₹{RATE_PER_KM_INR}/km (₹{DRIVER_NET_PER_KM_INR}/km chauffeur + ₹{COMPANY_MAINTENANCE_FEE_PER_KM_INR}/km company maint.).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="text-left sm:text-right mr-1">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {claimedCount} Claimed · {openAppointments.length} Open
            </p>
            <p className="text-xl font-bold text-stone-900 dark:text-white font-mono-tabular">
              {formatCurrency(totalCarePotential)} Queue Value
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFormErrors({});
              setShowBookingModal(true);
            }}
            data-testid="new-care-booking-btn"
            className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-stone-950 text-sm font-bold flex items-center gap-2 whitespace-nowrap shrink-0 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Pre-Schedule Appointment</span>
          </button>
        </div>
      </div>

      {/* Dedicated Specialist Earnings + Visual Care Mobility Showcase Banner */}
      <div className="rounded-3xl bg-[#0D1017]/95 backdrop-blur-xl border border-amber-400/25 text-white overflow-hidden grid grid-cols-1 md:grid-cols-12 shadow-sm">
        <div className="md:col-span-4 relative min-h-[132px]">
          <img
            src={CARE_MOBILITY_IMG_PATH}
            alt="Aurelia Electro-Hydraulic Care WAV Van at Hospital Portico"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0D1017]/90 hidden md:block" />
        </div>
        <div className="md:col-span-8 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#E6C77E]">
              Special Appointments Driver Earnings Segment
            </p>
            <p className="text-sm text-stone-200 font-mono-tabular">
              This Week: <strong className="text-white">{formatCurrency(careNetThisWeek)}</strong> net
              across {careTripsThisWeek} care trips · 100% care stipends + ₹{DRIVER_NET_PER_KM_INR}/km base payout
            </p>
            <p className="text-[11px] text-emerald-300">
              Electro-hydraulic WAV ramp · Oxygen mount · Emergency Hospital #1 corridor readiness
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCareAnalytics}
            className="min-h-[44px] px-4 rounded-xl bg-[#E6C77E] hover:bg-[#D4AF63] text-stone-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <BarChart3 className="w-4 h-4" />
            <span>View Specialist Earnings Analysis</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                filter === opt.id
                  ? 'bg-stone-900 dark:bg-[#E6C77E] text-white dark:text-stone-950 border-stone-900 dark:border-[#E6C77E]'
                  : 'bg-white/85 dark:bg-[#101218]/85 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/[0.06]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient, Bengaluru, Mysuru, WAV..."
            aria-label="Search care appointments"
            className="w-full min-h-[44px] pl-10 pr-3 py-2 rounded-xl bg-white/85 dark:bg-[#101218]/85 border border-stone-200 dark:border-white/10 text-sm text-stone-900 dark:text-white placeholder:text-stone-400"
          />
        </div>
      </div>

      {/* Appointments Grid */}
      {visibleAppointments.length === 0 ? (
        <div className="p-10 rounded-3xl bg-white/85 dark:bg-[#101218]/85 border border-stone-200 dark:border-white/10 text-center space-y-3">
          <HeartPulse className="w-8 h-8 text-emerald-600 mx-auto" />
          <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-white">
            No Matching Special Appointments
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
            Switch filter tabs or pre-schedule a new accessible appointment with a care-trained
            Karnataka chauffeur.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setSearchQuery('');
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-300 dark:border-white/15 text-sm font-semibold text-stone-800 dark:text-stone-200"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleAppointments.map((apt) => {
            const totalGuarantee =
              apt.baseFare + apt.careStipend + apt.waitTimeProtectionBonus;
            const isEmerg = Boolean(apt.isEmergencyHospitalVisit) || apt.priorityLevel === 'Critical Care';
            return (
              <article
                key={apt.id}
                data-testid="care-appointment-card"
                className={`p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border shadow-sm flex flex-col justify-between gap-4 ${
                  isEmerg
                    ? 'border-rose-300 dark:border-rose-500/40'
                    : 'border-stone-200/80 dark:border-white/10'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-stone-600 dark:text-stone-300">
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {getCategoryDisplayLabel(apt.category)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          isEmerg
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : 'text-stone-600 dark:text-stone-400'
                        }
                      >
                        {isEmerg ? 'Emergency Hospital #1' : apt.priorityLevel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#9A722A] dark:text-[#E6C77E]">
                        {getVehicleTierLabel(apt.vehicleTier)}
                      </span>
                    </div>

                    <span className="font-mono-tabular font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1">
                      <CalendarClock className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#E6C77E]" />
                      {apt.scheduledDate} {apt.scheduledTime}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-white">
                        {apt.patientName}
                      </h2>
                      <p className="text-sm text-stone-600 dark:text-stone-300 mt-0.5">
                        {apt.patientConditionSummary}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono-tabular">
                        {formatCurrency(totalGuarantee)}
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 font-mono-tabular">
                        ₹{RATE_PER_KM_INR}/km + {formatCurrency(apt.careStipend + apt.waitTimeProtectionBonus)} bonus
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#07080B] border border-stone-200/80 dark:border-white/10 space-y-2 text-xs">
                    <p className="font-semibold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                      <Accessibility className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{apt.accessibilityNeeds.join(' · ')}</span>
                    </p>
                    <p className="text-stone-700 dark:text-stone-300 flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#E6C77E] shrink-0" />
                      <span>Care Driver: {apt.assignedDriverName}</span>
                    </p>
                    <div className="flex items-start gap-2 text-stone-600 dark:text-stone-300">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 text-stone-500 shrink-0" />
                      <span>
                        {apt.pickupAddress} →{' '}
                        <strong className="text-stone-900 dark:text-white">
                          {apt.destinationFacility}
                        </strong>
                      </span>
                    </div>
                    <p className="text-stone-500 dark:text-stone-400 font-mono-tabular">
                      {apt.distanceMiles} km · Est. {apt.estimatedDurationMins} min ·{' '}
                      {apt.mobilityEquipment}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setProtocolApt(apt)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-200 dark:border-white/15 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-white/[0.06] flex items-center gap-1.5"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>Care Protocol</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleClaim(apt.id)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${
                      apt.claimed
                        ? 'border-amber-300 dark:border-[#E6C77E]/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-[#E6C77E]'
                        : 'border-stone-300 dark:border-white/15 text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{apt.claimed ? 'Claimed' : 'Claim Slot'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onStartCareTrip(apt)}
                    className="ml-auto min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Start Care Trip</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Care Protocol Detail Modal */}
      {protocolApt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Care boarding protocol details"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#101218] border border-stone-200 dark:border-white/15 p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {getCategoryDisplayLabel(protocolApt.category)} · {protocolApt.priorityLevel}
                </p>
                <h3 className="font-display text-2xl font-bold text-stone-900 dark:text-white mt-0.5">
                  {protocolApt.patientName} — Boarding Protocol
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProtocolApt(null)}
                aria-label="Close protocol details"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-sm text-stone-700 dark:text-stone-200">
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#07080B] border border-stone-200 dark:border-white/10">
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  Boarding & Clinical Instructions
                </p>
                <p className="mt-1 leading-relaxed">{protocolApt.boardingProtocol}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-stone-200 dark:border-white/10">
                  <p className="text-stone-500 dark:text-stone-400">Accessibility Requirements</p>
                  <p className="font-semibold text-stone-900 dark:text-white mt-0.5">
                    {protocolApt.accessibilityNeeds.join(', ')}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-stone-200 dark:border-white/10">
                  <p className="text-stone-500 dark:text-stone-400">Caregiver / Nurse Contact</p>
                  <p className="font-semibold text-stone-900 dark:text-white mt-0.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    {protocolApt.caregiverName} · {protocolApt.caregiverPhone}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProtocolApt(null)}
                className="min-h-[44px] px-4 rounded-xl border border-stone-300 dark:border-white/15 text-sm font-medium text-stone-700 dark:text-stone-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = protocolApt;
                  setProtocolApt(null);
                  onStartCareTrip(target);
                }}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-bold"
              >
                Dispatch This Trip Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Schedule Special Appointment Modal */}
      {showBookingModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pre-schedule special appointment with accessibility needs"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
        >
          <form
            onSubmit={handleSubmitBooking}
            noValidate
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#101218] border border-stone-200 dark:border-white/15 p-5 sm:p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-2xl font-bold text-stone-900 dark:text-white">
                  Pre-Schedule Special Appointment
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Priority hospital care & accessible Karnataka transfers (₹{RATE_PER_KM_INR}/km standard rate)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                aria-label="Close booking form"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Passenger / Patient Name
                </label>
                <input
                  type="text"
                  value={formState.patientName}
                  onChange={(e) => setFormState({ ...formState, patientName: e.target.value })}
                  placeholder="e.g., Meenakshi Deshpande"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                />
                {formErrors.patientName && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {formErrors.patientName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Care Category
                </label>
                <select
                  value={formState.category}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      category: e.target.value as Exclude<RideCategory, 'standard'>,
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                >
                  <option value="care_wheelchair">Wheelchair Mobility</option>
                  <option value="care_medical">Medical & Dialysis</option>
                  <option value="care_oxygen">Post-Op & Oxygen</option>
                  <option value="care_sensory">Sensory & Cognitive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Vehicle Tier
                </label>
                <select
                  value={formState.vehicleTier}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      vehicleTier: e.target.value as VehicleTier,
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                >
                  {VEHICLE_TIER_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Dispatch Priority
                </label>
                <select
                  value={formState.priorityLevel}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      priorityLevel: e.target.value as CareAppointment['priorityLevel'],
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                >
                  <option value="Critical Care">Critical Care (Emergency Hospital #1)</option>
                  <option value="Time-Sensitive">Time-Sensitive</option>
                  <option value="Routine">Routine</option>
                </select>
              </div>

              {/* Accessibility Needs */}
              <div className="sm:col-span-2 space-y-2">
                <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Specific Accessibility & Boarding Needs
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_ACCESSIBILITY_NEED_OPTIONS.map((opt) => {
                    const checked = formState.accessibilityNeeds.includes(opt);
                    return (
                      <label
                        key={opt}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl border border-stone-200 dark:border-white/10 cursor-pointer min-h-[44px] hover:bg-stone-50 dark:hover:bg-white/[0.04]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAccessibilityNeed(opt)}
                          className="w-4 h-4 accent-emerald-600 rounded shrink-0"
                        />
                        <span className="text-xs text-stone-800 dark:text-stone-200">{opt}</span>
                      </label>
                    );
                  })}
                </div>
                {formErrors.accessibilityNeeds && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {formErrors.accessibilityNeeds}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Trained Care Driver Assignment
                </label>
                <select
                  value={formState.assignedDriverName}
                  onChange={(e) =>
                    setFormState({ ...formState, assignedDriverName: e.target.value })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                >
                  {TRAINED_CARE_DRIVERS.map((drv) => (
                    <option key={drv} value={drv}>
                      {drv}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Medical / Disability Summary
                </label>
                <input
                  type="text"
                  value={formState.patientConditionSummary}
                  onChange={(e) =>
                    setFormState({ ...formState, patientConditionSummary: e.target.value })
                  }
                  placeholder="e.g., Power wheelchair + post-op mobility assistance"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                />
                {formErrors.patientConditionSummary && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {formErrors.patientConditionSummary}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Required Vehicle Equipment
                </label>
                <input
                  type="text"
                  value={formState.mobilityEquipment}
                  onChange={(e) =>
                    setFormState({ ...formState, mobilityEquipment: e.target.value })
                  }
                  placeholder="e.g., Electro-Hydraulic Side Ramp + 4-Point Restraints"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                />
                {formErrors.mobilityEquipment && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {formErrors.mobilityEquipment}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Pickup Address (Karnataka)
                </label>
                <input
                  type="text"
                  value={formState.pickupAddress}
                  onChange={(e) => setFormState({ ...formState, pickupAddress: e.target.value })}
                  placeholder="e.g., Sadashivanagar, Bengaluru"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                />
                {formErrors.pickupAddress && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {formErrors.pickupAddress}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Destination Hospital / Clinic
                </label>
                <input
                  type="text"
                  value={formState.destinationFacility}
                  onChange={(e) =>
                    setFormState({ ...formState, destinationFacility: e.target.value })
                  }
                  placeholder="e.g., Manipal Hospital, Bengaluru"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                />
                {formErrors.destinationFacility && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {formErrors.destinationFacility}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formState.scheduledDate}
                  onChange={(e) => setFormState({ ...formState, scheduledDate: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Appointment Time
                </label>
                <input
                  type="time"
                  value={formState.scheduledTime}
                  onChange={(e) => setFormState({ ...formState, scheduledTime: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Distance (km) — Auto ₹{RATE_PER_KM_INR}/km
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formState.distanceMiles}
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = Number(val);
                    const computedFare =
                      !Number.isNaN(num) && num > 0 ? String(Math.round(num * RATE_PER_KM_INR)) : '';
                    setFormState({
                      ...formState,
                      distanceMiles: val,
                      baseFare: computedFare || formState.baseFare,
                    });
                  }}
                  placeholder="10"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white font-mono-tabular"
                />
                {formErrors.distanceMiles && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {formErrors.distanceMiles}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Base Fare (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formState.baseFare}
                    onChange={(e) => setFormState({ ...formState, baseFare: e.target.value })}
                    placeholder="190"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white font-mono-tabular"
                  />
                  {formErrors.baseFare && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      {formErrors.baseFare}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Care Stipend (₹)
                  </label>
                  <input
                    type="number"
                    step="10"
                    value={formState.careStipend}
                    onChange={(e) => setFormState({ ...formState, careStipend: e.target.value })}
                    placeholder="550"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Caregiver / Coordinator Name
                </label>
                <input
                  type="text"
                  value={formState.caregiverName}
                  onChange={(e) => setFormState({ ...formState, caregiverName: e.target.value })}
                  placeholder="e.g., Dr. Nandini Rao"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                />
                {formErrors.caregiverName && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {formErrors.caregiverName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formState.caregiverPhone}
                  onChange={(e) => setFormState({ ...formState, caregiverPhone: e.target.value })}
                  placeholder="e.g., +91 80 4123 8890"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                />
                {formErrors.caregiverPhone && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {formErrors.caregiverPhone}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Boarding & Safety Protocol
                </label>
                <textarea
                  rows={2}
                  value={formState.boardingProtocol}
                  onChange={(e) => setFormState({ ...formState, boardingProtocol: e.target.value })}
                  placeholder="Describe portico access, ramp apron, or calm-cabin requirements..."
                  className="w-full p-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#07080B] text-sm text-stone-900 dark:text-white"
                />
                {formErrors.boardingProtocol && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {formErrors.boardingProtocol}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="min-h-[44px] px-4 rounded-xl border border-stone-300 dark:border-white/15 text-sm font-medium text-stone-700 dark:text-stone-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="submit-care-booking-btn"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-stone-950 text-sm font-bold"
              >
                Save Special Appointment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
