import { useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  FileCheck,
  Lock,
  MessageSquareWarning,
  Navigation,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import type {
  ApprovalStatus,
  DriverPayoutRecord,
  FleetApplicantRecord,
  LiveRideOrder,
  SupportComplaint,
} from '../types/aurelia';
import {
  calculatePayoutLedgerTotals,
  formatCurrency,
  formatPaymentMethodLabel,
  getVehicleTierLabel,
} from '../utils/aureliaLogic';

interface AdminPanelViewProps {
  isAuthenticatedAdmin: boolean;
  adminEmailHint: string;
  applicants: FleetApplicantRecord[];
  liveRides: LiveRideOrder[];
  payouts: DriverPayoutRecord[];
  complaints: SupportComplaint[];
  onApproveApplicant: (
    uid: string,
    driverStatus: ApprovalStatus,
    vehicleStatus: ApprovalStatus
  ) => Promise<void>;
  onUpdateRideStatus: (
    rideId: string,
    patch: Partial<Pick<LiveRideOrder, 'status' | 'driverName'>>
  ) => Promise<void>;
  onReconcilePayout: (payoutId: string, utrReference: string) => Promise<void>;
  onResolveComplaint: (
    complaintId: string,
    status: SupportComplaint['status'],
    note: string
  ) => Promise<void>;
  onLockAdmin?: () => void;
  onNotify: (msg: string) => void;
}

export function AdminPanelView({
  isAuthenticatedAdmin,
  adminEmailHint,
  applicants,
  liveRides,
  payouts,
  complaints,
  onApproveApplicant,
  onUpdateRideStatus,
  onReconcilePayout,
  onResolveComplaint,
  onLockAdmin,
  onNotify,
}: AdminPanelViewProps) {
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});
  const payoutTotals = calculatePayoutLedgerTotals(payouts);

  const handleSettlePayout = async (payout: DriverPayoutRecord) => {
    try {
      const res = await fetch('/api/payouts/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: payout.driverId,
          upiId: payout.upiId,
          netPayoutInr: payout.netPayoutInr,
          grossCollectedInr: payout.grossCollectedInr,
          companyFeeInr: payout.companyFeeInr,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'UPI reconciliation failed');
      }
      await onReconcilePayout(payout.id, data.utrReference);
      onNotify(
        `Reconciled ${formatCurrency(payout.netPayoutInr)} to ${payout.upiId} · UTR ${data.utrReference}`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Settlement error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Masthead */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9A722A] dark:text-[#E6C77E]">
            Aurelia Operations Control Center · Karnataka
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-50 mt-0.5">
            Admin Approval, Bookings, Complaints &amp; Payouts
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            {isAuthenticatedAdmin
              ? `Authenticated Admin (${adminEmailHint}) · Cloud Firestore writes active.`
              : `Local Operations Mode · Sign in with ${adminEmailHint} in Profile to sync admin changes across Cloud Firestore.`}
          </p>
          {onLockAdmin && (
            <button
              type="button"
              data-testid="lock-admin-btn"
              onClick={onLockAdmin}
              className="mt-2.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white/10 dark:hover:bg-white/20 text-white dark:text-stone-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-[#E6C77E]" />
              <span>Lock Admin Panel</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono-tabular shrink-0">
          <div className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10">
            <p className="text-[10px] text-stone-500">Pending Drivers</p>
            <p className="text-base font-bold text-amber-700 dark:text-[#E6C77E]">
              {applicants.filter((a) => a.approvalStatus === 'pending').length}
            </p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10">
            <p className="text-[10px] text-stone-500">Active Rides</p>
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">
              {liveRides.filter((r) => r.status !== 'completed' && r.status !== 'cancelled').length}
            </p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10">
            <p className="text-[10px] text-stone-500">Open Complaints</p>
            <p className="text-base font-bold text-rose-600 dark:text-rose-400">
              {complaints.filter((c) => c.status !== 'resolved').length}
            </p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10">
            <p className="text-[10px] text-stone-500">Pending UPI</p>
            <p className="text-base font-bold text-stone-900 dark:text-white">
              {formatCurrency(payoutTotals.pendingTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* 1. Driver & Vehicle Approval Queue */}
      <section className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#B48A3E] dark:text-[#D4AF63]" />
            <span>Driver &amp; Vehicle Approval Queue</span>
          </h2>
          <span className="text-xs font-mono-tabular text-stone-500 dark:text-stone-400">
            {applicants.length} fleet drivers
          </span>
        </div>

        <div className="divide-y divide-stone-100 dark:divide-white/5">
          {applicants.map((app) => (
            <div
              key={app.uid}
              data-testid={`admin-applicant-${app.uid}`}
              className="py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-sm text-stone-900 dark:text-white">
                    {app.fullName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-stone-600 dark:text-stone-300">
                    {app.phone}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-[#9A722A] dark:text-[#E6C77E]">
                    {app.vehicleMake} {app.vehicleModel} ({app.licensePlate})
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 font-mono-tabular">
                  DL: {app.licenseNumber} · Docs: {app.licenseDocName ?? 'Uploaded'} /{' '}
                  {app.vehicleDocName ?? 'RC Scan'} · Driver:{' '}
                  <strong className="uppercase">{app.approvalStatus}</strong> · Vehicle:{' '}
                  <strong className="uppercase">{app.vehicleApprovalStatus}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {app.approvalStatus === 'approved' && app.vehicleApprovalStatus === 'approved' ? (
                  <span className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified Active</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid={`approve-both-${app.uid}`}
                    onClick={async () => {
                      await onApproveApplicant(app.uid, 'approved', 'approved');
                      onNotify(`Approved driver ${app.fullName} & vehicle ${app.licensePlate}.`);
                    }}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Driver &amp; Vehicle</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await onApproveApplicant(app.uid, 'rejected', 'rejected');
                    onNotify(`Marked ${app.fullName} as Rejected / Resubmit Required.`);
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Live Bookings & UPI Payouts Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Live Bookings */}
        <section className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-3">
          <h2 className="font-display text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <Navigation className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Live Bookings Monitor ({liveRides.length})</span>
          </h2>

          <div className="divide-y divide-stone-100 dark:divide-white/5 max-h-[340px] overflow-y-auto pr-1">
            {liveRides.map((ride) => (
              <div key={ride.id} className="py-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900 dark:text-white">
                    {ride.customerName} · {getVehicleTierLabel(ride.vehicleTier)}
                  </span>
                  <span className="font-mono-tabular uppercase font-bold text-[#9A722A] dark:text-[#E6C77E]">
                    {ride.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-stone-600 dark:text-stone-300">
                  {ride.pickupLabel} → {ride.dropoffLabel} ({ride.distanceKm} km)
                </p>
                <div className="flex items-center justify-between font-mono-tabular text-[11px] text-stone-500 dark:text-stone-400">
                  <span>
                    {formatCurrency(ride.fareInr)} · {formatPaymentMethodLabel(ride.paymentMethod)} (
                    {ride.paymentStatus.toUpperCase()})
                    {ride.ccavenueTrackingId ? ` · ${ride.ccavenueTrackingId}` : ''}
                  </span>
                  {ride.status === 'searching' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onUpdateRideStatus(ride.id, {
                          status: 'matched',
                          driverName: 'Vikramaditya Rao',
                        });
                        onNotify(`Dispatched ride ${ride.id} to Vikramaditya Rao.`);
                      }}
                      className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                    >
                      Assign Driver
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* UPI Payout Reconciliation */}
        <section className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#B48A3E] dark:text-[#D4AF63]" />
              <span>Payments &amp; UPI Reconciliation</span>
            </h2>
            <span className="text-xs font-mono-tabular text-emerald-700 dark:text-emerald-400 font-bold">
              Settled {formatCurrency(payoutTotals.reconciledTotal)}
            </span>
          </div>

          <div className="divide-y divide-stone-100 dark:divide-white/5 max-h-[340px] overflow-y-auto pr-1">
            {payouts.map((p) => (
              <div
                key={p.id}
                data-testid={`admin-payout-${p.id}`}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <p className="font-bold text-stone-900 dark:text-white">
                    {p.driverName} · <span className="font-mono-tabular">{p.upiId}</span>
                  </p>
                  <p className="text-[11px] font-mono-tabular text-stone-500 dark:text-stone-400">
                    Net {formatCurrency(p.netPayoutInr)} (Fee {formatCurrency(p.companyFeeInr)}) ·{' '}
                    {p.utrReference}
                  </p>
                </div>

                {p.status === 'pending' ? (
                  <button
                    type="button"
                    data-testid={`reconcile-payout-btn-${p.id}`}
                    onClick={() => void handleSettlePayout(p)}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] text-white dark:text-stone-950 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Reconcile UPI
                  </button>
                ) : (
                  <span className="text-emerald-700 dark:text-emerald-400 font-mono-tabular font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>RECONCILED</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 3. Complaints Desk */}
      <section className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-3">
        <h2 className="font-display text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
          <MessageSquareWarning className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <span>Customer &amp; Driver Complaints Resolution ({complaints.length})</span>
        </h2>

        <div className="divide-y divide-stone-100 dark:divide-white/5">
          {complaints.map((cmp) => (
            <div key={cmp.id} className="py-3.5 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-sm text-stone-900 dark:text-white">
                  {cmp.subject}{' '}
                  <span className="text-[11px] font-mono-tabular text-stone-500">
                    ({cmp.reporterRole} · {cmp.rideId || 'General'})
                  </span>
                </p>
                <span
                  className={`font-mono-tabular uppercase font-bold ${
                    cmp.status === 'resolved'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {cmp.status}
                </span>
              </div>
              <p className="text-stone-600 dark:text-stone-300">{cmp.details}</p>

              {cmp.status !== 'resolved' ? (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Admin resolution note..."
                    value={resolutionDrafts[cmp.id] ?? cmp.resolutionNote ?? ''}
                    onChange={(e) =>
                      setResolutionDrafts((prev) => ({ ...prev, [cmp.id]: e.target.value }))
                    }
                    className="flex-1 min-h-[40px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const note =
                        resolutionDrafts[cmp.id]?.trim() ||
                        'Resolved by Aurelia Karnataka Operations Admin.';
                      await onResolveComplaint(cmp.id, 'resolved', note);
                      onNotify(`Complaint ${cmp.id} marked resolved.`);
                    }}
                    className="min-h-[40px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Mark Resolved</span>
                  </button>
                </div>
              ) : (
                cmp.resolutionNote && (
                  <p className="text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg">
                    Resolution: {cmp.resolutionNote}
                  </p>
                )
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
