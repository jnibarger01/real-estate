/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { queryMany, queryOne } from '../db/pool.js';
import {
  createSavedSearchSchema,
  distributionsQuerySchema,
  likePattern,
  mapGeomSqlExpression,
  mapGeometryMode,
  mapLimitForZoom,
  mapQuerySchema,
  mapSummarySchema,
  propertyIdParamSchema,
  salesQuerySchema,
  savedSearchIdParamSchema,
  searchQuerySchema,
  summaryResponseSchema,
  trendPointSchema,
} from '../schemas.js';
import { resolveDashboardUsername } from '../auth.js';
import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
} from '../savedSearchesStore.js';

const router = Router();

function numeric(value: unknown): number {
  return value == null || value === '' ? 0 : Number(value);
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

router.get('/dashboard/summary', async (_req, res, next) => {
  try {
    const row = await queryOne<Record<string, unknown>>(`SELECT * FROM api.dashboard_summary`);
    if (!row) return res.status(404).json({ error: 'summary unavailable' });
    const latest = await queryOne<{ year: number; avg_market_value: string }>(
      `SELECT year, avg_market_value FROM api.dashboard_value_trends ORDER BY year DESC LIMIT 1`
    );
    const prior = latest
      ? await queryOne<{ avg_market_value: string }>(
          `SELECT avg_market_value FROM api.dashboard_value_trends WHERE year = $1`,
          [Number(latest.year) - 1]
        )
      : undefined;
    const yoy =
      latest && prior && Number(prior.avg_market_value) > 0
        ? Number((((Number(latest.avg_market_value) - Number(prior.avg_market_value)) / Number(prior.avg_market_value)) * 100).toFixed(2))
        : null;
    const ingest = await queryOne<{ refreshed_at: Date | string }>(
      `SELECT refreshed_at FROM api.ingest_state WHERE source = $1`,
      ['mart.residential_properties']
    ).catch(() => undefined);
    const refreshedAt =
      ingest?.refreshed_at instanceof Date
        ? ingest.refreshed_at.toISOString()
        : ingest?.refreshed_at
          ? String(ingest.refreshed_at)
          : null;
    const body = summaryResponseSchema.parse({
      property_count: row.property_count ?? row.total_properties,
      total_properties: row.total_properties ?? row.property_count,
      distinct_cities: row.distinct_cities,
      distinct_zips: row.distinct_zips,
      avg_value: row.avg_value ?? row.avg_market_value,
      avg_market_value: row.avg_market_value ?? row.avg_value,
      median_value: row.median_value ?? row.median_market_value,
      median_market_value: row.median_market_value ?? row.median_value,
      total_assessed_value: row.total_assessed_value ?? 0,
      total_market_value: row.total_market_value,
      max_market_value: row.max_market_value,
      median_sqft: row.median_sqft,
      median_price_per_sqft: row.median_price_per_sqft,
      with_sqft: row.with_sqft,
      under_1m: row.under_1m,
      over_1m: row.over_1m,
      yoy_value_change_pct: yoy,
      yoy_from_year: latest ? Number(latest.year) - 1 : null,
      yoy_to_year: latest ? Number(latest.year) : null,
      queried_at: new Date().toISOString(),
      refreshed_at: refreshedAt,
    });
    res.json(body);
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/value-distribution', async (_req, res, next) => {
  try {
    const rows = await queryMany<Record<string, unknown>>(`SELECT * FROM api.dashboard_value_bands`);
    res.json(rows.map((r) => ({
      bucket: numeric(r.bucket),
      bucket_min: numeric(r.bucket_min),
      bucket_max: numeric(r.bucket_max),
      property_count: numeric(r.property_count),
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/sales-trends', async (_req, res, next) => {
  try {
    const rows = await queryMany<Record<string, unknown>>(`SELECT * FROM api.dashboard_value_trends ORDER BY year`);
    res.json(rows.map((r) => trendPointSchema.parse(r)));
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/property-types', async (_req, res, next) => {
  try {
    const rows = await queryMany<Record<string, unknown>>(`SELECT * FROM api.dashboard_property_types`);
    res.json(rows.map((r) => ({
      code: String(r.code ?? ''),
      label: String(r.label ?? ''),
      property_count: numeric(r.property_count),
      avg_market_value: numeric(r.avg_market_value),
      median_market_value: numeric(r.median_market_value),
      pct: numeric(r.pct),
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/distributions', async (req, res, next) => {
  try {
    const parsed = distributionsQuerySchema.parse(req.query);
    const view =
      parsed.dimension === 'value_band'
        ? 'api.dashboard_value_bands'
        : parsed.dimension === 'assessment_class'
          ? 'api.dashboard_assessment_classes'
          : 'api.dashboard_property_types';
    const rows = await queryMany<Record<string, unknown>>(`SELECT * FROM ${view}`);
    res.json({
      dimension: parsed.dimension,
      items: rows.map((r) => ({
        code: r.code != null ? String(r.code) : r.bucket != null ? String(r.bucket) : null,
        label: r.label != null ? String(r.label) : r.bucket_max != null ? `${r.bucket_min}–${r.bucket_max}` : null,
        bucket: r.bucket != null ? numeric(r.bucket) : undefined,
        bucket_min: r.bucket_min != null ? numeric(r.bucket_min) : undefined,
        bucket_max: r.bucket_max != null ? numeric(r.bucket_max) : undefined,
        property_count: numeric(r.property_count),
        avg_market_value: r.avg_market_value != null ? numeric(r.avg_market_value) : undefined,
        median_market_value: r.median_market_value != null ? numeric(r.median_market_value) : undefined,
        pct: r.pct != null ? numeric(r.pct) : undefined,
      })),
    });
  } catch (err) {
    next(err);
  }
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
      const q = likePattern(parsed.q);
      where.push(`(situs_address ILIKE ${push(q)} OR parcel_number ILIKE ${push(q)} OR parcel_id ILIKE ${push(q)} OR owner_info ILIKE ${push(q)})`);
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

    const sortColumn = parsed.sort;
    const sortDir = parsed.order === 'asc' ? 'ASC' : 'DESC';
    const whereSql = where.join(' AND ');
    const results = await queryMany<Record<string, unknown>>(
      `SELECT * FROM api.dashboard_property_search
       WHERE ${whereSql}
       ORDER BY ${sortColumn} ${sortDir} NULLS LAST
       LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
      [...filterParams, parsed.limit, parsed.offset]
    );
    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM api.dashboard_property_search WHERE ${whereSql}`,
      filterParams
    );
    res.json({
      results,
      total: Number(countRow?.count ?? 0),
      limit: parsed.limit,
      offset: parsed.offset,
      sort: parsed.sort,
      order: parsed.order,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/properties/:id', async (req, res, next) => {
  try {
    const { id } = propertyIdParamSchema.parse(req.params);
    const parcels = await queryMany<Record<string, unknown>>(
      `SELECT * FROM api.dashboard_property_detail WHERE property_id = $1 ORDER BY parcel_id`,
      [id]
    );
    if (!parcels.length) {
      return res.status(404).json({ error: 'not_found', message: 'Property not found' });
    }
    const primary = parcels[0];
    res.json({
      property_id: id,
      assessment: {
        tax_year: primary.tax_year ?? null,
        assessed_value_total: nullableNumber(primary.assessed_value_total),
        market_value_total: nullableNumber(primary.market_value_total),
        year_built: nullableNumber(primary.year_built),
        bedrooms: nullableNumber(primary.bedrooms),
        full_baths: nullableNumber(primary.full_baths),
        half_baths: nullableNumber(primary.half_baths),
        total_sqft: nullableNumber(primary.total_sqft),
        living_area: nullableNumber(primary.living_area),
        landuse_code: primary.landuse_code ?? null,
        landuse_description: primary.landuse_description ?? null,
      },
      parcel: {
        parcel_id: primary.parcel_id,
        parcel_number: primary.parcel_number ?? null,
        apn_display: primary.apn_display ?? null,
        situs_address: primary.situs_address ?? null,
        situs_city: primary.situs_city ?? null,
        situs_zip: primary.situs_zip ?? null,
      },
      ownership: {
        owner_info: primary.owner_info ?? null,
        owner_mailing_address: primary.owner_mailing_address ?? null,
      },
      geometry: {
        type: 'FeatureCollection',
        features: parcels.map((p) => ({
          type: 'Feature',
          properties: { parcel_id: p.parcel_id, property_id: id },
          geometry: p.geometry,
        })),
        centroid: primary.centroid ?? null,
        lng: nullableNumber(primary.lng),
        lat: nullableNumber(primary.lat),
      },
      parcels: parcels.map((p) => ({
        parcel_id: p.parcel_id,
        parcel_number: p.parcel_number ?? null,
        apn_display: p.apn_display ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/market/trends', async (_req, res, next) => {
  try {
    const rows = await queryMany<Record<string, unknown>>(
      `SELECT * FROM api.dashboard_value_trends ORDER BY year`
    );
    res.json({
      metric: 'assessed_market_value',
      semantics: 'assessor_year_values',
      note: 'Series is Jackson County assessor market value by tax year, not closed MLS sales.',
      series: rows.map((r) => trendPointSchema.parse(r)),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/sales', async (req, res, next) => {
  try {
    const parsed = salesQuerySchema.parse(req.query);
    const where: string[] = ['1=1'];
    const params: unknown[] = [];
    if (parsed.q) {
      params.push(likePattern(parsed.q));
      const idx = `$${params.length}`;
      where.push(`(situs_address ILIKE ${idx} OR parcel_number ILIKE ${idx} OR recording_num ILIKE ${idx})`);
    }
    const rows = await queryMany<Record<string, unknown>>(
      `SELECT property_id, parcel_id, parcel_number, situs_address, situs_city, tax_year, recording_num
       FROM api.dashboard_transfers
       WHERE ${where.join(' AND ')}
       ORDER BY tax_year DESC NULLS LAST, recording_num
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parsed.limit, parsed.offset]
    );
    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM api.dashboard_transfers WHERE ${where.join(' AND ')}`,
      params
    );
    res.json({
      available: true,
      semantics: 'assessor_recording_reference',
      note: 'jacen_dev has no sale price or transfer date. These rows expose assessor recording_num only.',
      results: rows,
      total: Number(countRow?.count ?? 0),
      limit: parsed.limit,
      offset: parsed.offset,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/map/properties', async (req, res, next) => {
  try {
    const parsed = mapQuerySchema.parse(req.query);
    const [minLng, minLat, maxLng, maxLat] = parsed.bbox;
    const limit = mapLimitForZoom(parsed.zoom, parsed.limit);
    const geometry = mapGeometryMode(parsed.zoom);
    const geomExpr = mapGeomSqlExpression(geometry, parsed.zoom);
    const rows = await queryMany<{
      parcel_id: string;
      property_id: number;
      market_value_total: number;
      situs_address: string | null;
      bbox_total: string;
      geom: Record<string, unknown>;
    }>(
      `SELECT
         parcel_id,
         property_id,
         market_value_total,
         situs_address,
         COUNT(*) OVER()::text AS bbox_total,
         ${geomExpr} AS geom
       FROM api.dashboard_map_properties
       WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
       LIMIT $5`,
      [minLng, minLat, maxLng, maxLat, limit]
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
          situs_address: r.situs_address,
        },
        geometry: r.geom,
      })),
      total,
      limit,
      zoom: parsed.zoom ?? null,
      geometry,
      truncated: rows.length < total,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/map/summary', async (req, res, next) => {
  try {
    const parsed = mapSummarySchema.parse(req.query);
    const [minLng, minLat, maxLng, maxLat] = parsed.bbox;
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


router.get('/dashboard/saved-searches', async (req, res, next) => {
  try {
    const username = resolveDashboardUsername(req);
    if (!username) return res.status(401).json({ error: 'unauthorized' });
    const items = await listSavedSearches(username);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/dashboard/saved-searches', async (req, res, next) => {
  try {
    const username = resolveDashboardUsername(req);
    if (!username) return res.status(401).json({ error: 'unauthorized' });
    const parsed = createSavedSearchSchema.parse(req.body ?? {});
    const row = await createSavedSearch({
      username,
      label: parsed.label,
      query_params: parsed.query_params,
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.delete('/dashboard/saved-searches/:id', async (req, res, next) => {
  try {
    const username = resolveDashboardUsername(req);
    if (!username) return res.status(401).json({ error: 'unauthorized' });
    const { id } = savedSearchIdParamSchema.parse(req.params);
    const deleted = await deleteSavedSearch(username, id);
    if (!deleted) return res.status(404).json({ error: 'not_found', message: 'Saved search not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
