import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.ts';
import { evaluateIngestFreshness } from '../src/api/db/pool.ts';
import { MAP_MAX_FEATURES, bboxSchema, mapLimitForZoom, mapQuerySchema } from '../src/api/schemas.ts';
import { redactLogMeta } from '../src/server/httpDefaults.ts';

const AUTH_KEYS = [
  'DASHBOARD_AUTH_USER',
  'DASHBOARD_AUTH_PASSWORD',
  'DASHBOARD_AUTH_USERS',
  'API_KEY',
  'ENABLE_MCP',
  'NODE_ENV',
] as const;

const original = Object.fromEntries(AUTH_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of AUTH_KEYS) {
    if (original[key] == null) delete process.env[key];
    else process.env[key] = original[key];
  }
}

afterEach(restoreEnv);

describe('ingest freshness helper', () => {
  it('treats a missing stamp as stale when a max age is set', () => {
    expect(evaluateIngestFreshness(null, 168).ok).toBe(false);
  });

  it('skips the SLA when max age is 0', () => {
    expect(evaluateIngestFreshness(null, 0).ok).toBe(true);
  });

  it('fails when the stamp is older than the SLA', () => {
    const old = new Date(Date.now() - 48 * 3600_000).toISOString();
    expect(evaluateIngestFreshness(old, 24).ok).toBe(false);
  });
});

describe('multi-user dashboard auth', () => {
  it('accepts a second Basic user from DASHBOARD_AUTH_USERS', async () => {
    delete process.env.DASHBOARD_AUTH_USER;
    delete process.env.DASHBOARD_AUTH_PASSWORD;
    delete process.env.API_KEY;
    process.env.DASHBOARD_AUTH_USERS = 'alice:alice-pass,bob:bob-pass';
    const app = createApp({ enforceAuth: true });

    const denied = await request(app).get('/api/dashboard/summary');
    expect(denied.status).toBe(401);

    const alice = await request(app).get('/api/dashboard/summary').auth('alice', 'alice-pass');
    expect(alice.status).not.toBe(401);

    const bob = await request(app).get('/api/dashboard/summary').auth('bob', 'bob-pass');
    expect(bob.status).not.toBe(401);
  });
});

describe('MCP production default', () => {
  it('does not expose /mcp when ENABLE_MCP is false', async () => {
    process.env.ENABLE_MCP = 'false';
    const app = createApp({ enforceAuth: false });
    const response = await request(app)
      .post('/mcp')
      .send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('mcp_disabled');
  });
});

describe('map abuse bounds', () => {
  it('rejects a bbox larger than one degree on a side', () => {
    expect(() => mapQuerySchema.parse({ bbox: '-96,38,-93,40' })).toThrow();
  });

  it('still accepts a Jackson County-scale bbox', () => {
    const parsed = mapQuerySchema.parse({ bbox: '-94.7,38.85,-94.2,39.3' });
    expect(parsed.bbox[0]).toBeCloseTo(-94.7);
  });

  it('caps explicit map limits at 5000', () => {
    expect(mapQuerySchema.parse({ bbox: '-94.6,39.0,-94.5,39.1', limit: 5000 }).limit).toBe(5000);
    expect(() => mapQuerySchema.parse({ bbox: '-94.6,39.0,-94.5,39.1', limit: 20000 })).toThrow();
    expect(mapLimitForZoom(18)).toBeLessThanOrEqual(MAP_MAX_FEATURES);
  });
});

describe('log redaction', () => {
  it('strips owner PII and credentials from log metadata', () => {
    const redacted = redactLogMeta({
      owner_info: 'JANE DOE',
      owner_mailing_address: '100 MAIN ST',
      authorization: 'Basic abc',
      api_key: 'shared-gate',
      requestId: 'abc',
    });
    expect(redacted.owner_info).toBe('[redacted]');
    expect(redacted.owner_mailing_address).toBe('[redacted]');
    expect(redacted.authorization).toBe('[redacted]');
    expect(redacted.api_key).toBe('[redacted]');
    expect(redacted.requestId).toBe('abc');
  });
});

describe('bbox helper still validates order', () => {
  it('rejects inverted coordinates', () => {
    expect(() => bboxSchema.parse('-94,39,-95,38')).toThrow();
  });
});
