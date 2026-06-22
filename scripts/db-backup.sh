#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if [[ -z "${BACKUP_S3_BUCKET:-}" ]]; then
  echo "BACKUP_S3_BUCKET is required." >&2
  exit 1
fi

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
file="travelshare-${timestamp}.dump"
path="${TMPDIR:-/tmp}/${file}"

pg_dump "$DATABASE_URL" --format=custom --file="$path"
aws s3 cp "$path" "s3://${BACKUP_S3_BUCKET}/${file}"

echo "Backup uploaded to s3://${BACKUP_S3_BUCKET}/${file}"
