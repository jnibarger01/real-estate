/**
 * Ingest freshness badge — pure helpers + SLA env; no PostGIS required.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateIngestFreshness, ingestMaxAgeHours } from '../src/api/db/pool.ts';
import { summaryResponseSchema } from '../src/api/schemas.ts';
import {
  formatIngestStamp,
  ingestBadgeStatus,
  ingestStatusLabel,
} from '../src/dashboard/ingestFreshness.ts';

const SLA_KEYS = ['INGEST_SLA_HOURS', 'INGEST_MAX_AGE_HOURS'] as const;
const original = Object.fromEntries(SLA_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of SLA_KEYS) {
    if (original[key] == null) delete process.env[key];
    else process.env[key] = original[key];
  }
}

afterEach(restoreEnv);

describe('ingestMaxAgeHours', () => {
  it('prefers INGEST_SLA_HOURS over INGEST_MAX_AGE_HOURS', () => {
    process.env.INGEST_SLA_HOURS = '24';
    process.env.INGEST_MAX_AGE_HOURS = '72';
    expect(ingestMaxAgeHours()).toBe(24);
  });

  it('falls back to INGEST_MAX_AGE_HOURS then 168', () => {
    delete process.env.INGEST_SLA_HOURS;
    process.env.INGEST_MAX_AGE_HOURS = '36';
    expect(ingestMaxAgeHours()).toBe(36);
    delete process.env.INGEST_MAX_AGE_HOURS;
    expect(ingestMaxAgeHours()).toBe(168);
  });
});

describe('evaluateIngestFreshness with fixture stamp', () => {
  it('marks a recent fixture stamp as fresh within SLA', () => {
    const stamped = '2026-09-13T12:00:00.000Z';
    const freshness = evaluateIngestFreshness(stamped, 168);
    expect(freshness.ok).toBe(true);
    expect(freshness.refreshedAt).toBe(stamped);
    expect(freshness.source).toBe('mart.residential_properties');
  });

  it('marks an old fixture stamp as stale past SLA', () => {
    const stamped = new Date(Date.now() - 72 * 3600_000).toISOString();
    const freshness = evaluateIngestFreshness(stamped, 24);
    expect(freshness.ok).toBe(false);
    expect(freshness.refreshedAt).toBe(stamped);
    expect(ingestBadgeStatus(freshness)).toBe('stale');
  });
});

describe('badge helpers', () => {
  it('formats the ingest stamp for display', () => {
    expect(formatIngestStamp('2026-09-13T16:30:00.000Z')).toBe('2026-09-13 16:30:00 UTC');
    expect(formatIngestStamp(null)).toBe('never');
  });

  it('labels fresh / stale / unknown', () => {
    expect(ingestStatusLabel('fresh')).toBe('Fresh');
    expect(ingestStatusLabel('stale')).toBe('Stale');
    expect(ingestStatusLabel('unknown')).toBe('Unknown');
    expect(
      ingestBadgeStatus({
        ok: true,
        source: 'mart.residential_properties',
        refreshedAt: '2026-09-13T12:00:00.000Z',
        ageHours: 1,
        maxAgeHours: 168,
      }),
    ).toBe('fresh');
    expect(
      ingestBadgeStatus({
        ok: false,
        source: 'mart.residential_properties',
        refreshedAt: null,
        ageHours: null,
        maxAgeHours: 168,
      }),
    ).toBe('unknown');
  });
});

describe('summaryResponseSchema ingest_freshness', () => {
  it('accepts a fixture ingest_freshness payload', () => {
    const stamped = '2026-09-13T12:00:00.000Z';
    const parsed = summaryResponseSchema.parse({
      property_count: 3,
      total_properties: 3,
      distinct_cities: 3,
      distinct_zips: 3,
      avg_value: 100,
      avg_market_value: 100,
      median_value: 100,
      median_market_value: 100,
      total_assessed_value: 100,
      total_market_value: 100,
      max_market_value: 100,
      median_sqft: null,
      median_price_per_sqft: null,
      with_sqft: 3,
      under_1m: 3,
      over_1m: 0,
      yoy_value_change_pct: null,
      yoy_from_year: null,
      yoy_to_year: null,
      queried_at: stamped,
      refreshed_at: stamped,
      ingest_freshness: evaluateIngestFreshness(stamped, 168),
    });
    expect(parsed.refreshed_at).toBe(stamped);
    expect(parsed.ingest_freshness.refreshedAt).toBe(stamped);
    expect(parsed.ingest_freshness.ok).toBe(true);
  });
});
