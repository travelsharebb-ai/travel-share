Deployment checklist — Travel Share

This file documents steps to deploy the current branch to Netlify / Render and to ensure skins, Prisma client and assets are available.

1) Build / generate artifacts (required on the server during deploy or locally before pushing):

   - Generate Prisma client (required by backend):

     ```bash
     cd backend
     npx prisma generate
     ```

   - If you run migrations during deploy, optionally run:

     ```bash
     cd backend
     npx prisma migrate deploy
     ```

   - Build the frontend (Vite):

     ```bash
     cd frontend
     npm install
     npm run build
     ```

2) Required environment variables (examples):

   - `DATABASE_URL` — PostgreSQL / MySQL connection string (backend)
   - `STRIPE_SECRET_KEY` — (optional) Stripe secret key for live checkout
   - `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` — (optional) PayPal keys
   - `FRONTEND_URL` — e.g. https://your-site.netlify.app (used by payment redirects)
   - `VITE_MAPBOX_TOKEN` — Mapbox token (frontend build-time or runtime)
   - `MODERATION_PROVIDER` (optional)
   - `CLOUDINARY_URL` or `S3_*` variables depending on `MEDIA_STORAGE_DRIVER`
   - `GUEST_ACCESS_DAYS`, `GUEST_DELETION_DAYS` (optional overrides)

3) Static assets: `backend/public/assets/skins/*`

   - The backend uses `backend/public/assets/skins/basic` and `/premium`.
   - The `backend/scripts/import-skins.mjs` script can copy images from `frontend/public` to the backend public assets and upsert `PurchaseItem` rows.
   - If you prefer to manage assets manually, ensure `backend/public/assets/skins/*` is included in your repo or uploaded to CDN and that `PurchaseItem.metadata.frameAssetUrl` points to the correct URL path.

4) Prisma / Deploy specifics

   - On platforms like Render, include a build step for `backend` that runs `npx prisma generate` before starting the Node process so `@prisma/client` is available.
   - Example Render start command (backend):

     ```bash
     # generate client
     npx prisma generate
     # run migrations (if needed)
     npx prisma migrate deploy
     # start
     node src/index.js
     ```

   - On Netlify, you can deploy the `frontend` build. The `backend` must be hosted separately (Render, Heroku, Fly, etc.).

5) Smoke tests to run after deployment

   - GET `/api/public/store-preview` returns store items (should include `image_skin` items).
   - Open `/guest/skins` on the frontend to verify preview list resolves images.
   - Log in as admin → `/api/admin/store` and verify `purchaseItem.metadata.frameAssetUrl` exists for skins.
   - Create a test user, ensure `ensureBasicSkinUnlocks` grants 2 basic skins.
   - Test payment flow (Stripe): set `STRIPE_SECRET_KEY` and exercise `/api/store/:itemId/checkout` and `/api/store/payments/:transactionId/confirm`.

6) Notes / Caveats

   - Stripe/PayPal require valid credentials — endpoints will return 501 if keys missing.
   - The cleanup job for guest sessions exists as `backend/scripts/cleanup-expired-guests.mjs` and can be scheduled as a cron job or run via `npm run cleanup:guests`.

7) Git commit process (local)

   ```bash
   git add .
   git commit -m "chore(deploy): add deployment checklist and verify skins"
   git push origin feature/map-complete
   ```

If you want, I can commit the DEPLOYMENT.md file now and push the branch (if you want me to run the push).