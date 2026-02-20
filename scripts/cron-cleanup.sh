#!/usr/bin/env bash
#
# Hourly cleanup of expired PartFiles content.
# Intended to be invoked by crontab:
#   0 * * * * /path/to/PartFiles/scripts/cron-cleanup.sh >> /path/to/PartFiles/logs/cleanup.log 2>&1
#
# Required env vars (reads from .env by default):
#   CRON_SECRET   – must match the server's CRON_SECRET
#   BASE_URL      – server origin, defaults to http://localhost:3000

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Source .env if it exists (simple key=value parser)
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.env"
  set +a
fi

BASE_URL="${BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:?CRON_SECRET is not set}"

echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Running cleanup..."

RESPONSE=$(curl -sf -X POST "${BASE_URL}/api/cron/cleanup" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json")

echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $RESPONSE"
