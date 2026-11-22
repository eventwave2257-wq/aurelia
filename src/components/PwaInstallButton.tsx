import { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  Package,
  Smartphone,
  Terminal,
  X,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      data-testid="pwa-offline-indicator"
      className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      <span>Offline Mode — Cached Karnataka route data active</span>
    </div>
  );
}

const APK_BUILD_COMMANDS = `npm run build
npm install -D @capacitor/core @capacitor/cli @capacitor/android
npx cap add android && npx cap sync android
cd android && ./gradlew assembleDebug`;

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  const handleInstallOrOpenKit = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setModalOpen(true);
  };

  const handleCopyCommands = async () => {
    try {
      await navigator.clipboard.writeText(APK_BUILD_COMMANDS);
      setCopiedCmd(true);
      window.setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="pwa-install-apk-btn"
        onClick={() => void handleInstallOrOpenKit()}
        className="min-h-[40px] px-3 py-1.5 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-400/50 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/25 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        title="Install Android App (PWA) or View Android APK Packaging Kit"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden lg:inline">
          {isInstalled ? 'App Installed' : isInstallable ? 'Install App' : 'Android App / APK'}
        </span>
        <span className="lg:hidden">{isInstallable ? 'Install' : 'APK'}</span>
      </button>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Android App Installation and APK Packaging Kit"
          data-testid="android-apk-modal"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start sm:items-center justify-center p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg my-auto max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#101218] border border-stone-200 dark:border-amber-400/30 p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Android PWA &amp; Native APK Packaging</span>
                </p>
                <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-white mt-0.5">
                  AURELIA Mobile App Kit
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close Android App Kit"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Instant Android Chrome PWA Installation */}
            <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-700/50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Option 1: Instant Android Install (WebAPK / PWA)</span>
                </p>
                {isInstallable && (
                  <button
                    type="button"
                    onClick={() => void install()}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Install Now
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                {isIOS
                  ? 'On iPhone / iPad Safari: tap Share → Add to Home Screen for full standalone AURELIA mobile mode.'
                  : 'Open this app URL in Chrome on Android, tap the browser menu (⋮) → "Install app" / "Add to Home screen". Chrome installs AURELIA with offline service worker caching, full-screen standalone UI, and the latest updates.'}
              </p>
            </div>

            {/* Local Android Studio / Capacitor / Bubblewrap APK Build */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#B48A3E] dark:text-[#E6C77E]" />
                  <span>Option 2: Compile Signed Android .APK Binary</span>
                </p>
                <button
                  type="button"
                  onClick={() => void handleCopyCommands()}
                  className="px-2.5 py-1 rounded-lg bg-stone-200/80 dark:bg-white/10 text-[11px] font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedCmd ? 'Copied!' : 'Copy CLI'}</span>
                </button>
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
                This repo includes pre-configured <code className="font-mono-tabular">capacitor.config.ts</code>,{' '}
                <code className="font-mono-tabular">twa-manifest.json</code>, and{' '}
                <code className="font-mono-tabular">scripts/build-android-apk.sh</code> containing every developed feature (OTP, CCAvenue, Live GPS Tracking, &gt;20% Duration Alert, Arcade, Admin Gate). Run on any machine with JDK 17 + Android SDK:
              </p>
              <pre className="p-3 rounded-xl bg-[#0B0D12] text-emerald-300 text-[11px] font-mono-tabular overflow-x-auto leading-relaxed">
                <Terminal className="w-3 h-3 inline mr-1.5 text-[#E6C77E]" />
                {APK_BUILD_COMMANDS}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
