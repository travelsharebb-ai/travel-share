# Staging smoke test

Set `STAGING_FRONTEND_URL`, `STAGING_BACKEND_URL`, and `CONFIRM_STAGING_SMOKE=true`, then run `npm run smoke:staging`. The script performs read-only health/public endpoint checks. It refuses to run without explicit staging confirmation and does not require production secrets.

Record tester, deployment SHA, date, browser/device, and pass/fail evidence for every item:

- [ ] Email/password signup, login, logout
- [ ] Password reset when email is enabled
- [ ] Google OAuth with the staging redirect URI
- [ ] Microsoft OAuth with the staging redirect URI
- [ ] Map loads with Mapbox; denied/unsupported geolocation does not crash
- [ ] Upload reaches configured Cloudinary/S3/R2 storage and returns a persistent URL
- [ ] QR guest entry and public QR upload
- [ ] Guest claim path; cleanup dry-run confirms access/deletion windows
- [ ] Admin Ads loads; create image and video ads
- [ ] Animated ad enters from right, centers at bottom, exits left, and respects exclusions
- [ ] One impression and click are recorded without blocking navigation
- [ ] Store loads and free ownership works
- [ ] Stripe test checkout and signed webhook finalize exactly once
- [ ] PayPal remains unavailable unless readiness reports fully ready
- [ ] Admin dashboard, reports, users, moderation, ads and data tools load
- [ ] Language switch updates representative pages in all supported locales
- [ ] Mobile topbar/drawer opens, closes by overlay/link/Escape, and has no duplicate topbar or horizontal overflow
- [ ] Background video appears only on allowed signed-out public routes

Do not point this checklist or its helpers at production for mutation tests. Use provider test modes and staging-only accounts/content.
