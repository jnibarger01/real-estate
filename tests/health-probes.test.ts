/**
 * Liveness (/healthz, /health) vs readiness (/readyz, /api/health) contract.
 * The DB layer is mocked so these run without Postgres.
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  up: true,
  ingestOk: true,
}));

vi.mock('../src/api/db/pool.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/db/pool.js')>();
  return {
    ...actual,
    pingDatabase: vi.fn(async () =>
      db.up ? { ok: true, latencyMs: 1 } : { ok: false, latencyMs: 1, error: 'unreachable' },
    ),
    inspectDatabase: vi.fn(async () => ({
      database: db.up ? { ok: true, latencyMs: 1 } : { ok: false, latencyMs: 1, error: 'unreachable' },
      postgis: { ok: db.up, version: db.up ? '3.4' : null },
      queryReadiness: { ok: db.up, missing: [] },
      ingestFreshness: {
        ok: db.up && db.ingestOk,
        source: 'mart.residential_properties',
        refreshedAt: '2026-09-01T00:00:00.000Z',
        ageHours: db.ingestOk ? 1 : 500,
        maxAgeHours: 168,
      },
    })),
  };
});

const { createApp } = await import('../src/api/app.ts');

const originalEnv = process.env.NODE_ENV;

beforeEach(() => {
  db.up = true;
  db.ingestOk = true;
});

afterEach(() => {
  if (originalEnv == null) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv;
});

describe('health probes', () => {
  it('production + reachable DB + stale ingest: liveness 200, readiness 503', async () => {
    process.env.NODE_ENV = 'production';
    db.ingestOk = false;
    const app = createApp({ enforceAuth: false });

    for (const path of ['/healthz', '/health']) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok', probe: 'liveness' });
      expect(res.body.ingestFreshness).toBeUndefined();
    }
    for (const path of ['/readyz', '/api/health']) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(503);
      expect(res.body).toMatchObject({ status: 'error', probe: 'readiness' });
      expect(res.body.ingestFreshness.ok).toBe(false);
    }
  });

  it('DB down: every probe fails closed', async () => {
    process.env.NODE_ENV = 'test';
    db.up = false;
    const app = createApp({ enforceAuth: false });
    for (const path of ['/healthz', '/health', '/readyz', '/api/health']) {
      expect((await request(app).get(path)).status, path).toBe(503);
    }
  });

  it('all healthy: every probe is 200', async () => {
    process.env.NODE_ENV = 'production';
    const app = createApp({ enforceAuth: false });
    for (const path of ['/healthz', '/health', '/readyz', '/api/health']) {
      expect((await request(app).get(path)).status, path).toBe(200);
    }
  });

  it('non-production stale ingest: readiness degrades but stays 200', async () => {
    process.env.NODE_ENV = 'development';
    db.ingestOk = false;
    const res = await request(createApp({ enforceAuth: false })).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
  });
});
