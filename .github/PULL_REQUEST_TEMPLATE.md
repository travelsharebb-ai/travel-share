## Summary

This PR implements the final map UX features and admin safeguards under branch `feature/map-complete`.

- Map: click-to-upload, locate control, forward geocode search, photos-only filter, empty-spot panel
- Uploads: prefill upload forms from URL query params
- Admin: user anonymize/safe-delete endpoint

## Testing / Verification

Run the frontend build and preview, then execute the smoke script:

```bash
cd "frontend"
npm ci
npm run build
npm run preview -- --port 5173 --host 127.0.0.1
# in another shell (adjust BASE if preview chooses different port)
BASE="http://127.0.0.1:5174" bash scripts/smoke-map-e2e.sh
```

Playwright E2E tests are included under `frontend/e2e/` — CI should install dependencies and run `npx playwright install` before `npx playwright test`.

## Notes

- Backend migrations/build may require a local database and Prisma CLI available in the environment. If CI runs the backend migrations, ensure `DATABASE_URL` is set and the environment has Prisma installed (or run `npm ci` in `/backend`).

## Checklist

- [ ] Review changes and run the smoke tests locally
- [ ] Merge and deploy
