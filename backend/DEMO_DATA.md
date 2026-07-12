# Demo Data Tooling

This backend demo data tooling creates safe, reversible demo content for client presentations without affecting non-demo production records.

## What these scripts do

- `npm run demo:seed` creates realistic demo users, trips, events, QR upload spaces, uploads, store items, purchases, notifications, and supporting data.
- `npm run demo:clear` deletes only demo-labelled records created by the demo seed process.
- `npm run demo:reset` clears demo data and then reseeds it.
- `--dry-run` prints what would happen without writing or deleting data.

## Demo safety guards

The scripts refuse to run in production-like environments unless both of these are set:

- `ALLOW_DEMO_DATA=true`
- `CONFIRM_DEMO_RESET=I_UNDERSTAND_THIS_DELETES_DEMO_DATA`

The production guard is triggered when `NODE_ENV=production` or when `DATABASE_URL` contains production-like keywords such as `prod`, `production`, or `live`.

## Required env variables

No special env vars are required for local development, but if you run against a production-like environment you must set:

```bash
ALLOW_DEMO_DATA=true \
CONFIRM_DEMO_RESET=I_UNDERSTAND_THIS_DELETES_DEMO_DATA
```

## Usage

Run from the `backend` folder.

### Dry-run examples

```bash
cd backend
npm run demo:seed -- --dry-run
npm run demo:clear -- --dry-run
npm run demo:reset -- --dry-run
```

### Seed demo data

```bash
cd backend
npm run demo:seed
```

### Clear only demo data

```bash
cd backend
npm run demo:clear
```

### Reset demo data

```bash
cd backend
npm run demo:reset
```

### Production-like demo reset

```bash
cd backend
ALLOW_DEMO_DATA=true CONFIRM_DEMO_RESET=I_UNDERSTAND_THIS_DELETES_DEMO_DATA npm run demo:reset
```

## Demo users created

- `[DEMO] Platform Admin` — `admin@demo.travelshare.local`
- `[DEMO] Organizer` — `organizer@demo.travelshare.local`
- `[DEMO] Tourist` — `tourist@demo.travelshare.local`
- `[DEMO] Guest Traveller` — created as a guest session

## Demo data coverage

The demo seed creates realistic Barbados-themed content for supported models
including:

- Users and preferences
- Guest session
- Trips and trip chapters
- Trip uploads and location references
- Events, event maps, event zones, and event uploads
- QR upload spaces targeting a trip and an event
- Share links for demo trips and events
- Store item and demo purchase
- Payment transaction and webhook event
- Notifications
- Internal ad content

## Image/media policy

Media references are demo-safe remote image URLs. No large image files are downloaded into the repo.

## How to remove demo data

Run:

```bash
cd backend
npm run demo:clear
```

If you want a full refresh, run:

```bash
cd backend
npm run demo:reset
```

## Warning

Do not run these scripts against a real production database unless you intentionally want to seed and remove demo data in a demo environment.
