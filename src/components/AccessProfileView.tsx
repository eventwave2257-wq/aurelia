import { useState } from 'react';
import {
  Accessibility,
  Car,
  CheckCircle2,
  Eye,
  HeartPulse,
  Lock,
  MapPin,
  Moon,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  ShieldCheck,
  Sun,
  Upload,
  UserCheck,
  Volume2,
} from 'lucide-react';
import { KARNATAKA_31_DISTRICTS, VEHICLE_TIER_OPTIONS } from '../data/karnatakaDistricts';
import { DRIVER_AVATAR_PATH } from '../data/seedData';
import type {
  BackgroundCheckStatus,
  CompletedTrip,
  DriverPreferences,
  DriverProfileData,
} from '../types/aurelia';
import type { User } from 'firebase/auth';
import {
  hashPasswordSha256,
  validateDriverProfileInput,
  validatePasswordSetup,
} from '../utils/aureliaLogic';
import { QrCodePreview } from './QrCodePreview';
import { VehicleMaintenanceWidget } from './VehicleMaintenanceWidget';

interface AccessProfileViewProps {
  profile: DriverProfileData;
  preferences: DriverPreferences;
  completedTrips?: CompletedTrip[];
  firebaseUser?: User | null;
  isAdminUser?: boolean;
  connectionOk?: boolean;
  onSignInGoogle?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
  onSaveProfile: (updated: DriverProfileData) => void;
  onUpdatePreferences: (partial: Partial<DriverPreferences>) => void;
  onResetDemoData: () => void;
}

const BG_STATUS_OPTIONS: BackgroundCheckStatus[] = [
  'Verified & Cleared',
  'Pending Review',
  'Renewal Required',
  'Action Required',
];

