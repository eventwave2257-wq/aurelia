import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Phone,
  KeyRound,
  Car,
  Sparkles,
  CheckCircle2,
  Award,
  Share2,
  Copy,
  AlertCircle,
  Upload,
  QrCode,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { ConfirmationResult } from 'firebase/auth';
import { DRIVER_AVATAR_PATH, EXECUTIVE_FLEET_IMG_PATH } from '../data/seedData';
import type { DriverProfileData, VehicleTier } from '../types/aurelia';
import {
  buildSmsShareUri,
  generateVerificationOtp,
  hashPasswordSha256,
  isValidIndianMobile,
  maskIndianPhoneNumber,
  normalizeIndianMobile,
  normalizeOtpInput,
  validatePasswordSetup,
  validateQrPayloadOrImage,
  validateUpiId,
  validateVerificationOtp,
} from '../utils/aureliaLogic';
import { QrCodePreview } from './QrCodePreview';

interface DriverOnboardingModalProps {
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
  onSwitchPortal?: (portal: 'customer' | 'admin') => void;
  onComplete: (profile: DriverProfileData, tier: VehicleTier | 'auto') => void;
}

type OnboardingStep = 'phone' | 'otp' | 'credentials' | 'demoride' | 'success';

export function DriverOnboardingModal({
  verifiedPhoneNumber,
  onSendFirebasePhoneOtp,
  onVerifyFirebasePhoneOtp,
  onSwitchPortal,
  onComplete,
}: DriverOnboardingModalProps) {
  const [step, setStep] = useState<OnboardingStep>('phone');
  const [phone, setPhone] = useState<string>('9845012345');
  const [useFirebaseSms, setUseFirebaseSms] = useState<boolean>(true);
  const [fbConfirmation, setFbConfirmation] = useState<ConfirmationResult | null>(null);
  const [firebasePhoneLinked, setFirebasePhoneLinked] = useState<boolean>(Boolean(verifiedPhoneNumber));
  const [firebaseConsoleNotice, setFirebaseConsoleNotice] = useState<string | null>(null);
  const [smsGatewayNote, setSmsGatewayNote] = useState<string | null>(null);
  const [smsInboxCode, setSmsInboxCode] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otp, setOtp] = useState<string>('');
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [copiedSms, setCopiedSms] = useState<boolean>(false);
  const [resendCountdown, setResendCountdown] = useState<number>(0);

  const [fullName, setFullName] = useState<string>('Rajesh Kumar');
  const [licenseNumber, setLicenseNumber] = useState<string>('KA-01-2021004829');
  const [yearsExperience, setYearsExperience] = useState<number>(5);
  const [upiId, setUpiId] = useState<string>('rajesh.kumar@okicici');
  const [qrUpiPayload, setQrUpiPayload] = useState<string>('upi://pay?pa=rajesh.kumar@okicici&pn=Rajesh%20Kumar&cu=INR');
  const [qrCodeDocName, setQrCodeDocName] = useState<string>('Generated UPI QR');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [accountPassword, setAccountPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordHash, setPasswordHash] = useState<string>('');
  const [licenseDocName, setLicenseDocName] = useState<string>('DL-KA01-Front.jpg');
  const [licenseDocDataUrl, setLicenseDocDataUrl] = useState<string>('');
  const [vehicleDocName, setVehicleDocName] = useState<string>('Vehicle-RC-Scan.jpg');
  const [vehicleDocDataUrl, setVehicleDocDataUrl] = useState<string>('');
  const [carMake, setCarMake] = useState<string>('Toyota');
  const [carModel, setCarModel] = useState<string>('Camry Executive');
  const [carYear, setCarYear] = useState<number>(2024);
  const [carPlate, setCarPlate] = useState<string>('KA 01 AB 4829');
  const [vehicleSelection, setVehicleSelection] = useState<'auto' | 'economy' | 'premier' | 'elite'>('premier');
  const [credError, setCredError] = useState<string | null>(null);

  const [demoProgress, setDemoProgress] = useState<number>(0);
  const [demoRunning, setDemoRunning] = useState<boolean>(false);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCountdown]);

  const handleFileRead = (
    file: File | undefined,
    setName: (name: string) => void,
    setDataUrl: (url: string) => void
  ) => {
    if (!file) return;
    setName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const dispatchOtpToPhone = async (phoneNumber: string, codeToShare?: string): Promise<boolean> => {
    const cleanPhone = normalizeIndianMobile(phoneNumber);
    setOtpError(null);
    setSmsGatewayNote(null);
    setFirebaseConsoleNotice(null);
    setIsSendingOtp(true);

    // Primary Firebase Phone Auth OTP flow (reCAPTCHA + SMS / test numbers)
    let fallbackNotePrefix: string | null = null;
    if (useFirebaseSms && onSendFirebasePhoneOtp) {
      const fbRes = await onSendFirebasePhoneOtp(cleanPhone, 'aurelia-recaptcha-container');
      if (fbRes.ok && fbRes.confirmation) {
        setFbConfirmation(fbRes.confirmation);
        setSmsInboxCode(null);
        setSmsGatewayNote(`Firebase Phone Auth SMS OTP dispatched to ${maskIndianPhoneNumber(cleanPhone)}.`);
        setIsSendingOtp(false);
        setResendCountdown(30);
        return true;
      }
      if (typeof document !== 'undefined') {
        const rcContainer = document.getElementById('aurelia-recaptcha-container');
        if (rcContainer) rcContainer.innerHTML = '';
      }
      if (!fbRes.canFallbackToGateway) {
        setPhoneError(fbRes.error || 'Could not dispatch Firebase SMS OTP.');
        setIsSendingOtp(false);
        return false;
      }
      if (fbRes.requiresConsoleSetup && fbRes.error) {
        setFirebaseConsoleNotice(fbRes.error);
      }
      fallbackNotePrefix =
        'Firebase SMS carrier not active for this domain — delivered via Aurelia Secure OTP Gateway fallback.';
    }

    const fallbackCode = codeToShare || generateVerificationOtp();
    let activeCode = fallbackCode;
    setFbConfirmation(null);

    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, otp: fallbackCode }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setPhoneError(data?.error || 'Could not dispatch OTP to this number.');
        setIsSendingOtp(false);
        return false;
      }
      if (typeof data.deliveredCodePreview === 'string' && /^\d{4}$/.test(data.deliveredCodePreview)) {
        activeCode = data.deliveredCodePreview;
      }
      setSmsGatewayNote(
        fallbackNotePrefix ??
          `OTP dispatched via Aurelia Secure SMS Gateway to ${data.maskedPhone ?? maskIndianPhoneNumber(cleanPhone)}.`
      );
    } catch {
      setSmsGatewayNote(
        fallbackNotePrefix ??
          `Offline tolerance active — local verification session started for ${maskIndianPhoneNumber(cleanPhone)}.`
      );
    }

    setGeneratedOtp(activeCode);
    setSmsInboxCode(null);

    setIsSendingOtp(false);
    setResendCountdown(30);
    return true;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizeIndianMobile(phone);
    if (!isValidIndianMobile(cleanPhone)) {
      setPhoneError('Enter a valid 10-digit Indian mobile number (starting with 6–9).');
      return;
    }
    setPhone(cleanPhone);
    setPhoneError(null);
    setOtp('');
    const ok = await dispatchOtpToPhone(cleanPhone);
    if (ok) {
      setStep('otp');
    }
  };

  const handleShareToSms = () => {
    const cleanPhone = normalizeIndianMobile(phone);
    const uri = buildSmsShareUri(cleanPhone, generatedOtp);
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: 'Aurelia Driver Verification OTP',
          text: `Your Aurelia Karnataka Chauffeur verification OTP is: ${generatedOtp}`,
        })
        .catch(() => {
          window.location.href = uri;
        });
    } else {
      window.location.href = uri;
    }
  };

  const handleCopySmsText = () => {
    const text = `Your Aurelia Karnataka Chauffeur verification OTP is: ${generatedOtp}`;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedSms(true);
      setTimeout(() => setCopiedSms(false), 2500);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isSendingOtp) return;
    const cleanPhone = normalizeIndianMobile(phone);
    setOtp('');
    await dispatchOtpToPhone(cleanPhone);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    const cleanOtp = normalizeOtpInput(otp);

    if (fbConfirmation) {
      if (onVerifyFirebasePhoneOtp) {
        const verifyRes = await onVerifyFirebasePhoneOtp(fbConfirmation, cleanOtp);
        if (!verifyRes.ok) {
          setOtpError(verifyRes.error || 'Invalid Firebase SMS OTP code. Please check your SMS and try again.');
          return;
        }
        setFirebasePhoneLinked(true);
        setStep('credentials');
        return;
      }
      try {
        await fbConfirmation.confirm(cleanOtp);
        setFirebasePhoneLinked(true);
        setStep('credentials');
        return;
      } catch {
        setOtpError('Invalid Firebase SMS OTP code. Please check your SMS and try again.');
        return;
      }
    }

    const validation = validateVerificationOtp(cleanOtp, generatedOtp);
    if (!validation.valid) {
      setOtpError(validation.error || 'Invalid verification code.');
      return;
    }

    try {
      const cleanPhone = normalizeIndianMobile(phone);
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, otp: cleanOtp }),
      });
      const data = await res.json();
      if (!res.ok && data?.error && !data.error.includes('No active OTP')) {
        setOtpError(data.error);
        return;
      }
    } catch {
      // offline tolerance when local session validated
    }

    setStep('credentials');
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setCredError('Please enter a valid 10-digit verified mobile number for account payouts.');
      return;
    }
    if (!fullName.trim() || !licenseNumber.trim() || !carModel.trim() || !carPlate.trim()) {
      setCredError('Please fill in all required driver, license, and vehicle credentials.');
      return;
    }
    const upiCheck = validateUpiId(upiId);
    if (!upiCheck.valid) {
      setCredError(upiCheck.error || 'Valid UPI ID is required.');
      return;
    }
    const qrCheck = validateQrPayloadOrImage(qrUpiPayload || upiId, qrCodeDataUrl);
    if (!qrCheck.valid) {
      setCredError(qrCheck.error || 'Please link your Payment QR Code or UPI URI.');
      return;
    }
    const pwdCheck = validatePasswordSetup(accountPassword, confirmPassword);
    if (!pwdCheck.valid) {
      setCredError(pwdCheck.error || 'Please set a valid account password.');
      return;
    }

    const hashed = await hashPasswordSha256(accountPassword);
    setPasswordHash(hashed);
    setCredError(null);
    setStep('demoride');
  };

  const handleStartDemoRide = () => {
    setDemoRunning(true);
    setDemoProgress(0);
    const interval = setInterval(() => {
      setDemoProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setDemoRunning(false);
          return 100;
        }
        return prev + 10;
      });
    }, 400);
  };

  const handleFinishOnboarding = () => {
    let resolvedTier: VehicleTier | 'auto' = 'car_premier';
    if (vehicleSelection === 'auto') resolvedTier = 'auto';
    else if (vehicleSelection === 'economy') resolvedTier = 'car_economy';
    else if (vehicleSelection === 'premier') resolvedTier = 'car_premier';
    else if (vehicleSelection === 'elite') resolvedTier = 'car_elite';

    const profile: DriverProfileData = {
      fullName: fullName.trim(),
      email: `${fullName.toLowerCase().replace(/\s+/g, '')}@aurelia-driver.in`,
      phone: `+91 ${phone}`,
      cityRegion: 'Bengaluru / Karnataka Corridor',
      yearsExperience,
      bio: `Professional Karnataka driver with ${yearsExperience} years experience operating ${carModel} (${carYear}).`,
      upiId: upiId.trim(),
      qrUpiPayload: qrUpiPayload.trim() || `upi://pay?pa=${upiId.trim()}&cu=INR`,
      qrCodeDocName,
      qrCodeDataUrl: qrCodeDataUrl || undefined,
      passwordHash,
      passwordUpdatedAt: new Date().toISOString().slice(0, 10),
      licenseNumber: licenseNumber.trim(),
      licenseDocName,
      licenseDocDataUrl: licenseDocDataUrl || DRIVER_AVATAR_PATH,
      vehicleDocName,
      vehicleDocDataUrl: vehicleDocDataUrl || undefined,
      approvalStatus: 'pending',
      vehicleApprovalStatus: 'pending',
      vehicle: {
        make: carMake.trim(),
        model: `${carModel.trim()} (${carYear}) - ${vehicleSelection.toUpperCase()}`,
        year: carYear,
        licensePlate: carPlate.trim().toUpperCase(),
        color: 'Midnight Obsidian / Pearl Gold',
        wavConfiguration:
          vehicleSelection === 'auto' ? 'Karnataka Metered Auto' : 'Executive Climate Luxury',
      },
      specializations: [
        vehicleSelection === 'auto'
          ? 'Auto Rickshaw Fleet'
          : `${vehicleSelection.toUpperCase()} Executive & Care`,
      ],
      backgroundCheck: {
        status: 'Pending Review',
        lastUpdated: new Date().toISOString().slice(0, 10),
        reviewedBy: 'Aurelia Karnataka Trust & Safety Queue',
        notes: 'Submitted onboarding documents, payment QR code, password setup, and free demo ride verification.',
      },
    };

    onComplete(profile, resolvedTier);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aurelia Driver Onboarding & Verification"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div id="aurelia-recaptcha-container" />
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#101218] border border-amber-300 dark:border-amber-500/40 shadow-2xl text-stone-900 dark:text-stone-100 my-auto">
        {/* Visual Fleet Hero Banner + Header */}
        <div className="relative h-28 sm:h-32 w-full overflow-hidden border-b border-stone-200 dark:border-white/10">
          <img
            src={EXECUTIVE_FLEET_IMG_PATH}
            alt="Aurelia Karnataka Executive Chauffeur Sedan at Vidhana Soudha"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-[#0B0D12]/65 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:px-6 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E6C77E]">
              Aurelia Karnataka Fleet Onboarding
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">
              {step === 'phone' && 'Driver Mobile Verification'}
              {step === 'otp' && 'Enter Security Verification OTP'}
              {step === 'credentials' && 'Mobile, Payment QR & Password Setup'}
              {step === 'demoride' && 'Mandatory Free Company Demo Ride'}
              {step === 'success' && 'Submitted for Admin Verification'}
            </h2>
          </div>
        </div>

        <div className="px-6 pt-3 pb-0">
          <p className="text-xs text-stone-600 dark:text-stone-400">
            {step === 'phone' && 'Enter your +91 mobile number to receive a Firebase Phone Auth or Gateway OTP'}
            {step === 'otp' && `Verification session active for ${maskIndianPhoneNumber(phone)}`}
            {step === 'credentials' && 'Confirm mobile number, link Payment QR Code (₹3/ride fee auto-deducted), and set your account password'}
            {step === 'demoride' && 'Complete your 3 km demo ride to activate Karnataka dispatch'}
            {step === 'success' && 'Documents queued in Admin Panel for final approval'}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Mobile Number (+91)
                </label>
                <div className="flex items-center">
                  <span className="px-3.5 py-3 rounded-l-2xl bg-stone-100 dark:bg-stone-800 border border-r-0 border-stone-300 dark:border-stone-700 text-xs font-mono-tabular text-stone-600 dark:text-stone-300">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    data-testid="onboarding-phone-input"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder="9845012345"
                    className="flex-1 min-h-[48px] px-4 rounded-r-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-sm font-mono-tabular text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 text-xs cursor-pointer">
                <div className="space-y-0.5">
                  <span className="font-semibold text-stone-800 dark:text-stone-200 block">
                    Firebase Phone Auth OTP (Primary · reCAPTCHA + SMS)
                  </span>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 block">
                    Sends 6-digit Firebase Auth OTP; auto-falls back to Aurelia SMS Gateway if carrier setup is pending.
                  </span>
                </div>
                <input
                  type="checkbox"
                  data-testid="onboarding-firebase-otp-toggle"
                  checked={useFirebaseSms}
                  onChange={(e) => setUseFirebaseSms(e.target.checked)}
                  className="w-4 h-4 accent-[#D4AF63] shrink-0"
                />
              </label>

              {phoneError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{phoneError}</p>
              )}

              <button
                type="submit"
                disabled={isSendingOtp}
                data-testid="send-otp-btn"
                className="w-full min-h-[48px] rounded-2xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Phone className="w-4 h-4" />
                <span>{isSendingOtp ? 'Dispatching OTP...' : 'Send SMS OTP'}</span>
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-stone-800 dark:text-stone-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-[#E2C77D]">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{fbConfirmation ? 'Firebase Phone Auth OTP Sent' : 'OTP Dispatched'}</span>
                  </div>
                  <span className="text-[11px] font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-300">
                    +91 {phone}
                  </span>
                </div>
                <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                  {smsGatewayNote ??
                    'A verification code was delivered to your mobile number.'}
                </p>
                {firebaseConsoleNotice && (
                  <p
                    data-testid="onboarding-firebase-setup-hint"
                    className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-900/30 border border-amber-300/70 dark:border-amber-600/40 rounded-xl px-3 py-2"
                  >
                    {firebaseConsoleNotice}
                  </p>
                )}

                {!fbConfirmation && (
                  <div className="flex items-center flex-wrap gap-2 pt-1 border-t border-stone-200/60 dark:border-white/10">
                    <button
                      type="button"
                      onClick={handleShareToSms}
                      className="text-[11px] font-semibold text-[#B48A3E] dark:text-[#D4AF63] hover:underline flex items-center gap-1.5 cursor-pointer py-1.5 px-2.5 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Open in SMS</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopySmsText}
                      className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 hover:underline flex items-center gap-1.5 cursor-pointer py-1.5 px-2.5 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedSms ? 'Copied' : 'Copy SMS'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('phone');
                        setOtp('');
                        setOtpError(null);
                      }}
                      className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 underline ml-auto cursor-pointer"
                    >
                      Edit Number
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    {fbConfirmation ? 'Enter 6-Digit Firebase SMS Code' : 'Enter Verification Code'}
                  </label>
                  <button
                    type="button"
                    disabled={resendCountdown > 0 || isSendingOtp}
                    onClick={() => void handleResendOtp()}
                    data-testid="resend-otp-btn"
                    className="text-[11px] font-semibold text-amber-700 dark:text-[#D4AF63] hover:underline disabled:opacity-40 cursor-pointer"
                  >
                    {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  autoFocus
                  data-testid="otp-code-input"
                  value={otp}
                  onChange={(e) => {
                    setOtp(normalizeOtpInput(e.target.value));
                    if (otpError) setOtpError(null);
                  }}
                  placeholder={fbConfirmation ? '• • • • • •' : '• • • •'}
                  className="w-full min-h-[48px] px-4 text-center tracking-[0.5em] text-xl rounded-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 font-mono-tabular text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {otpError && (
                  <div
                    data-testid="otp-error-msg"
                    className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium pt-1"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                data-testid="verify-otp-btn"
                className="w-full min-h-[48px] rounded-2xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Verify OTP &amp; Continue</span>
              </button>
            </form>
          )}

          {step === 'credentials' && (
            <form onSubmit={(e) => void handleSaveCredentials(e)} className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
              {/* Post-Verification Linked Mobile & Account Payout Info */}
              <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Post-Verification Payout Account (Flat ₹3/ride fee · Remainder Auto-Transferred)</span>
                  </span>
                  {(firebasePhoneLinked || verifiedPhoneNumber) && (
                    <span className="text-[10px] font-mono-tabular px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-800 dark:text-emerald-300">
                      Firebase Phone Linked
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                      Payout Mobile Number (+91)
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      data-testid="onboarding-payout-mobile-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs font-mono-tabular text-stone-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                      UPI Payout Handle
                    </label>
                    <input
                      type="text"
                      required
                      value={upiId}
                      onChange={(e) => {
                        setUpiId(e.target.value);
                        setQrUpiPayload(`upi://pay?pa=${e.target.value.trim()}&pn=${encodeURIComponent(fullName || 'Aurelia Driver')}&cu=INR`);
                      }}
                      placeholder="driver@okicici"
                      className="w-full min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white font-mono-tabular"
                    />
                  </div>
                </div>
              </div>

              {/* Payment QR Code Upload & Preview */}
              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#D4AF63]" />
                      <span>Payment QR Code Link / UPI QR URI</span>
                    </label>
                    <input
                      type="text"
                      data-testid="onboarding-qr-payload-input"
                      value={qrUpiPayload}
                      onChange={(e) => setQrUpiPayload(e.target.value)}
                      placeholder="upi://pay?pa=yourname@okicici&cu=INR"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101218] border border-stone-300 dark:border-stone-700 text-xs font-mono-tabular text-stone-900 dark:text-white"
                    />
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-white dark:bg-[#101218] text-[11px] font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#D4AF63]" />
                      <span>Upload QR Image ({qrCodeDocName})</span>
                      <input
                        type="file"
                        accept="image/*"
                        data-testid="onboarding-qr-upload-input"
                        className="hidden"
                        onChange={(e) =>
                          handleFileRead(e.target.files?.[0], setQrCodeDocName, setQrCodeDataUrl)
                        }
                      />
                    </label>
                  </div>
                  <div className="shrink-0 self-center">
                    <QrCodePreview
                      payload={qrUpiPayload || upiId}
                      imageDataUrl={qrCodeDataUrl}
                      label={upiId || '+91 ' + phone}
                      size={92}
                    />
                  </div>
                </div>
              </div>

              {/* Set Password (setapass) */}
              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#D4AF63]" />
                    <span>Set Account Password (setapass)</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                      Create Password (8+ chars)
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      data-testid="onboarding-password-input"
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      placeholder="Aurelia2026"
                      className="w-full min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#101218] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      data-testid="onboarding-confirm-password-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#101218] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-stone-500 dark:text-stone-400">
                  Must include at least 8 characters with both letters and numbers.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    License Number
                  </label>
                  <input
                    type="text"
                    required
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white font-mono-tabular"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Experience (yrs)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    required
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white font-mono-tabular"
                  />
                </div>
              </div>

              {/* Real File Upload Inputs for License & RC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="p-3 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#080A0F] cursor-pointer space-y-1">
                  <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#D4AF63]" />
                    <span>Upload Driving License</span>
                  </span>
                  <span className="block text-[10px] font-mono-tabular text-stone-500 truncate">
                    {licenseDocName}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleFileRead(e.target.files?.[0], setLicenseDocName, setLicenseDocDataUrl)
                    }
                  />
                </label>

                <label className="p-3 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#080A0F] cursor-pointer space-y-1">
                  <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Upload Vehicle RC Photo</span>
                  </span>
                  <span className="block text-[10px] font-mono-tabular text-stone-500 truncate">
                    {vehicleDocName}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleFileRead(e.target.files?.[0], setVehicleDocName, setVehicleDocDataUrl)
                    }
                  />
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Vehicle Service Tier
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'auto', label: 'Auto Rickshaw', desc: 'Metered local auto rides' },
                    { id: 'economy', label: 'Economy Sedan', desc: 'Models 2018–2021' },
                    { id: 'premier', label: 'Premier Executive', desc: 'Models 2022–2024' },
                    { id: 'elite', label: 'Elite / EV', desc: 'Luxury & Electric 2025+' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setVehicleSelection(item.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        vehicleSelection === item.id
                          ? 'border-[#B48A3E] dark:border-[#D4AF63] bg-amber-50/80 dark:bg-amber-400/10'
                          : 'border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-[#080A0F]/60'
                      }`}
                    >
                      <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                        {item.label}
                      </p>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400">{item.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">Make</label>
                  <input
                    type="text"
                    required
                    value={carMake}
                    onChange={(e) => setCarMake(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">Model</label>
                  <input
                    type="text"
                    required
                    value={carModel}
                    onChange={(e) => setCarModel(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">Year</label>
                  <input
                    type="number"
                    min={2010}
                    max={2026}
                    required
                    value={carYear}
                    onChange={(e) => setCarYear(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white font-mono-tabular"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Vehicle Number Plate
                </label>
                <input
                  type="text"
                  required
                  value={carPlate}
                  onChange={(e) => setCarPlate(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white font-mono-tabular"
                />
              </div>

              {credError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{credError}</p>
              )}

              <button
                type="submit"
                className="w-full min-h-[48px] rounded-2xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer pt-1"
              >
                <Car className="w-4 h-4" />
                <span>Save &amp; Proceed to Demo Ride</span>
              </button>
            </form>
          )}

          {step === 'demoride' && (
            <div className="space-y-4 text-left">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-stone-800 dark:text-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-amber-800 dark:text-[#E6C77E] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Mandatory Company Demo Calibration Ride (3 km)</span>
                  </p>
                  <span className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
                    ₹57 Credit
                  </span>
                </div>
                <p className="leading-relaxed text-stone-600 dark:text-stone-300">
                  Every driver completes a 3.0 km telemetry check ride along the Vidhana Soudha → MG Road corridor. Revenue from this calibration ride (₹57 at ₹19/km) is verified and credited towards your account safety setup.
                </p>
              </div>

              {/* Live Telemetry Calibration Strip */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono-tabular">
                  <div className="p-2 rounded-xl bg-white dark:bg-[#101218] border border-stone-200 dark:border-white/10">
                    <p className="text-[10px] text-stone-500">Distance</p>
                    <p className="font-bold text-stone-900 dark:text-white">
                      {((demoProgress * 3.0) / 100).toFixed(1)} / 3.0 km
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-[#101218] border border-stone-200 dark:border-white/10">
                    <p className="text-[10px] text-stone-500">Calibrated Speed</p>
                    <p className="font-bold text-emerald-700 dark:text-emerald-400">
                      {demoRunning ? '42 km/h' : demoProgress === 100 ? '0 km/h (Done)' : '0 km/h'}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-[#101218] border border-stone-200 dark:border-white/10">
                    <p className="text-[10px] text-stone-500">GPS Signal</p>
                    <p className="font-bold text-emerald-700 dark:text-emerald-400">
                      Lock (100%)
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono-tabular text-stone-600 dark:text-stone-300">
                    <span>Telemetry Progress</span>
                    <span className="font-bold">{demoProgress}%</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${demoProgress}%` }}
                    />
                  </div>
                </div>

                {/* Checkpoints */}
                <div className="space-y-1.5 text-[11px] pt-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${
                        demoProgress >= 30 ? 'text-emerald-600' : 'text-stone-400'
                      }`}
                    />
                    <span className={demoProgress >= 30 ? 'text-stone-900 dark:text-white font-medium' : 'text-stone-500'}>
                      Checkpoint 1: Vidhana Soudha GPS &amp; Fare Meter Calibration
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${
                        demoProgress >= 70 ? 'text-emerald-600' : 'text-stone-400'
                      }`}
                    />
                    <span className={demoProgress >= 70 ? 'text-stone-900 dark:text-white font-medium' : 'text-stone-500'}>
                      Checkpoint 2: MG Road Speed Limit &amp; Overrun Safety Warning Check
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${
                        demoProgress >= 100 ? 'text-emerald-600' : 'text-stone-400'
                      }`}
                    />
                    <span className={demoProgress >= 100 ? 'text-stone-900 dark:text-white font-medium' : 'text-stone-500'}>
                      Checkpoint 3: Brigade Road Terminal &amp; ₹3 Flat Platform Ledger Verification
                    </span>
                  </div>
                </div>
              </div>

              {!demoRunning && demoProgress === 0 && (
                <button
                  type="button"
                  data-testid="start-demo-ride-btn"
                  onClick={handleStartDemoRide}
                  className="w-full min-h-[48px] rounded-2xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Free Company Demo Calibration Ride (3 km)</span>
                </button>
              )}

              {demoRunning && (
                <div className="p-3 text-center rounded-xl bg-amber-500/10 text-amber-800 dark:text-[#E6C77E] text-xs font-semibold animate-pulse">
                  Calibrating GPS &amp; driving telemetry on Bengaluru corridor...
                </div>
              )}

              {demoProgress >= 100 && (
                <button
                  type="button"
                  data-testid="complete-demo-ride-btn"
                  onClick={() => setStep('success')}
                  className="w-full min-h-[48px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Calibration Approved · Proceed to Final Approval</span>
                </button>
              )}
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-5 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">
                  Onboarding Complete &amp; Queued for Admin Approval
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400 font-mono-tabular">
                  Documents ({licenseDocName}, {vehicleDocName}) and UPI handle ({upiId}) linked to{' '}
                  <strong className="text-amber-700 dark:text-[#D4AF63] uppercase">
                    {vehicleSelection}
                  </strong>{' '}
                  tier.
                </p>
              </div>

              <button
                type="button"
                onClick={handleFinishOnboarding}
                className="w-full min-h-[48px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>Enter Aurelia Driver Cockpit</span>
              </button>
            </div>
          )}

          {onSwitchPortal && (
            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-stone-500 dark:text-stone-400">
                Not onboarding as a driver?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSwitchPortal('customer')}
                  className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:border-[#B48A3E] dark:hover:border-[#D4AF63] font-medium whitespace-nowrap cursor-pointer"
                >
                  Open Customer App
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchPortal('admin')}
                  className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:border-[#B48A3E] dark:hover:border-[#D4AF63] font-medium whitespace-nowrap cursor-pointer"
                >
                  Admin Panel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
