# TravelShare Backend Environment

## Required

- `DATABASE_URL`: Managed Postgres connection string. Example: `postgresql://USER:PASSWORD@HOST:5432/DB?schema=public`
- `JWT_SECRET`: Stable random secret used to sign auth tokens. Do not rotate unless you want all users signed out.
- `FRONTEND_URL`: Public frontend URL. Example: `https://travelshare.netlify.app`
- `CORS_ORIGIN`: Comma-separated allowed frontend origins. Example: `https://travelshare.netlify.app,http://localhost:5173`
- `STORAGE_PROVIDER`: Use `cloudinary` for production.
- `CLOUDINARY_URL`: Preferred Cloudinary credential format, or set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
- `FINGERPRINT_SECRET`: Secret used to generate uploader fingerprints and prevent counterfeit sessions.
- `REDIS_URL`: Recommended for optional Redis-backed rate limiting and caching. If unset, the app falls back to in-memory rate limiting.
- `PAYMENT_PROVIDER`: Default payment routing provider, for example `stripe`.
 - `GUEST_ACCESS_DAYS`: Number of days a guest session is active before entering the grace period.
 - `GUEST_DELETION_DAYS`: Total number of days after guest session creation before the guest is considered expired and eligible for cleanup. Example: with `GUEST_ACCESS_DAYS=3` and `GUEST_DELETION_DAYS=14` the guest is active on days 0–3, in a grace period on days 3–14, and eligible for cleanup after day 14.

## Optional / Provider Dependent

- `PORT`: Render provides this automatically.
- `SESSION_SECRET`: Not currently used because the app relies on JWT plus HttpOnly guest cookies. Keep available if Redis/session middleware is added later.
- `REDIS_URL`: Optional future managed session/cache store. Current app does not require Redis.
 - `REDIS_URL`: Optional Redis connection string used for rate limiting when available.
- `SENDGRID_API_KEY`: Required for password reset and upload notification email delivery.
- `SENDGRID_FROM_EMAIL`: Sender address for SendGrid.
- `SUPPORT_EMAIL`: Support contact shown in the app.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: Required to enable Google sign-in.
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`: Required to enable Microsoft/Hotmail sign-in.
- `STRIPE_SECRET_KEY`: Backend-only secret key required for Stripe Checkout.
- `STRIPE_WEBHOOK_SECRET`: Backend-only signing secret required for `POST /api/webhooks/stripe`.
- `STRIPE_CURRENCY`: Checkout currency. Defaults to `usd`.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: Required for PayPal checkout.
- `PAYPAL_WEBHOOK_ID`: Reserved for future PayPal webhook verification.
- `PAYPAL_API_BASE`: Optional. Defaults to PayPal sandbox: `https://api-m.sandbox.paypal.com`
- `ALLOW_DEV_PURCHASES`: Set `true` only in local/dev if you want paid store items to unlock without checkout.
- `PAYMENT_PROVIDER`: Example: `stripe`.
- `MODERATION_PROVIDER`: Optional moderation provider switch.
- `MAX_UPLOAD_SIZE_MB`: Upload limit. Default: `50`.
- `BACKGROUND_VIDEO_URL`: Default public landing/auth background video URL.
 - `GUEST_DELETION_DAYS`: Total number of days after guest session creation (active + grace) before guest-owned data may be permanently removed. Default: `14`.
- `BACKUP_S3_BUCKET`: S3 bucket used by `scripts/db-backup.sh`.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`: Required by AWS CLI for backups/restores.
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL`: Required only when `STORAGE_PROVIDER=s3`.

## Render Notes

Use a Render managed Postgres database and set `DATABASE_URL` from that database. Do not use local SQLite or file uploads as persistent storage.

Recommended backend start command:

```bash
prisma generate && prisma migrate deploy && node src/index.js
```

The backend `package.json` `start` script already runs that command.

Set all env vars in Render Dashboard > Service > Environment. Never commit secrets to the repo.

Stripe production purchase unlocks require signed webhooks. The frontend success redirect is only a receipt/status cue and must not unlock purchases by itself. Ownership is granted only after the backend verifies Stripe Checkout server-side through `POST /api/webhooks/stripe` or the authenticated confirm fallback.

For Netlify, set:

