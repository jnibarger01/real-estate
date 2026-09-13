/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persists authenticated dashboard filter bookmarks (label + query params).
 * Never stores owner_info / owner_mailing_address. Explicit `owner` filter keys
 * are stripped on write. Tests can force an in-memory backend.
 */

import { randomUUID } from 'node:crypto';
import { pool } from './db/pool.js';

/** Filter keys safe to bookmark. Explicit owner search is excluded (PII). */
export const SAVED_SEARCH_PARAM_KEYS = [
  'q',
  'city',
  'parcel',
  'landuse',
  'minValue',
  'maxValue',
  'minBeds',
  'maxBeds',
  'minSqft',
  'maxSqft',
  'sort',
  'order',
] as const;

export type SavedSearchParamKey = (typeof SAVED_SEARCH_PARAM_KEYS)[number];

export type SavedSearchQueryParams = Partial<Record<SavedSearchParamKey, string | number>>;

export type SavedSearchRecord = {
  id: string;
  username: string;
  label: string;
  query_params: SavedSearchQueryParams;
  created_at: string;
};

type StoreMode = 'auto' | 'memory' | 'postgres';

let mode: StoreMode = 'auto';
let memoryRows: SavedSearchRecord[] = [];
let postgresAvailable: boolean | null = null;

export function resetSavedSearchesStoreForTests(options: { mode?: StoreMode } = {}): void {
  mode = options.mode ?? 'memory';
  memoryRows = [];
  postgresAvailable = mode === 'postgres' ? true : mode === 'memory' ? false : null;
}

export function sanitizeSavedSearchParams(input: unknown): SavedSearchQueryParams {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const raw = input as Record<string, unknown>;
  const out: SavedSearchQueryParams = {};
  for (const key of SAVED_SEARCH_PARAM_KEYS) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (value == null || value === '') continue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (['minValue', 'maxValue', 'minBeds', 'maxBeds', 'minSqft', 'maxSqft'].includes(key)) {
        const n = Number(trimmed);
        if (Number.isFinite(n)) out[key] = n;
      } else {
        out[key] = trimmed.slice(0, 200);
      }
    }
  }
  return out;
}

async function tableReady(): Promise<boolean> {
  if (mode === 'memory') return false;
  if (mode === 'postgres') return true;
  if (postgresAvailable != null) return postgresAvailable;
  try {
    const result = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass('api.saved_searches') AS reg`,
    );
    postgresAvailable = Boolean(result.rows[0]?.reg);
  } catch {
    postgresAvailable = false;
  }
  return postgresAvailable;
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

export async function listSavedSearches(username: string): Promise<SavedSearchRecord[]> {
  if (await tableReady()) {
    const { rows } = await pool.query<{
      id: string;
      username: string;
      label: string;
      query_params: SavedSearchQueryParams;
      created_at: Date | string;
    }>(
      `SELECT id::text, username, label, query_params, created_at
       FROM api.saved_searches
       WHERE username = $1
       ORDER BY created_at DESC`,
      [username],
    );
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      label: r.label,
      query_params: sanitizeSavedSearchParams(r.query_params),
      created_at: toIso(r.created_at),
    }));
  }

  return memoryRows
    .filter((r) => r.username === username)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createSavedSearch(input: {
  username: string;
  label: string;
  query_params: unknown;
}): Promise<SavedSearchRecord> {
  const label = input.label.trim().slice(0, 120);
  if (!label) throw Object.assign(new Error('label_required'), { status: 400 });
  const query_params = sanitizeSavedSearchParams(input.query_params);
  const id = randomUUID();
  const created_at = new Date().toISOString();
  const row: SavedSearchRecord = {
    id,
    username: input.username,
    label,
    query_params,
    created_at,
  };

  if (await tableReady()) {
    await pool.query(
      `INSERT INTO api.saved_searches (id, username, label, query_params)
       VALUES ($1::uuid, $2, $3, $4::jsonb)`,
      [id, input.username, label, JSON.stringify(query_params)],
    );
    return row;
  }

  memoryRows.unshift(row);
  return row;
}

export async function deleteSavedSearch(username: string, id: string): Promise<boolean> {
  if (await tableReady()) {
    const result = await pool.query(
      `DELETE FROM api.saved_searches WHERE id = $1::uuid AND username = $2`,
      [id, username],
    );
    return (result.rowCount ?? 0) > 0;
  }

  const before = memoryRows.length;
  memoryRows = memoryRows.filter((r) => !(r.id === id && r.username === username));
  return memoryRows.length < before;
}
