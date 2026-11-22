#!/usr/bin/env bash
set -euo pipefail

echo "=== AURELIA Karnataka — Android APK Build Script ==="
echo "1. Building production web bundle (dist/) + Service Worker + Web App Manifest..."
npm run build

if command -v npx >/dev/null 2>&1 && command -v java >/dev/null 2>&1 && [ -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]; then
  echo "2. Java & Android SDK detected. Packaging Capacitor Android APK..."
  if [ ! -d "android" ]; then
    npx @capacitor/cli init "AURELIA Karnataka" "in.aureliamobility.karnataka" --web-dir=dist || true
    npm install --no-save @capacitor/core @capacitor/android @capacitor/cli
    npx cap add android
  fi
  npx cap sync android
  (cd android && ./gradlew assembleDebug)
  echo "APK generated at: android/app/build/outputs/apk/debug/app-debug.apk"
else
  echo ""
  echo "NOTE: Java JDK and Android SDK are required to compile a signed .apk binary."
  echo "Your full production bundle + PWA manifest are ready in ./dist/."
  echo ""
  echo "Option A — Instant Android PWA Install (No SDK needed):"
  echo "  Open the deployed app URL in Chrome on Android and tap 'Install App'."
  echo ""
  echo "Option B — Local Capacitor APK Build (with JDK 17 + Android Studio):"
  echo "  npm install -D @capacitor/core @capacitor/cli @capacitor/android"
  echo "  npm run build && npx cap add android && npx cap sync android"
  echo "  cd android && ./gradlew assembleDebug"
  echo ""
  echo "Option C — Trusted Web Activity (Bubblewrap TWA APK using twa-manifest.json):"
  echo "  npm i -g @bubblewrap/cli && bubblewrap update && bubblewrap build"
fi
