import { useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { verifyAdminPasscode } from '../utils/aureliaLogic';

interface AdminLockGateProps {
  onUnlock: () => void;
  onCancel: () => void;
}

export function AdminLockGate({ onUnlock, onCancel }: AdminLockGateProps) {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = passcode.trim();
    if (!trimmed) {
      setErrorMessage('Enter the 10-digit Admin access number to unlock.');
      return;
    }

    setVerifying(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/admin/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: trimmed }),
      });

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        unlocked?: boolean;
        error?: string;
      } | null;

      if (response.ok && data?.unlocked) {
        onUnlock();
        return;
      }

      if (response.status === 400 || response.status === 401 || response.status === 429) {
        setErrorMessage(data?.error || 'Incorrect access number. Access denied.');
        setPasscode('');
        return;
      }

      // Network or non-auth server error fallback via SHA-256 verification
      const ok = await verifyAdminPasscode(trimmed);
      if (ok) {
        onUnlock();
      } else {
        setErrorMessage('Incorrect access number. Access denied.');
        setPasscode('');
      }
    } catch {
      const ok = await verifyAdminPasscode(trimmed);
      if (ok) {
        onUnlock();
      } else {
        setErrorMessage('Incorrect access number. Access denied.');
        setPasscode('');
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <section
      data-testid="admin-lock-screen"
      aria-labelledby="admin-lock-heading"
      className="max-w-lg mx-auto my-8 p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-[#101218]/90 backdrop-blur-xl border border-stone-200 dark:border-amber-500/30 shadow-2xl space-y-6"
    >
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-[#9A722A] dark:text-[#E6C77E]">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9A722A] dark:text-[#E6C77E]">
            Restricted Operations Control
          </p>
          <h1
            id="admin-lock-heading"
            className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-50"
          >
            Admin Panel Locked
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-sm">
            Enter the authorized Admin access number to inspect fleet approvals, live rides, complaints, and UPI payouts.
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="admin-lock-passcode"
            className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#9A722A] dark:text-[#E6C77E]" />
            <span>Admin Access Number</span>
          </label>
          <div className="relative">
            <input
              id="admin-lock-passcode"
              data-testid="admin-password-input"
              type={showPasscode ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Enter authorized access number"
              className="w-full min-h-[48px] pl-4 pr-12 rounded-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-300 dark:border-white/15 text-stone-900 dark:text-stone-100 font-mono-tabular text-base tracking-wider placeholder:tracking-normal placeholder:text-xs sm:placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF63]"
            />
            <button
              type="button"
              onClick={() => setShowPasscode((prev) => !prev)}
              aria-label={showPasscode ? 'Hide access number' : 'Show access number'}
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white cursor-pointer"
            >
              {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            data-testid="admin-lock-error"
            className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="submit"
            disabled={verifying}
            data-testid="admin-unlock-btn"
            className="flex-1 min-h-[48px] px-5 rounded-2xl bg-stone-900 hover:bg-stone-800 dark:bg-[#E6C77E] dark:hover:bg-[#D4AF63] text-white dark:text-stone-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-60 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{verifying ? 'Verifying...' : 'Unlock Admin Panel'}</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-white/5 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Driver App</span>
          </button>
        </div>
      </form>
    </section>
  );
}
