/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { z } from 'zod';
import { queryMany, queryOne } from '../db/pool.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/dashboard/summary
// ---------------------------------------------------------------------------
router.get('/dashboard/summary', async (_req, res, next) => {
  try {
    const row = await queryOne<Record<string, unknown>>(`SELECT * FROM api.dashboard_summary_mv`);
    const pctChangeQuery = `
      WITH trends AS (SELECT * FROM api.dashboard_value_trends_mv)
      SELECT
        ROUND(((a.avg_market_value - b.avg_market_value)::numeric / b.avg_market_value) * 100, 2) AS yoy_value_change_pct
      FROM trends a
      JOIN trends b ON a.year = (SELECT MAX(year) FROM trends) AND b.year = (SELECT MAX(year) - 1 FROM trends)
      LIMIT 1`;
    const pct = await queryOne<{ yoy_value_change_pct: string | number }>(pctChangeQuery);
    if (!row) return res.status(404).json({ error: 'summary unavailable' });
    const numeric = (v: unknown): number => (v == null ? 0 : Number(v));
    res.json({
      total_properties: numeric(row.total_properties),
      distinct_cities: numeric(row.distinct_cities),
      distinct_zips: numeric(row.distinct_zips),
      avg_market_value: numeric(row.avg_market_value),
      median_market_value: numeric(row.median_market_value),
      total_market_value: numeric(row.total_market_value),
      max_market_value: numeric(row.max_market_value),
      median_sqft: numeric(row.median_sqft),
      median_price_per_sqft: numeric(row.median_price_per_sqft),
      with_sqft: numeric(row.with_sqft),
      under_1m: numeric(row.under_1m),
      over_1m: numeric(row.over_1m),
      yoy_value_change_pct: pct ? Number(pct.yoy_value_change_pct) : null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/value-distribution
// ---------------------------------------------------------------------------
router.get('/dashboard/value-distribution', async (_req, res, next) => {
  try {
    const rows = await queryMany<{
      bucket: number;
      bucket_min: number;
      bucket_max: number;
      property_count: string;
    }>(`SELECT * FROM api.dashboard_value_distribution`);
    res.json(rows.map((r) => ({ ...r, property_count: Number(r.property_count) })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/sales-trends
// No historical sales transactions exist in the database; expose the
// neighboring year-over-year market value series so the widget stays real.
// ---------------------------------------------------------------------------
router.get('/dashboard/sales-trends', async (_req, res, next) => {
  try {
    const rows = await queryMany<{
      year: number;
      avg_market_value: string;
      total_market_value: string;
      property_count: string;
    }>(`SELECT * FROM api.dashboard_value_trends_mv`);
    res.json(rows.map((r) => ({
      year: Number(r.year),
      avg_market_value: Number(r.avg_market_value),
      total_market_value: Number(r.total_market_value),
      property_count: Number(r.property_count),
    })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/property-types
// ---------------------------------------------------------------------------
router.get('/dashboard/property-types', async (_req, res, next) => {
  try {
    const rows = await queryMany<{
      code: string;
      label: string;
      property_count: string;
      avg_market_value: string;
      median_market_value: string;
      pct: string;
    }>(`SELECT * FROM api.dashboard_property_types`);
    res.json(rows.map((r) => ({
      code: r.code,
      label: r.label,
      property_count: Number(r.property_count),
      avg_market_value: Number(r.avg_market_value),
      median_market_value: Number(r.median_market_value),
      pct: Number(r.pct),
    })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/properties/search
// ---------------------------------------------------------------------------
const searchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  landuse: z.string().trim().max(20).optional(),
  minValue: z.coerce.number().int().nonnegative().optional(),
  maxValue: z.coerce.number().int().nonnegative().optional(),
  minBeds: z.coerce.number().int().nonnegative().optional(),
  maxBeds: z.coerce.number().int().nonnegative().optional(),
  minSqft: z.coerce.number().int().nonnegative().optional(),
  maxSqft: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

router.get('/properties/search', async (req, res, next) => {
  try {
    const parsed = searchQuerySchema.parse(req.query);
    const where: string[] = ['1=1'];
    const filterParams: unknown[] = [];
    const push = (value: unknown) => {
      filterParams.push(value);
      return `$${filterParams.length}`;
    };

    if (parsed.q) {
      const q = `%${parsed.q.replace(/[%_]/g, (m) => '\\' + m)}%`;
      where.push(`(situs_address ILIKE ${push(q)} OR parcel_number ILIKE ${push(q)} OR parcel_id ILIKE ${push(q)} OR owner_info ILIKE ${push(q)})`);
    }
    if (parsed.city) where.push(`situs_city ILIKE ${push(parsed.city)}`);
    if (parsed.landuse) where.push(`landuse_code = ${push(parsed.landuse)}`);
    if (parsed.minValue !== undefined) where.push(`market_value_total >= ${push(parsed.minValue)}`);
    if (parsed.maxValue !== undefined) where.push(`market_value_total <= ${push(parsed.maxValue)}`);
    if (parsed.minBeds !== undefined) where.push(`bedrooms >= ${push(parsed.minBeds)}`);
    if (parsed.maxBeds !== undefined) where.push(`bedrooms <= ${push(parsed.maxBeds)}`);
    if (parsed.minSqft !== undefined) where.push(`living_area >= ${push(parsed.minSqft)}`);
    if (parsed.maxSqft !== undefined) where.push(`living_area <= ${push(parsed.maxSqft)}`);

    const whereSql = where.join(' AND ');
    const results = await queryMany<Record<string, unknown>>(
      `SELECT * FROM api.dashboard_property_search WHERE ${whereSql} ORDER BY market_value_total DESC LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
      [...filterParams, parsed.limit, parsed.offset]
    );
    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM api.dashboard_property_search WHERE ${whereSql}`,
      filterParams
    );
    res.json({ results, total: Number(countRow?.count ?? 0), limit: parsed.limit, offset: parsed.offset });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/map/properties?bbox=minLng,minLat,maxLng,maxLat[&limit]
// ---------------------------------------------------------------------------
const mapQuerySchema = z.object({
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .describe('minLng,minLat,maxLng,maxLat'),
  limit: z.coerce.number().int().min(1).max(20000).default(5000),
});

router.get('/map/properties', async (req, res, next) => {
  try {
    const parsed = mapQuerySchema.parse(req.query);
    const [minLng, minLat, maxLng, maxLat] = parsed.bbox.split(',').map(Number);
    const rows = await queryMany<{
      parcel_id: string;
      property_id: number;
      market_value_total: number;
      bbox_total: string;
      geom: Record<string, unknown>;
    }>(
      `SELECT
         parcel_id,
         property_id,
         market_value_total,
         COUNT(*) OVER()::text AS bbox_total,
         ST_AsGeoJSON(geom::geometry, 6)::jsonb AS geom
       FROM api.dashboard_map_properties
       WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
       LIMIT $5`,
      [minLng, minLat, maxLng, maxLat, parsed.limit]
    );

    const total = Number(rows[0]?.bbox_total ?? rows.length);
    res.json({
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        properties: {
          parcel_id: r.parcel_id,
          property_id: r.property_id,
          market_value_total: Number(r.market_value_total),
        },
        geometry: r.geom,
      })),
      total,
      limit: parsed.limit,
      truncated: rows.length < total,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/map/summary?bbox=...  (aggregates for the visible viewport)
// ---------------------------------------------------------------------------
const mapSummarySchema = z.object({
  bbox: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/),
});

router.get('/map/summary', async (req, res, next) => {
  try {
    const parsed = mapSummarySchema.parse(req.query);
    const [minLng, minLat, maxLng, maxLat] = parsed.bbox.split(',').map(Number);
    const rows = await queryMany<{ code: string; label: string; property_count: string }>(
      `SELECT landuse_code AS code, landuse_description AS label, COUNT(*) AS property_count
       FROM api.dashboard_map_properties
       WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
       GROUP BY landuse_code, landuse_description
       ORDER BY property_count DESC`,
      [minLng, minLat, maxLng, maxLat]
    );
    res.json(rows.map((r) => ({ ...r, property_count: Number(r.property_count) })));
  } catch (err) {
    next(err);
  }
});

export default router;