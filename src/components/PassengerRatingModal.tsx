import { useState } from 'react';
import { Lock, Star } from 'lucide-react';
import type { CompletedTrip, PassengerMultiPointRating } from '../types/aurelia';
import {
  calculateFlatRideTransfer,
  calculateTripFinancials,
  computePassengerRatingAverage,
  formatCurrency,
  isCareCategory,
  roundCurrency,
  validatePassengerRatingInput,
} from '../utils/aureliaLogic';

interface PassengerRatingModalProps {
  trip: CompletedTrip;
  onSave: (tripId: string, rating: PassengerMultiPointRating) => void;
  onClose: () => void;
}

const CARE_NOTE_PRESETS = [
  'Allow 5 min extra curb boarding time',
  'Smooth acceleration & low-audio cabin preferred',
  'Meet caregiver at hospital West Wing portico',
  'Side ramp apron clear; avoid steep front curb',
];

export function PassengerRatingModal({
  trip,
  onSave,
  onClose,
}: PassengerRatingModalProps) {
  const existing = trip.driverPassengerRating;
  const isCareTrip = isCareCategory(trip.category);

  const [curbReadiness, setCurbReadiness] = useState<number>(existing?.curbReadiness ?? 5);
  const [communication, setCommunication] = useState<number>(existing?.communication ?? 5);
  const [equipmentReadiness, setEquipmentReadiness] = useState<number>(
    existing?.equipmentReadiness ?? 5
  );
  const [overall, setOverall] = useState<number>(existing?.overall ?? 5);
  const [privateCareNotes, setPrivateCareNotes] = useState<string>(
    existing?.privateCareNotes ?? ''
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const previewAvg = computePassengerRatingAverage({
    overall,
    curbReadiness,
    communication,
    equipmentReadiness,
  });

  const tripFinancials = calculateTripFinancials(trip);
  const grossFareWithTip = roundCurrency(
    (trip.baseFare || 0) + (trip.surgeBonus || 0) + (trip.careStipend || 0) + (trip.tip || 0)
  );
  const flatSettlement = calculateFlatRideTransfer(grossFareWithTip);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: PassengerMultiPointRating = {
      overall,
      curbReadiness,
      communication,
      equipmentReadiness,
      privateCareNotes: isCareTrip && privateCareNotes.trim() ? privateCareNotes.trim() : undefined,
      updatedAt: '2026-11-14',
    };
    const errors = validatePassengerRatingInput(payload);
    if (Object.keys(errors).length > 0) {
      setErrorMsg(Object.values(errors)[0]);
      return;
    }
    onSave(trip.id, payload);
  };

  const renderCriterion = (
    label: string,
    description: string,
    value: number,
    onChange: (n: number) => void
  ) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 border-b border-stone-200/70 dark:border-stone-800 last:border-b-0">
      <div>
        <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">{label}</p>
        <p className="text-[11px] text-stone-500 dark:text-stone-400">{description}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= value;
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              aria-label={`${label}: ${star} of 5 stars`}
              aria-pressed={value === star}
              className={`min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center transition-colors ${
                active
                  ? 'text-[#B48A3E] dark:text-[#D4AF63] bg-amber-50 dark:bg-amber-950/40'
                  : 'text-stone-300 dark:text-stone-600 hover:text-stone-500'
              }`}
            >
              <Star
                className={`w-4 h-4 ${
                  active ? 'fill-[#B48A3E] dark:fill-[#D4AF63]' : ''
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Multi-point passenger rating and care feedback"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white/95 dark:bg-[#101218]/95 backdrop-blur-2xl border border-stone-200/80 dark:border-white/15 p-5 sm:p-6 space-y-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
              {isCareTrip ? 'Special Appointment Feedback' : 'Executive Trip Feedback'} ·{' '}
              {trip.serviceLabel}
            </p>
            <h3 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-50 mt-0.5">
              Rate {trip.riderOrPatientName}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {trip.routeSummary} · Composite {previewAvg.toFixed(1)}★
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rating modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white"
          >
            ×
          </button>
        </div>

        {errorMsg && (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{errorMsg}</p>
        )}

        {/* Completed Trip Final Earnings Summary (with In-Trip Tip) */}
        <div
          data-testid="completed-trip-earnings-summary"
          className="p-3.5 rounded-2xl bg-[#FAF8F4] dark:bg-[#080A0F] border border-amber-300/70 dark:border-[#D4AF63]/35 space-y-1.5 text-xs font-mono-tabular"
        >
          <div className="flex items-center justify-between font-sans">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9A722A] dark:text-[#E6C77E]">
              Final Trip Earnings Summary
            </span>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
              {trip.id}
            </span>
          </div>
          <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
            <span>
              Fare {formatCurrency(trip.baseFare)}
              {trip.careStipend > 0 ? ` + Care ${formatCurrency(trip.careStipend)}` : ''}
              {trip.surgeBonus > 0 ? ` + Surge ${formatCurrency(trip.surgeBonus)}` : ''}
            </span>
            <span>Maint -{formatCurrency(tripFinancials.platformFee)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-700 dark:text-stone-300">Passenger Tip Added</span>
            <span
              data-testid="completed-summary-tip"
              className={
                trip.tip > 0
                  ? 'font-bold text-emerald-700 dark:text-emerald-400'
                  : 'text-stone-500 dark:text-stone-400'
              }
            >
              +{formatCurrency(trip.tip)}
            </span>
          </div>
          <div className="pt-1.5 border-t border-stone-200/80 dark:border-white/10 flex items-center justify-between gap-2">
            <span className="font-sans font-bold text-stone-900 dark:text-white">
              Total Payout (UPI Net {formatCurrency(flatSettlement.transferredNetInr)})
            </span>
            <span
              data-testid="completed-summary-total-payout"
              className="text-base font-bold text-[#9A722A] dark:text-[#E6C77E]"
            >
              {formatCurrency(tripFinancials.netPayout)}
            </span>
          </div>
        </div>

        {/* Multi-Point Criteria */}
        <div className="p-3.5 rounded-xl bg-[#FAF8F4] dark:bg-[#0B0C0E] border border-stone-200 dark:border-stone-800">
          {renderCriterion(
            'Punctuality & Curb Readiness',
            'Ready at pickup portico or clinic apron within grace window',
            curbReadiness,
            setCurbReadiness
          )}
          {renderCriterion(
            'Communication & Coordination',
            'Clear pickup instructions from passenger or caregiver',
            communication,
            setCommunication
          )}
          {renderCriterion(
            isCareTrip ? 'Equipment & Boarding Readiness' : 'Cabin Conduct & Entry',
            isCareTrip
              ? 'Mobility gear, oxygen tank, or walkway cleared smoothly'
              : 'Smooth boarding and respectful cabin experience',
            equipmentReadiness,
            setEquipmentReadiness
          )}
          {renderCriterion(
            'Overall Trip Experience',
            'Overall passenger & drop-off satisfaction',
            overall,
            setOverall
          )}
        </div>

        {/* Private Feedback Notes specifically for Special Appointments */}
        {isCareTrip && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="private-care-notes"
                className="text-xs font-semibold text-stone-800 dark:text-stone-100 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Private Care Expectations Note (Drivers & Care Dispatch Only)</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CARE_NOTE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    setPrivateCareNotes((prev) =>
                      prev.trim() ? `${prev.trim()} ${preset}.` : `${preset}.`
                    )
                  }
                  className="min-h-[36px] px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 text-[11px] font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <textarea
              id="private-care-notes"
              rows={3}
              value={privateCareNotes}
              onChange={(e) => setPrivateCareNotes(e.target.value)}
              placeholder="Document ramp access, post-treatment wait buffers, caregiver handoff notes, or sensory cabin preferences for future drivers..."
              className="w-full p-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white"
            />
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Never shared with the passenger; visible strictly to AURELIA care drivers and
              clinical dispatchers to calibrate future appointments.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 pb-1 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-medium text-stone-700 dark:text-stone-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="save-passenger-rating-btn"
            className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-semibold"
          >
            Save Multi-Point Rating
          </button>
        </div>
      </form>
    </div>
  );
}
