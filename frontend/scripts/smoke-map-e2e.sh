#!/usr/bin/env bash
set -euo pipefail
BASE="http://localhost:5173"

# Wait for preview server to be ready
for i in {1..20}; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/" || echo "000")
  if [ "$status" = "200" ]; then
    break
  fi
  echo "Waiting for preview server... ($i)"
  sleep 1
done

check() {
  path="$1"
  echo -n "Checking $path ... "
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path" || echo "000")
  echo "$status"
  if [ "$status" != "200" ]; then
    echo "Failed: $path returned $status"
    exit 2
  fi
}

check "/"
check "/tourist"
check "/events"
check "/trips/test-id/upload"
check "/qr/abc123/upload"

echo "Smoke checks passed: basic routes are reachable on $BASE" 
