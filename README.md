# Travel Share

Travel Share is a privacy-first travel memory sharing MVP. A tourist creates a trip album, shares a QR code, and scanners can upload photos or videos into a private approval queue. Nothing appears in the album unless the tourist approves it.

## Folder Structure

```text
Travel Share/
  backend/
    prisma/
      schema.prisma
      migrations/
      seed-e2e.js
    src/
      app.js
      index.js
      middleware/
      routes/
      utils/
    tests/e2e/
    .env.example
    package.json
  frontend/
    src/
      components/
      lib/
      pages/
      App.jsx
      main.jsx
      index.css
    .env.example
    package.json
  .gitignore
  package.json
  README.md
```

## Install Commands

```bash
npm install
npm install --workspace backend
npm install --workspace frontend
```

## Local Setup Commands

1. Create PostgreSQL database locally.
2. Copy env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Fill in `backend/.env` and `frontend/.env`.
4. Run migrations:

```bash
npm run prisma:migrate --workspace backend
```

5. Start apps:

```bash
npm run dev:backend
npm run dev:frontend
```

Frontend defaults to `http://localhost:5173`; backend defaults to `http://localhost:10000`.

## Environment Variables

Backend Render envs:

```bash
NODE_ENV=production
PORT=10000
DATABASE_URL=
JWT_SECRET=
FRONTEND_URL=
CORS_ORIGIN=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
MAX_UPLOAD_SIZE_MB=50
SUPPORT_EMAIL=
APP_NAME=Travel Share
FINGERPRINT_SECRET=
SENDGRID_API_KEY=
EMAIL_FROM=
ADMIN_EMAIL=
MODERATION_PROVIDER=sightengine
MODERATION_UNSAFE_THRESHOLD=0.75
SIGHTENGINE_API_USER=
SIGHTENGINE_API_SECRET=
SIGHTENGINE_MODELS=nudity-2.1,weapon,gore-2.0,offensive,violence
MEDIA_STORAGE_DRIVER=cloudinary
```

Frontend Netlify envs:

```bash
VITE_API_URL=
VITE_APP_NAME=Travel Share
VITE_SUPPORT_EMAIL=
```

