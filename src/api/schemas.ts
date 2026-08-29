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

export const propertyIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const mapQuerySchema = z.object({
  bbox: bboxSchema,
  zoom: z.coerce.number().min(0).max(22).optional(),
  limit: z.coerce.number().int().min(1).max(5_000).optional(),
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
});

export const trendPointSchema = z.object({
  year: numeric,
  avg_market_value: numeric,
  total_market_value: numeric,
  property_count: numeric,
});

export function mapLimitForZoom(zoom: number | undefined, explicit?: number): number {
  if (explicit != null) return explicit;
  if (zoom == null) return 2_000;
  if (zoom < 11) return 400;
  if (zoom < 13) return 1_500;
  if (zoom < 15) return 4_000;
  return 5_000;
}

export function likePattern(value: string): string {
  return `%${value.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
}
