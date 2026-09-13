import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.ts';
import { rateLimitKeyForRequest } from '../src/server/httpDefaults.ts';
import {
  SESSION_COOKIE,
  createSessionToken,
  clearRevokedSessionsForTests,
} from '../src/api/session.ts';
import type { Request } from 'express';

const ENV_KEYS = [
  'DASHBOARD_AUTH_USER',
  'DASHBOARD_AUTH_PASSWORD',
  'DASHBOARD_AUTH_USERS',
  'API_KEY',
  'SESSION_SECRET',
  'API_RATE_LIMIT_PER_MINUTE',
  'PII_RATE_LIMIT_PER_MINUTE',
  'NODE_ENV',
] as const;

const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (original[key] == null) delete process.env[key];
    else process.env[key] = original[key];
  }
}

afterEach(() => {
  restoreEnv();
  clearRevokedSessionsForTests();
});

function mockReq(partial: {
  ip?: string;
  get?: (name: string) => string | undefined;
  headers?: { cookie?: string };
  socket?: { remoteAddress?: string };
}): Request {
  return {
    ip: partial.ip ?? '127.0.0.1',
    get: partial.get ?? (() => undefined),
    headers: partial.headers ?? {},
    socket: partial.socket ?? { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

describe('rateLimitKeyForRequest', () => {
  it('keys by validated Basic username', () => {
    process.env.DASHBOARD_AUTH_USERS = 'alice:alice-pass,bob:bob-pass';
    delete process.env.API_KEY;
    const auth = `Basic ${Buffer.from('alice:alice-pass').toString('base64')}`;
    const key = rateLimitKeyForRequest(
      mockReq({ get: (name) => (name.toLowerCase() === 'authorization' ? auth : undefined) }),
    );
    expect(key).toBe('principal:alice');
  });

  it('keys by API key principal', () => {
    delete process.env.DASHBOARD_AUTH_USER;
    delete process.env.DASHBOARD_AUTH_PASSWORD;
    delete process.env.DASHBOARD_AUTH_USERS;
    process.env.API_KEY = 'shared-gate';
    const key = rateLimitKeyForRequest(
      mockReq({ get: (name) => (name.toLowerCase() === 'x-api-key' ? 'shared-gate' : undefined) }),
    );
    expect(key).toBe('principal:api-key');
  });

  it('keys by session username', () => {
    process.env.DASHBOARD_AUTH_USER = 'session-user';
    process.env.DASHBOARD_AUTH_PASSWORD = 'session-pass';
    process.env.SESSION_SECRET = 'rate-limit-session-secret';
    delete process.env.API_KEY;
    const { token } = createSessionToken('session-user');
    const key = rateLimitKeyForRequest(
      mockReq({ headers: { cookie: `${SESSION_COOKIE}=${token}` } }),
    );
    expect(key).toBe('principal:session-user');
  });

  it('falls back to IP when no principal is present', () => {
    process.env.DASHBOARD_AUTH_USER = 'alice';
    process.env.DASHBOARD_AUTH_PASSWORD = 'secret';
    delete process.env.API_KEY;
    const key = rateLimitKeyForRequest(mockReq({ ip: '203.0.113.9' }));
    expect(key.startsWith('ip:')).toBe(true);
    expect(key).toContain('203.0.113.9');
  });
});

describe('per-principal API rate limit', () => {
  it('returns structured 429 when one Basic principal bursts', async () => {
    process.env.DASHBOARD_AUTH_USERS = 'alice:alice-pass,bob:bob-pass';
    delete process.env.API_KEY;
    process.env.API_RATE_LIMIT_PER_MINUTE = '3';
    process.env.PII_RATE_LIMIT_PER_MINUTE = '100';
    const app = createApp({ enforceAuth: true });

    for (let i = 0; i < 3; i += 1) {
      const ok = await request(app).get('/api/dashboard/summary').auth('alice', 'alice-pass');
      expect(ok.status).not.toBe(429);
    }

    const limited = await request(app).get('/api/dashboard/summary').auth('alice', 'alice-pass');
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({
      success: false,
      error: 'rate_limit_exceeded',
      message: 'Too many requests. Please retry shortly.',
    });
    expect(typeof limited.body.requestId).toBe('string');
    // draft-7 may expose RateLimit / RateLimit-Policy; accept any standard rate-limit header.
    const headerNames = Object.keys(limited.headers).map((h) => h.toLowerCase());
    expect(headerNames.some((h) => h.includes('ratelimit') || h.includes('rate-limit'))).toBe(true);

    const other = await request(app).get('/api/dashboard/summary').auth('bob', 'bob-pass');
    expect(other.status).not.toBe(429);
  });

  it('stacks a tighter PII limit on /api/properties/search', async () => {
    process.env.DASHBOARD_AUTH_USER = 'searcher';
    process.env.DASHBOARD_AUTH_PASSWORD = 'search-pass';
    delete process.env.API_KEY;
    process.env.API_RATE_LIMIT_PER_MINUTE = '100';
    process.env.PII_RATE_LIMIT_PER_MINUTE = '2';
    const app = createApp({ enforceAuth: true });

    expect((await request(app).get('/api/properties/search?limit=1').auth('searcher', 'search-pass')).status).not.toBe(429);
    expect((await request(app).get('/api/properties/search?limit=1').auth('searcher', 'search-pass')).status).not.toBe(429);

    const limited = await request(app).get('/api/properties/search?limit=1').auth('searcher', 'search-pass');
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe('rate_limit_exceeded');
  });
});
