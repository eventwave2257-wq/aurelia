import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Clock,
  Download,
  FileText,
  HeartHandshake,
  Star,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type {
  CareAppointment,
  CompletedTrip,
  DriverPayoutRecord,
  DriverPerformanceStats,
  EarningsFocus,
  EarningsPeriod,
  PassengerMultiPointRating,
} from '../types/aurelia';
import {
  calculateAcceptanceRate,
  calculatePayoutLedgerTotals,
  calculateTripFinancials,
  computeFlatRideTransferSummary,
  computePassengerRatingAverage,
  computeSeparateEarningsAnalysis,
  computeTaxReportTotals,
  filterTripsByPeriod,
  formatCurrency,
  formatDuration,
  getVehicleTierLabel,
  isCareCategory,
  tripsToPdfBytes,
  tripsToTaxCsv,
  validateUpiId,
} from '../utils/aureliaLogic';
import { PassengerRatingModal } from './PassengerRatingModal';
import { AiFeedbackAnalysisCard } from './AiFeedbackAnalysisCard';
import { ProjectedEarningsCard } from './ProjectedEarningsCard';
import { QrCodePreview } from './QrCodePreview';

interface EarningsAnalyticsViewProps {
  trips: CompletedTrip[];
  openAppointments: CareAppointment[];
  performanceStats: DriverPerformanceStats;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverUpiId?: string;
  driverQrPayload?: string;
  driverQrDataUrl?: string;
  payouts?: DriverPayoutRecord[];
  onRecordPayout?: (payout: DriverPayoutRecord) => Promise<void>;
  onSavePassengerRating: (tripId: string, rating: PassengerMultiPointRating) => void;
}

