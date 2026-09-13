#!/usr/bin/env bash
# Backup (optional) + restore into a throwaway DB + verify dashboard_readonly.
# Usage: scripts/restore-drill.sh [DATABASE_URL] [DUMP_FILE]
# Env: THROW_DB (default jacen_restore_drill),
#      BACKUP_DIR (default ./backups), KEEP_THROW_DB=1 to skip dropdb.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SRC_URL="${1:-${DATABASE_URL:-postgresql://jacen@/jacen_dev?host=/var/run/postgresql}}"
DUMP_ARG="${2:-}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
THROW_DB="${THROW_DB:-jacen_restore_drill}"

psql_admin() {
  psql "$SRC_URL" -v ON_ERROR_STOP=1 "$@"
}

throw_url() {
  python3 - "$SRC_URL" "$THROW_DB" <<'PY'
import sys
from urllib.parse import urlparse, urlunparse
src, name = sys.argv[1], sys.argv[2]
u = urlparse(src)
print(urlunparse((u.scheme, u.netloc, "/" + name, u.params, u.query, u.fragment)))
PY
}

# Validate THROW_DB is a simple identifier (avoid SQL injection via env).
if [[ ! "$THROW_DB" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "THROW_DB must be a simple SQL identifier, got: $THROW_DB" >&2
  exit 1
fi

echo "==> Source: $SRC_URL"
echo "==> Throwaway DB: $THROW_DB"

if [[ -n "$DUMP_ARG" ]]; then
  DUMP="$DUMP_ARG"
  if [[ ! -f "$DUMP" ]]; then
    echo "Dump not found: $DUMP" >&2
    exit 1
  fi
else
  mkdir -p "$BACKUP_DIR"
  echo "==> Taking logical backup"
  DUMP="$(scripts/backup-postgres.sh "$SRC_URL" "$BACKUP_DIR")"
fi
echo "==> Dump: $DUMP"

echo "==> Recreating throwaway database"
psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$THROW_DB' AND pid <> pg_backend_pid();" >/dev/null || true
psql_admin -c "DROP DATABASE IF EXISTS $THROW_DB;"
psql_admin -c "CREATE DATABASE $THROW_DB;"

THROW_URL="$(throw_url)"
echo "==> Throwaway URL: $THROW_URL"

echo "==> Ensuring dashboard roles exist on cluster"
psql "$THROW_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_app') THEN
    CREATE ROLE dashboard_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_readonly') THEN
    CREATE ROLE dashboard_readonly NOLOGIN;
  END IF;
END
$$;
SQL

echo "==> Restoring dump (custom format, --no-owner)"
# pg_restore returns 1 when warnings are emitted; fail only on ERROR lines.
set +e
pg_restore --no-owner --dbname="$THROW_URL" "$DUMP" >/tmp/restore-drill-pg_restore.out 2>/tmp/restore-drill-pg_restore.err
RESTORE_RC=$?
set -e
cat /tmp/restore-drill-pg_restore.out /tmp/restore-drill-pg_restore.err >&2 || true
if [[ "$RESTORE_RC" -gt 1 ]]; then
  echo "pg_restore failed with exit $RESTORE_RC" >&2
  exit "$RESTORE_RC"
fi
if [[ "$RESTORE_RC" -eq 1 ]]; then
  if grep -qiE '^pg_restore: error:' /tmp/restore-drill-pg_restore.err || grep -qiE 'ERROR:' /tmp/restore-drill-pg_restore.err; then
    echo "pg_restore reported ERROR" >&2
    exit 1
  fi
  echo "    (pg_restore exit 1 with warnings only — continuing)"
fi

echo "==> Allow connecting user to assume dashboard_readonly for the drill"
psql "$THROW_URL" -v ON_ERROR_STOP=1 -c "GRANT dashboard_readonly TO CURRENT_USER;"

echo "==> Verify dashboard_readonly can read api.dashboard_summary"
SUMMARY="$(psql "$THROW_URL" -v ON_ERROR_STOP=1 -q -tAc "SET ROLE dashboard_readonly; SELECT property_count FROM api.dashboard_summary;")"
SUMMARY="$(echo "$SUMMARY" | tr -d '[:space:]')"
if [[ -z "$SUMMARY" || ! "$SUMMARY" =~ ^[0-9]+$ ]]; then
  echo "dashboard_readonly summary query returned unexpected value: '$SUMMARY'" >&2
  exit 1
fi
echo "    property_count=$SUMMARY"

echo "==> Verify dashboard_readonly can read map view"
MAP_ROWS="$(psql "$THROW_URL" -v ON_ERROR_STOP=1 -q -tAc "SET ROLE dashboard_readonly; SELECT COUNT(*) FROM api.dashboard_map_properties;")"
MAP_ROWS="$(echo "$MAP_ROWS" | tr -d '[:space:]')"
echo "    map_rows=$MAP_ROWS"

echo "==> Verify PII search view is denied to dashboard_readonly"
set +e
psql "$THROW_URL" -v ON_ERROR_STOP=1 -c "SET ROLE dashboard_readonly; SELECT owner_info FROM api.dashboard_property_search LIMIT 1;" >/tmp/restore-drill-pii.out 2>/tmp/restore-drill-pii.err
PII_RC=$?
set -e
if [[ "$PII_RC" -eq 0 ]]; then
  echo "Expected permission denied on api.dashboard_property_search for dashboard_readonly" >&2
  cat /tmp/restore-drill-pii.out >&2 || true
  exit 1
fi
if ! grep -qiE 'permission denied|must be owner|not have permission' /tmp/restore-drill-pii.err; then
  echo "PII probe failed for an unexpected reason:" >&2
  cat /tmp/restore-drill-pii.err >&2
  exit 1
fi
echo "    PII search correctly denied"

if [[ "${KEEP_THROW_DB:-}" == "1" ]]; then
  echo "==> KEEP_THROW_DB=1 — leaving $THROW_DB in place"
else
  echo "==> Dropping throwaway database $THROW_DB"
  psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$THROW_DB' AND pid <> pg_backend_pid();" >/dev/null || true
  psql_admin -c "DROP DATABASE IF EXISTS $THROW_DB;"
fi

echo "OK: restore drill passed (dashboard_readonly summary property_count=$SUMMARY)"
