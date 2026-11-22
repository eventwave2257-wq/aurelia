import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  MessageSquareWarning,
  Navigation,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { KARNATAKA_LANDMARKS, VEHICLE_TIER_OPTIONS } from '../data/karnatakaDistricts';
import {
  CARE_MOBILITY_IMG_PATH,
  EXECUTIVE_FLEET_IMG_PATH,
  KARNATAKA_AUTO_IMG_PATH,
} from '../data/seedData';
import type {
  FareConditionId,
  LiveRideOrder,
  PaymentMethod,
  SupportComplaint,
  VehicleTier,
} from '../types/aurelia';
import {
  calculateLiveRideTotalsWithTip,
  estimateRoadDistanceKm,
  evaluateWinWinConditionFare,
  formatCurrency,
  formatPaymentMethodLabel,
  getCcavenuePaymentOption,
  getVehicleTierLabel,
  validateCcavenueCheckoutInput,
} from '../utils/aureliaLogic';
import { FareComparisonOptimizer } from './FareComparisonOptimizer';
import { PassengerTipSelector } from './PassengerTipSelector';
import { VehicleTierGraphic } from './VehicleTierGraphic';

interface CustomerBookingViewProps {
  activeCondition: FareConditionId;
  liveRides: LiveRideOrder[];
  currentUserUid?: string;
  onChangeCondition: (conditionId: FareConditionId) => void;
  onCreateRide: (ride: LiveRideOrder) => Promise<LiveRideOrder>;
  onUpdateRideStatus: (
    rideId: string,
    patch: Partial<
      Pick<
        LiveRideOrder,
        | 'status'
        | 'driverId'
        | 'driverName'
        | 'driverLat'
        | 'driverLng'
        | 'paymentStatus'
        | 'ccavenueTrackingId'
        | 'ccavenueBankRefNo'
        | 'tipInr'
      >
    >
  ) => Promise<void>;
  onSubmitComplaint: (complaint: SupportComplaint) => Promise<void>;
  onNotify: (msg: string) => void;
}

