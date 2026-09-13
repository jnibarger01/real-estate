/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
const numeric = z.coerce.number();

export const bboxSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
  .transform((value, ctx) => {
    const [minLng, minLat, maxLng, maxLat] = value.split(',').map(Number);
    if (
      minLng < -180 || maxLng > 180 ||
      minLat < -90 || maxLat > 90 ||
      minLng >= maxLng || minLat >= maxLat
    ) {
      ctx.addIssue({ code: 'custom', message: 'bbox must be ordered and within coordinate ranges' });
      return z.NEVER;
    }
    if (maxLng - minLng > 1 || maxLat - minLat > 1) {
      ctx.addIssue({ code: 'custom', message: 'bbox span must be at most 1 degree per axis' });
      return z.NEVER;
    }
    return [minLng, minLat, maxLng, maxLat] as [number, number, number, number];
  });

export const SORT_FIELDS = [
  'market_value_total',
  'assessed_value_total',
  'situs_address',
  'parcel_number',
  'owner_info',
  'year_built',
  'total_sqft',
  'bedrooms',
] as const;

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  owner: z.string().trim().max(200).optional(),
  parcel: z.string().trim().max(64).optional(),
  landuse: z.string().trim().max(20).optional(),
  minValue: z.coerce.number().int().nonnegative().optional(),
  maxValue: z.coerce.number().int().nonnegative().optional(),
  minBeds: z.coerce.number().int().nonnegative().optional(),
  maxBeds: z.coerce.number().int().nonnegative().optional(),
  minSqft: z.coerce.number().int().nonnegative().optional(),
  maxSqft: z.coerce.number().int().nonnegative().optional(),
  sort: z.enum(SORT_FIELDS).default('market_value_total'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().nonnegative().max(100_000).default(0),
});

/** Hard cap on rows returned by GET /api/properties/export.csv (documented in README). */
const boolish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'yes', 'no'])])
  .optional()
  .transform((value) => {
    if (value == null) return false;
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1' || value === 'yes';
  });

/** Same filters as search; higher row cap; optional PII with explicit confirm. */
export const exportQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  owner: z.string().trim().max(200).optional(),
  parcel: z.string().trim().max(64).optional(),
  landuse: z.string().trim().max(20).optional(),
  minValue: z.coerce.number().int().nonnegative().optional(),
  maxValue: z.coerce.number().int().nonnegative().optional(),
  minBeds: z.coerce.number().int().nonnegative().optional(),
  maxBeds: z.coerce.number().int().nonnegative().optional(),
  minSqft: z.coerce.number().int().nonnegative().optional(),
  maxSqft: z.coerce.number().int().nonnegative().optional(),
  sort: z.enum(SORT_FIELDS).default('market_value_total'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(10_000).default(10_000),
  include_pii: boolish,
  confirm_pii: boolish,
});

export const propertyIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** Hard cap on features returned by GET /api/map/properties (documented in README). */
export const MAP_MAX_FEATURES = 5_000;

/** Max bbox span per axis (degrees) accepted by /api/map/*. */
export const MAP_MAX_BBOX_SPAN_DEG = 1;

export const mapQuerySchema = z.object({
  bbox: bboxSchema,
  zoom: z.coerce.number().min(0).max(22).optional(),
  limit: z.coerce.number().int().min(1).max(MAP_MAX_FEATURES).optional(),
});

export const mapSummarySchema = z.object({
  bbox: bboxSchema,
});

export const distributionsQuerySchema = z.object({
  dimension: z.enum(['property_type', 'value_band', 'assessment_class']).default('property_type'),
});

export const salesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().nonnegative().max(100_000).default(0),
});

export const summaryResponseSchema = z.object({
  property_count: numeric,
  total_properties: numeric,
  distinct_cities: numeric,
  distinct_zips: numeric,
  avg_value: numeric,
  avg_market_value: numeric,
  median_value: numeric,
  median_market_value: numeric,
  total_assessed_value: numeric,
  total_market_value: numeric,
  max_market_value: numeric,
  median_sqft: numeric.nullable(),
  median_price_per_sqft: numeric.nullable(),
  with_sqft: numeric,
  under_1m: numeric,
  over_1m: numeric,
  yoy_value_change_pct: numeric.nullable(),
  yoy_from_year: numeric.nullable(),
  yoy_to_year: numeric.nullable(),
  queried_at: z.string(),
  refreshed_at: z.string().nullable(),
  ingest_freshness: z.object({
    ok: z.boolean(),
    source: z.string(),
    refreshedAt: z.string().nullable(),
    ageHours: z.number().nullable(),
    maxAgeHours: z.number(),
  }),
});

