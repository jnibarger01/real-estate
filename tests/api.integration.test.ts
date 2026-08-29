import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/api/app.ts';
import { inspectDatabase, pool } from '../src/api/db/pool.ts';

const app = createApp();
let server: Server;
let base = '';

async function json(path: string) {
  const res = await fetch(`${base}${path}`);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

before(async () => {
  const ready = await inspectDatabase();
  if (!ready.database.ok) {
    throw new Error('Integration tests require PostgreSQL (DATABASE_URL or local jacen_dev)');
  }
  if (!ready.queryReadiness.ok) {
    throw new Error(`Missing dashboard views: ${ready.queryReadiness.missing.join(', ')}`);
  }
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        base = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

describe('health', () => {
  it('distinguishes process, database, postgis, and query readiness', async () => {
    const { status, body } = await json('/api/health');
    assert.equal(status, 200);
    assert.equal(body.process.ok, true);
    assert.equal(body.database.ok, true);
    assert.equal(body.postgis.ok, true);
    assert.equal(body.queryReadiness.ok, true);
  });
});

describe('dashboard summary', () => {
  it('returns defensible top-level KPIs', { timeout: 60_000 }, async () => {
    const { status, body } = await json('/api/dashboard/summary');
    assert.equal(status, 200);
    assert.ok(body.property_count > 0);
    assert.ok(body.avg_value > 0);
    assert.ok(body.median_value > 0);
    assert.ok(body.total_assessed_value > 0);
    assert.ok(body.total_market_value > 0);
    assert.ok(body.yoy_to_year == null || body.yoy_to_year >= body.yoy_from_year);
    assert.ok(body.queried_at);
  });
});

describe('property search', () => {
  it('supports address/parcel/owner, pagination, and sort', async () => {
    const { status, body } = await json('/api/properties/search?q=MAIN&sort=market_value_total&order=desc&limit=2&offset=0');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.results));
    assert.equal(body.limit, 2);
    assert.equal(body.offset, 0);
    assert.ok(body.total >= body.results.length);
    assert.equal(body.sort, 'market_value_total');
  });

  it('rejects oversized limits', async () => {
    const { status, body } = await json('/api/properties/search?limit=9999');
    assert.equal(status, 400);
    assert.equal(body.error, 'validation_error');
  });
});

describe('property detail', () => {
  it('returns a normalized record for a known id', async () => {
    const search = await json('/api/properties/search?limit=1');
    const id = search.body.results[0].property_id;
    const { status, body } = await json(`/api/properties/${id}`);
    assert.equal(status, 200);
    assert.equal(body.property_id, id);
    assert.ok(body.assessment);
    assert.ok(body.parcel);
    assert.ok(body.ownership);
    assert.ok(body.geometry);
  });

  it('404s missing ids and 400s invalid ids', async () => {
    const missing = await json('/api/properties/999999999');
    assert.equal(missing.status, 404);
    const invalid = await json('/api/properties/not-an-id');
    assert.equal(invalid.status, 400);
  });
});

describe('market trends', () => {
  it('returns a recharts-ready assessor year series', { timeout: 60_000 }, async () => {
    const { status, body } = await json('/api/market/trends');
    assert.equal(status, 200);
    assert.equal(body.semantics, 'assessor_year_values');
    assert.ok(Array.isArray(body.series));
    assert.ok(body.series.length > 0);
    assert.ok('year' in body.series[0]);
    assert.ok('avg_market_value' in body.series[0]);
  });
});

describe('sales / transfers', () => {
  it('does not fabricate market-sale semantics', async () => {
    const { status, body } = await json('/api/sales?limit=5');
    assert.equal(status, 200);
    assert.equal(body.semantics, 'assessor_recording_reference');
    assert.match(String(body.note), /no sale price/);
    assert.ok(Array.isArray(body.results));
    for (const row of body.results) {
      assert.ok(row.recording_num);
      assert.equal(row.sale_price, undefined);
    }
  });
});

describe('map', () => {
  it('returns GeoJSON for a Jackson County bbox', async () => {
    const { status, body } = await json('/api/map/properties?bbox=-94.70,38.80,-94.30,39.20&zoom=14&limit=25');
    assert.equal(status, 200);
    assert.equal(body.type, 'FeatureCollection');
    assert.ok(Array.isArray(body.features));
    assert.ok(body.features.length > 0);
    assert.ok(body.features.length <= 25);
    assert.ok(body.features[0].geometry);
  });

  it('rejects inverted bbox', async () => {
    const { status } = await json('/api/map/properties?bbox=0,0,-1,-1');
    assert.equal(status, 400);
  });
});

describe('distributions', () => {
  it('returns property-type mix', async () => {
    const { status, body } = await json('/api/dashboard/distributions?dimension=property_type');
    assert.equal(status, 200);
    assert.equal(body.dimension, 'property_type');
    assert.ok(body.items.length > 0);
    assert.ok(body.items[0].property_count > 0);
  });
});