export function EarningsAnalyticsView({
  trips,
  openAppointments,
  performanceStats,
  driverId = 'drv-vikram-01',
  driverName = 'Vikramaditya Rao',
  driverPhone = '+91 98450 72190',
  driverUpiId = 'vikram.rao@okicici',
  driverQrPayload,
  driverQrDataUrl,
  payouts = [],
  onRecordPayout,
  onSavePassengerRating,
}: EarningsAnalyticsViewProps) {
  const [period, setPeriod] = useState<EarningsPeriod>('week');
  const [focus, setFocus] = useState<EarningsFocus>('compare');
  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null);
  const [cashoutOpen, setCashoutOpen] = useState<boolean>(false);
  const [cashoutSuccess, setCashoutSuccess] = useState<boolean>(false);
  const [upiInput, setUpiInput] = useState<string>(driverUpiId);
  const [upiError, setUpiError] = useState<string | null>(null);
  const [lastUtr, setLastUtr] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [ratingTripId, setRatingTripId] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const ledgerTotals = useMemo(() => calculatePayoutLedgerTotals(payouts), [payouts]);

  const summary = useMemo(
    () =>
      computeSeparateEarningsAnalysis(
        trips,
        period,
        '2026-11-14T23:59:59Z',
        openAppointments
      ),
    [trips, period, openAppointments]
  );

  const acceptanceRate = useMemo(
    () => calculateAcceptanceRate(performanceStats),
    [performanceStats]
  );

  const bestPeakWindow = useMemo(() => {
    return summary.peakWindows.reduce(
      (best, win) =>
        win.standardNet + win.careNet > best.standardNet + best.careNet ? win : best,
      summary.peakWindows[0]
    );
  }, [summary.peakWindows]);

  const ledgerTrips = useMemo(() => {
    const scoped = filterTripsByPeriod(trips, period).sort((a, b) =>
      b.completedAt.localeCompare(a.completedAt)
    );
    if (focus === 'standard') return scoped.filter((t) => !isCareCategory(t.category));
    if (focus === 'care') return scoped.filter((t) => isCareCategory(t.category));
    return scoped;
  }, [trips, period, focus]);

  const flatTransferSummary = useMemo(
    () =>
      computeFlatRideTransferSummary(
        ledgerTrips,
        `${driverUpiId} · ${driverPhone}`,
        payouts
      ),
    [ledgerTrips, driverUpiId, driverPhone, payouts]
  );

  const maxDailyTotal = useMemo(() => {
    const maxVal = summary.dailyComparison.reduce(
      (acc, pt) => Math.max(acc, pt.standardNet, pt.careNet),
      500
    );
    return Math.ceil(maxVal / 500) * 500;
  }, [summary.dailyComparison]);

  const maxPeakWindowTotal = useMemo(() => {
    const maxVal = summary.peakWindows.reduce(
      (acc, w) => Math.max(acc, w.standardNet + w.careNet),
      500
    );
    return Math.ceil(maxVal / 500) * 500;
  }, [summary.peakWindows]);

  const activePoint =
    summary.dailyComparison.find((d) => d.dateKey === hoveredDayKey) ??
    summary.dailyComparison[summary.dailyComparison.length - 1] ??
    null;

  const periodLabel =
    period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month';
  const channelLabel =
    focus === 'standard'
      ? 'Executive Only'
      : focus === 'care'
        ? 'Special Care'
        : 'All Trips';

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const csv = tripsToTaxCsv(ledgerTrips, { periodLabel, channelLabel });
    const totals = computeTaxReportTotals(ledgerTrips);
    const filename = `aurelia-tax-trip-history-${period}.csv`;
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, filename);
    setExportNotice(
      `Exported CSV (${filename}) · ${totals.tripCount} trips · Net Taxable ${formatCurrency(
        totals.netTaxableIncome
      )} · Deductible Fees ${formatCurrency(totals.deductibleFees)}.`
    );
  };

  const handleDownloadPdf = () => {
    const pdfBytes = tripsToPdfBytes(ledgerTrips, {
      periodLabel,
      channelLabel,
      generatedAt: '2026-11-14',
    });
    const totals = computeTaxReportTotals(ledgerTrips);
    const filename = `aurelia-tax-statement-${period}.pdf`;
    const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(pdfBuffer).set(pdfBytes);
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    triggerDownload(blob, filename);
    setExportNotice(
      `Exported PDF (${filename}) · ${totals.tripCount} trips · Net Taxable ${formatCurrency(
        totals.netTaxableIncome
      )} · Deductible Fees ${formatCurrency(totals.deductibleFees)}.`
    );
  };

  return (
    <div className="space-y-5">
      {/* Header & Period Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9A722A] dark:text-[#D4AF63]">
            Karnataka Telemetry · ₹19/km Standard (₹3/km Maintenance & Service)
          </p>
          <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-50 mt-0.5">
            Driver Analytics & Earnings Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-2xl bg-stone-100/80 dark:bg-[#080A0F]/80 border border-stone-200/80 dark:border-white/10">
            {(['today', 'week', 'month'] as EarningsPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  period === p
                    ? 'bg-white dark:bg-[#D4AF63] text-stone-900 dark:text-stone-950 shadow-sm'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>

          <button
            type="button"
            data-testid="export-csv-btn"
            onClick={handleDownloadCsv}
            className="min-h-[44px] px-3.5 py-2 rounded-2xl border border-stone-200/80 dark:border-white/15 text-xs font-semibold text-stone-800 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-white/5 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            data-testid="export-pdf-btn"
            onClick={handleDownloadPdf}
            className="min-h-[44px] px-3.5 py-2 rounded-2xl border border-amber-300 dark:border-[#D4AF63]/50 bg-amber-50/70 dark:bg-amber-400/10 text-xs font-semibold text-[#8A621E] dark:text-[#E6C77E] hover:bg-amber-100/70 dark:hover:bg-amber-400/20 flex items-center gap-1.5 whitespace-nowrap"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCashoutSuccess(false);
              setCashoutOpen(true);
            }}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shadow-sm"
          >
            <Wallet className="w-4 h-4" />
            <span>Instant Cashout</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div
          role="status"
          data-testid="export-confirmation-banner"
          className="px-4 py-3 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/60 text-xs font-medium text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3"
        >
          <span>{exportNotice}</span>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-emerald-800 dark:text-emerald-300 font-semibold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4-Column Driver Performance Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-1">
          <p className="text-xs text-stone-500 dark:text-stone-400">Real-Time Net</p>
          <p className="text-2xl font-bold text-stone-900 dark:text-stone-50 font-mono-tabular">
            {formatCurrency(summary.combined.netEarnings)}
          </p>
          <p className="text-xs text-stone-600 dark:text-stone-400 font-mono-tabular">
            {summary.combined.tripCount} trips · {formatDuration(summary.combined.activeMinutes)}
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-1">
          <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#D4AF63]" />
            <span>Passenger Rating</span>
          </p>
          <p className="text-2xl font-bold text-stone-900 dark:text-stone-50 font-mono-tabular">
            {performanceStats.averageRating.toFixed(2)}★
          </p>
          <p className="text-xs text-stone-600 dark:text-stone-400 font-mono-tabular">
            {performanceStats.ratingCount} verified reviews
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-1">
          <p className="text-xs text-stone-500 dark:text-stone-400">Acceptance Rate</p>
          <p
            data-testid="acceptance-rate-value"
            className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono-tabular"
          >
            {acceptanceRate}%
          </p>
          <p className="text-xs text-stone-600 dark:text-stone-400 font-mono-tabular">
            {performanceStats.acceptedCount} accepted · {performanceStats.declinedCount} declined
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-1">
          <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Top Earning Window</span>
          </p>
          <p className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-50 truncate">
            {bestPeakWindow.label}
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-mono-tabular">
            {bestPeakWindow.timeRange} ·{' '}
            {formatCurrency(bestPeakWindow.standardNet + bestPeakWindow.careNet)}
          </p>
        </div>
      </div>

      {/* Projected Earnings Predictive Card */}
      <ProjectedEarningsCard trips={trips} />

      {/* Flat ₹3 Per-Ride Deduction & Net Account Transfer Breakdown */}
      <section
        data-testid="flat-three-rupee-analytics"
        className="p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-amber-300/70 dark:border-[#D4AF63]/35 shadow-sm space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-200/70 dark:border-white/10 pb-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9A722A] dark:text-[#D4AF63]">
              Direct Account Settlement · Flat ₹3.00 Platform Fee Per Ride
            </p>
            <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-50">
              ₹3/Ride Deduction &amp; Rider Account Transfers
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-300 font-mono-tabular">
              Linked Account: <strong className="text-stone-900 dark:text-white">{driverUpiId}</strong> · Mobile {driverPhone}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto">
            <QrCodePreview
              payload={driverQrPayload || `upi://pay?pa=${driverUpiId}&cu=INR`}
              imageDataUrl={driverQrDataUrl}
              label={driverUpiId}
              size={64}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-tabular">
          <div className="p-3.5 rounded-2xl bg-[#FAF8F4] dark:bg-[#080A0F] border border-stone-200/80 dark:border-white/10">
            <p className="text-[11px] font-sans text-stone-500 dark:text-stone-400">Settled Rides</p>
            <p className="text-xl font-bold text-stone-900 dark:text-white mt-0.5">
              {flatTransferSummary.totalTrips}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#FAF8F4] dark:bg-[#080A0F] border border-stone-200/80 dark:border-white/10">
            <p className="text-[11px] font-sans text-stone-500 dark:text-stone-400">Gross Ride Collections</p>
            <p className="text-xl font-bold text-stone-900 dark:text-white mt-0.5">
              {formatCurrency(flatTransferSummary.totalGrossInr)}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-500/30">
            <p className="text-[11px] font-sans text-rose-700 dark:text-rose-300">Flat ₹3/Ride Deducted</p>
            <p
              data-testid="total-three-rupee-deducted"
              className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-0.5"
            >
              -{formatCurrency(flatTransferSummary.totalDeductedFeeInr)}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/35">
            <p className="text-[11px] font-sans text-emerald-800 dark:text-emerald-300">Transferred to Account</p>
            <p
              data-testid="total-net-transferred"
              className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5"
            >
              {formatCurrency(flatTransferSummary.totalTransferredNetInr)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-stone-200/80 dark:border-white/10 rounded-2xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-stone-100/80 dark:bg-[#080A0F] border-b border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-400">
                <th className="py-2.5 px-3 text-left font-semibold">Ride ID</th>
                <th className="py-2.5 px-3 text-left font-semibold">Passenger</th>
                <th className="py-2.5 px-3 text-right font-semibold">Gross</th>
                <th className="py-2.5 px-3 text-right font-semibold">Platform Cut</th>
                <th className="py-2.5 px-3 text-right font-semibold">Transferred Remainder</th>
                <th className="py-2.5 px-3 text-right font-semibold">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-white/5 font-mono-tabular">
              {flatTransferSummary.entries.slice(0, 6).map((entry) => (
                <tr key={entry.tripId}>
                  <td className="py-2 px-3 font-semibold text-stone-800 dark:text-stone-200">
                    {entry.tripId}
                  </td>
                  <td className="py-2 px-3 font-sans text-stone-700 dark:text-stone-300">
                    {entry.riderOrPatientName}
                  </td>
                  <td className="py-2 px-3 text-right text-stone-800 dark:text-stone-200">
                    {formatCurrency(entry.grossFareInr)}
                  </td>
                  <td className="py-2 px-3 text-right text-rose-600 dark:text-rose-400 font-semibold">
                    -{formatCurrency(entry.deductedFeeInr)}
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-400 font-bold">
                    {formatCurrency(entry.transferredNetInr)}
                  </td>
                  <td className="py-2 px-3 text-right uppercase text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    {entry.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Side-by-Side Channel Split: Executive Rides vs. Special Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section
          data-testid="standard-earnings-card"
          className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-amber-500/20 space-y-3"
        >
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-semibold text-[#9A722A] dark:text-[#D4AF63] flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              Executive & Tiered Rides
            </span>
            <span className="text-stone-500 dark:text-stone-400 font-mono-tabular">
              {summary.standard.tripCount} trips · {summary.standard.totalMiles} km · ₹3/km maint.
            </span>
          </div>
          <p className="text-3xl font-bold text-stone-900 dark:text-stone-50 font-mono-tabular">
            {formatCurrency(summary.standard.netEarnings)}
          </p>
          <div className="pt-2 border-t border-stone-200/70 dark:border-white/10 flex items-center justify-between text-xs font-mono-tabular text-stone-600 dark:text-stone-300">
            <span>Avg {formatCurrency(summary.standard.avgNetPerTrip)} / trip</span>
            <span>{formatCurrency(summary.standard.hourlyRate)} / hr</span>
          </div>
        </section>

        <section
          data-testid="care-earnings-card"
          className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-emerald-300/70 dark:border-emerald-500/35 space-y-3"
        >
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4" />
              Special Appointments (Disabled & Medical Care)
            </span>
            <span className="text-stone-500 dark:text-stone-400 font-mono-tabular">
              {summary.care.tripCount} trips · {summary.care.totalMiles} km · ₹3/km maint.
            </span>
          </div>
          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 font-mono-tabular">
            {formatCurrency(summary.care.netEarnings)}
          </p>
          <div className="pt-2 border-t border-stone-200/70 dark:border-white/10 flex items-center justify-between text-xs font-mono-tabular text-stone-600 dark:text-stone-300">
            <span>Avg {formatCurrency(summary.care.avgNetPerTrip)} / trip</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(summary.care.hourlyRate)} / hr
            </span>
          </div>
        </section>
      </div>

      {/* Dedicated Special Appointments Segment: Trends & Income Potential */}
      <section
        data-testid="special-appointments-analysis"
        className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-emerald-300/70 dark:border-emerald-500/35 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/70 dark:border-white/10 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
              Dedicated Segment Analysis · Special Appointments Specialists
            </p>
            <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-50">
              Special Appointments Trends & Income Potential
            </h2>
          </div>
          <p className="text-xs font-mono-tabular text-stone-600 dark:text-stone-300">
            Care Share:{' '}
            <strong className="text-emerald-700 dark:text-emerald-400">
              {summary.specialAnalysis.careSharePercent}%
            </strong>{' '}
            of net income
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-[#FAF8F4]/90 dark:bg-[#080A0F]/80 border border-stone-200/80 dark:border-white/10">
            <p className="text-xs text-stone-500 dark:text-stone-400">Hourly Rate Advantage</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono-tabular mt-1">
              {summary.specialAnalysis.hourlyAdvantage >= 0 ? '+' : ''}
              {formatCurrency(summary.specialAnalysis.hourlyAdvantage)}/hr
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
              vs. Executive Metro rides
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#FAF8F4]/90 dark:bg-[#080A0F]/80 border border-stone-200/80 dark:border-white/10">
            <p className="text-xs text-stone-500 dark:text-stone-400">Care Stipend Advantage</p>
            <p className="text-xl font-bold text-[#9A722A] dark:text-[#D4AF63] font-mono-tabular mt-1">
              +{formatCurrency(summary.specialAnalysis.commissionSaved)}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
              Zero commission on care stipends
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#FAF8F4]/90 dark:bg-[#080A0F]/80 border border-stone-200/80 dark:border-white/10">
            <p className="text-xs text-stone-500 dark:text-stone-400">Open Queue Value</p>
            <p className="text-xl font-bold text-stone-900 dark:text-stone-50 font-mono-tabular mt-1">
              {formatCurrency(summary.specialAnalysis.openQueuePotential)}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
              {openAppointments.filter((a) => !a.completed).length} scheduled Karnataka care slots
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#FAF8F4]/90 dark:bg-[#080A0F]/80 border border-stone-200/80 dark:border-white/10">
            <p className="text-xs text-stone-500 dark:text-stone-400">Weekly Income Potential</p>
            <p className="text-xl font-bold text-stone-900 dark:text-stone-50 font-mono-tabular mt-1">
              {formatCurrency(summary.specialAnalysis.projectedWeeklyPotential)}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
              At 14 specialized trips/week
            </p>
          </div>
        </div>

        {/* Breakdown by Disability / Medical Sub-category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {summary.specialAnalysis.categoryBreakdown.map((item) => (
            <div
              key={item.category}
              className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2"
            >
              <div>
                <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                  {item.label}
                </p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 font-mono-tabular">
                  {item.tripCount} trips · Avg {formatCurrency(item.avgPayout)}
                </p>
              </div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 font-mono-tabular">
                {formatCurrency(item.netEarnings)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* AI-Driven Feedback Analysis Card */}
      <AiFeedbackAnalysisCard trips={trips} />

      {/* Daily Trend Chart + Peak Earning Times */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Daily Comparison Chart */}
        <div className="lg:col-span-7 p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">
                Executive vs. Special Care Daily Trend
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Tap or hover a day column to inspect net INR payout
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#B48A3E] dark:bg-[#D4AF63] inline-block" />
                Executive
              </span>
              <span className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-500 inline-block" />
                Special Care
              </span>
            </div>
          </div>

          {summary.dailyComparison.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-stone-500 dark:text-stone-400">
              No completed trips in this period yet.
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="h-52 flex items-end justify-around gap-3 pt-4 pb-2 px-2 border-b border-stone-200 dark:border-stone-800"
                role="img"
                aria-label="Grouped bar chart comparing daily executive ride earnings and special appointment earnings"
              >
                {summary.dailyComparison.map((day) => {
                  const stdHeightPct = Math.max(4, Math.round((day.standardNet / maxDailyTotal) * 100));
                  const careHeightPct = Math.max(4, Math.round((day.careNet / maxDailyTotal) * 100));
                  const isActive = activePoint?.dateKey === day.dateKey;
                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onMouseEnter={() => setHoveredDayKey(day.dateKey)}
                      onFocus={() => setHoveredDayKey(day.dateKey)}
                      onClick={() => setHoveredDayKey(day.dateKey)}
                      className={`flex-1 max-w-[76px] h-full flex flex-col justify-end items-center gap-1.5 p-1 rounded-xl transition-colors ${
                        isActive ? 'bg-stone-50 dark:bg-stone-800/70' : ''
                      }`}
                    >
                      <div className="w-full flex-1 flex items-end justify-center gap-1.5">
                        <div
                          className="w-4 sm:w-5 rounded-t-md bg-[#B48A3E] dark:bg-[#D4AF63] transition-all"
                          style={{ height: `${day.standardNet > 0 ? stdHeightPct : 2}%` }}
                        />
                        <div
                          className="w-4 sm:w-5 rounded-t-md bg-emerald-600 dark:bg-emerald-500 transition-all"
                          style={{ height: `${day.careNet > 0 ? careHeightPct : 2}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                        {day.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activePoint && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular text-stone-700 dark:text-stone-300">
                  <span className="font-semibold text-stone-900 dark:text-stone-50">
                    {activePoint.label}
                  </span>
                  <span>
                    Executive:{' '}
                    <strong className="text-[#9A722A] dark:text-[#D4AF63]">
                      {formatCurrency(activePoint.standardNet)}
                    </strong>{' '}
                    ({activePoint.standardTrips})
                  </span>
                  <span>
                    Special Care:{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(activePoint.careNet)}
                    </strong>{' '}
                    ({activePoint.careTrips})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Peak Earning Times Breakdown */}
        <div className="lg:col-span-5 p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">
              Peak Earning Times
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Combined Karnataka executive surge & clinical appointment demand windows
            </p>
          </div>

          <div className="space-y-3">
            {summary.peakWindows.map((win) => {
              const total = win.standardNet + win.careNet;
              const stdPct = Math.round((win.standardNet / maxPeakWindowTotal) * 100);
              const carePct = Math.round((win.careNet / maxPeakWindowTotal) * 100);
              return (
                <div key={win.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      {win.label}{' '}
                      <span className="font-normal text-stone-500 dark:text-stone-400 font-mono-tabular">
                        ({win.timeRange})
                      </span>
                    </span>
                    <span className="font-mono-tabular font-bold text-stone-900 dark:text-stone-50">
                      {formatCurrency(total)}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden flex">
                    {win.careNet > 0 && (
                      <div
                        className="h-full bg-emerald-600 dark:bg-emerald-500"
                        style={{ width: `${carePct}%` }}
                        title={`Special Care: ${formatCurrency(win.careNet)}`}
                      />
                    )}
                    {win.standardNet > 0 && (
                      <div
                        className="h-full bg-[#B48A3E] dark:bg-[#D4AF63]"
                        style={{ width: `${stdPct}%` }}
                        title={`Executive: ${formatCurrency(win.standardNet)}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Profitability Table + Trip History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-3">
          <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">
            Channel Profitability & Maintenance Audit
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                  <th className="py-2 text-left font-medium">Line Item</th>
                  <th className="py-2 text-right font-medium text-[#9A722A] dark:text-[#D4AF63]">
                    Executive
                  </th>
                  <th className="py-2 text-right font-medium text-emerald-700 dark:text-emerald-400">
                    Special Care
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono-tabular">
                <tr>
                  <td className="py-2.5 text-stone-700 dark:text-stone-300 font-sans">
                    Distance Fares (₹19/km)
                  </td>
                  <td className="py-2.5 text-right text-stone-900 dark:text-stone-100">
                    {formatCurrency(summary.standard.grossFares)}
                  </td>
                  <td className="py-2.5 text-right text-stone-900 dark:text-stone-100">
                    {formatCurrency(summary.care.grossFares)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-stone-700 dark:text-stone-300 font-sans">Surge Bonuses</td>
                  <td className="py-2.5 text-right text-stone-900 dark:text-stone-100">
                    {formatCurrency(summary.standard.surgeBonuses)}
                  </td>
                  <td className="py-2.5 text-right text-stone-500 dark:text-stone-400">
                    {formatCurrency(summary.care.surgeBonuses)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-stone-700 dark:text-stone-300 font-sans">
                    Care & Wait Stipends
                  </td>
                  <td className="py-2.5 text-right text-stone-500 dark:text-stone-400">
                    {formatCurrency(summary.standard.careStipends)}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    +{formatCurrency(summary.care.careStipends)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-stone-700 dark:text-stone-300 font-sans">
                    Rider / Family Tips
                  </td>
                  <td className="py-2.5 text-right text-stone-900 dark:text-stone-100">
                    {formatCurrency(summary.standard.tips)}
                  </td>
                  <td className="py-2.5 text-right text-stone-900 dark:text-stone-100">
                    {formatCurrency(summary.care.tips)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-stone-700 dark:text-stone-300 font-sans">
                    Company Maint. (₹3/km)
                  </td>
                  <td className="py-2.5 text-right text-rose-600 dark:text-rose-400">
                    -{formatCurrency(summary.standard.platformFees)}
                  </td>
                  <td className="py-2.5 text-right text-rose-600 dark:text-rose-400">
                    -{formatCurrency(summary.care.platformFees)}
                  </td>
                </tr>
                <tr className="font-bold">
                  <td className="py-3 text-stone-900 dark:text-white font-sans">Net Driver Earnings</td>
                  <td className="py-3 text-right text-[#9A722A] dark:text-[#D4AF63]">
                    {formatCurrency(summary.standard.netEarnings)}
                  </td>
                  <td className="py-3 text-right text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(summary.care.netEarnings)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Completed Trip History Ledger */}
        <div className="lg:col-span-7 p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">
              Trip History ({ledgerTrips.length})
            </h2>

            <div className="flex items-center gap-1 p-1 rounded-2xl bg-stone-100/80 dark:bg-[#080A0F]/80 border border-stone-200/80 dark:border-white/10 self-start">
              {([
                { id: 'compare', label: 'All Trips' },
                { id: 'standard', label: 'Executive Only' },
                { id: 'care', label: 'Special Care' },
              ] as { id: EarningsFocus; label: string }[]).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFocus(tab.id)}
                  className={`min-h-[38px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    focus === tab.id
                      ? 'bg-white dark:bg-[#D4AF63] text-stone-900 dark:text-stone-950 shadow-sm'
                      : 'text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-[440px] overflow-y-auto pr-1">
            {ledgerTrips.map((trip) => {
              const fin = calculateTripFinancials(trip);
              const care = isCareCategory(trip.category);
              const rating = trip.driverPassengerRating;
              const composite = rating ? computePassengerRatingAverage(rating) : null;
              return (
                <div
                  key={trip.id}
                  data-testid={`trip-log-row-${trip.id}`}
                  className="py-3.5 flex flex-col gap-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`font-semibold ${
                            care
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-[#9A722A] dark:text-[#D4AF63]'
                          }`}
                        >
                          {trip.isEmergencyHospitalVisit
                            ? 'Emergency Hospital #1'
                            : care
                              ? 'Special Care'
                              : 'Executive'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-stone-700 dark:text-stone-300 font-medium">
                          {getVehicleTierLabel(trip.vehicleTier)} · {trip.serviceLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-stone-500 dark:text-stone-400 font-mono-tabular">
                          {trip.completedAt.slice(0, 10)} · {trip.durationMins}m · {trip.distanceMiles} km ·{' '}
                          {(trip.riderRatingGiven ?? 5.0).toFixed(1)}★
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-50">
                        {trip.riderOrPatientName} — {trip.routeSummary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-left sm:text-right font-mono-tabular">
                        <p className="text-base font-bold text-stone-900 dark:text-stone-50">
                          {formatCurrency(fin.netPayout)}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400">
                          {trip.pricingModel === 'per_km_19'
                            ? `₹19/km (${formatCurrency(trip.baseFare)}) · Maint -${formatCurrency(fin.platformFee)}${care && trip.careStipend > 0 ? ` + Care ${formatCurrency(trip.careStipend)}` : ''}${trip.tip > 0 ? ` + Tip ${formatCurrency(trip.tip)}` : ''}`
                            : care
                              ? `Base ${formatCurrency(trip.baseFare)} + Stipend ${formatCurrency(trip.careStipend)}${trip.tip > 0 ? ` + Tip ${formatCurrency(trip.tip)}` : ''}`
                              : `Base ${formatCurrency(trip.baseFare)} - Fee ${formatCurrency(fin.platformFee)}${trip.tip > 0 ? ` + Tip ${formatCurrency(trip.tip)}` : ''}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setRatingTripId(trip.id)}
                        data-testid={`rate-trip-btn-${trip.id}`}
                        className="min-h-[40px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 whitespace-nowrap"
                      >
                        {rating ? (care ? 'Edit Rating & Note' : 'Edit Rating') : care ? 'Rate & Care Note' : 'Rate Rider'}
                      </button>
                    </div>
                  </div>

                  {rating && (
                    <div className="text-xs text-stone-600 dark:text-stone-300 space-y-1 pl-0.5">
                      <p className="font-mono-tabular">
                        <span className="font-sans font-semibold text-[#9A722A] dark:text-[#E6C77E]">
                          Passenger Rated {composite?.toFixed(1)}★
                        </span>{' '}
                        · Curb {rating.curbReadiness}/5 · Comm {rating.communication}/5 ·{' '}
                        {care ? `Equip ${rating.equipmentReadiness}/5` : `Boarding ${rating.equipmentReadiness}/5`}
                      </p>
                      {care && rating.privateCareNotes && (
                        <p className="text-emerald-900 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-lg px-2.5 py-1.5">
                          <span className="font-semibold">Private Care Note:</span>{' '}
                          {rating.privateCareNotes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* UPI Payout Reconciliation Ledger */}
      {payouts.length > 0 && (
        <section
          data-testid="driver-upi-payout-ledger"
          className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">
                UPI Driver Payout &amp; Settlement Reconciliation Ledger
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-mono-tabular">
                Settled: {formatCurrency(ledgerTotals.reconciledTotal)} ({ledgerTotals.reconciledCount}) · Pending: {formatCurrency(ledgerTotals.pendingTotal)} ({ledgerTotals.pendingCount})
              </p>
            </div>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
            {payouts.map((p) => (
              <div key={p.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 font-mono-tabular">
                <div>
                  <span className="font-semibold text-stone-900 dark:text-white">{p.upiId}</span>
                  <span className="text-stone-500 dark:text-stone-400"> · {p.utrReference}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-stone-900 dark:text-white">
                    {formatCurrency(p.netPayoutInr)}
                  </span>
                  <span
                    className={
                      p.status === 'reconciled'
                        ? 'text-emerald-700 dark:text-emerald-400 font-bold uppercase'
                        : 'text-amber-700 dark:text-[#E6C77E] font-bold uppercase'
                    }
                  >
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Multi-Point Passenger Rating Modal */}
      {ratingTripId && (() => {
        const target = trips.find((t) => t.id === ratingTripId);
        if (!target) return null;
        return (
          <PassengerRatingModal
            trip={target}
            onClose={() => setRatingTripId(null)}
            onSave={(id, rating) => {
              onSavePassengerRating(id, rating);
              setRatingTripId(null);
            }}
          />
        );
      })()}

      {/* Secure UPI Payout & Reconciliation Modal */}
      {cashoutOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Secure UPI Payout Confirmation"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-white/95 dark:bg-[#101218]/95 backdrop-blur-2xl border border-stone-200/80 dark:border-white/15 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-50">
                Secure UPI Payout &amp; Reconciliation
              </h3>
              <button
                type="button"
                onClick={() => setCashoutOpen(false)}
                aria-label="Close payout dialog"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500"
              >
                ×
              </button>
            </div>

            {cashoutSuccess ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-900 dark:text-emerald-200 space-y-1.5">
                  <p className="font-semibold">UPI Payout Reconciled &amp; Logged</p>
                  <p className="text-xs font-mono-tabular">
                    Settled {formatCurrency(summary.combined.netEarnings)} to <strong>{upiInput}</strong>
                  </p>
                  {lastUtr && (
                    <p className="text-xs font-mono-tabular font-bold">
                      UTR Reference: {lastUtr}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="close-upi-settlement-done-btn"
                  onClick={() => setCashoutOpen(false)}
                  className="w-full min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white text-sm font-semibold cursor-pointer"
                >
                  Done &amp; View UTR Ledger
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Verified Driver UPI Handle
                  </label>
                  <input
                    type="text"
                    value={upiInput}
                    onChange={(e) => {
                      setUpiInput(e.target.value);
                      if (upiError) setUpiError(null);
                    }}
                    placeholder="driver@okicici"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-stone-700 text-xs font-mono-tabular text-stone-900 dark:text-white"
                  />
                  {upiError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{upiError}</p>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF8F4]/90 dark:bg-[#080A0F]/85 border border-stone-200 dark:border-white/10 space-y-2 text-xs font-mono-tabular">
                  <div className="flex justify-between">
                    <span className="font-sans text-stone-600 dark:text-stone-300">
                      Executive Net Balance
                    </span>
                    <span className="text-stone-900 dark:text-white">
                      {formatCurrency(summary.standard.netEarnings)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-stone-600 dark:text-stone-300">
                      Special Appointments Net Balance
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(summary.care.netEarnings)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-stone-200 dark:border-white/10 flex justify-between text-sm font-bold text-stone-900 dark:text-white">
                    <span className="font-sans">Total Settlement</span>
                    <span>{formatCurrency(summary.combined.netEarnings)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSettling}
                  data-testid="confirm-upi-settlement-btn"
                  onClick={async () => {
                    const check = validateUpiId(upiInput);
                    if (!check.valid) {
                      setUpiError(check.error || 'Invalid UPI ID');
                      return;
                    }
                    setIsSettling(true);
                    setUpiError(null);
                    try {
                      const res = await fetch('/api/payouts/reconcile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          driverId,
                          upiId: upiInput.trim(),
                          netPayoutInr: Math.max(1, summary.combined.netEarnings),
                          grossCollectedInr:
                            summary.combined.grossFares + summary.combined.careStipends,
                          companyFeeInr: summary.combined.platformFees,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok || !data.success) {
                        throw new Error(data.error || 'UPI reconciliation failed');
                      }
                      setLastUtr(data.utrReference);
                      await onRecordPayout?.({
                        id: `pay-${Date.now()}`,
                        driverId,
                        driverName,
                        upiId: data.upiId,
                        grossCollectedInr: data.grossCollectedInr,
                        companyFeeInr: data.companyFeeInr,
                        netPayoutInr: data.netPayoutInr,
                        utrReference: data.utrReference,
                        status: 'reconciled',
                        createdAt: data.reconciledAt,
                        updatedAt: data.reconciledAt,
                      });
                      setCashoutSuccess(true);
                    } catch (err) {
                      setUpiError(err instanceof Error ? err.message : 'Settlement error');
                    } finally {
                      setIsSettling(false);
                    }
                  }}
                  className="w-full min-h-[48px] rounded-xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isSettling ? 'Reconciling via UPI...' : 'Verify UPI & Settle Now'}</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