export function CustomerBookingView({
  activeCondition,
  liveRides,
  currentUserUid,
  onChangeCondition,
  onCreateRide,
  onUpdateRideStatus,
  onSubmitComplaint,
  onNotify,
}: CustomerBookingViewProps) {
  const [customerName, setCustomerName] = useState<string>('Aarav Sharma');
  const [pickupId, setPickupId] = useState<string>(KARNATAKA_LANDMARKS[0].id);
  const [dropoffId, setDropoffId] = useState<string>(KARNATAKA_LANDMARKS[1].id);
  const [vehicleTier, setVehicleTier] = useState<VehicleTier>('car_premier');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ccavenue_upi');

  // CCAvenue Checkout Sheet state
  const [checkoutOrder, setCheckoutOrder] = useState<{
    ride: LiveRideOrder;
    orderId: string;
    mode: string;
    accessCode: string;
    encRequest: string;
    paymentOption: string;
    gatewayUrl: string;
  } | null>(null);
  const [upiHandleInput, setUpiHandleInput] = useState<string>('aarav.sharma@okicici');
  const [cardLast4, setCardLast4] = useState<string>('4242');
  const [netbankingBank, setNetbankingBank] = useState<string>('HDFC Bank');
  const [isProcessingPay, setIsProcessingPay] = useState<boolean>(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Complaint modal/drawer state
  const [complaintOpen, setComplaintOpen] = useState<boolean>(false);
  const [complaintSubject, setComplaintSubject] = useState<string>('');
  const [complaintDetails, setComplaintDetails] = useState<string>('');

  const pickupLandmark =
    KARNATAKA_LANDMARKS.find((l) => l.id === pickupId) ?? KARNATAKA_LANDMARKS[0];
  const dropoffLandmark =
    KARNATAKA_LANDMARKS.find((l) => l.id === dropoffId) ?? KARNATAKA_LANDMARKS[1];

  const distanceKm = useMemo(
    () =>
      estimateRoadDistanceKm(
        { lat: pickupLandmark.lat, lng: pickupLandmark.lng },
        { lat: dropoffLandmark.lat, lng: dropoffLandmark.lng }
      ),
    [pickupLandmark, dropoffLandmark]
  );

  const fareEvaluation = useMemo(
    () =>
      evaluateWinWinConditionFare({
        vehicleMode: vehicleTier,
        conditionId: activeCondition,
        distanceKm,
      }),
    [vehicleTier, activeCondition, distanceKm]
  );

  const activeCustomerRide =
    liveRides.find(
      (r) => r.status !== 'completed' && r.status !== 'cancelled'
    ) ?? liveRides[0] ?? null;

  const activeCustomerRideTotals = useMemo(
    () => (activeCustomerRide ? calculateLiveRideTotalsWithTip(activeCustomerRide) : null),
    [activeCustomerRide]
  );

  const handleBookRide = async () => {
    setPayError(null);
    if (pickupLandmark.id === dropoffLandmark.id) {
      onNotify('Select a different Drop destination from your Pickup point.');
      return;
    }

    const newRide: LiveRideOrder = {
      id: `ride-aur-${Date.now()}`,
      customerId: currentUserUid ?? 'cust-karnataka-live',
      customerName: customerName.trim() || 'Karnataka Rider',
      pickupLabel: pickupLandmark.title,
      dropoffLabel: dropoffLandmark.title,
      pickupLatLng: { lat: pickupLandmark.lat, lng: pickupLandmark.lng },
      dropoffLatLng: { lat: dropoffLandmark.lat, lng: dropoffLandmark.lng },
      vehicleTier,
      fareCondition: activeCondition,
      distanceKm: fareEvaluation.distanceKm,
      fareInr: fareEvaluation.customerTotalFare,
      driverNetInr: fareEvaluation.driverTotalNetPayout,
      companyFeeInr: fareEvaluation.companyTotalFee,
      paymentMethod,
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'pending',
      driverLat: pickupLandmark.lat - 0.008,
      driverLng: pickupLandmark.lng - 0.006,
      status: 'searching',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (paymentMethod === 'cash') {
      await onCreateRide(newRide);
      onNotify(
        `Ride ${newRide.id} dispatched (${fareEvaluation.conditionLabel} · ${formatCurrency(
          newRide.fareInr
        )}). Looking for nearby Karnataka driver.`
      );
      return;
    }

    // Initialize CCAvenue encrypted order on server first
    setIsProcessingPay(true);
    try {
      const apiMethod =
        paymentMethod === 'ccavenue_card'
          ? 'card'
          : paymentMethod === 'ccavenue_netbanking'
            ? 'netbanking'
            : 'upi';

      const res = await fetch('/api/payments/ccavenue/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountInr: newRide.fareInr,
          rideId: newRide.id,
          method: apiMethod,
          customerName: newRide.customerName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not initialize CCAvenue order');
      }
      const created = await onCreateRide({
        ...newRide,
        ccavenueOrderId: data.orderId,
      });
      setCheckoutOrder({
        ride: created,
        orderId: data.orderId,
        mode: data.mode,
        accessCode: data.accessCode,
        encRequest: data.encRequest,
        paymentOption: data.paymentOption || getCcavenuePaymentOption(paymentMethod),
        gatewayUrl: data.gatewayUrl,
      });
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'CCAvenue order setup failed.');
    } finally {
      setIsProcessingPay(false);
    }
  };

  const handleConfirmCcavenueVerify = async () => {
    if (!checkoutOrder) return;
    const validation = validateCcavenueCheckoutInput({
      method: checkoutOrder.ride.paymentMethod,
      upiId: upiHandleInput,
      cardLast4,
      bankCode: netbankingBank,
    });
    if (!validation.valid) {
      setPayError(validation.error || 'Please verify payment details.');
      return;
    }

    setIsProcessingPay(true);
    setPayError(null);
    try {
      const res = await fetch('/api/payments/ccavenue/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: checkoutOrder.orderId,
          mode: checkoutOrder.mode,
          paymentMethodDetails: {
            upiId: upiHandleInput.trim(),
            cardLast4: cardLast4.trim(),
            bankName: netbankingBank,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        throw new Error(data.error || 'CCAvenue AES-128-CBC verification failed');
      }

      await onUpdateRideStatus(checkoutOrder.ride.id, {
        paymentStatus: 'paid',
        ccavenueTrackingId: data.trackingId,
        ccavenueBankRefNo: data.bankRefNo,
      });

      onNotify(
        `${formatPaymentMethodLabel(checkoutOrder.ride.paymentMethod)} Verified (${data.trackingId}). Searching for nearest driver!`
      );
      setCheckoutOrder(null);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'CCAvenue verification error');
    } finally {
      setIsProcessingPay(false);
    }
  };

  const handleSubmitComplaintForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintSubject.trim() || !complaintDetails.trim()) return;
    await onSubmitComplaint({
      id: `cmp-${Date.now()}`,
      reporterUid: currentUserUid ?? 'cust-karnataka-live',
      reporterRole: 'customer',
      rideId: activeCustomerRide?.id,
      subject: complaintSubject.trim(),
      details: complaintDetails.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setComplaintSubject('');
    setComplaintDetails('');
    setComplaintOpen(false);
    onNotify('Support ticket submitted directly to Aurelia Admin Operations Desk.');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9A722A] dark:text-[#E6C77E]">
            Aurelia Customer App · Karnataka Live Booking &amp; CCAvenue Checkout
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-50 mt-0.5">
            Book Fair-Rate Karnataka Ride
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Compare Uber, Rapido, Ola &amp; Namma Yatri per-km fares live, apply condition discounts, and track your matched chauffeur.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setComplaintOpen((p) => !p)}
          className="min-h-[44px] px-4 py-2 rounded-2xl border border-stone-300 dark:border-white/15 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/10 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <MessageSquareWarning className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <span>{complaintOpen ? 'Close Support Form' : 'Raise Ride Complaint'}</span>
        </button>
      </div>

      {/* Complaint Drawer */}
      {complaintOpen && (
        <form
          onSubmit={handleSubmitComplaintForm}
          className="p-5 rounded-3xl bg-white/90 dark:bg-[#101218]/90 border border-rose-300 dark:border-rose-500/40 space-y-3"
        >
          <h3 className="font-display text-lg font-bold text-stone-900 dark:text-white">
            Submit Complaint to Admin Desk
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Issue subject (e.g., Fare adjustment / pickup delay)"
              value={complaintSubject}
              onChange={(e) => setComplaintSubject(e.target.value)}
              className="min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white"
            />
            <input
              type="text"
              required
              placeholder="Describe what happened..."
              value={complaintDetails}
              onChange={(e) => setComplaintDetails(e.target.value)}
              className="min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="min-h-[44px] px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
          >
            Submit Support Ticket
          </button>
        </form>
      )}

      {/* Main Booking + Live Tracking Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Booking Form */}
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Rider Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#E6C77E]" />
                <span>Pickup Point</span>
              </label>
              <select
                value={pickupId}
                data-testid="customer-pickup-select"
                onChange={(e) => setPickupId(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white"
              >
                {KARNATAKA_LANDMARKS.map((lm) => (
                  <option key={lm.id} value={lm.id}>
                    {lm.title} ({lm.district})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Destination</span>
              </label>
              <select
                value={dropoffId}
                data-testid="customer-dropoff-select"
                onChange={(e) => setDropoffId(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white"
              >
                {KARNATAKA_LANDMARKS.map((lm) => (
                  <option key={lm.id} value={lm.id}>
                    {lm.title} ({lm.district})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vehicle Tiers + Fleet Visual Preview */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Select Vehicle Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {VEHICLE_TIER_OPTIONS.map((t) => {
                const active = vehicleTier === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`customer-tier-${t.id}`}
                    onClick={() => setVehicleTier(t.id)}
                    className={`min-h-[48px] px-3 py-2 rounded-xl border text-left transition-colors flex items-center gap-2 cursor-pointer ${
                      active
                        ? 'bg-stone-900 dark:bg-[#E6C77E] text-white dark:text-stone-950 border-stone-900 dark:border-[#E6C77E]'
                        : 'bg-stone-50 dark:bg-[#080A0F] text-stone-800 dark:text-stone-200 border-stone-200 dark:border-white/10'
                    }`}
                  >
                    <VehicleTierGraphic tier={t.id} className="w-6 h-3.5 shrink-0" />
                    <span className="text-xs font-bold truncate">{t.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Visual Selected Fleet Showcase Strip */}
            <div className="relative h-28 rounded-2xl overflow-hidden border border-stone-200 dark:border-white/10">
              <img
                src={
                  vehicleTier === 'car_elite'
                    ? CARE_MOBILITY_IMG_PATH
                    : vehicleTier === 'bike'
                      ? KARNATAKA_AUTO_IMG_PATH
                      : EXECUTIVE_FLEET_IMG_PATH
                }
                alt={`${getVehicleTierLabel(vehicleTier)} Karnataka Fleet Preview`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0B0D12]/90 via-[#0B0D12]/60 to-transparent" />
              <div className="absolute inset-0 p-3.5 flex items-center justify-between text-white">
                <div className="space-y-0.5 max-w-[75%]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#E6C77E]">
                    {getVehicleTierLabel(vehicleTier)} · Karnataka Dispatch
                  </p>
                  <p className="text-xs sm:text-sm font-bold truncate">
                    {pickupLandmark.title} → {dropoffLandmark.title}
                  </p>
                  <p className="text-[11px] text-stone-300 font-mono-tabular">
                    {distanceKm} km route · Transparent ₹{fareEvaluation.aureliaReducedRatePerKm.toFixed(1)}/km
                  </p>
                </div>
                <VehicleTierGraphic tier={vehicleTier} className="w-10 h-6 text-[#E6C77E] shrink-0" />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between gap-2">
              <span>CCAvenue Payment Method (UPI · Cards · NetBanking · Cash)</span>
              <span className="text-[10px] font-mono-tabular text-emerald-700 dark:text-emerald-400">
                AES-128-CBC Secured
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'ccavenue_upi' as const, label: 'CCAvenue UPI', icon: Smartphone },
                { id: 'ccavenue_card' as const, label: 'CCAvenue Card', icon: CreditCard },
                { id: 'ccavenue_netbanking' as const, label: 'NetBanking', icon: Building2 },
                { id: 'cash' as const, label: 'Cash on Arrival', icon: Wallet },
              ].map((m) => {
                const Icon = m.icon;
                const active = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`payment-method-${m.id}`}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-600'
                        : 'bg-stone-50 dark:bg-[#080A0F] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary Bar & Book Action */}
          <div className="p-4 rounded-2xl bg-[#0B0D12] text-white border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#E6C77E] font-semibold">
                {fareEvaluation.conditionLabel} · {fareEvaluation.distanceKm} km
              </p>
              <p className="text-2xl font-bold font-mono-tabular">
                {formatCurrency(fareEvaluation.customerTotalFare)}{' '}
                <span className="text-xs font-normal text-emerald-400">
                  (₹{fareEvaluation.aureliaReducedRatePerKm.toFixed(1)}/km · Saves {fareEvaluation.customerSavingsPercentVsAvg}% vs Uber/Ola/Rapido/Namma Yatri)
                </span>
              </p>
            </div>

            <button
              type="button"
              disabled={isProcessingPay}
              data-testid="book-customer-ride-btn"
              onClick={() => void handleBookRide()}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#E6C77E] hover:bg-[#D4AF63] text-stone-950 font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isProcessingPay
                  ? 'Encrypting Order...'
                  : paymentMethod === 'cash'
                    ? 'Confirm & Dispatch Ride'
                    : 'Book & Pay via CCAvenue'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Ride & GPS Tracking Card */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200/70 dark:border-white/10 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                Real-Time Dispatch Sync
              </p>
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-white">
                Live Ride Tracker
              </h2>
            </div>
            {activeCustomerRide && (
              <span
                data-testid="customer-live-ride-status"
                className="text-xs font-mono-tabular font-bold uppercase text-amber-700 dark:text-[#E6C77E]"
              >
                {activeCustomerRide.status.replace('_', ' ')}
              </span>
            )}
          </div>

          {!activeCustomerRide ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-8 text-center">
              No active bookings. Choose a pickup and destination to book a ride.
            </p>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between font-mono-tabular">
                  <span className="text-stone-500 dark:text-stone-400">Ride ID</span>
                  <span className="font-semibold text-stone-900 dark:text-white">
                    {activeCustomerRide.id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 dark:text-stone-400">Route</span>
                  <span className="font-semibold text-stone-900 dark:text-white text-right">
                    {activeCustomerRide.pickupLabel} → {activeCustomerRide.dropoffLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono-tabular">
                  <span className="text-stone-500 dark:text-stone-400">Vehicle &amp; Fare</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {getVehicleTierLabel(activeCustomerRide.vehicleTier)} ·{' '}
                    {formatCurrency(activeCustomerRide.fareInr)}
                  </span>
                </div>
                {activeCustomerRideTotals && activeCustomerRideTotals.tipInr > 0 && (
                  <div className="flex items-center justify-between font-mono-tabular">
                    <span className="text-stone-500 dark:text-stone-400">Tip &amp; Updated Total</span>
                    <span
                      data-testid="customer-tracker-total-with-tip"
                      className="font-bold text-[#9A722A] dark:text-[#E6C77E]"
                    >
                      +{formatCurrency(activeCustomerRideTotals.tipInr)} Tip ={' '}
                      {formatCurrency(activeCustomerRideTotals.customerTotalWithTipInr)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between font-mono-tabular">
                  <span className="text-stone-500 dark:text-stone-400">Matched Driver</span>
                  <span className="font-semibold text-stone-900 dark:text-white">
                    {activeCustomerRide.driverName ?? 'Broadcasting to Karnataka drivers...'}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono-tabular">
                  <span className="text-stone-500 dark:text-stone-400">Live GPS Coordinates</span>
                  <span className="text-[#9A722A] dark:text-[#E6C77E]">
                    {activeCustomerRide.driverLat.toFixed(4)}°N, {activeCustomerRide.driverLng.toFixed(4)}°E
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono-tabular">
                  <span className="text-stone-500 dark:text-stone-400">Payment</span>
                  <span
                    data-testid="customer-tracker-payment"
                    className={
                      activeCustomerRide.paymentStatus === 'paid'
                        ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                        : 'text-amber-700 dark:text-amber-400 font-semibold'
                    }
                  >
                    {formatPaymentMethodLabel(activeCustomerRide.paymentMethod)} ·{' '}
                    {activeCustomerRide.paymentStatus.toUpperCase()}
                    {activeCustomerRide.ccavenueTrackingId
                      ? ` (${activeCustomerRide.ccavenueTrackingId})`
                      : ''}
                  </span>
                </div>
              </div>

              {/* Ride stage progress strip */}
              <div className="grid grid-cols-5 gap-1 text-[10px] font-mono-tabular text-center">
                {(['searching', 'matched', 'en_route', 'arrived', 'in_trip'] as const).map(
                  (stage) => {
                    const order = ['searching', 'matched', 'en_route', 'arrived', 'in_trip'];
                    const reached =
                      order.indexOf(activeCustomerRide.status) >= order.indexOf(stage);
                    return (
                      <div
                        key={stage}
                        className={`py-1.5 rounded-lg border ${
                          reached
                            ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold'
                            : 'bg-stone-100 dark:bg-white/[0.03] border-stone-200 dark:border-white/10 text-stone-400'
                        }`}
                      >
                        {stage.replace('_', ' ')}
                      </div>
                    );
                  }
                )}
              </div>

              {activeCustomerRide.status === 'in_trip' && activeCustomerRideTotals && (
                <PassengerTipSelector
                  mode="passenger"
                  selectedTipInr={activeCustomerRideTotals.tipInr}
                  baseFareInr={activeCustomerRideTotals.baseFareInr}
                  platformFeeInr={activeCustomerRideTotals.companyFeeInr}
                  netPayoutWithTipInr={activeCustomerRideTotals.driverPayoutWithTipInr}
                  flatTransferNetInr={activeCustomerRideTotals.flatTransferredNetInr}
                  customerTotalWithTipInr={activeCustomerRideTotals.customerTotalWithTipInr}
                  driverName={activeCustomerRide.driverName}
                  onSelectTip={async (tipInr) => {
                    await onUpdateRideStatus(activeCustomerRide.id, { tipInr });
                    onNotify(
                      tipInr > 0
                        ? `Added ₹${tipInr} tip for ${activeCustomerRide.driverName ?? 'your driver'}. Total updated to ${formatCurrency(
                            activeCustomerRide.fareInr + tipInr
                          )}.`
                        : 'Tip removed from live trip.'
                    );
                  }}
                />
              )}

              {activeCustomerRide.status === 'searching' && (
                <button
                  type="button"
                  onClick={() =>
                    void onUpdateRideStatus(activeCustomerRide.id, { status: 'cancelled' })
                  }
                  className="w-full min-h-[42px] rounded-xl border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 font-semibold cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  Cancel Ride Request
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Embedded Live Competitor Rate Comparison & Condition Optimizer */}
      <FareComparisonOptimizer
        selectedMode={vehicleTier}
        activeCondition={activeCondition}
        distanceKm={distanceKm}
        onSelectCondition={onChangeCondition}
        onSelectMode={(mode) => {
          if (mode !== 'auto') setVehicleTier(mode);
        }}
      />

      {/* CCAvenue Payment Verification Modal */}
      {checkoutOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="CCAvenue Checkout Verification"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start sm:items-center justify-center p-4 overflow-y-auto"
        >
          <div className="w-full max-w-md my-auto max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#101218] border border-amber-300 dark:border-amber-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9A722A] dark:text-[#E6C77E] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>CCAvenue Payment Gateway ({checkoutOrder.mode})</span>
                </p>
                <h3 className="font-display text-2xl font-bold text-stone-900 dark:text-white mt-0.5">
                  Authorize {formatCurrency(checkoutOrder.ride.fareInr)}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close CCAvenue Checkout"
                onClick={() => setCheckoutOrder(null)}
                className="min-h-[40px] min-w-[40px] rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-white/10 cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 text-xs font-mono-tabular space-y-1">
              <p>Order ID: {checkoutOrder.orderId}</p>
              <p>
                Option: {checkoutOrder.paymentOption} ({formatPaymentMethodLabel(checkoutOrder.ride.paymentMethod)})
              </p>
              <p>
                Route: {checkoutOrder.ride.pickupLabel} → {checkoutOrder.ride.dropoffLabel}
              </p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 truncate">
                encRequest (AES-128-CBC): {checkoutOrder.encRequest.slice(0, 28)}...
              </p>
            </div>

            {checkoutOrder.ride.paymentMethod === 'ccavenue_upi' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Customer UPI ID (CCAvenue OPTUPI)
                </label>
                <input
                  type="text"
                  data-testid="ccavenue-upi-input"
                  value={upiHandleInput}
                  onChange={(e) => setUpiHandleInput(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs font-mono-tabular text-stone-900 dark:text-white"
                />
              </div>
            )}

            {checkoutOrder.ride.paymentMethod === 'ccavenue_card' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Card Last 4 Digits (Visa / Mastercard / RuPay · OPTCRDC)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  data-testid="ccavenue-card-input"
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ''))}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs font-mono-tabular text-stone-900 dark:text-white"
                />
              </div>
            )}

            {checkoutOrder.ride.paymentMethod === 'ccavenue_netbanking' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Select Issuing Bank (CCAvenue OPTNBK)
                </label>
                <select
                  data-testid="ccavenue-bank-select"
                  value={netbankingBank}
                  onChange={(e) => setNetbankingBank(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white"
                >
                  <option value="HDFC Bank">HDFC Bank NetBanking</option>
                  <option value="ICICI Bank">ICICI Bank NetBanking</option>
                  <option value="State Bank of India">State Bank of India (SBI)</option>
                  <option value="Canara Bank">Canara Bank (Karnataka Nodal)</option>
                  <option value="Axis Bank">Axis Bank Corporate &amp; Retail</option>
                  <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                </select>
              </div>
            )}

            {payError && (
              <p
                data-testid="ccavenue-pay-error"
                className="text-xs text-rose-600 dark:text-rose-400 font-medium"
              >
                {payError}
              </p>
            )}

            <button
              type="button"
              disabled={isProcessingPay}
              data-testid="confirm-ccavenue-payment-btn"
              onClick={() => void handleConfirmCcavenueVerify()}
              className="w-full min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isProcessingPay
                  ? 'Decrypting & Verifying encResp...'
                  : 'Complete & Verify CCAvenue Payment'}
              </span>
            </button>

            <p className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-center gap-1.5 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>AES-128-CBC encRequest / encResp verified via `/api/payments/ccavenue/verify`</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
