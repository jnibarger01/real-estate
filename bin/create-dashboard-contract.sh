#!/usr/bin/env bash
set -euo pipefail

DB="${PGDATABASE:-jacen_dev}"
PGHOST="${PGHOST:-/var/run/postgresql}"

echo "==> Creating dashboard contract views in $DB (schema: dashboard)"

psql -q -v ON_ERROR_STOP=1 -c "CREATE SCHEMA IF NOT EXISTS dashboard;" 2>/dev/null || true

psql -q -v ON_ERROR_STOP=1 -f "$(dirname "$0")/sql/dashboard_contract_views.sql"

echo "==> Verifying contract views"
psql -q -c "
  SELECT schemaname, tablename, viewdefinition IS NOT NULL AS is_view
  FROM pg_catalog.pg_views
  WHERE schemaname = 'dashboard'
  ORDER BY tablename;
"
