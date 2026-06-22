#!/usr/bin/env bash
set -euo pipefail

# Safe rollback helper
# Creates a backup branch at current HEAD, then resets to previous commit (HEAD~1).
# Usage: ./scripts/auto_rollback.sh

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository. Aborting."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean. Please commit or stash changes before rollback."
  exit 1
fi

LAST_COMMIT=$(git rev-parse --verify HEAD)
BACKUP_BRANCH="backup-before-rollback-$(date +%s)"

echo "Creating backup branch $BACKUP_BRANCH at $LAST_COMMIT"
git branch "$BACKUP_BRANCH" "$LAST_COMMIT"

echo "Resetting to previous commit (HEAD~1)" 
git reset --hard HEAD~1

echo "Rollback complete. Backup branch created: $BACKUP_BRANCH"
echo "To restore the backed-up commit: git checkout -b restore-$BACKUP_BRANCH $BACKUP_BRANCH"

exit 0
