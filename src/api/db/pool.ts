/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pg from 'pg';

const { Pool } = pg;

// Connection priority:
//   1. DATABASE_URL (production / external hosts)
//   2. SUPABASE_DB_URL (legacy .env name)
//   3. Local peer-auth socket to the jacen_dev database
const explicitUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const connectionString =
  explicitUrl ||
  `postgresql://jacen@/jacen_dev?host=${encodeURIComponent(process.env.PGHOST || '/var/run/postgresql')}`;

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

/**
 * Single-row convenience helper: returns the first row or undefined.
 */
export async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const { rows } = await pool.query(sql, params as never[]);
  return rows[0] as T | undefined;
}

/**
 * Multi-row convenience helper.
 */
export async function queryMany<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(sql, params as never[]);
  return rows as T[];
}