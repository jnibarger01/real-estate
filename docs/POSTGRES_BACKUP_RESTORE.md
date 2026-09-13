# Postgres backup and restore drill

Logical backups for the dashboard database (`jacen_dev` / `DATABASE_URL`). Goal: practice restore onto a **throwaway** database and confirm `api.dashboard_*` works under role `dashboard_readonly`.

This does **not** restore production in place. Never point these steps at a live prod URL without an explicit ops change.

## Prerequisites

- `pg_dump`, `pg_restore`, `psql`, and `createdb`/`dropdb` (PostgreSQL 16+ client tools)
- A reachable source database with PostGIS and the API contract applied (`sql/api_dashboard_views.sql`)
- Cluster privileges to create a throwaway database and (if missing) roles `dashboard_app` / `dashboard_readonly`

## PII and git hygiene

- Production and local `jacen_dev` dumps include **owner PII** (`owner_info`, `owner_mailing_address` on search/detail views and underlying mart rows). Treat dump files as sensitive.
- Store dumps only under `./backups/` (or `BACKUP_DIR`). That directory and `*.dump` are gitignored — **never commit backups**.
- Share dumps only over approved secure channels. Prefer wiping throwaway DBs after the drill.
- CI uses `tests/fixtures/minimal.sql` (synthetic names only). That path is non-production and acceptable to dump/restore in automation.

## 1. Backup

```bash
# Uses DATABASE_URL, else the peer-auth local default in the script.
bun run db:backup
# or
scripts/backup-postgres.sh "$DATABASE_URL" ./backups
```

Writes a custom-format dump: `backups/jacen-dashboard-<UTC>.dump`.

## 2. Restore to a throwaway database

Pick a disposable name (example: `jacen_restore_drill`). Do not reuse production DB names.

```bash
SRC_URL="${DATABASE_URL:-postgresql://jacen@/jacen_dev?host=/var/run/postgresql}"
DUMP="$(ls -1t ./backups/jacen-dashboard-*.dump | head -1)"
THROW="jacen_restore_drill"

# Drop leftover drill DB if present, then create empty target.
dropdb --if-exists "$THROW"
createdb "$THROW"

# Roles are cluster-level; pg_dump does not create them. Ensure they exist.
psql -d "$THROW" -v ON_ERROR_STOP=1 <<'SQL'
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

pg_restore --no-owner --dbname="$THROW" "$DUMP"
```

Equivalent one-shot helper (same steps, then verify + cleanup):

```bash
scripts/restore-drill.sh
# or with explicit URL / dump:
scripts/restore-drill.sh "$DATABASE_URL" ./backups/jacen-dashboard-….dump
```

## 3. Verify `dashboard_readonly` can query the contract

`dashboard_readonly` may SELECT aggregates/map/transfers/`ingest_state` only — not owner-PII search/detail views. Acceptance check:

```bash
psql -d jacen_restore_drill -v ON_ERROR_STOP=1 <<'SQL'
-- Needed unless the connecting role is already a member / superuser.
GRANT dashboard_readonly TO CURRENT_USER;
SET ROLE dashboard_readonly;
SELECT property_count FROM api.dashboard_summary;
SELECT COUNT(*) AS map_rows FROM api.dashboard_map_properties;
RESET ROLE;
-- Expect: permission denied (PII views are not granted to dashboard_readonly)
SET ROLE dashboard_readonly;
SELECT owner_info FROM api.dashboard_property_search LIMIT 1;
SQL
```

Success criteria:

- `api.dashboard_summary` returns a row (CI fixture: `property_count = 3`)
- `api.dashboard_map_properties` is readable
- Selecting `owner_info` from `api.dashboard_property_search` as `dashboard_readonly` fails with insufficient privilege

Optional fuller smoke (still as `dashboard_readonly`):

```sql
SET ROLE dashboard_readonly;
SELECT COUNT(*) FROM api.dashboard_property_types;
SELECT COUNT(*) FROM api.dashboard_value_bands;
SELECT COUNT(*) FROM api.dashboard_transfers;
SELECT source, refreshed_at FROM api.ingest_state;
```

## 4. Cleanup

```bash
dropdb --if-exists jacen_restore_drill
# optional: shred local dumps when finished
# rm -f ./backups/jacen-dashboard-*.dump
```

## CI path (fixture, non-PII)

GitHub Actions already loads `tests/fixtures/minimal.sql` + `sql/api_dashboard_views.sql` into `realestate_test`. The workflow then runs `scripts/restore-drill.sh` against that database: dump → restore into `realestate_restore_drill` → `dashboard_readonly` summary query → drop throwaway DB. No dump artifact is uploaded or committed.

## Related

- Backup script: `scripts/backup-postgres.sh` (`bun run db:backup`)
- Drill helper: `scripts/restore-drill.sh`
- API contract: `docs/DB_CONTRACT.md`, `sql/api_dashboard_views.sql`