export function AccessProfileView({
  profile,
  preferences,
  completedTrips = [],
  firebaseUser,
  isAdminUser = false,
  connectionOk = true,
  onSignInGoogle,
  onSignOut,
  onSaveProfile,
  onUpdatePreferences,
  onResetDemoData,
}: AccessProfileViewProps) {
  const [imgError, setImgError] = useState<boolean>(false);
  const [draft, setDraft] = useState<DriverProfileData>(profile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [newSpecInput, setNewSpecInput] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  // Administrator verification panel state
  const [adminMode, setAdminMode] = useState<boolean>(false);
  const [adminStatus, setAdminStatus] = useState<BackgroundCheckStatus>(
    profile.backgroundCheck.status
  );
  const [adminReviewer, setAdminReviewer] = useState<string>(
    profile.backgroundCheck.reviewedBy
  );
  const [adminNotes, setAdminNotes] = useState<string>(profile.backgroundCheck.notes);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateDriverProfileInput(draft);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      setSaveFeedback(null);
      return;
    }
    setErrors({});
    onSaveProfile(draft);
    setSaveFeedback('Chauffeur profile, payment QR code, and vehicle details saved.');
  };

  const handleQrFileUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const next = {
          ...draft,
          qrCodeDocName: file.name,
          qrCodeDataUrl: reader.result,
        };
        setDraft(next);
        onSaveProfile(next);
        setSaveFeedback(`Payment QR image "${file.name}" saved for automatic post-ride transfers.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdatePassword = async () => {
    const check = validatePasswordSetup(newPassword, confirmPassword);
    if (!check.valid) {
      setPasswordStatus(check.error || 'Invalid password.');
      return;
    }
    const hashed = await hashPasswordSha256(newPassword);
    const updated: DriverProfileData = {
      ...draft,
      passwordHash: hashed,
      passwordUpdatedAt: new Date().toISOString().slice(0, 10),
    };
    setDraft(updated);
    onSaveProfile(updated);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordStatus('Account password hashed and saved securely.');
  };

  const handleAddSpecialization = () => {
    const trimmed = newSpecInput.trim();
    if (!trimmed) return;
    if (draft.specializations.includes(trimmed)) {
      setNewSpecInput('');
      return;
    }
    const next = {
      ...draft,
      specializations: [...draft.specializations, trimmed],
    };
    setDraft(next);
    onSaveProfile(next);
    setNewSpecInput('');
  };

  const handleRemoveSpecialization = (spec: string) => {
    const next = {
      ...draft,
      specializations: draft.specializations.filter((s) => s !== spec),
    };
    setDraft(next);
    onSaveProfile(next);
  };

  const handleAdminUpdateBackgroundCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: DriverProfileData = {
      ...draft,
      backgroundCheck: {
        status: adminStatus,
        lastUpdated: '2026-11-14',
        reviewedBy: adminReviewer.trim() || 'AURELIA Karnataka Trust & Safety Admin',
        notes: adminNotes.trim() || 'Status updated by administrator.',
      },
    };
    setDraft(updated);
    onSaveProfile(updated);
    setSaveFeedback(`Background check status updated to "${adminStatus}".`);
    setAdminMode(false);
  };

  const toggleCertification = (key: keyof DriverPreferences['certifications']) => {
    onUpdatePreferences({
      certifications: {
        ...preferences.certifications,
        [key]: !preferences.certifications[key],
      },
    });
  };

  const statusTextColor = (status: BackgroundCheckStatus) => {
    if (status === 'Verified & Cleared') return 'text-emerald-700 dark:text-emerald-400';
    if (status === 'Pending Review') return 'text-[#9A722A] dark:text-[#D4AF63]';
    return 'text-rose-700 dark:text-rose-400';
  };

  return (
    <div className="space-y-5">
      {/* Top Profile Header Summary */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {!imgError ? (
            <img
              src={DRIVER_AVATAR_PATH}
              alt={`${profile.fullName}, AURELIA Sovereign Mobility Chauffeur`}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-16 h-16 rounded-2xl object-cover border border-amber-400/50 dark:border-[#D4AF63]/50 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#B48A3E] dark:bg-[#D4AF63] text-white dark:text-stone-950 font-bold text-xl flex items-center justify-center shrink-0">
              {profile.fullName
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9A722A] dark:text-[#D4AF63]">
              Chauffeur Profile · {profile.cityRegion} · {profile.yearsExperience} yrs experience
            </p>
            <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-50">
              {profile.fullName}
            </h1>
            <p className="text-xs text-stone-600 dark:text-stone-300 font-mono-tabular mt-0.5">
              {profile.vehicle.year} {profile.vehicle.make} {profile.vehicle.model} · Plate{' '}
              {profile.vehicle.licensePlate}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-left md:text-right">
            <p className="text-xs text-stone-500 dark:text-stone-400">Background Check</p>
            <p
              data-testid="bg-check-status-label"
              className={`text-sm font-bold ${statusTextColor(profile.backgroundCheck.status)}`}
            >
              {profile.backgroundCheck.status}
            </p>
          </div>
          <button
            type="button"
            onClick={onResetDemoData}
            className="min-h-[44px] px-3.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {saveFeedback && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-medium text-emerald-900 dark:text-emerald-200"
        >
          {saveFeedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Editable Personal & Vehicle Profile Form */}
        <form
          onSubmit={handleSaveProfile}
          noValidate
          className="lg:col-span-7 p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-sm space-y-5"
        >
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-50">
                Driver & Vehicle Details
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Keep personal credentials, Karnataka RTO vehicle specs, and experience current
              </p>
            </div>
            <button
              type="submit"
              data-testid="save-driver-profile-btn"
              className="min-h-[44px] px-4 rounded-xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>Save Profile</span>
            </button>
          </div>

          {/* Personal Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-stone-500 dark:text-stone-400">
              Personal Details & Experience
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={draft.fullName}
                  onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white"
                />
                {errors.fullName && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.fullName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white"
                />
                {errors.email && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white"
                />
                {errors.phone && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Years of Driving Experience
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={draft.yearsExperience}
                  onChange={(e) =>
                    setDraft({ ...draft, yearsExperience: Number(e.target.value) })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white font-mono-tabular"
                />
                {errors.yearsExperience && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {errors.yearsExperience}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  UPI Payout Handle
                </label>
                <input
                  type="text"
                  value={draft.upiId ?? ''}
                  onChange={(e) => setDraft({ ...draft, upiId: e.target.value })}
                  placeholder="vikram.rao@okicici"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white font-mono-tabular"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Care & Driving Summary
                </label>
                <textarea
                  rows={2}
                  value={draft.bio}
                  onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                  className="w-full p-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Payment QR Code & Set Password (setapass) */}
          <div className="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-[#B48A3E] dark:text-[#D4AF63]" />
              <span>Linked Payment QR Code &amp; Account Password (setapass)</span>
            </h3>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F4] dark:bg-[#0B0C0E] border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 space-y-2.5">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    QR Code UPI Payload / Link
                  </label>
                  <input
                    type="text"
                    value={draft.qrUpiPayload ?? `upi://pay?pa=${draft.upiId ?? 'vikram.rao@okicici'}&cu=INR`}
                    onChange={(e) => setDraft({ ...draft, qrUpiPayload: e.target.value })}
                    placeholder="upi://pay?pa=vikram.rao@okicici&cu=INR"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#101218] text-xs font-mono-tabular text-stone-900 dark:text-white"
                  />
                </div>
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-white dark:bg-[#101218] text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#D4AF63]" />
                  <span>{draft.qrCodeDocName ? `Replace QR (${draft.qrCodeDocName})` : 'Upload Payment QR Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleQrFileUpload(e.target.files?.[0])}
                  />
                </label>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  After each completed ride, flat ₹3 is deducted and the remainder transfers to this linked account.
                </p>
              </div>
              <div className="shrink-0 self-center">
                <QrCodePreview
                  payload={draft.qrUpiPayload || `upi://pay?pa=${draft.upiId || 'vikram.rao@okicici'}&cu=INR`}
                  imageDataUrl={draft.qrCodeDataUrl}
                  label={draft.upiId || draft.phone}
                  size={96}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F4] dark:bg-[#0B0C0E] border border-stone-200 dark:border-stone-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#D4AF63]" />
                  <span>Account Password (setapass)</span>
                </span>
                <span className="font-mono-tabular text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  {draft.passwordHash ? `Configured (${draft.passwordUpdatedAt ?? 'Active'})` : 'Not set yet'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (8+ chars)"
                  className="min-h-[42px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#101218] text-xs text-stone-900 dark:text-white"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="min-h-[42px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#101218] text-xs text-stone-900 dark:text-white"
                />
                <button
                  type="button"
                  data-testid="profile-setapass-btn"
                  onClick={() => void handleUpdatePassword()}
                  className="min-h-[42px] px-3 rounded-xl bg-stone-900 dark:bg-[#D4AF63] text-white dark:text-stone-950 text-xs font-semibold cursor-pointer"
                >
                  Save Password
                </button>
              </div>
              {passwordStatus && (
                <p className="text-xs font-medium text-amber-700 dark:text-[#E6C77E]">{passwordStatus}</p>
              )}
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <Car className="w-4 h-4 text-[#B48A3E] dark:text-[#D4AF63]" />
              <span>Vehicle Information</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Vehicle Make
                </label>
                <input
                  type="text"
                  value={draft.vehicle.make}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      vehicle: { ...draft.vehicle, make: e.target.value },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white"
                />
                {errors.vehicleMake && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {errors.vehicleMake}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Vehicle Model
                </label>
                <input
                  type="text"
                  value={draft.vehicle.model}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      vehicle: { ...draft.vehicle, model: e.target.value },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white"
                />
                {errors.vehicleModel && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {errors.vehicleModel}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Model Year
                </label>
                <input
                  type="number"
                  value={draft.vehicle.year}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      vehicle: { ...draft.vehicle, year: Number(e.target.value) },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white font-mono-tabular"
                />
                {errors.vehicleYear && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {errors.vehicleYear}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  License Plate (Karnataka RTO)
                </label>
                <input
                  type="text"
                  value={draft.vehicle.licensePlate}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      vehicle: { ...draft.vehicle, licensePlate: e.target.value.toUpperCase() },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white font-mono-tabular"
                />
                {errors.licensePlate && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {errors.licensePlate}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Accessibility & Boarding Configuration
                </label>
                <input
                  type="text"
                  value={draft.vehicle.wavConfiguration}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      vehicle: { ...draft.vehicle, wavConfiguration: e.target.value },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Vehicle Maintenance & Service Interval Tracker */}
          <VehicleMaintenanceWidget
            completedTrips={completedTrips}
            vehicle={draft.vehicle}
          />

          {/* Specializations & Custom Certifications */}
          <div className="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-stone-500 dark:text-stone-400">
              Specializations & Medical Certifications
            </h3>

            <div className="flex gap-2">
              <input
                type="text"
                value={newSpecInput}
                onChange={(e) => setNewSpecInput(e.target.value)}
                placeholder="Add specialization (e.g., Kannada & English Care Concierge)"
                aria-label="New specialization or certification"
                className="flex-1 min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddSpecialization}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl">
              {draft.specializations.map((spec) => (
                <div
                  key={spec}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-medium text-stone-800 dark:text-stone-200">{spec}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSpecialization(spec)}
                    className="min-h-[36px] px-2 text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Right Column: Firebase Cloud Sync + Background Check Admin Panel + Karnataka Preferences */}
        <div className="lg:col-span-5 space-y-5">
          {/* Firebase Cloud Sync & Authentication */}
          <section className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-amber-400/20 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A722A] dark:text-[#E6C77E]">
                  Firebase Auth &amp; Cloud Firestore
                </p>
                <h2 className="font-display text-lg font-bold text-stone-900 dark:text-white">
                  {firebaseUser ? firebaseUser.displayName || firebaseUser.email : 'Local Sandbox Session'}
                </h2>
              </div>
              <span
                className={`text-[11px] font-mono-tabular font-bold ${
                  connectionOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600'
                }`}
              >
                {firebaseUser ? (isAdminUser ? 'ADMIN SYNCED' : 'CLOUD SYNCED') : 'LOCAL MODE'}
              </span>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300">
              {firebaseUser
                ? `Signed in as ${firebaseUser.email} — driver profile, live rides, payouts & complaints sync directly to Firestore.`
                : 'Sign in with Google to persist Driver, Customer Bookings, Payouts, and Admin approvals to Cloud Firestore.'}
            </p>

            {firebaseUser ? (
              <button
                type="button"
                onClick={() => void onSignOut?.()}
                className="w-full min-h-[42px] rounded-xl border border-stone-300 dark:border-white/15 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/10 cursor-pointer"
              >
                Sign Out of Firebase
              </button>
            ) : (
              <button
                type="button"
                data-testid="firebase-google-signin-btn"
                onClick={() => void onSignInGoogle?.()}
                className="w-full min-h-[44px] rounded-xl bg-stone-900 dark:bg-[#E6C77E] text-white dark:text-stone-950 text-xs font-bold cursor-pointer"
              >
                Sign In with Google (Firebase Cloud Sync)
              </button>
            )}
          </section>

          {/* Background Check Verification Status + Admin Update Control */}
          <section className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#B48A3E] dark:text-[#D4AF63]" />
                  <span>Background Check Verification</span>
                </p>
                <h2
                  className={`font-display text-2xl font-bold mt-1 ${statusTextColor(
                    profile.backgroundCheck.status
                  )}`}
                >
                  {profile.backgroundCheck.status}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAdminStatus(profile.backgroundCheck.status);
                  setAdminReviewer(profile.backgroundCheck.reviewedBy);
                  setAdminNotes(profile.backgroundCheck.notes);
                  setAdminMode((prev) => !prev);
                }}
                data-testid="toggle-admin-verify-btn"
                className="min-h-[44px] px-3.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-1.5 shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{adminMode ? 'Close Admin' : 'Admin Update'}</span>
              </button>
            </div>

            <div className="text-xs text-stone-600 dark:text-stone-300 space-y-1">
              <p>
                <strong className="text-stone-800 dark:text-stone-100">Reviewed By:</strong>{' '}
                {profile.backgroundCheck.reviewedBy}
              </p>
              <p className="font-mono-tabular">
                <strong className="font-sans text-stone-800 dark:text-stone-100">
                  Last Verified:
                </strong>{' '}
                {profile.backgroundCheck.lastUpdated}
              </p>
              <p className="pt-1 leading-relaxed">{profile.backgroundCheck.notes}</p>
            </div>

            {adminMode && (
              <form
                onSubmit={handleAdminUpdateBackgroundCheck}
                className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-3"
              >
                <p className="text-xs font-semibold text-[#9A722A] dark:text-[#D4AF63]">
                  Administrator Verification Controls
                </p>

                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Verification Status
                  </label>
                  <select
                    value={adminStatus}
                    onChange={(e) => setAdminStatus(e.target.value as BackgroundCheckStatus)}
                    aria-label="Administrator background check status"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white"
                  >
                    {BG_STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Administrator ID / Name
                  </label>
                  <input
                    type="text"
                    value={adminReviewer}
                    onChange={(e) => setAdminReviewer(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Compliance Notes
                  </label>
                  <textarea
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full p-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0B0C0E] text-sm text-stone-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  data-testid="submit-admin-status-btn"
                  className="w-full min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  Apply Administrator Status Update
                </button>
              </form>
            )}
          </section>

          {/* Karnataka Dispatch Preferences: 31 Districts, Tier & Emergency Hospital Priority */}
          <section className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-sm space-y-3.5">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#B48A3E] dark:text-[#D4AF63]" />
              <span>Karnataka Dispatch & Priority Settings</span>
            </h3>

            <div>
              <label
                htmlFor="profile-district-select"
                className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
              >
                Primary Karnataka District (31 Districts)
              </label>
              <select
                id="profile-district-select"
                value={preferences.selectedDistrictId}
                onChange={(e) => onUpdatePreferences({ selectedDistrictId: e.target.value })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#080A0F] text-sm text-stone-900 dark:text-white"
              >
                {KARNATAKA_31_DISTRICTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.headquarters}) · {d.highwayCode}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-tier-select"
                className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
              >
                Default Vehicle Service Tier (₹19/km · ₹3/km Maint.)
              </label>
              <select
                id="profile-tier-select"
                value={preferences.selectedVehicleTier}
                onChange={(e) =>
                  onUpdatePreferences({
                    selectedVehicleTier: e.target.value as DriverPreferences['selectedVehicleTier'],
                  })
                }
                className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-[#080A0F] text-sm text-stone-900 dark:text-white"
              >
                {VEHICLE_TIER_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} — {t.subtitle}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() =>
                onUpdatePreferences({
                  emergencyHospitalFirst: !preferences.emergencyHospitalFirst,
                })
              }
              aria-pressed={preferences.emergencyHospitalFirst}
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-2 text-xs font-semibold transition-colors ${
                preferences.emergencyHospitalFirst
                  ? 'bg-rose-600/15 border-rose-500/40 text-rose-800 dark:text-rose-200'
                  : 'bg-stone-50 dark:bg-[#080A0F] border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Emergency Hospital Visit = #1 Priority</span>
              </span>
              <span className="font-mono-tabular">
                {preferences.emergencyHospitalFirst ? 'ACTIVE' : 'OFF'}
              </span>
            </button>
          </section>

          {/* Active Vehicle Safety Readiness */}
          <section className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Vehicle Care Dispatch Readiness</span>
            </h3>
            <div className="space-y-2">
              {[
                { key: 'wheelchairRamp' as const, label: 'Electro-Hydraulic Side Ramp Operational' },
                { key: 'oxygenSupport' as const, label: 'Oxygen Cylinder Cradle Mounted' },
                { key: 'cprFirstAid' as const, label: 'First-Aid & Cardiac Kit Restocked' },
                { key: 'sensoryCalmCabin' as const, label: 'Acoustic-Calm Sensory Cabin Ready' },
              ].map((cert) => (
                <label
                  key={cert.key}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/5 cursor-pointer min-h-[44px]"
                >
                  <span className="text-xs font-medium text-stone-800 dark:text-stone-200">
                    {cert.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences.certifications[cert.key]}
                    onChange={() => toggleCertification(cert.key)}
                    className="w-5 h-5 accent-emerald-600 rounded shrink-0"
                  />
                </label>
              ))}
            </div>
          </section>

          {/* Easy-Access Ergonomic Controls */}
          <section className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-sm space-y-4">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">
                Easy-Access Cockpit Controls
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5">
                Obsidian night theme, enlarged typography, voice readout, and motion comfort.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdatePreferences({ darkMode: !preferences.darkMode })}
                aria-pressed={preferences.darkMode}
                data-testid="toggle-dark-mode-btn"
                className={`p-3.5 rounded-xl border text-left transition-colors min-h-[88px] flex flex-col justify-between ${
                  preferences.darkMode
                    ? 'bg-[#0B0C0E] border-[#D4AF63] text-white'
                    : 'bg-[#FAF8F4] border-stone-200 text-stone-900 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  {preferences.darkMode ? (
                    <Moon className="w-4 h-4 text-[#D4AF63]" />
                  ) : (
                    <Sun className="w-4 h-4 text-[#B48A3E]" />
                  )}
                  <span className="text-[11px] font-semibold font-mono-tabular">
                    {preferences.darkMode ? 'OBSIDIAN' : 'ALABASTER'}
                  </span>
                </div>
                <p className="text-xs font-bold">Luxury Cockpit Theme</p>
              </button>

              <button
                type="button"
                onClick={() => onUpdatePreferences({ largeAssist: !preferences.largeAssist })}
                aria-pressed={preferences.largeAssist}
                data-testid="toggle-large-assist-btn"
                className={`p-3.5 rounded-xl border text-left transition-colors min-h-[88px] flex flex-col justify-between ${
                  preferences.largeAssist
                    ? 'bg-emerald-700 border-emerald-600 text-white'
                    : 'bg-[#FAF8F4] dark:bg-[#0B0C0E] border-stone-200 dark:border-stone-800 text-stone-900 dark:text-white hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Accessibility className="w-4 h-4" />
                  <span className="text-[11px] font-semibold font-mono-tabular">
                    {preferences.largeAssist ? 'LARGE' : 'STD'}
                  </span>
                </div>
                <p className="text-xs font-bold">Large Assist Scale</p>
              </button>

              <button
                type="button"
                onClick={() => onUpdatePreferences({ voiceReadout: !preferences.voiceReadout })}
                aria-pressed={preferences.voiceReadout}
                className={`p-3.5 rounded-xl border text-left transition-colors min-h-[88px] flex flex-col justify-between ${
                  preferences.voiceReadout
                    ? 'bg-[#B48A3E] dark:bg-[#D4AF63] border-[#B48A3E] text-white dark:text-stone-950'
                    : 'bg-[#FAF8F4] dark:bg-[#0B0C0E] border-stone-200 dark:border-stone-800 text-stone-900 dark:text-white hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Volume2 className="w-4 h-4" />
                  <span className="text-[11px] font-semibold font-mono-tabular">
                    {preferences.voiceReadout ? 'SPOKEN' : 'MUTED'}
                  </span>
                </div>
                <p className="text-xs font-bold">Voice Dispatch</p>
              </button>

              <button
                type="button"
                onClick={() => onUpdatePreferences({ reducedMotion: !preferences.reducedMotion })}
                aria-pressed={preferences.reducedMotion}
                className={`p-3.5 rounded-xl border text-left transition-colors min-h-[88px] flex flex-col justify-between ${
                  preferences.reducedMotion
                    ? 'bg-emerald-700 border-emerald-600 text-white'
                    : 'bg-[#FAF8F4] dark:bg-[#0B0C0E] border-stone-200 dark:border-stone-800 text-stone-900 dark:text-white hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Eye className="w-4 h-4" />
                  <span className="text-[11px] font-semibold font-mono-tabular">
                    {preferences.reducedMotion ? 'REDUCED' : 'DEFAULT'}
                  </span>
                </div>
                <p className="text-xs font-bold">Reduced Motion</p>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF8F4] dark:bg-[#0B0C0E] border border-stone-200 dark:border-stone-800 flex items-start gap-2.5 text-xs text-stone-600 dark:text-stone-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <span>44px+ minimum touch targets and WCAG AA contrast enforced across all views.</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
