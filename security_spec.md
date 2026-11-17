# A1 MOBILE — Firestore Security Specification

## 1. Data Invariants

1. **Public vs. PII Isolation**: `user_private/{userId}` and `bookings/{bookingId}` store PII (`email`, `customerPhone`, `customerName`) and are readable/listable strictly by the owning user (`uid == request.auth.uid`) or verified Store Admin. Public analytics dashboards read strictly non-PII projections (`user_profiles/{userId}` and `booking_metrics/{bookingId}`).
2. **Inventory Authority**: Only verified Store Admins (`isAdmin()`) may create, edit, restock, or delete `inventory/{itemId}` items. Public storefront visitors may only read published items (`isPublished == true`).
3. **Atomic Booking-Metric Synchronization**: Creating a `bookings/{bookingId}` document requires `existsAfter()` of its paired `booking_metrics/{bookingId}` document in the same atomic batch, and vice versa.
4. **Role Escalation Prevention**: Users creating `user_profiles/{userId}` can only set `role: "customer"` (unless `isAdmin()`), and cannot mutate `role`, `uid`, or `completedBookings` on update.
5. **Terminal State Locking**: Once a booking reaches `completed` or `cancelled`, non-admin users cannot transition or mutate it further.
6. **Temporal Integrity**: All `createdAt`, `updatedAt`, and `lastActiveAt` timestamps must match `request.time`; `createdAt` and `userId`/`uid` are immutable after creation.

## 2. The "Dirty Dozen" Adversarial Payloads

All 12 payloads below MUST evaluate to `PERMISSION_DENIED`:

1. **Identity Spoofing on Booking Create**: Authenticated user `alice` submits `bookings/b1` with `userId: "bob"`.
2. **Self-Admin Role Escalation on Profile Create**: Non-admin user `alice` creates `user_profiles/alice` with `role: "admin"`.
3. **Role Mutation on Profile Update**: Non-admin user `alice` updates `user_profiles/alice` changing `role` from `"customer"` to `"admin"`.
4. **Shadow Field Injection on Inventory Create**: Admin creates `inventory/item1` with an extra undeclared field `isVerifiedHack: true`.
5. **Non-Admin Inventory Edit**: Regular customer `alice` attempts to update `inventory/item1` setting `price: 1`.
6. **Orphaned Booking Without Atomic Metric**: User `alice` creates `bookings/b2` outside a batch without creating `booking_metrics/b2`.
7. **PII Blanket Read on `user_private`**: User `alice` attempts `get` or `list` on `user_private/bob`.
8. **PII List Scraping on `bookings`**: Non-admin `alice` runs an unfiltered `list` query on `/bookings` without `where("userId", "==", "alice")`.
9. **Terminal State Re-opening**: Customer `alice` updates `bookings/b1` (currently `status: "completed"`) back to `status: "pending"`.
10. **ID Poisoning / Resource Exhaustion**: Attacker writes a 1500-character document ID or 5000-character `notes` string.
11. **Timestamp Forgery**: User `alice` submits `createdAt: Timestamp(2020-01-01)` instead of `serverTimestamp()`.
12. **Unverified Email Admin Spoof**: Token with `email: "sanayaikhom62@gmail.com"` and `email_verified: false` attempts an admin write on `/inventory/item1`.
