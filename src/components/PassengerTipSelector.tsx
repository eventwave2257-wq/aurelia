import { useEffect, useState } from 'react';
import { Check, Coins, Wallet } from 'lucide-react';
import {
  FLAT_PLATFORM_DEDUCTION_INR,
  PASSENGER_TIP_PRESETS_INR,
  formatCurrency,
  validatePassengerTipAmount,
} from '../utils/aureliaLogic';

interface PassengerTipSelectorProps {
  selectedTipInr: number;
  baseFareInr: number;
  careStipendInr?: number;
  surgeBonusInr?: number;
  platformFeeInr?: number;
  netPayoutWithTipInr: number;
  flatTransferNetInr: number;
  customerTotalWithTipInr?: number;
  mode?: 'driver' | 'passenger';
  passengerName?: string;
  driverName?: string;
  onSelectTip: (tipInr: number) => void | Promise<void>;
}

export function PassengerTipSelector({
  selectedTipInr,
  baseFareInr,
  careStipendInr = 0,
  surgeBonusInr = 0,
  platformFeeInr = 0,
  netPayoutWithTipInr,
  flatTransferNetInr,
  customerTotalWithTipInr,
  mode = 'driver',
  passengerName,
  driverName,
  onSelectTip,
}: PassengerTipSelectorProps) {
  const isPreset = PASSENGER_TIP_PRESETS_INR.some(
    (amt) => Math.abs(amt - selectedTipInr) < 0.01
  );
  const [customInput, setCustomInput] = useState<string>(
    !isPreset && selectedTipInr > 0 ? String(selectedTipInr) : ''
  );
  const [tipError, setTipError] = useState<string | null>(null);
  const [savedTipNotice, setSavedTipNotice] = useState<boolean>(false);

  useEffect(() => {
    const matchesPreset = PASSENGER_TIP_PRESETS_INR.some(
      (amt) => Math.abs(amt - selectedTipInr) < 0.01
    );
    if (!matchesPreset && selectedTipInr > 0) {
      setCustomInput(String(selectedTipInr));
    } else if (matchesPreset) {
      setCustomInput('');
    }
  }, [selectedTipInr]);

  const triggerSelection = async (amount: number) => {
    setTipError(null);
    await onSelectTip(amount);
    setSavedTipNotice(true);
    window.setTimeout(() => setSavedTipNotice(false), 1800);
  };

  const handleApplyCustomTip = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePassengerTipAmount(customInput);
    if (!validation.valid) {
      setTipError(validation.error ?? 'Enter a valid tip amount.');
      return;
    }
    await triggerSelection(validation.amount);
  };

  const grossWithTip = Math.max(
    0,
    baseFareInr + careStipendInr + surgeBonusInr + selectedTipInr
  );

  return (
    <section
      data-testid="in-trip-tip-interface"
      aria-label="In-trip passenger tip selection and final earnings summary"
      className="p-4 rounded-2xl bg-[#FAF8F4] dark:bg-[#080A0F] border border-amber-300/70 dark:border-[#D4AF63]/35 space-y-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A722A] dark:text-[#E6C77E] flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 shrink-0" />
            <span>In-Trip Passenger Tipping · 100% Goes to Chauffeur</span>
          </p>
          <h3 className="text-sm font-bold text-stone-900 dark:text-white">
            {mode === 'passenger'
              ? `Appreciate ${driverName || 'your chauffeur'} during this trip`
              : `${passengerName ? `${passengerName}'s` : 'Passenger'} Live Tip & Payout`}
          </h3>
        </div>

        <span
          data-testid="in-trip-selected-tip-readout"
          className="text-xs font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400"
        >
          Tip: +{formatCurrency(selectedTipInr)}
        </span>
      </div>

      {/* Preset Tip Selector Grid */}
      <div
        role="group"
        aria-label="Select passenger tip preset"
        className="grid grid-cols-4 gap-2"
      >
        {PASSENGER_TIP_PRESETS_INR.map((amount) => {
          const active = Math.abs(selectedTipInr - amount) < 0.01;
          return (
            <button
              key={amount}
              type="button"
              aria-pressed={active}
              data-testid={`tip-preset-${amount}`}
              onClick={() => void triggerSelection(amount)}
              className={`min-h-[42px] px-2 py-2 rounded-xl border text-xs font-bold font-mono-tabular transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#B48A3E] dark:bg-[#E6C77E] text-white dark:text-stone-950 border-[#B48A3E] dark:border-[#E6C77E] shadow-sm'
                  : 'bg-white dark:bg-[#101218] text-stone-800 dark:text-stone-200 border-stone-200 dark:border-white/15 hover:border-amber-400 dark:hover:border-[#E6C77E]/60'
              }`}
            >
              {amount === 0 ? 'No Tip' : `+₹${amount}`}
            </button>
          );
        })}
      </div>

      {/* Custom Tip Entry */}
      <form onSubmit={(e) => void handleApplyCustomTip(e)} className="flex items-stretch gap-2">
        <div className="flex-1 flex items-center">
          <label htmlFor={`custom-tip-input-${mode}`} className="sr-only">
            Custom tip amount in INR
          </label>
          <span className="min-h-[42px] px-3 flex items-center rounded-l-xl bg-stone-100 dark:bg-[#101218] border border-r-0 border-stone-300 dark:border-stone-700 text-xs font-mono-tabular text-stone-600 dark:text-stone-300">
            ₹
          </span>
          <input
            id={`custom-tip-input-${mode}`}
            type="number"
            min={0}
            max={5000}
            step="1"
            value={customInput}
            data-testid={`custom-tip-input-${mode}`}
            onChange={(e) => {
              setCustomInput(e.target.value);
              if (tipError) setTipError(null);
            }}
            placeholder="Custom tip (e.g. 75)"
            className="w-full min-h-[42px] px-3 rounded-r-xl bg-white dark:bg-[#101218] border border-stone-300 dark:border-stone-700 text-xs font-mono-tabular text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <button
          type="submit"
          data-testid={`apply-custom-tip-btn-${mode}`}
          className="min-h-[42px] px-4 rounded-xl bg-stone-900 dark:bg-white/15 hover:bg-stone-800 dark:hover:bg-white/25 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
        >
          Apply Tip
        </button>
      </form>

      {tipError && (
        <p role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
          {tipError}
        </p>
      )}

      {savedTipNotice && !tipError && (
        <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>Tip updated · Final earnings summary &amp; total payout recalculated.</span>
        </p>
      )}

      {/* Real-Time Final Earnings Summary & Total Payout Calculation */}
      <div
        data-testid="live-final-earnings-summary"
        className="pt-2.5 border-t border-stone-200/80 dark:border-white/10 space-y-1.5 text-xs"
      >
        <div className="flex items-center justify-between text-stone-600 dark:text-stone-400 font-mono-tabular">
          <span>Base Fare</span>
          <span>{formatCurrency(baseFareInr)}</span>
        </div>

        {surgeBonusInr > 0 && (
          <div className="flex items-center justify-between text-stone-600 dark:text-stone-400 font-mono-tabular">
            <span>Surge Adjustment</span>
            <span>+{formatCurrency(surgeBonusInr)}</span>
          </div>
        )}

        {careStipendInr > 0 && (
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-mono-tabular">
            <span>Special Care Stipend</span>
            <span>+{formatCurrency(careStipendInr)}</span>
          </div>
        )}

        <div className="flex items-center justify-between font-mono-tabular">
          <span className="text-stone-700 dark:text-stone-300">Passenger Tip (In-Trip)</span>
          <span
            data-testid="summary-tip-line-value"
            className={
              selectedTipInr > 0
                ? 'font-bold text-emerald-700 dark:text-emerald-400'
                : 'text-stone-500 dark:text-stone-400'
            }
          >
            +{formatCurrency(selectedTipInr)}
          </span>
        </div>

        <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-mono-tabular">
          <span>
            {mode === 'passenger'
              ? 'Platform Service Cut'
              : `Maint / Flat ₹${FLAT_PLATFORM_DEDUCTION_INR} Settlement`}
          </span>
          <span>
            -{formatCurrency(mode === 'passenger' ? platformFeeInr : FLAT_PLATFORM_DEDUCTION_INR)}
            {mode === 'driver' && platformFeeInr > 0 ? ` (Tariff ${formatCurrency(platformFeeInr)})` : ''}
          </span>
        </div>

        <div className="pt-2 mt-1 border-t border-stone-200 dark:border-white/10 flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <span className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#E6C77E]" />
              <span>
                {mode === 'passenger' ? 'Total Chauffeur Payout' : 'Total Net Payout (w/ Tip)'}
              </span>
            </span>
            {mode === 'passenger' && typeof customerTotalWithTipInr === 'number' && (
              <p
                data-testid="customer-total-with-tip"
                className="text-[11px] font-mono-tabular text-stone-500 dark:text-stone-400"
              >
                Your Total Charge (Fare + Tip): {formatCurrency(customerTotalWithTipInr)}
              </p>
            )}
            {mode === 'driver' && (
              <p
                data-testid="flat-settlement-with-tip"
                className="text-[11px] font-mono-tabular text-stone-500 dark:text-stone-400"
              >
                Gross {formatCurrency(grossWithTip)} − ₹{FLAT_PLATFORM_DEDUCTION_INR}.00 fee ={' '}
                {formatCurrency(flatTransferNetInr)} UPI Transfer
              </p>
            )}
          </div>

          <span
            data-testid="live-total-payout-value"
            className="text-base font-bold font-mono-tabular text-[#9A722A] dark:text-[#E6C77E]"
          >
            {formatCurrency(netPayoutWithTipInr)}
          </span>
        </div>
      </div>
    </section>
  );
}
