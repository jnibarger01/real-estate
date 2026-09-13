#!/usr/bin/env bash
# Apply the canonical api.dashboard_* contract to a Postgres/PostGIS database.
# Usage: bin/create-dashboard-contract.sh
# Env: PGDATABASE (default jacen_dev), PGHOST, PGUSER, PGPASSWORD, DATABASE_URL
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="$ROOT/sql/api_dashboard_views.sql"
SAVED="$ROOT/sql/api_saved_searches.sql"

if [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1)
  TARGET="$DATABASE_URL"
else
  DB="${PGDATABASE:-jacen_dev}"
  PSQL=(psql -d "$DB" -v ON_ERROR_STOP=1)
  TARGET="$DB"
fi

echo "==> Applying api.dashboard_* contract to $TARGET"
"${PSQL[@]}" -f "$SQL"
echo "==> Applying api.saved_searches table"
"${PSQL[@]}" -f "$SAVED"

echo "==> Verifying api.dashboard_* views"
"${PSQL[@]}" -c "
  SELECT n.nspname AS schema, c.relname AS name, c.relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'api'
    AND c.relkind IN ('v', 'm', 'r')
  ORDER BY c.relname;
"
