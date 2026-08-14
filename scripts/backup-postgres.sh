#!/usr/bin/env bash
# Logical backup of the dashboard database. Does not restore production.
# Usage: scripts/backup-postgres.sh [DATABASE_URL] [OUTPUT_DIR]
set -euo pipefail
DB_URL="${1:-${DATABASE_URL:-postgresql://jacen@/jacen_dev?host=/var/run/postgresql}}"
OUT_DIR="${2:-${BACKUP_DIR:-./backups}}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/jacen-dashboard-$STAMP.dump"
pg_dump --format=custom --no-owner --file="$OUT" "$DB_URL"
echo "$OUT"
