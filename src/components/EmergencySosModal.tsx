import { useEffect, useState } from 'react';
import {
  Accessibility,
  Ambulance,
  Copy,
  Hospital,
  MapPin,
  PhoneCall,
  Shield,
  ShieldAlert,
  Siren,
  X,
} from 'lucide-react';
import { KARNATAKA_31_DISTRICTS } from '../data/karnatakaDistricts';
import type { DriverTripPhase, RideOffer } from '../types/aurelia';
import { getDistrictEmergencyContacts } from '../utils/aureliaLogic';

interface EmergencySosModalProps {
  isOpen: boolean;
  selectedDistrictId: string;
  phase: DriverTripPhase;
  activeOffer: RideOffer | null;
  onSelectDistrictId?: (districtId: string) => void;
  onClose: () => void;
}

export function EmergencySosModal({
  isOpen,
  selectedDistrictId,
  phase,
  activeOffer,
  onSelectDistrictId,
  onClose,
}: EmergencySosModalProps) {
  const [modalDistrictId, setModalDistrictId] = useState<string>(selectedDistrictId);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setModalDistrictId(selectedDistrictId);
      setStatusMessage(null);
    }
  }, [isOpen, selectedDistrictId]);

  if (!isOpen) return null;

  const contacts = getDistrictEmergencyContacts(modalDistrictId);
  const isActiveTrip =
    phase === 'en_route_pickup' || phase === 'arrived_pickup' || phase === 'in_trip';

  const handleDistrictChange = (nextId: string) => {
    setModalDistrictId(nextId);
    setStatusMessage(null);
    if (onSelectDistrictId) {
      onSelectDistrictId(nextId);
    }
  };

  const handleCopyContacts = async () => {
    const summary = [
      `AURELIA SOS — ${contacts.districtName} District (${contacts.headquarters})`,
      `Police: ${contacts.police.title} | Emergency ${contacts.police.emergencyDial} | Control ${contacts.police.controlRoomPhone}`,
      `Hospital: ${contacts.hospital.name} | Ambulance ${contacts.hospital.emergencyDial} | Desk ${contacts.hospital.deskPhone}`,
      ...contacts.emergencyServices.map((s) => `${s.label}: ${s.phone} (${s.detail})`),
    ].join('\n');

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
      }
      setStatusMessage(
        `Copied ${contacts.districtName} police, hospital, and emergency helpline contacts.`
      );
    } catch {
      setStatusMessage(
        `${contacts.districtName} contacts ready above for immediate dialing.`
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Emergency SOS contacts for ${contacts.districtName} District`}
      data-testid="emergency-sos-modal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4"
    >
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#101218] border border-rose-300 dark:border-rose-500/40 p-4 sm:p-5 space-y-3 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-600 dark:text-rose-400">
              {isActiveTrip ? 'Active Trip Priority SOS' : 'Karnataka District SOS Directory'}
            </p>
            <h3 className="font-display text-lg sm:text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2 mt-0.5 leading-snug">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Emergency SOS · {contacts.districtName}</span>
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              {contacts.headquarters} · {contacts.division} · {contacts.highwayCode}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-sos-modal-btn"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/10 shrink-0"
            aria-label="Close emergency SOS modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Trip Banner (when triggered during a trip) */}
        {isActiveTrip && activeOffer && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/40 text-xs space-y-1">
            <p className="font-bold text-rose-900 dark:text-rose-200">
              Active Trip: {activeOffer.riderName} · {activeOffer.serviceLabel}
            </p>
            <p className="text-rose-800 dark:text-rose-300 truncate">
              Route: {activeOffer.pickupAddress} → {activeOffer.dropoffAddress}
            </p>
          </div>
        )}

        {/* District Selector inside SOS */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-stone-50 dark:bg-white/[0.04] border border-stone-200/80 dark:border-white/10">
          <label
            htmlFor="sos-district-select"
            className="text-xs font-semibold text-stone-700 dark:text-stone-300"
          >
            Pre-Saved District Contacts:
          </label>
          <select
            id="sos-district-select"
            data-testid="sos-district-select"
            value={modalDistrictId}
            onChange={(e) => handleDistrictChange(e.target.value)}
            className="min-h-[38px] px-3 rounded-xl border border-stone-200 dark:border-white/15 bg-white dark:bg-[#07080B] text-xs font-semibold text-stone-900 dark:text-white"
          >
            {KARNATAKA_31_DISTRICTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {statusMessage && (
          <div
            role="status"
            data-testid="sos-status-banner"
            className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700 text-xs font-medium text-emerald-900 dark:text-emerald-200"
          >
            {statusMessage}
          </div>
        )}

        {/* 1. Local Police Contact Card */}
        <section
          aria-label="Local police emergency contacts"
          data-testid="sos-police-card"
          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-900 dark:text-white">
                Local Police
              </h4>
            </div>
            <span className="text-[11px] font-mono-tabular font-bold px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300">
              Dial {contacts.police.emergencyDial}
            </span>
          </div>
          <p className="text-sm font-bold text-stone-900 dark:text-white">
            {contacts.police.title}
          </p>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Jurisdiction: {contacts.police.jurisdiction}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              href={`tel:${contacts.police.controlRoomPhone}`}
              onClick={() =>
                setStatusMessage(
                  `Dialing ${contacts.police.title} (${contacts.police.controlRoomPhone})…`
                )
              }
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-mono-tabular inline-flex items-center gap-1.5"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Control Room: {contacts.police.controlRoomPhone}</span>
            </a>
            <a
              href="tel:112"
              onClick={() =>
                setStatusMessage(
                  `Connected to 112 ERSS Police Response for ${contacts.districtName}.`
                )
              }
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-blue-300 dark:border-blue-500/40 text-blue-800 dark:text-blue-300 text-xs font-bold font-mono-tabular inline-flex items-center gap-1.5 hover:bg-blue-50 dark:hover:bg-blue-500/10"
            >
              <Siren className="w-3.5 h-3.5" />
              <span>Emergency 112</span>
            </a>
          </div>
        </section>

        {/* 2. Local Hospital Contact Card */}
        <section
          aria-label="Local hospital emergency contacts"
          data-testid="sos-hospital-card"
          className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-700/50 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Hospital className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-emerald-950 dark:text-emerald-200">
                Local Hospital &amp; Trauma Center
              </h4>
            </div>
            <span className="text-[11px] font-mono-tabular font-bold px-2 py-0.5 rounded-lg bg-emerald-200/80 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300">
              ER {contacts.hospital.emergencyDial}
            </span>
          </div>
          <p className="text-sm font-bold text-stone-900 dark:text-white">
            {contacts.hospital.name}
          </p>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            {contacts.hospital.address}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              href={`tel:${contacts.hospital.deskPhone}`}
              onClick={() =>
                setStatusMessage(
                  `Calling 24×7 Emergency Desk at ${contacts.hospital.name} (${contacts.hospital.deskPhone})…`
                )
              }
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold font-mono-tabular inline-flex items-center gap-1.5"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Hospital ER: {contacts.hospital.deskPhone}</span>
            </a>
            <a
              href="tel:108"
              onClick={() =>
                setStatusMessage(
                  `Dispatched 108 Trauma Ambulance toward ${contacts.hospital.name}.`
                )
              }
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-600/50 text-emerald-900 dark:text-emerald-300 text-xs font-bold font-mono-tabular inline-flex items-center gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/10"
            >
              <Ambulance className="w-3.5 h-3.5" />
              <span>108 Ambulance</span>
            </a>
          </div>
        </section>

        {/* 3. District Emergency Services Helplines */}
        <section
          aria-label="Emergency services helplines"
          data-testid="sos-services-card"
          className="p-3.5 rounded-2xl bg-stone-50 dark:bg-white/[0.04] border border-stone-200 dark:border-white/10 space-y-2.5"
        >
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-stone-800 dark:text-stone-200">
            Emergency Services ({contacts.districtName})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {contacts.emergencyServices.map((svc) => (
              <a
                key={svc.label}
                href={`tel:${svc.phone}`}
                onClick={() =>
                  setStatusMessage(
                    `Connecting to ${svc.label} (${svc.phone}) in ${contacts.districtName}…`
                  )
                }
                className="p-2.5 rounded-xl bg-white dark:bg-[#0B0D12] border border-stone-200 dark:border-white/10 hover:border-rose-400 dark:hover:border-rose-500/60 flex items-center justify-between gap-2 transition-colors min-h-[48px]"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                    {svc.label}
                  </p>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                    {svc.detail}
                  </p>
                </div>
                <span className="px-2 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold font-mono-tabular shrink-0">
                  {svc.phone}
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* Quick Telemetry & Concierge Dispatch Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
          <button
            type="button"
            onClick={() =>
              setStatusMessage(
                `Live GPS & active trip alert shared with ${contacts.districtName} Police (${contacts.police.controlRoomPhone}) & caregiver.`
              )
            }
            className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>Share SOS Telemetry</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusMessage(
                `Wheelchair lift & roadside medical crew dispatched in ${contacts.districtName} (ETA 8 min).`
              )
            }
            className="min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 dark:border-white/15 text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/[0.06] font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Accessibility className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Lift / Care Assist</span>
          </button>

          <button
            type="button"
            onClick={handleCopyContacts}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 dark:border-white/15 text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/[0.06] font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#E6C77E] shrink-0" />
            <span>Copy Contacts</span>
          </button>
        </div>
      </div>
    </div>
  );
}
