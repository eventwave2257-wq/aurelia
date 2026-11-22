import { useState } from 'react';
import {
  ShieldCheck,
  FileCheck,
  Car,
  CheckCircle2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { LICENSE_DOC_PATH, VEHICLE_INSPECTION_PATH } from '../data/seedData';
import type { DriverProfileData } from '../types/aurelia';

interface DocumentVerificationViewProps {
  driverProfile: DriverProfileData;
  onUpdateDocuments?: (patch: Partial<DriverProfileData>) => void;
}

export function DocumentVerificationView({
  driverProfile,
  onUpdateDocuments,
}: DocumentVerificationViewProps) {
  const [auditStatus, setAuditStatus] = useState<'Verified & Cleared' | 'Pending Review' | 'Flagged'>(
    driverProfile.approvalStatus === 'pending' ? 'Pending Review' : 'Verified & Cleared'
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [licenseImgErr, setLicenseImgErr] = useState<boolean>(false);
  const [vehicleImgErr, setVehicleImgErr] = useState<boolean>(false);

  const handleUploadDoc = (
    file: File | undefined,
    kind: 'license' | 'vehicle'
  ) => {
    if (!file || !onUpdateDocuments) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      if (kind === 'license') {
        onUpdateDocuments({
          licenseDocName: file.name,
          licenseDocDataUrl: reader.result,
          approvalStatus: 'pending',
        });
        setLicenseImgErr(false);
        setNotice(`Uploaded ${file.name} for License Review.`);
      } else {
        onUpdateDocuments({
          vehicleDocName: file.name,
          vehicleDocDataUrl: reader.result,
          vehicleApprovalStatus: 'pending',
        });
        setVehicleImgErr(false);
        setNotice(`Uploaded ${file.name} for Vehicle RC Audit.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApproveAudit = () => {
    setAuditStatus('Verified & Cleared');
    onUpdateDocuments?.({
      approvalStatus: 'approved',
      vehicleApprovalStatus: 'approved',
    });
    setNotice('Company Audit Approved: All Karnataka transport credentials and vehicle photos validated.');
  };

  const handleFlagAudit = () => {
    setAuditStatus('Flagged');
    onUpdateDocuments?.({
      approvalStatus: 'rejected',
      vehicleApprovalStatus: 'rejected',
    });
    setNotice('Audit Flagged: Requesting updated vehicle insurance and license renewal copy from driver.');
  };

  const licenseSrc = driverProfile.licenseDocDataUrl || LICENSE_DOC_PATH;
  const vehicleSrc = driverProfile.vehicleDocDataUrl || VEHICLE_INSPECTION_PATH;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-[#D4AF63]">
            Karnataka Transport Authority · Company Audit Portal
          </p>
          <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-50 mt-0.5">
            Document &amp; Vehicle Verification Gallery
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Auditing driver license, background check, and uploaded vehicle imagery for{' '}
            {driverProfile.fullName} ({driverProfile.vehicle.licensePlate}).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold font-mono-tabular flex items-center gap-1.5 ${
              auditStatus === 'Verified & Cleared'
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{auditStatus}</span>
          </span>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-xs font-medium text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-amber-800 dark:text-amber-300 font-semibold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Driver License Card */}
        <div className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>Driver License Card</span>
            </h3>
            <span className="text-[11px] font-mono-tabular text-emerald-700 dark:text-emerald-400 uppercase font-bold">
              {driverProfile.approvalStatus ?? 'approved'}
            </span>
          </div>

          <div className="relative aspect-video rounded-2xl overflow-hidden bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-center group">
            {!licenseImgErr ? (
              <img
                src={licenseSrc}
                alt="Driver License Document"
                referrerPolicy="no-referrer"
                onError={() => setLicenseImgErr(true)}
                className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="text-xs text-stone-400 font-mono-tabular p-4 text-center">
                {driverProfile.licenseDocName ?? 'Karnataka Commercial License'}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end p-3">
              <p className="text-xs font-mono-tabular text-white font-medium">
                {driverProfile.licenseNumber ?? 'KA-01-2021004829'} · {driverProfile.fullName}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-stone-600 dark:text-stone-400 font-mono-tabular">
            <span>File: {driverProfile.licenseDocName ?? 'KA-DL-4829.jpg'}</span>
            {onUpdateDocuments && (
              <label className="text-[#9A722A] dark:text-[#E6C77E] font-semibold cursor-pointer flex items-center gap-1 hover:underline">
                <Upload className="w-3.5 h-3.5" />
                <span>Replace</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUploadDoc(e.target.files?.[0], 'license')}
                />
              </label>
            )}
          </div>
        </div>

        {/* Vehicle Inspection Card */}
        <div className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
              <Car className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>Vehicle Exterior &amp; RC</span>
            </h3>
            <span className="text-[11px] font-mono-tabular text-amber-700 dark:text-amber-400 uppercase font-bold">
              {driverProfile.vehicleApprovalStatus ?? 'approved'}
            </span>
          </div>

          <div className="relative aspect-video rounded-2xl overflow-hidden bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-center group">
            {!vehicleImgErr ? (
              <img
                src={vehicleSrc}
                alt="Vehicle Exterior Inspection"
                referrerPolicy="no-referrer"
                onError={() => setVehicleImgErr(true)}
                className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="text-xs text-stone-400 font-mono-tabular p-4 text-center">
                {driverProfile.vehicle.licensePlate} · {driverProfile.vehicle.model}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end p-3">
              <p className="text-xs font-mono-tabular text-white font-medium">
                Plate: {driverProfile.vehicle.licensePlate}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-stone-600 dark:text-stone-400 font-mono-tabular">
            <span>
              {driverProfile.vehicle.make} ({driverProfile.vehicle.year})
            </span>
            {onUpdateDocuments && (
              <label className="text-[#9A722A] dark:text-[#E6C77E] font-semibold cursor-pointer flex items-center gap-1 hover:underline">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload RC</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUploadDoc(e.target.files?.[0], 'vehicle')}
                />
              </label>
            )}
          </div>
        </div>

        {/* Background Check & Insurance Card */}
        <div className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Background &amp; Insurance</span>
            </h3>
            <span className="text-[11px] font-mono-tabular text-emerald-700 dark:text-emerald-400 font-bold">
              Cleared
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-stone-800 space-y-2 text-xs font-mono-tabular">
            <div className="flex justify-between">
              <span className="text-stone-500">Police Verification:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">CLEARED</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Commercial Insurance:</span>
              <span className="text-stone-900 dark:text-white">ICICI Lombard ₹15L Cover</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Medical Fitness:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">VALID</span>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleApproveAudit}
              className="flex-1 min-h-[40px] px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve Audit</span>
            </button>
            <button
              type="button"
              onClick={handleFlagAudit}
              className="min-h-[40px] px-3 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Flag</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
