Phase 3 Auto-Rollback and Preflight
=================================

This folder contains helper scripts used during Phase 3 development to safely
revert the last change if a critical failure occurs (frontend build, Prisma
migration, backend crash, etc.).

Scripts
-------
- `auto_rollback.sh` — creates a backup branch at current `HEAD`, then resets
  `HEAD` to `HEAD~1`. Use this to revert the last commit safely.

- `check_and_rollback.js` — runs a conservative preflight: (1) `npm run build`
  in the `frontend` directory, and (2) `npx prisma migrate status` in `backend`.
  If either fails, it invokes `auto_rollback.sh` to restore the repository to
  the previous commit (after creating a backup branch).

Usage
-----
Run the check script from the repository root:

```bash
node scripts/check_and_rollback.js
```

Or run the rollback manually if you see an immediate failure:

```bash
./scripts/auto_rollback.sh
```

Safety notes
------------
- The scripts require a clean working tree (no uncommitted changes). They will
  abort if the working tree is dirty.
- `auto_rollback.sh` creates a backup branch named `backup-before-rollback-<ts>`
  before resetting. You can restore it if needed.
- These helpers are conservative tools to help enforce the project's Auto-Rollback
  policy. They do not attempt any database changes themselves; if a Prisma
  migration had started to run or was applied to a live DB, handle DB rollbacks
  manually following the project's DB safety rules.
