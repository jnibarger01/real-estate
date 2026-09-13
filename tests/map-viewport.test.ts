/**
 * Unit tests for map viewport caps / bbox / geometry mode.
 * Pure schema helpers — no PostGIS required.
 */
import { describe, expect, it } from 'vitest';
import {
  MAP_MAX_FEATURES,
  MAP_MAX_BBOX_SPAN_DEG,
  bboxSchema,
  clampMapBbox,
  mapGeomSqlExpression,
  mapGeometryMode,
  mapLimitForZoom,
  mapQuerySchema,
  mapSimplifyTolerance,
} from '../src/api/schemas.ts';

describe('MAP_MAX_FEATURES documentation constant', () => {
  it('is 5000', () => {
    expect(MAP_MAX_FEATURES).toBe(5000);
    expect(MAP_MAX_BBOX_SPAN_DEG).toBe(1);
  });
});

describe('mapLimitForZoom', () => {
  it('applies zoom tiers and hard-caps explicit limits', () => {
    expect(mapLimitForZoom(undefined)).toBe(2000);
    expect(mapLimitForZoom(8)).toBe(400);
    expect(mapLimitForZoom(11)).toBe(1500);
    expect(mapLimitForZoom(12.9)).toBe(1500);
    expect(mapLimitForZoom(13)).toBe(4000);
    expect(mapLimitForZoom(14.5)).toBe(4000);
    expect(mapLimitForZoom(15)).toBe(MAP_MAX_FEATURES);
    expect(mapLimitForZoom(18, 9999)).toBe(MAP_MAX_FEATURES);
    expect(mapLimitForZoom(18, 100)).toBe(100);
  });
});

describe('mapGeometryMode + SQL expression', () => {
  it('selects centroid / simplified / polygon by zoom', () => {
    expect(mapGeometryMode(10)).toBe('centroid');
    expect(mapGeometryMode(12.9)).toBe('centroid');
    expect(mapGeometryMode(13)).toBe('simplified');
    expect(mapGeometryMode(14)).toBe('simplified');
    expect(mapGeometryMode(15)).toBe('polygon');
    expect(mapGeometryMode(undefined)).toBe('centroid');
  });

  it('emits PostGIS expressions without executing SQL', () => {
    expect(mapGeomSqlExpression('centroid')).toContain('centroid');
    expect(mapGeomSqlExpression('simplified', 14)).toContain('ST_SimplifyPreserveTopology');
    expect(mapGeomSqlExpression('simplified', 14)).toContain(String(mapSimplifyTolerance(14)));
    expect(mapGeomSqlExpression('polygon')).toMatch(/geom::geometry/);
    expect(mapGeomSqlExpression('polygon')).not.toContain('Simplify');
  });
});

describe('bbox filtering helpers', () => {
  it('rejects oversized and inverted bboxes via schema', () => {
    expect(() => mapQuerySchema.parse({ bbox: '-96,38,-93,40' })).toThrow();
    expect(() => bboxSchema.parse('-94,39,-95,38')).toThrow();
    expect(() => mapQuerySchema.parse({ bbox: '-94.6,39.0,-94.5,39.1', limit: 20000 })).toThrow();
  });

  it('accepts Jackson County-scale bbox and clamps client spans', () => {
    const parsed = mapQuerySchema.parse({ bbox: '-94.7,38.85,-94.2,39.3', zoom: 12 });
    expect(parsed.bbox[0]).toBeCloseTo(-94.7);
    expect(mapLimitForZoom(parsed.zoom)).toBe(1500);

    const clamped = clampMapBbox([-95.5, 38.0, -93.0, 40.0]);
    expect(clamped[2] - clamped[0]).toBeLessThanOrEqual(MAP_MAX_BBOX_SPAN_DEG + 1e-9);
    expect(clamped[3] - clamped[1]).toBeLessThanOrEqual(MAP_MAX_BBOX_SPAN_DEG + 1e-9);
  });
});