Optional later envs:

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
VITE_STRIPE_PUBLISHABLE_KEY=
SENDGRID_API_KEY=
EMAIL_FROM=
ADMIN_EMAIL=
TEST_DATABASE_URL=
```

## Email Notifications

Travel Share sends transactional email through SendGrid when `SENDGRID_API_KEY` and `EMAIL_FROM` are configured. In local development it falls back to console delivery unless `EMAIL_PROVIDER` is changed.

Current notifications:

- New upload waiting for tourist review.
- Reported upload notification to `ADMIN_EMAIL` or `SUPPORT_EMAIL`.
- Password reset verification link.

Every attempted email writes an `EmailNotificationLog` row so delivery status persists across deploys.

## Forgot Password

Users can open `/forgot-password`, enter their email, and receive a verification link. Reset tokens are random, stored only as SHA-256 hashes, expire after 30 minutes, and become invalid after one use. The reset request response is intentionally generic so attackers cannot confirm whether an email address has an account.

## AI / Moderation Provider

Set `MODERATION_PROVIDER=sightengine` and add `SIGHTENGINE_API_USER` plus `SIGHTENGINE_API_SECRET` to enable real image/video moderation. Uploads are still private and pending; flagged media stays in the approval queue with `aiFlagged=true`, `moderationStatus`, `moderationProvider`, and JSON labels stored in PostgreSQL.

For local tests, use:

```bash
MEDIA_STORAGE_DRIVER=mock
MODERATION_PROVIDER=mock
EMAIL_PROVIDER=console
```

## Privacy-Preserving Uploader Fingerprints

Uploader fingerprints are HMAC hashes generated from coarse network bucket, short browser/language hashes, and an HTTP-only uploader session cookie. Raw IP addresses, raw user agents, and raw device details are not stored. Set a strong `FINGERPRINT_SECRET` in production and do not rotate it casually, because existing blocked uploader records depend on it.

## Internal Ads

Admins can manage first-party Travel Share ads from `/admin`. Ads are stored in PostgreSQL and can be image or video creatives uploaded to Cloudinary/S3 through the admin form or linked by another HTTPS media URL.

Admin controls:

- Add, edit, pause/activate, or delete ads.
- Set media type: image or video.
- Upload an image/video creative or paste an existing media URL.
- Set optional click-through URL.
- Set priority for weighted display.
- Set display duration from 5 to 60 seconds.
- Set optional start and end date/time.

The app shows one active ad in an animated fixed slot at the bottom of the page. It slides in, stays visible for the configured duration, and then slides out. This is internal inventory only; no third-party ad scripts or trackers are used.

## Prisma Migration Commands

Local development:

```bash
npm run prisma:migrate --workspace backend
npm run prisma:generate --workspace backend
```

Production deploy:

```bash
npm run prisma:deploy --workspace backend
```

E2E test database setup:

```bash
createdb travel_share_test
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/travel_share_test npm run prisma:deploy --workspace backend
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/travel_share_test npm run db:seed:e2e --workspace backend
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/travel_share_test npm run test:e2e --workspace backend
```

## Production Data Safety

- Never run `prisma migrate reset` in production.
- Never delete the production database.
- Never store production media on the server filesystem.
- Use Cloudinary or S3 for uploads.
- Use database backups.
- Before major migrations, backup the database.
- Deployments must not wipe user data.
- Prisma migrations must be additive and reviewed before production deployment.
- Render restarts and deploys can wipe local files, so production uploads must live in Cloudinary/S3 and all records must live in PostgreSQL.
- Run e2e tests only against a disposable PostgreSQL database using `TEST_DATABASE_URL`.

## Render Deployment Steps

1. Push this repository to GitHub.
2. Create a Render PostgreSQL database or connect Supabase PostgreSQL.
3. Create a Render Web Service from the GitHub repo.
4. Set root directory to `backend`.
5. Build command:

```bash
npm install && npm run prisma:generate && npm run build
```

6. Start command:

```bash
npm run prisma:deploy && npm start
```

7. Add all backend env vars in Render.
8. Set health check path to `/health`.
9. Set `CORS_ORIGIN` and `FRONTEND_URL` to the Netlify URL.
10. Set SendGrid, Sightengine, and `FINGERPRINT_SECRET` env vars before accepting production uploads.

## Netlify Deployment Steps

1. Create a Netlify site from GitHub.
2. Set base directory to `frontend`.
3. Build command:

```bash
npm install && npm run build
```

4. Publish directory:

```bash
dist
```

5. Add frontend env vars, especially `VITE_API_URL` with the Render API URL.

## Cloudinary Setup Steps

1. Create a Cloudinary account.
2. Copy cloud name, API key, and API secret into Render env vars.
3. Keep uploaded assets in Cloudinary folders such as `travel-share/trips`.
4. Do not commit Cloudinary credentials.
5. Test by uploading an image through a public QR upload page and verifying the returned `filePublicId` is stored in PostgreSQL.

## SendGrid Setup Steps

1. Create or use a SendGrid account.
2. Verify the sender used for `EMAIL_FROM`.
3. Create an API key with mail send permission.
4. Add `SENDGRID_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, and `SUPPORT_EMAIL` to Render.
5. Upload a test memory and confirm an `EmailNotificationLog` row is created.

## Sightengine Setup Steps

1. Create a Sightengine account.
2. Add `MODERATION_PROVIDER=sightengine`.
3. Add `SIGHTENGINE_API_USER` and `SIGHTENGINE_API_SECRET` to Render.
4. Keep `SIGHTENGINE_MODELS` aligned with your moderation policy.
5. Upload a test image and confirm the upload row contains `moderationProvider`, `moderationStatus`, `moderationLabels`, and `aiFlagged`.

## Confirm Data Persists After Redeploy

1. Create a user and trip.
2. Upload a test photo through the QR flow.
3. Approve it in Pending Memories.
4. Confirm the upload row exists in PostgreSQL and the media asset exists in Cloudinary.
5. Redeploy Render and Netlify.
6. Log back in and confirm the trip, QR code, approval status, share link, and media still exist.
7. Confirm no files are required from the Render server filesystem.

- Add payment plans if monetization is needed.
- Add browser-level Playwright tests once a staging Netlify/Render environment exists.
- Add background jobs for retrying failed email notifications.
