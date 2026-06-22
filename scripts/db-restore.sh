#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: DATABASE_URL=postgres://... scripts/db-restore.sh s3://bucket/travelshare.dump" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

source_uri="$1"
file="${TMPDIR:-/tmp}/$(basename "$source_uri")"

aws s3 cp "$source_uri" "$file"
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$file"

echo "Restore completed from ${source_uri}"
