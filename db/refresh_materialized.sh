#!/usr/bin/env bash
# Refresh materialized dashboard views after a new Jackson County ingest.
# Usage: db/refresh_materialized.sh [DATABASE_URL]
set -euo pipefail

DB_URL="${1:-postgresql://jacen@/jacen_dev?host=/var/run/postgresql}"

psql "$DB_URL" <<'SQL'
REFRESH MATERIALIZED VIEW api.dashboard_summary_mv;
REFRESH MATERIALIZED VIEW api.dashboard_value_trends_mv;
SQL

echo "Materialized dashboard views refreshed at $(date -u +%Y-%m-%dT%H:%M:%SZ)"