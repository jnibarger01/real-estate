/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pg from 'pg';

const { Pool } = pg;

const explicitUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const connectionString =
  explicitUrl ||
  `postgresql://jacen@/jacen_dev?host=${encodeURIComponent(process.env.PGHOST || '/var/run/postgresql')}`;

export const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const { rows } = await pool.query(sql, params as never[]);
  return rows[0] as T | undefined;
}

export async function queryMany<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(sql, params as never[]);
  return rows as T[];
}

export interface IngestFreshness {
  ok: boolean;
  source: string;
  refreshedAt: string | null;
  ageHours: number | null;
  maxAgeHours: number;
}

export interface DatabaseValidation {
  database: { ok: boolean; latencyMs: number; error?: string };
  postgis: { ok: boolean; version: string | null };
  queryReadiness: { ok: boolean; missing: string[] };
  ingestFreshness: IngestFreshness;
}

export function ingestMaxAgeHours(): number {
  const raw = Number(process.env.INGEST_MAX_AGE_HOURS);
  return Number.isFinite(raw) ? Math.max(0, raw) : 168;
}

export function evaluateIngestFreshness(
  refreshedAt: Date | string | null | undefined,
  maxAgeHours = ingestMaxAgeHours(),
): IngestFreshness {
  if (maxAgeHours === 0) {
    return { ok: true, source: 'mart.residential_properties', refreshedAt: refreshedAt ? String(refreshedAt) : null, ageHours: null, maxAgeHours };
  }
  if (refreshedAt == null || refreshedAt === '') {
    return { ok: false, source: 'mart.residential_properties', refreshedAt: null, ageHours: null, maxAgeHours };
  }
  const stamp = refreshedAt instanceof Date ? refreshedAt : new Date(refreshedAt);
  if (Number.isNaN(stamp.getTime())) {
    return { ok: false, source: 'mart.residential_properties', refreshedAt: String(refreshedAt), ageHours: null, maxAgeHours };
  }
  const ageHours = (Date.now() - stamp.getTime()) / 3_600_000;
  return {
    ok: ageHours <= maxAgeHours,
    source: 'mart.residential_properties',
    refreshedAt: stamp.toISOString(),
    ageHours: Number(ageHours.toFixed(2)),
    maxAgeHours,
  };
}

const REQUIRED_VIEWS = [
  'api.dashboard_summary',
  'api.dashboard_property_search',
  'api.dashboard_property_detail',
  'api.dashboard_value_trends',
  'api.dashboard_map_properties',
  'api.dashboard_transfers',
  'api.ingest_state',
];

export async function inspectDatabase(): Promise<DatabaseValidation> {
  const started = Date.now();
  try {
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - started;
    const postgis = await pool.query<{ extversion: string }>(
      `SELECT extversion FROM pg_extension WHERE extname = 'postgis'`
    );
    const missing: string[] = [];
    for (const name of REQUIRED_VIEWS) {
      const found = await pool.query<{ reg: string | null }>(`SELECT to_regclass($1) AS reg`, [name]);
      if (!found.rows[0]?.reg) missing.push(name);
    }
    const ingestRow = await pool
      .query<{ refreshed_at: Date | string }>(
        `SELECT refreshed_at FROM api.ingest_state WHERE source = $1`,
        ['mart.residential_properties'],
      )
      .catch(() => ({ rows: [] as { refreshed_at: Date | string }[] }));
    const ingestFreshness = evaluateIngestFreshness(ingestRow.rows[0]?.refreshed_at ?? null);
    return {
      database: { ok: true, latencyMs },
      postgis: { ok: Boolean(postgis.rows[0]?.extversion), version: postgis.rows[0]?.extversion ?? null },
      queryReadiness: { ok: missing.length === 0, missing },
      ingestFreshness,
    };
  } catch (error) {
    return {
      database: { ok: false, latencyMs: Date.now() - started, error: 'unreachable' },
      postgis: { ok: false, version: null },
      queryReadiness: { ok: false, missing: REQUIRED_VIEWS },
      ingestFreshness: evaluateIngestFreshness(null),
    };
  }
}

export async function validateDatabaseOrThrow(): Promise<DatabaseValidation> {
  const result = await inspectDatabase();
  if (!result.database.ok) {
    throw new Error('PostgreSQL startup validation failed: cannot connect to jacen_dev / DATABASE_URL');
  }
  if (!result.postgis.ok) {
    throw new Error('PostgreSQL startup validation failed: PostGIS is not installed');
  }
  return result;
}
