# Aurelia Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Master Catch-All Deny**: Every path not explicitly matched is denied for all reads and writes.
2. **Ownership & Verified Identity**: All driver data (`/drivers/{driverId}`) and subcollections require `request.auth != null`, either verified email (`request.auth.token.email_verified == true`) or verified Firebase Phone OTP (`request.auth.token.phone_number`), and `request.auth.uid == driverId`. Admin privileges strictly require verified email (`eventwave2257@gmail.com`).
3. **PII Isolation**: Sensitive fields (`email`, `phone`, `licensePlate`, `licenseNumber`) are stored strictly in `/drivers/{driverId}/private/pii` and readable/writable only by `driverId`.
4. **Master Gate**: Writes to `/trips/{tripId}` and `/appointments/{appointmentId}` verify parent `/drivers/{driverId}` exists and belongs to `request.auth.uid`.
5. **Immutable & Terminal States**: `uid`, `ownerUid`, and `createdAt` are immutable; completed trips cannot be altered once persisted; completed care appointments cannot transition backward.
6. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: `request.auth == null` on `/drivers/uid1` -> DENIED.
2. **Unverified Identity**: `request.auth.token.email_verified == false` without `phone_number` on `/drivers/uid1` -> DENIED.
3. **Cross-User Ownership Spoof**: Signed in as `uid1`, create `/drivers/uid2` with `uid: "uid2"` -> DENIED.
4. **UID Injection in Payload**: Signed in as `uid1`, create `/drivers/uid1` with `uid: "uid2"` -> DENIED.
5. **Shadow / Ghost Field Injection**: Create `/drivers/uid1` with extra key `isAdmin: true` -> DENIED (`keys().hasOnly(...)`).
6. **PII Cross-Read**: Signed in as `uid2`, read `/drivers/uid1/private/pii` -> DENIED.
7. **ID Poisoning**: Document ID longer than 128 chars or containing `/` / `$` / `.` -> DENIED (`isValidId`).
8. **Type Poisoning**: `yearsExperience: "five"` or `distanceKm: "10"` -> DENIED.
9. **String Size Overflow**: `routeSummary` > 200 chars on `TripRecord` -> DENIED (Denial of Wallet protection).
10. **Client-Spoofed Timestamp**: `updatedAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> DENIED.
11. **Terminal State Rollback**: Update `/drivers/uid1/appointments/apt1` from `status: "completed"` back to `status: "open"` -> DENIED.
12. **Blanket List Query Scrape**: Attempt `list` on `/drivers` collection globally -> DENIED.
