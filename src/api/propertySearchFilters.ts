/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared WHERE-clause builder for property search and CSV export so both
 * endpoints honor the same on-screen filters.
 */

import { likePattern } from './schemas.js';

/** Filter fields shared by search + export (limit/offset/sort handled by callers). */
export type PropertySearchFilters = {
  q?: string;
  city?: string;
  owner?: string;
  parcel?: string;
  landuse?: string;
  minValue?: number;
  maxValue?: number;
  minBeds?: number;
  maxBeds?: number;
  minSqft?: number;
  maxSqft?: number;
};

export type BuiltSearchWhere = {
  whereSql: string;
  params: unknown[];
};

/**
 * Build a parameterized WHERE clause against `api.dashboard_property_search`.
 * Sort column must still be validated by the caller (whitelist only).
 */
export function buildPropertySearchWhere(parsed: PropertySearchFilters): BuiltSearchWhere {
  const where: string[] = ['1=1'];
  const params: unknown[] = [];
  const push = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (parsed.q) {
    const q = likePattern(parsed.q);
    where.push(
      `(situs_address ILIKE ${push(q)} OR parcel_number ILIKE ${push(q)} OR parcel_id ILIKE ${push(q)} OR owner_info ILIKE ${push(q)})`,
    );
  }
  if (parsed.owner) where.push(`owner_info ILIKE ${push(likePattern(parsed.owner))}`);
  if (parsed.parcel) {
    const p = likePattern(parsed.parcel);
    where.push(`(parcel_id ILIKE ${push(p)} OR parcel_number ILIKE ${push(p)})`);
  }
  if (parsed.city) where.push(`situs_city ILIKE ${push(parsed.city)}`);
  if (parsed.landuse) where.push(`landuse_code = ${push(parsed.landuse)}`);
  if (parsed.minValue !== undefined) where.push(`market_value_total >= ${push(parsed.minValue)}`);
  if (parsed.maxValue !== undefined) where.push(`market_value_total <= ${push(parsed.maxValue)}`);
  if (parsed.minBeds !== undefined) where.push(`bedrooms >= ${push(parsed.minBeds)}`);
  if (parsed.maxBeds !== undefined) where.push(`bedrooms <= ${push(parsed.maxBeds)}`);
  if (parsed.minSqft !== undefined) where.push(`living_area >= ${push(parsed.minSqft)}`);
  if (parsed.maxSqft !== undefined) where.push(`living_area <= ${push(parsed.maxSqft)}`);

  return { whereSql: where.join(' AND '), params };
}
