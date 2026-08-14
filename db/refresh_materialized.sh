#!/usr/bin/env bash
# Refresh the mart that api.dashboard_* reads, promote raw history, reindex, stamp ingest.
# Usage: db/refresh_materialized.sh [DATABASE_URL]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_URL="${1:-${DATABASE_URL:-postgresql://jacen@/jacen_dev?host=/var/run/postgresql}}"

psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF to_regclass('mart.residential_properties') IS NULL THEN
    RAISE EXCEPTION 'mart.residential_properties is missing';
  END IF;
END
$$;
SQL

if psql "$DB_URL" -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_matviews WHERE schemaname = 'mart' AND matviewname = 'residential_properties'" | grep -q 1; then
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mart.residential_properties;"
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/sql/promote_raw_to_mart.sql"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/sql/spatial_indexes.sql" || true

psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO api.ingest_state (source, refreshed_at)
VALUES ('mart.residential_properties', now())
ON CONFLICT (source) DO UPDATE SET refreshed_at = excluded.refreshed_at;
SQL

echo "mart.residential_properties refreshed at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