export const trendPointSchema = z.object({
  year: numeric,
  avg_market_value: numeric,
  total_market_value: numeric,
  property_count: numeric,
});

export type MapGeometryMode = 'centroid' | 'simplified' | 'polygon';

/**
 * Zoom-tier feature caps for viewport loads. Explicit `limit` still cannot exceed MAP_MAX_FEATURES.
 * zoom < 11 → 400 | < 13 → 1_500 | < 15 → 4_000 | else → 5_000 (default without zoom: 2_000)
 */
export function mapLimitForZoom(zoom: number | undefined, explicit?: number): number {
  if (explicit != null) return Math.min(explicit, MAP_MAX_FEATURES);
  if (zoom == null) return 2_000;
  if (zoom < 11) return 400;
  if (zoom < 13) return 1_500;
  if (zoom < 15) return 4_000;
  return MAP_MAX_FEATURES;
}

/** Geometry strategy by zoom: points at low zoom, simplified polygons mid, full parcels close-in. */
export function mapGeometryMode(zoom: number | undefined): MapGeometryMode {
  const z = zoom ?? 12;
  if (z < 13) return 'centroid';
  if (z < 15) return 'simplified';
  return 'polygon';
}

/** Douglas-Peucker tolerance (degrees) for ST_SimplifyPreserveTopology at mid zooms. */
export function mapSimplifyTolerance(zoom: number | undefined): number {
  const z = zoom ?? 14;
  if (z < 14) return 0.0003;
  return 0.0001;
}

/** PostGIS expression selecting GeoJSON geometry for the given zoom mode (source: api.dashboard_map_properties). */
export function mapGeomSqlExpression(mode: MapGeometryMode, zoom?: number): string {
  if (mode === 'centroid') {
    return 'ST_AsGeoJSON(centroid::geometry, 6)::jsonb';
  }
  if (mode === 'simplified') {
    const tol = mapSimplifyTolerance(zoom);
    return `ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom::geometry, ${tol}), 5)::jsonb`;
  }
  return 'ST_AsGeoJSON(geom::geometry, 6)::jsonb';
}

/** Clamp a viewport bbox to MAP_MAX_BBOX_SPAN_DEG centered on the same midpoint (client safety). */
export function clampMapBbox(
  bbox: [number, number, number, number],
  maxSpan = MAP_MAX_BBOX_SPAN_DEG,
): [number, number, number, number] {
  let [minLng, minLat, maxLng, maxLat] = bbox;
  const midLng = (minLng + maxLng) / 2;
  const midLat = (minLat + maxLat) / 2;
  if (maxLng - minLng > maxSpan) {
    minLng = midLng - maxSpan / 2;
    maxLng = midLng + maxSpan / 2;
  }
  if (maxLat - minLat > maxSpan) {
    minLat = midLat - maxSpan / 2;
    maxLat = midLat + maxSpan / 2;
  }
  return [
    Math.max(-180, minLng),
    Math.max(-90, minLat),
    Math.min(180, maxLng),
    Math.min(90, maxLat),
  ];
}

export function likePattern(value: string): string {
  return `%${value.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
}

export const savedSearchQueryParamsSchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    parcel: z.string().trim().max(64).optional(),
    landuse: z.string().trim().max(20).optional(),
    minValue: z.coerce.number().int().nonnegative().optional(),
    maxValue: z.coerce.number().int().nonnegative().optional(),
    minBeds: z.coerce.number().int().nonnegative().optional(),
    maxBeds: z.coerce.number().int().nonnegative().optional(),
    minSqft: z.coerce.number().int().nonnegative().optional(),
    maxSqft: z.coerce.number().int().nonnegative().optional(),
    sort: z.enum(SORT_FIELDS).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .strict();

export const createSavedSearchSchema = z.object({
  label: z.string().trim().min(1).max(120),
  query_params: savedSearchQueryParamsSchema.default({}),
});

export const savedSearchIdParamSchema = z.object({
  id: z.string().uuid(),
});
