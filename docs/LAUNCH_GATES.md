# Travel Share launch gates

Run these gates against staging before production. Never paste secret values into logs or source control.

## Database migration gate

The backend deployment command remains:

```sh
prisma generate && prisma migrate deploy && node src/index.js
```

Before deployment, point `DATABASE_URL` explicitly at the intended staging or production database and run `npm run prisma:status --workspace backend`. Confirm the hostname/database name with the deployment owner first. Use `prisma migrate dev` only for local development. Use `prisma migrate deploy` for staging and production. Never run `prisma migrate reset` against staging or production.

## Environment gate

Provide backend and frontend deployment variables to the same validation job, then run `npm run env:validate:production`. It prints only missing or weak variable names, never values. A failing result blocks deployment.

PayPal is launch-disabled in code until verified PayPal webhook processing exists. Stripe checkout is enabled only when `PAYMENT_PROVIDER=stripe` (or `both`) and both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are present.

## CI gate

GitHub Actions provisions PostgreSQL, deploys migrations, seeds the CI database, and runs `npm run test:backend:ci`. A skipped or failed HTTP test is not a pass. The frontend build and all i18n checks must also pass before release.

## Guest cleanup

Configure a Render Cron Job (or equivalent) to run daily from the backend directory:

```sh
npm run guest:cleanup
```

The job uses the deployment `DATABASE_URL`. It deletes expired, unclaimed guest-owned data, but detaches and preserves approved uploads and guest trips/events containing approved uploads. It must not run as part of normal web startup. Test first with `DRY_RUN=1 npm run guest:cleanup` against staging.

## Skin catalog

The required directories live under `backend/public/assets/skins/{basic,premium,seasonal,pending-naming}`. On staging, run `npm run skins:import --workspace backend`, then `npm run skins:verify --workspace backend`. The curated importer uses committed assets and display names, updates records by stable asset URL, and does not duplicate products. Verification requires exactly two active free basic skins and two unlocks for every registered non-guest user.

## Release decision

Complete [STAGING_SMOKE_TEST.md](./STAGING_SMOKE_TEST.md), preserve the output of migration status and CI, confirm persistent media URLs, and verify provider dashboards/webhooks before enabling real payments or tagging a production release.
