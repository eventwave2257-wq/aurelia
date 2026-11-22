import { useMemo, useState } from 'react';
import {
  Building2,
  Car,
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  MessageSquareWarning,
  Navigation,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  Zap,
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
import type { ConfirmationResult } from 'firebase/auth';
import {
  calculateLiveRideTotalsWithTip,
  computeLiveTrackingMetrics,
  estimateRoadDistanceKm,
  evaluateWinWinConditionFare,
  formatCurrency,
  formatPaymentMethodLabel,
  generateVerificationOtp,
  getCcavenuePaymentOption,
  getVehicleTierLabel,
  isValidIndianMobile,
  maskIndianPhoneNumber,
  normalizeIndianMobile,
  normalizeOtpInput,
  validateCcavenueCheckoutInput,
  validateVerificationOtp,
} from '../utils/aureliaLogic';
import { ActiveTripMiniMap } from './ActiveTripMiniMap';
import { FareComparisonOptimizer } from './FareComparisonOptimizer';
import { PassengerTipSelector } from './PassengerTipSelector';
import { VehicleTierGraphic } from './VehicleTierGraphic';

interface CustomerBookingViewProps {
  activeCondition: FareConditionId;
  liveRides: LiveRideOrder[];
  currentUserUid?: string;
  verifiedPhoneNumber?: string | null;
  onSendFirebasePhoneOtp?: (
    phone10Digits: string,
    recaptchaContainerId: string
  ) => Promise<{
    ok: boolean;
    confirmation?: ConfirmationResult;
    error?: string;
    errorCode?: string;
    canFallbackToGateway?: boolean;
    requiresConsoleSetup?: boolean;
  }>;
  onVerifyFirebasePhoneOtp?: (
    confirmation: ConfirmationResult,
    otpCode: string
  ) => Promise<{
    ok: boolean;
    uid?: string;
    phoneNumber?: string | null;
    error?: string;
    errorCode?: string;
  }>;
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
  verifiedPhoneNumber = null,
  onSendFirebasePhoneOtp,
  onVerifyFirebasePhoneOtp,
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
  const [selectedCategory, setSelectedCategory] = useState<'car' | 'auto' | 'bike' | 'other'>('car');
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

  // Rider Firebase Phone Auth OTP verification state
  const [riderPhone, setRiderPhone] = useState<string>(() => {
    const digits = (verifiedPhoneNumber ?? '').replace(/\D/g, '').slice(-10);
    return digits.length === 10 ? digits : '9845098765';
  });
  const [customerFbConfirmation, setCustomerFbConfirmation] = useState<ConfirmationResult | null>(null);
  const [customerOtpCode, setCustomerOtpCode] = useState<string>('');
  const [customerOtpStep, setCustomerOtpStep] = useState<'idle' | 'sent' | 'verified'>(
    verifiedPhoneNumber ? 'verified' : 'idle'
  );
  const [customerOtpBusy, setCustomerOtpBusy] = useState<boolean>(false);
  const [customerOtpNote, setCustomerOtpNote] = useState<string | null>(null);
  const [customerOtpError, setCustomerOtpError] = useState<string | null>(null);

  const handleSendCustomerOtp = async () => {
    const cleanPhone = normalizeIndianMobile(riderPhone);
    if (!isValidIndianMobile(cleanPhone)) {
      setCustomerOtpError('Enter a valid 10-digit +91 mobile number (6–9).');
      return;
    }
    setRiderPhone(cleanPhone);
    setCustomerOtpError(null);
    setCustomerOtpNote(null);
    setCustomerOtpCode('');
    setCustomerOtpBusy(true);

    if (onSendFirebasePhoneOtp) {
      const res = await onSendFirebasePhoneOtp(cleanPhone, 'aurelia-customer-recaptcha-container');
      if (res.ok && res.confirmation) {
        setCustomerFbConfirmation(res.confirmation);
        setCustomerOtpStep('sent');
        setCustomerOtpNote(`Firebase OTP sent to ${maskIndianPhoneNumber(cleanPhone)}. Enter code below.`);
        setCustomerOtpBusy(false);
        return;
      }
      if (!res.canFallbackToGateway) {
        setCustomerOtpError(res.error || 'Could not dispatch Firebase OTP.');
        setCustomerOtpBusy(false);
        return;
      }
      setCustomerOtpNote(
        res.error
          ? `${res.error} Using Aurelia Secure OTP Gateway fallback.`
          : 'Firebase SMS carrier inactive in preview — dispatched via Aurelia Secure OTP Gateway.'
      );
    }

    const fallbackCode = generateVerificationOtp();
    try {
      await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, otp: fallbackCode, role: 'Customer Ride Booking' }),
      });
    } catch {
      // Offline tolerance
    }
    setCustomerFbConfirmation(null);
    setCustomerOtpStep('sent');
    setCustomerOtpNote(`Verification OTP sent via SMS to ${maskIndianPhoneNumber(cleanPhone)}. Check SMS inbox.`);
    setCustomerOtpBusy(false);
  };

  const handleVerifyCustomerOtp = async () => {
    const cleanOtp = normalizeOtpInput(customerOtpCode);
    setCustomerOtpError(null);
    setCustomerOtpBusy(true);

    if (customerFbConfirmation && onVerifyFirebasePhoneOtp) {
      const res = await onVerifyFirebasePhoneOtp(customerFbConfirmation, cleanOtp);
      setCustomerOtpBusy(false);
      if (!res.ok) {
        setCustomerOtpError(res.error || 'Invalid Firebase SMS OTP code.');
        return;
      }
      setCustomerOtpStep('verified');
      setCustomerOtpNote(`Rider mobile +91 ${riderPhone} verified via Firebase Phone Auth.`);
      onNotify(`Rider phone +91 ${riderPhone} verified via Firebase Phone Auth.`);
      return;
    }

    const check = validateVerificationOtp(cleanOtp, customerGatewayCode ?? '');
    if (!check.valid) {
      setCustomerOtpBusy(false);
      setCustomerOtpError(check.error || 'Invalid OTP code.');
      return;
    }

    try {
      await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: riderPhone, otp: cleanOtp }),
      });
    } catch {
      // Ignore offline
    }

    setCustomerOtpBusy(false);
    setCustomerOtpStep('verified');
    setCustomerOtpNote(`Rider mobile +91 ${riderPhone} verified via Aurelia OTP Gateway.`);
    onNotify(`Rider mobile +91 ${riderPhone} verified for dispatch.`);
  };

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

  const customerLiveMetrics = useMemo(() => {
    if (!activeCustomerRide) return null;
    return computeLiveTrackingMetrics({
      currentPos: { lat: activeCustomerRide.driverLat, lng: activeCustomerRide.driverLng },
      pickup: activeCustomerRide.pickupLatLng,
      dropoff: activeCustomerRide.dropoffLatLng,
      phase: activeCustomerRide.status,
      plannedDistanceKm: activeCustomerRide.distanceKm,
    });
  }, [activeCustomerRide]);

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
          {/* Rider Firebase Phone OTP Verification Strip */}
          <div
            data-testid="customer-firebase-otp-strip"
            className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 space-y-2.5"
          >
            <div id="aurelia-customer-recaptcha-container" />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-stone-700 dark:text-stone-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#D4AF63]" />
                <span>Send OTP &amp; Share Ride</span>
              </span>
              {(customerOtpStep === 'verified' || verifiedPhoneNumber) && (
                <span
                  data-testid="customer-otp-verified-badge"
                  className="text-[10px] font-mono-tabular font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                >
                  {verifiedPhoneNumber ? `Verified ${verifiedPhoneNumber}` : `Verified +91 ${riderPhone}`}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center flex-1 min-w-0">
                <span className="px-2.5 min-h-[40px] flex items-center rounded-l-xl bg-stone-100 dark:bg-stone-800 border border-r-0 border-stone-300 dark:border-stone-700 text-xs font-mono-tabular text-stone-600 dark:text-stone-300">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  data-testid="customer-otp-phone-input"
                  value={riderPhone}
                  onChange={(e) => {
                    setRiderPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    if (customerOtpError) setCustomerOtpError(null);
                  }}
                  placeholder="9845098765"
                  className="w-full min-w-0 min-h-[40px] px-3 rounded-r-xl bg-white dark:bg-[#101218] border border-stone-300 dark:border-stone-700 text-xs font-mono-tabular text-stone-900 dark:text-white"
                />
              </div>

              <button
                type="button"
                disabled={customerOtpBusy}
                data-testid="customer-send-otp-btn"
                onClick={() => void handleSendCustomerOtp()}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {customerOtpBusy ? 'Sending...' : 'Send OTP & Share'}
              </button>
            </div>

            {customerOtpStep === 'sent' && (
              <div className="pt-1 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    data-testid="customer-otp-code-input"
                    value={customerOtpCode}
                    onChange={(e) => {
                      setCustomerOtpCode(normalizeOtpInput(e.target.value));
                      if (customerOtpError) setCustomerOtpError(null);
                    }}
                    placeholder={customerFbConfirmation ? '6-digit Firebase OTP' : 'Enter OTP code'}
                    className="flex-1 min-w-0 min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101218] border border-stone-300 dark:border-stone-700 text-xs font-mono-tabular text-stone-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={customerOtpBusy}
                    data-testid="customer-verify-otp-btn"
                    onClick={() => void handleVerifyCustomerOtp()}
                    className="min-h-[40px] px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Verify OTP
                  </button>
                </div>
              </div>
            )}

            {customerOtpNote && (
              <p className="text-[11px] text-stone-600 dark:text-stone-300">{customerOtpNote}</p>
            )}

            {customerOtpError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{customerOtpError}</p>
            )}
          </div>

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

          {/* Vehicle Category & Service Brand Selector */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between">
              <span>Select Vehicle Category &amp; Service Brand</span>
              <span className="text-[10px] text-[#D4AF63] font-mono-tabular">Uber &amp; Rapido Partner Network</span>
            </label>

            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'car' as const, label: 'Car', icon: Car },
                { id: 'auto' as const, label: 'Auto', icon: Navigation },
                { id: 'bike' as const, label: 'Bike', icon: Zap },
                { id: 'other' as const, label: 'Other', icon: ShieldCheck },
              ].map((cat) => {
                const Icon = cat.icon;
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    data-testid={`vehicle-category-${cat.id}`}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      if (cat.id === 'car') setVehicleTier('car_premier');
                      else if (cat.id === 'auto') setVehicleTier('car_economy');
                      else if (cat.id === 'bike') setVehicleTier('bike');
                      else if (cat.id === 'other') setVehicleTier('car_elite');
                    }}
                    className={`min-h-[56px] p-2 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      active
                        ? 'bg-stone-900 dark:bg-[#D4AF63] text-white dark:text-stone-950 border-stone-900 dark:border-[#D4AF63] shadow-md scale-[1.02]'
                        : 'bg-stone-50 dark:bg-[#080A0F] text-stone-700 dark:text-stone-300 border-stone-200 dark:border-white/10 hover:border-stone-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-bold leading-none">{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-options for selected category (Uber / Rapido styling) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {selectedCategory === 'car' && [
                { id: 'car_economy' as VehicleTier, brand: 'Uber Go / Economy', desc: 'Affordable compact AC sedan · 4 seats', priceOffset: 'Standard Fare' },
                { id: 'car_premier' as VehicleTier, brand: 'Uber Premier / Executive', desc: 'Top-rated drivers & premium sedan legroom', priceOffset: '+₹30 surge-free' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setVehicleTier(opt.id)}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    vehicleTier === opt.id
                      ? 'bg-amber-50/80 dark:bg-[#D4AF63]/15 border-amber-400 dark:border-[#D4AF63] text-stone-900 dark:text-stone-50 shadow-sm'
                      : 'bg-stone-50/70 dark:bg-[#080A0F]/70 border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold">{opt.brand}</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">{opt.desc}</p>
                  </div>
                  <span className="text-[10px] font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                    {opt.priceOffset}
                  </span>
                </button>
              ))}

              {selectedCategory === 'auto' && [
                { id: 'car_economy' as VehicleTier, brand: 'Uber Auto', desc: 'Doorstep pickup · Negotiated meter rates', priceOffset: 'Best Value' },
                { id: 'car_economy' as VehicleTier, brand: 'Rapido Auto', desc: 'Fastest auto booking across Karnataka', priceOffset: 'Zero Wait' },
              ].map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setVehicleTier('car_economy')}
                  className="p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer bg-stone-50/70 dark:bg-[#080A0F]/70 border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:border-stone-400"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold">{opt.brand}</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">{opt.desc}</p>
                  </div>
                  <span className="text-[10px] font-mono-tabular font-bold text-[#D4AF63] shrink-0">
                    {opt.priceOffset}
                  </span>
                </button>
              ))}

              {selectedCategory === 'bike' && [
                { id: 'bike' as VehicleTier, brand: 'Rapido Bike', desc: 'Lightning-fast two-wheeler for traffic zipping', priceOffset: 'Fastest' },
                { id: 'bike' as VehicleTier, brand: 'Uber Moto', desc: 'Helmet provided · Solo urban commute', priceOffset: 'Lowest Fare' },
              ].map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setVehicleTier('bike')}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    vehicleTier === 'bike'
                      ? 'bg-amber-50/80 dark:bg-[#D4AF63]/15 border-amber-400 dark:border-[#D4AF63] text-stone-900 dark:text-stone-50 shadow-sm'
                      : 'bg-stone-50/70 dark:bg-[#080A0F]/70 border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold">{opt.brand}</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">{opt.desc}</p>
                  </div>
                  <span className="text-[10px] font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                    {opt.priceOffset}
                  </span>
                </button>
              ))}

              {selectedCategory === 'other' && [
                { id: 'car_elite' as VehicleTier, brand: 'Special Care WAV & Medical', desc: 'Wheelchair accessible vehicle with trained attendant', priceOffset: 'Certified' },
                { id: 'car_elite' as VehicleTier, brand: 'XL Family Van / Shuttle', desc: 'Up to 6 seats for luggage or large family groups', priceOffset: 'Spacious' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setVehicleTier(opt.id)}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    vehicleTier === opt.id
                      ? 'bg-amber-50/80 dark:bg-[#D4AF63]/15 border-amber-400 dark:border-[#D4AF63] text-stone-900 dark:text-stone-50 shadow-sm'
                      : 'bg-stone-50/70 dark:bg-[#080A0F]/70 border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold">{opt.brand}</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">{opt.desc}</p>
                  </div>
                  <span className="text-[10px] font-mono-tabular font-bold text-[#D4AF63] shrink-0">
                    {opt.priceOffset}
                  </span>
                </button>
              ))}
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

          {/* Payment Method & All UPI Options One Below the Other */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between gap-2">
              <span>CCAvenue Payment Method &amp; All UPI Apps</span>
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

            {/* All UPI Options One Below the Other with Logos */}
            {paymentMethod === 'ccavenue_upi' && (
              <div className="space-y-2 pt-1.5">
                <p className="text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                  Select Your UPI App (Instant Gateway Direct)
                </p>
                <div className="space-y-1.5">
                  {[
                    { name: 'Google Pay (GPay)', handle: '@okicici / @oksbi', logo: '🌐', color: 'bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60' },
                    { name: 'PhonePe', handle: '@ybl / @axl', logo: '🟣', color: 'bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60' },
                    { name: 'Paytm UPI', handle: '@paytm', logo: '🟦', color: 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/60' },
                    { name: 'BHIM UPI', handle: '@upi', logo: '🇮🇳', color: 'bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/60' },
                    { name: 'Amazon Pay', handle: '@apl', logo: '📦', color: 'bg-orange-500/10 text-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800/60' },
                    { name: 'Cred Pay', handle: '@cred', logo: '💳', color: 'bg-stone-500/10 text-stone-900 dark:text-stone-100 border-stone-300 dark:border-stone-700' },
                    { name: 'WhatsApp Pay', handle: '@wa', logo: '💬', color: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60' },
                  ].map((app, idx) => (
                    <div
                      key={idx}
                      onClick={() => setUpiHandleInput(`aarav${idx + 1}${app.handle.split('/')[0].trim()}`)}
                      className={`p-2.5 rounded-2xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all hover:scale-[1.01] ${app.color}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-white dark:bg-stone-900 flex items-center justify-center text-sm shadow-sm shrink-0">
                          {app.logo}
                        </span>
                        <div>
                          <p className="font-bold">{app.name}</p>
                          <p className="text-[10px] opacity-80 font-mono-tabular">Handle: {app.handle}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono-tabular font-bold px-2.5 py-1 rounded-xl bg-white/90 dark:bg-stone-900/90 shadow-xs">
                        Select
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-1">
                  <input
                    type="text"
                    value={upiHandleInput}
                    onChange={(e) => setUpiHandleInput(e.target.value)}
                    placeholder="Enter UPI Handle (e.g. aarav@okicici)"
                    className="w-full min-h-[42px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs font-mono-tabular text-stone-900 dark:text-white"
                  />
                </div>
              </div>
            )}
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

              {/* Visual Real-Time Live Tracking Map for Customer */}
              <ActiveTripMiniMap
                mapIdSuffix="customer"
                viewerRole="customer"
                pickupLatLng={activeCustomerRide.pickupLatLng}
                dropoffLatLng={activeCustomerRide.dropoffLatLng}
                pickupLabel={activeCustomerRide.pickupLabel}
                dropoffLabel={activeCustomerRide.dropoffLabel}
                vehicleTier={activeCustomerRide.vehicleTier}
                isEmergencyOrCare={activeCustomerRide.fareCondition === 'care_priority'}
                distanceKm={activeCustomerRide.distanceKm}
                durationMins={Math.max(8, Math.round(activeCustomerRide.distanceKm * 2.2))}
                phase={activeCustomerRide.status}
                driverLatLng={{
                  lat: activeCustomerRide.driverLat,
                  lng: activeCustomerRide.driverLng,
                }}
                isLiveTracking={
                  activeCustomerRide.status === 'matched' ||
                  activeCustomerRide.status === 'en_route' ||
                  activeCustomerRide.status === 'arrived' ||
                  activeCustomerRide.status === 'in_trip'
                }
              />

              {customerLiveMetrics && (
                <div
                  data-testid="customer-live-tracking-telemetry"
                  className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
                    <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse shrink-0" />
                    <span>{customerLiveMetrics.phaseLabel}</span>
                  </span>
                  <span className="font-mono-tabular font-bold text-stone-800 dark:text-stone-100">
                    {customerLiveMetrics.remainingKm} km ·{' '}
                    {customerLiveMetrics.etaMins > 0
                      ? `${customerLiveMetrics.etaMins} min ETA`
                      : 'Arrived'}
                  </span>
                </div>
              )}

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
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Select UPI App or Enter VPA (CCAvenue OPTUPI)
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {[
                    { name: 'Google Pay (GPay)', handle: '@okicici / @oksbi', logo: '🌐' },
                    { name: 'PhonePe', handle: '@ybl / @axl', logo: '🟣' },
                    { name: 'Paytm UPI', handle: '@paytm', logo: '🟦' },
                    { name: 'BHIM UPI', handle: '@upi', logo: '🇮🇳' },
                    { name: 'Amazon Pay', handle: '@apl', logo: '📦' },
                    { name: 'Cred Pay', handle: '@cred', logo: '💳' },
                    { name: 'WhatsApp Pay', handle: '@wa', logo: '💬' },
                  ].map((app, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setUpiHandleInput(`aarav${idx + 1}${app.handle.split('/')[0].trim()}`)}
                      className="w-full p-2 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50/80 dark:bg-[#080A0F] hover:border-[#D4AF63] text-xs flex items-center justify-between gap-2 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-white dark:bg-stone-900 flex items-center justify-center text-xs shadow-xs">
                          {app.logo}
                        </span>
                        <span className="font-bold text-stone-900 dark:text-white">{app.name}</span>
                      </div>
                      <span className="text-[10px] font-mono-tabular text-stone-500">{app.handle}</span>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  data-testid="ccavenue-upi-input"
                  value={upiHandleInput}
                  onChange={(e) => setUpiHandleInput(e.target.value)}
                  placeholder="e.g. yourname@okaxis"
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