- `VITE_API_URL`: Render backend URL, for example `https://travelshare-api.onrender.com`
- `VITE_SUPPORT_EMAIL`
- `VITE_MAPBOX_TOKEN` if Mapbox production maps are enabled
- `VITE_STRIPE_PUBLISHABLE_KEY`: Frontend-safe publishable Stripe key only. Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` to the frontend.
- `VITE_GOOGLE_MAPS_API_KEY`: (optional) API key used by browser-only Google Maps JavaScript/Embed features such as Street View preview.

Note: `VITE_GOOGLE_MAPS_API_KEY` is a frontend key and should be configured in your Netlify site's environment variables (frontend). Do not use it for the Google Geocoding REST API from browser code because referrer-restricted keys are not valid for that REST call. If Google Geocoding REST is needed later, use a backend-only `GOOGLE_GEOCODING_API_KEY`, keep it out of frontend env vars, and restrict it by server/IP in Google Cloud Console.

## Stripe Product Sync

After setting `DATABASE_URL` and `STRIPE_SECRET_KEY`, sync the default TravelShare store catalog into Stripe and the app database with:

```bash
npm --workspace travel-share-backend run stripe:sync-products
```

The sync creates or updates Stripe Products, creates reusable one-time Prices, and stores `stripeProductId`, `stripePriceId`, and `stripeLookupKey` in each `PurchaseItem.metadata`. Checkout will use those Stripe Prices when present.

## Backups

Schedule `scripts/db-backup.sh` from Render Cron or an external scheduler with:

```bash
DATABASE_URL=... BACKUP_S3_BUCKET=... AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=... scripts/db-backup.sh
```

Restore with:

```bash
DATABASE_URL=... AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=... scripts/db-restore.sh s3://bucket/travelshare-YYYYMMDDTHHMMSSZ.dump
```

## Manual Persistence Checklist

1. Create a user.
2. Create a guest creator album/event, then sign up and confirm it is claimed.
3. Upload media through a QR page and confirm the stored `fileUrl` is a Cloudinary URL.
4. Create a store item in Admin > Store.
5. Purchase the store item as a user.
6. Activate the store item.
7. Reload the app and confirm `GET /api/auth/me` returns `activeStoreItem`.
8. Restart or redeploy backend.
9. Confirm user, purchases, active item, trips/events, QR links, and uploaded media remain available.

## Production Environment Variables (examples)

Set these in your hosting provider's environment config (Render, Railway, Heroku, Vercel, etc.). Replace placeholders with real credentials and never commit secrets.

- `DATABASE_URL`: `postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public`
- `JWT_SECRET`: long random string (do not rotate unless you want to sign users out)
- `FRONTEND_URL`: public frontend URL (e.g. `https://app.example.com`)
- `CORS_ORIGIN`: comma-separated allowed frontends (e.g. `https://app.example.com`)

- Storage (choose one):
	- Cloudinary: set `MEDIA_STORAGE_DRIVER=cloudinary` and either `CLOUDINARY_URL` (preferred) or `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
	- S3: set `MEDIA_STORAGE_DRIVER=s3` (or `STORAGE_PROVIDER=s3`) and set `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optional `S3_ENDPOINT` / `S3_PUBLIC_BASE_URL` for non-AWS providers.

- `REDIS_URL` (recommended): connection string for a managed Redis instance (e.g. `rediss://:PASSWORD@host:6380/0`). When set, the app uses Redis-backed rate limiting for resilience.

- Email: `SENDGRID_API_KEY` and `EMAIL_FROM` (or configure another email provider integration)

- Payments (if used): `STRIPE_SECRET_KEY`, `STRIPE_CURRENCY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` as required.

## Deployment checklist

1. Provision a managed Postgres instance and set `DATABASE_URL`.
2. Provision object storage (Cloudinary or S3) and set storage-related env vars.
3. Provision managed Redis and set `REDIS_URL` (use TLS/`rediss://` if provided).
4. Configure email credentials for SendGrid or another provider.
5. Set `JWT_SECRET` and other secrets in your hosting platform (never in repo).
6. Run migrations on deploy target: `prisma migrate deploy` (the backend `start` script already runs this).
7. Schedule daily DB backups (see `scripts/db-backup.sh`) and test restores periodically.

If you want, use this file as the source of truth and paste these variables into your provider's environment settings when creating the service.

## Seeding Platform Settings (DB)

You can populate the `PlatformSetting` table with sane defaults using the provided seed script. This is useful so the Settings UI is not empty and platform defaults can be edited from the admin UI/API.

How to run the seed (on the server where `DATABASE_URL` is configured):

```bash
# from the repo root in your backend service directory
cd backend
node scripts/seed-platform-settings.mjs
# or via npm script
npm run seed:platform-settings
```

The script will upsert keys: `guestAccessDays`, `maxUploadSizeMb`, `defaultPrivacy`, `moderationProvider`, `mapProvider`, `paymentProvider`, `backgroundVideoUrl`.

Cleanup expired guests
----------------------

To remove expired guest sessions and their guest-owned data (albums, uploads, QR links) after the configured retention window, run the cleanup script on the host that can access the production database:

```bash
cd backend
# optional: set custom total guest lifetime (in days) used as the cleanup cutoff
# this value represents days since guest session creation; guests older than this
# value are eligible for purge
GUEST_DELETION_DAYS=14 npm run cleanup:guests
```

The script uses the environment variable `GUEST_DELETION_DAYS` (or the `guestDeletionDays` `PlatformSetting`) as the total guest lifetime (days since session creation) to decide which guest sessions to purge. It will not remove public map aggregates or non-guest-owned data.

You can also update these via the admin API (authenticated admin) with `PATCH /api/admin/settings` sending JSON with key/value pairs, for example:

```json
{
	"guestAccessDays": 5,
	"defaultPrivacy": "exact",
	"mapProvider": "mapbox"
}
```

The server validates and ignores unknown keys.


## Skins (photo-frame overlays)

1. Ensure the backend serves static assets from the `public` folder (the app exposes `/assets`). The import script copies overlays to `/backend/public/assets/skins` and they will be served as `/assets/skins/...`.
2. Run the import script once after migrations to copy PNGs and create `PurchaseItem` rows: from repo root run `node backend/scripts/import-skins.mjs` (we recommend running this during deploy with the repository checked out so `frontend/public` assets are available).
3. The import script grants the first two basic skins to registered users by inserting `UserSkinUnlock` records. Premium skins remain gated behind purchases.
4. Frontend components read `upload.frameAssetUrl` (when present) and overlay the PNG above the media; confirm `GET` endpoints return `frameAssetUrl` (uploads list, trip get, public share). If you add other upload-returning endpoints, hydrate them similarly.
5. If you plan to host skin assets on external storage (S3/Cloudinary), adjust `import-skins.mjs` to copy or upload assets there and set `metadata.frameAssetUrl` to the public URL.
