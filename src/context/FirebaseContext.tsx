import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type ConfirmationResult, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  linkWithPhoneNumber,
  OperationType,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  testConnection,
} from '../firebase';
import {
  classifyFirebasePhoneAuthError,
  formatIndianE164Phone,
  isVerifiedFirebaseAuthUser,
  normalizeOtpInput,
} from '../utils/aureliaLogic';
import {
  INITIAL_COMPLAINTS,
  INITIAL_FLEET_APPLICANTS,
  INITIAL_LIVE_RIDES,
  INITIAL_PAYOUT_RECORDS,
} from '../data/seedData';
import type {
  ApprovalStatus,
  DriverPayoutRecord,
  DriverPreferences,
  DriverProfileData,
  FleetApplicantRecord,
  LiveRideOrder,
  LiveRideStatus,
  SupportComplaint,
} from '../types/aurelia';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  isAdminUser: boolean;
  isAuthVerified: boolean;
  verifiedPhoneNumber: string | null;
  connectionOk: boolean;
  lastError: string | null;
  liveRides: LiveRideOrder[];
  payouts: DriverPayoutRecord[];
  complaints: SupportComplaint[];
  fleetApplicants: FleetApplicantRecord[];
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  sendPhoneOtpViaFirebase: (
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
  verifyPhoneOtpViaFirebase: (
    confirmation: ConfirmationResult,
    otpCode: string
  ) => Promise<{
    ok: boolean;
    uid?: string;
    phoneNumber?: string | null;
    error?: string;
    errorCode?: string;
  }>;
  syncDriverAccountToFirestore: (
    profile: DriverProfileData,
    prefs: DriverPreferences
  ) => Promise<void>;
  createLiveRideOrder: (ride: LiveRideOrder) => Promise<LiveRideOrder>;
  updateLiveRideStatus: (
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
  recordDriverPayout: (payout: DriverPayoutRecord) => Promise<void>;
  reconcilePayoutAdmin: (payoutId: string, utrReference: string) => Promise<void>;
  submitSupportComplaint: (complaint: SupportComplaint) => Promise<void>;
  updateComplaintStatusAdmin: (
    complaintId: string,
    status: SupportComplaint['status'],
    resolutionNote: string
  ) => Promise<void>;
  updateApplicantApprovalAdmin: (
    uid: string,
    approvalStatus: ApprovalStatus,
    vehicleApprovalStatus: ApprovalStatus
  ) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

const PLATFORM_STORAGE_KEY = 'aurelia_platform_collections_v1';

function loadLocalCollections(): {
  liveRides: LiveRideOrder[];
  payouts: DriverPayoutRecord[];
  complaints: SupportComplaint[];
  fleetApplicants: FleetApplicantRecord[];
} {
  const defaults = {
    liveRides: INITIAL_LIVE_RIDES,
    payouts: INITIAL_PAYOUT_RECORDS,
    complaints: INITIAL_COMPLAINTS,
    fleetApplicants: INITIAL_FLEET_APPLICANTS,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(PLATFORM_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      liveRides: Array.isArray(parsed.liveRides) && parsed.liveRides.length > 0 ? parsed.liveRides : defaults.liveRides,
      payouts: Array.isArray(parsed.payouts) && parsed.payouts.length > 0 ? parsed.payouts : defaults.payouts,
      complaints: Array.isArray(parsed.complaints) && parsed.complaints.length > 0 ? parsed.complaints : defaults.complaints,
      fleetApplicants:
        Array.isArray(parsed.fleetApplicants) && parsed.fleetApplicants.length > 0
          ? parsed.fleetApplicants
          : defaults.fleetApplicants,
    };
  } catch {
    return defaults;
  }
}

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const initialLocal = useMemo(() => loadLocalCollections(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [connectionOk, setConnectionOk] = useState<boolean>(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const [liveRides, setLiveRides] = useState<LiveRideOrder[]>(initialLocal.liveRides);
  const [payouts, setPayouts] = useState<DriverPayoutRecord[]>(initialLocal.payouts);
  const [complaints, setComplaints] = useState<SupportComplaint[]>(initialLocal.complaints);
  const [fleetApplicants, setFleetApplicants] = useState<FleetApplicantRecord[]>(
    initialLocal.fleetApplicants
  );

  const isAuthVerified = isVerifiedFirebaseAuthUser(user);
  const verifiedPhoneNumber = user?.phoneNumber ?? null;
  const isAdminUser = Boolean(
    user?.email && user.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL
  );

  useEffect(() => {
    void testConnection().then((ok) => setConnectionOk(ok));
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PLATFORM_STORAGE_KEY,
        JSON.stringify({ liveRides, payouts, complaints, fleetApplicants })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [liveRides, payouts, complaints, fleetApplicants]);

  // Attach authenticated Firestore listeners cleanly when authReady && isAuthVerified
  useEffect(() => {
    if (!authReady || !user || !isAuthVerified) return;

    const ridesQuery = isAdminUser
      ? query(collection(db, 'rides'))
      : query(collection(db, 'rides'), where('status', '==', 'searching'));

    const unsubRides = onSnapshot(
      ridesQuery,
      (snap) => {
        if (snap.empty) return;
        const docs = snap.docs.map((d) => {
          const raw = d.data();
          return {
            ...(raw as LiveRideOrder),
            id: d.id,
            pickupLatLng: raw.pickupLatLng ?? { lat: 12.9716, lng: 77.5946 },
            dropoffLatLng: raw.dropoffLatLng ?? { lat: 12.9592, lng: 77.648 },
            driverLat: typeof raw.driverLat === 'number' ? raw.driverLat : 12.9716,
            driverLng: typeof raw.driverLng === 'number' ? raw.driverLng : 77.5946,
            createdAt:
              typeof raw.createdAt === 'string'
                ? raw.createdAt
                : new Date().toISOString(),
            updatedAt:
              typeof raw.updatedAt === 'string'
                ? raw.updatedAt
                : new Date().toISOString(),
          };
        });
        setLiveRides((prev) => {
          const map = new Map<string, LiveRideOrder>();
          for (const item of prev) map.set(item.id, item);
          for (const item of docs) map.set(item.id, item);
          return Array.from(map.values());
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'rides');
      }
    );

    const payoutsQuery = isAdminUser
      ? query(collection(db, 'payouts'))
      : query(collection(db, 'payouts'), where('driverId', '==', user.uid));

    const unsubPayouts = onSnapshot(
      payoutsQuery,
      (snap) => {
        if (snap.empty) return;
        const docs = snap.docs.map((d) => {
          const raw = d.data();
          return {
            ...(raw as DriverPayoutRecord),
            id: d.id,
            createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
            updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
          };
        });
        setPayouts((prev) => {
          const map = new Map<string, DriverPayoutRecord>();
          for (const item of prev) map.set(item.id, item);
          for (const item of docs) map.set(item.id, item);
          return Array.from(map.values());
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'payouts');
      }
    );

    const complaintsQuery = isAdminUser
      ? query(collection(db, 'complaints'))
      : query(collection(db, 'complaints'), where('reporterUid', '==', user.uid));

    const unsubComplaints = onSnapshot(
      complaintsQuery,
      (snap) => {
        if (snap.empty) return;
        const docs = snap.docs.map((d) => {
          const raw = d.data();
          return {
            ...(raw as SupportComplaint),
            id: d.id,
            createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
            updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
          };
        });
        setComplaints((prev) => {
          const map = new Map<string, SupportComplaint>();
          for (const item of prev) map.set(item.id, item);
          for (const item of docs) map.set(item.id, item);
          return Array.from(map.values());
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'complaints');
      }
    );

    return () => {
      unsubRides();
      unsubPayouts();
      unsubComplaints();
    };
  }, [authReady, user, isAuthVerified, isAdminUser]);

  const signInWithGoogle = useCallback(async () => {
    setLastError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setLastError(msg);
      throw err;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setLastError(null);
    await signOut(auth);
  }, []);

  const sendPhoneOtpViaFirebase = useCallback(
    async (phone10Digits: string, recaptchaContainerId: string) => {
      const e164Phone = formatIndianE164Phone(phone10Digits);
      if (!e164Phone) {
        return {
          ok: false,
          error: 'Enter a valid 10-digit +91 Indian mobile number.',
          errorCode: 'auth/invalid-phone-number',
          canFallbackToGateway: false,
          requiresConsoleSetup: false,
        };
      }

      const cleanupRecaptchaUi = () => {
        try {
          recaptchaVerifierRef.current?.clear();
        } catch {
          // ignore stale verifier cleanup errors
        }
        recaptchaVerifierRef.current = null;
        if (typeof document !== 'undefined') {
          const el = document.getElementById(recaptchaContainerId);
          if (el) el.innerHTML = '';
          // Remove orphaned Google reCAPTCHA challenge overlays appended directly to document.body
          document.querySelectorAll('body > div').forEach((div) => {
            if (
              div.querySelector('iframe[src*="recaptcha/api2/bframe"]') ||
              div.querySelector('iframe[src*="recaptcha/enterprise/bframe"]')
            ) {
              div.remove();
            }
          });
        }
      };

      cleanupRecaptchaUi();

      let verifier: RecaptchaVerifier | null = null;
      try {
        const container =
          typeof document !== 'undefined' ? document.getElementById(recaptchaContainerId) : null;
        if (!container) {
          return {
            ok: false,
            error: 'reCAPTCHA container unavailable in DOM.',
            errorCode: 'auth/captcha-check-failed',
            canFallbackToGateway: true,
            requiresConsoleSetup: false,
          };
        }

        verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
          size: 'invisible',
        });
        recaptchaVerifierRef.current = verifier;

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Firebase SMS reCAPTCHA timed out')), 6500);
        });

        const shouldLinkExistingAccount = Boolean(auth.currentUser && !auth.currentUser.phoneNumber);
        const authPromise = shouldLinkExistingAccount && auth.currentUser
          ? linkWithPhoneNumber(auth.currentUser, e164Phone, verifier)
          : signInWithPhoneNumber(auth, e164Phone, verifier);
        // Prevent late unhandled rejection if timeoutPromise settles first
        void authPromise.catch(() => {});

        const confirmation = await Promise.race([authPromise, timeoutPromise]);
        return { ok: true, confirmation };
      } catch (err) {
        try {
          verifier?.clear();
        } catch {
          // ignore reCAPTCHA clear errors
        }
        cleanupRecaptchaUi();
        const classified = classifyFirebasePhoneAuthError(err);
        return {
          ok: false,
          error: classified.message,
          errorCode: classified.code,
          canFallbackToGateway: classified.canFallbackToGateway,
          requiresConsoleSetup: classified.requiresConsoleSetup,
        };
      }
    },
    []
  );

  const verifyPhoneOtpViaFirebase = useCallback(
    async (confirmation: ConfirmationResult, otpCode: string) => {
      const cleanCode = normalizeOtpInput(otpCode);
      if (cleanCode.length < 4) {
        return {
          ok: false,
          error: 'Enter the 6-digit verification code sent by Firebase SMS.',
          errorCode: 'auth/invalid-verification-code',
        };
      }
      try {
        const cred = await confirmation.confirm(cleanCode);
        setUser(cred.user);
        setLastError(null);
        return {
          ok: true,
          uid: cred.user.uid,
          phoneNumber: cred.user.phoneNumber ?? null,
        };
      } catch (err) {
        const classified = classifyFirebasePhoneAuthError(err);
        return {
          ok: false,
          error: classified.message,
          errorCode: classified.code,
        };
      }
    },
    []
  );

  const syncDriverAccountToFirestore = useCallback(
    async (profile: DriverProfileData, prefs: DriverPreferences) => {
      const applicantEntry: FleetApplicantRecord = {
        uid: user?.uid ?? 'drv-vikram-01',
        fullName: profile.fullName,
        phone: profile.phone,
        cityRegion: profile.cityRegion,
        vehicleMake: profile.vehicle.make,
        vehicleModel: profile.vehicle.model,
        vehicleYear: profile.vehicle.year,
        licensePlate: profile.vehicle.licensePlate,
        vehicleTier: prefs.selectedVehicleTier,
        licenseNumber: profile.licenseNumber ?? 'KA-01-2021004829',
        upiId: profile.upiId ?? 'vikram.rao@okicici',
        approvalStatus: profile.approvalStatus ?? 'pending',
        vehicleApprovalStatus: profile.vehicleApprovalStatus ?? 'pending',
        licenseDocName: profile.licenseDocName,
        vehicleDocName: profile.vehicleDocName,
        updatedAt: new Date().toISOString(),
      };

      setFleetApplicants((prev) => {
        const idx = prev.findIndex((a) => a.uid === applicantEntry.uid);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = applicantEntry;
          return copy;
        }
        return [applicantEntry, ...prev];
      });

      if (!user || !isVerifiedFirebaseAuthUser(user)) return;

      const driverPath = `drivers/${user.uid}`;
      try {
        await setDoc(
          doc(db, 'drivers', user.uid),
          {
            uid: user.uid,
            fullName: profile.fullName.slice(0, 120),
            cityRegion: profile.cityRegion.slice(0, 160),
            yearsExperience: profile.yearsExperience,
            vehicleMake: profile.vehicle.make.slice(0, 60),
            vehicleModel: profile.vehicle.model.slice(0, 100),
            vehicleYear: profile.vehicle.year,
            vehicleTier: prefs.selectedVehicleTier,
            selectedDistrictId: prefs.selectedDistrictId,
            activeFareCondition: prefs.activeFareCondition ?? 'off_peak_corridor',
            approvalStatus: profile.approvalStatus ?? 'pending',
            vehicleApprovalStatus: profile.vehicleApprovalStatus ?? 'pending',
            backgroundCheckStatus: profile.backgroundCheck.status,
            upiId: (profile.upiId ?? 'vikram.rao@okicici').slice(0, 100),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        await setDoc(
          doc(db, 'drivers', user.uid, 'private', 'pii'),
          {
            uid: user.uid,
            email: profile.email.slice(0, 160),
            phone: profile.phone.slice(0, 30),
            licensePlate: profile.vehicle.licensePlate.slice(0, 40),
            licenseNumber: (profile.licenseNumber ?? 'KA-01-PENDING').slice(0, 60),
            licenseDocName: (profile.licenseDocName ?? 'license-upload.jpg').slice(0, 120),
            vehicleDocName: (profile.vehicleDocName ?? 'vehicle-rc.jpg').slice(0, 120),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, driverPath);
      }
    },
    [user]
  );

  const createLiveRideOrder = useCallback(
    async (ride: LiveRideOrder) => {
      const normalized: LiveRideOrder = {
        ...ride,
        customerId: user?.uid ?? ride.customerId,
      };
      setLiveRides((prev) => [normalized, ...prev]);

      if (user && isVerifiedFirebaseAuthUser(user)) {
        const path = `rides/${normalized.id}`;
        try {
          await setDoc(doc(db, 'rides', normalized.id), {
            id: normalized.id,
            customerId: user.uid,
            customerName: normalized.customerName.slice(0, 120),
            pickupLabel: normalized.pickupLabel.slice(0, 160),
            dropoffLabel: normalized.dropoffLabel.slice(0, 160),
            vehicleTier: normalized.vehicleTier,
            fareCondition: normalized.fareCondition,
            distanceKm: normalized.distanceKm,
            fareInr: normalized.fareInr,
            driverNetInr: normalized.driverNetInr,
            companyFeeInr: normalized.companyFeeInr,
            tipInr: normalized.tipInr ?? 0,
            paymentMethod: normalized.paymentMethod,
            paymentStatus: normalized.paymentStatus,
            ccavenueOrderId: normalized.ccavenueOrderId ?? '',
            ccavenueTrackingId: normalized.ccavenueTrackingId ?? '',
            ccavenueBankRefNo: normalized.ccavenueBankRefNo ?? '',
            driverLat: normalized.driverLat,
            driverLng: normalized.driverLng,
            status: 'searching' as LiveRideStatus,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
      return normalized;
    },
    [user]
  );

  const updateLiveRideStatus = useCallback(
    async (
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
    ) => {
      const nowIso = new Date().toISOString();
      setLiveRides((prev) =>
        prev.map((r) => (r.id === rideId ? { ...r, ...patch, updatedAt: nowIso } : r))
      );

      if (user && isVerifiedFirebaseAuthUser(user)) {
        const path = `rides/${rideId}`;
        try {
          await updateDoc(doc(db, 'rides', rideId), {
            ...patch,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [user]
  );

  const recordDriverPayout = useCallback(
    async (payout: DriverPayoutRecord) => {
      setPayouts((prev) => [payout, ...prev]);

      if (user && isVerifiedFirebaseAuthUser(user)) {
        const path = `payouts/${payout.id}`;
        try {
          await setDoc(doc(db, 'payouts', payout.id), {
            id: payout.id,
            driverId: user.uid,
            driverName: payout.driverName,
            upiId: payout.upiId,
            grossCollectedInr: payout.grossCollectedInr,
            companyFeeInr: payout.companyFeeInr,
            netPayoutInr: payout.netPayoutInr,
            utrReference: payout.utrReference,
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [user]
  );

  const reconcilePayoutAdmin = useCallback(
    async (payoutId: string, utrReference: string) => {
      const nowIso = new Date().toISOString();
      setPayouts((prev) =>
        prev.map((p) =>
          p.id === payoutId
            ? { ...p, status: 'reconciled', utrReference, updatedAt: nowIso }
            : p
        )
      );

      if (user && user.emailVerified && isAdminUser) {
        const path = `payouts/${payoutId}`;
        try {
          await updateDoc(doc(db, 'payouts', payoutId), {
            status: 'reconciled',
            utrReference,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [user, isAdminUser]
  );

  const submitSupportComplaint = useCallback(
    async (complaint: SupportComplaint) => {
      setComplaints((prev) => [complaint, ...prev]);

      if (user && isVerifiedFirebaseAuthUser(user)) {
        const path = `complaints/${complaint.id}`;
        try {
          await setDoc(doc(db, 'complaints', complaint.id), {
            id: complaint.id,
            reporterUid: user.uid,
            reporterRole: complaint.reporterRole,
            rideId: complaint.rideId ?? '',
            subject: complaint.subject.slice(0, 140),
            details: complaint.details.slice(0, 600),
            status: 'open',
            resolutionNote: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [user]
  );

  const updateComplaintStatusAdmin = useCallback(
    async (
      complaintId: string,
      status: SupportComplaint['status'],
      resolutionNote: string
    ) => {
      const nowIso = new Date().toISOString();
      setComplaints((prev) =>
        prev.map((c) =>
          c.id === complaintId ? { ...c, status, resolutionNote, updatedAt: nowIso } : c
        )
      );

      if (user && user.emailVerified && isAdminUser) {
        const path = `complaints/${complaintId}`;
        try {
          await updateDoc(doc(db, 'complaints', complaintId), {
            status,
            resolutionNote: resolutionNote.slice(0, 300),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [user, isAdminUser]
  );

  const updateApplicantApprovalAdmin = useCallback(
    async (
      uid: string,
      approvalStatus: ApprovalStatus,
      vehicleApprovalStatus: ApprovalStatus
    ) => {
      const nowIso = new Date().toISOString();
      setFleetApplicants((prev) =>
        prev.map((a) =>
          a.uid === uid
            ? { ...a, approvalStatus, vehicleApprovalStatus, updatedAt: nowIso }
            : a
        )
      );

      if (user && user.emailVerified && isAdminUser) {
        const path = `drivers/${uid}`;
        try {
          await updateDoc(doc(db, 'drivers', uid), {
            approvalStatus,
            vehicleApprovalStatus,
            backgroundCheckStatus:
              approvalStatus === 'approved' ? 'Verified & Cleared' : 'Pending Review',
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [user, isAdminUser]
  );

  const value: FirebaseContextValue = {
    user,
    authReady,
    isAdminUser,
    isAuthVerified,
    verifiedPhoneNumber,
    connectionOk,
    lastError,
    liveRides,
    payouts,
    complaints,
    fleetApplicants,
    signInWithGoogle,
    signOutUser,
    sendPhoneOtpViaFirebase,
    verifyPhoneOtpViaFirebase,
    syncDriverAccountToFirestore,
    createLiveRideOrder,
    updateLiveRideStatus,
    recordDriverPayout,
    reconcilePayoutAdmin,
    submitSupportComplaint,
    updateComplaintStatusAdmin,
    updateApplicantApprovalAdmin,
  };

  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside <FirebaseProvider>');
  }
  return ctx;
}
