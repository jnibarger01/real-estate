import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.ts';
import {
  SESSION_COOKIE,
  createSessionToken,
  getIdleWarningMs,
  getSessionTtlMs,
  verifySessionToken,
  clearRevokedSessionsForTests,
} from '../src/api/session.ts';

const AUTH_KEYS = [
  'DASHBOARD_AUTH_USER',
  'DASHBOARD_AUTH_PASSWORD',
  'DASHBOARD_AUTH_USERS',
  'API_KEY',
  'SESSION_TTL_MS',
  'SESSION_IDLE_WARNING_MS',
  'SESSION_SECRET',
] as const;

const original = Object.fromEntries(AUTH_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of AUTH_KEYS) {
    if (original[key] == null) delete process.env[key];
    else process.env[key] = original[key];
  }
}

afterEach(() => {
  restoreEnv();
  clearRevokedSessionsForTests();
});

function extractCookie(setCookie: string[] | string | undefined): string {
  const raw = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const line = raw.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  expect(line).toBeTruthy();
  return line!.split(';')[0]!;
}

describe('session helpers', () => {
  it('reads SESSION_TTL_MS and idle warning from env', () => {
    process.env.SESSION_TTL_MS = '120000';
    process.env.SESSION_IDLE_WARNING_MS = '15000';
    expect(getSessionTtlMs()).toBe(120000);
    expect(getIdleWarningMs()).toBe(15000);
  });

  it('rejects expired tokens', () => {
    process.env.SESSION_SECRET = 'test-secret';
    process.env.SESSION_TTL_MS = '1000';
    const { token } = createSessionToken('alice', Date.now() - 5000);
    expect(verifySessionToken(token)).toBeNull();
  });
});

describe('dashboard session auth', () => {
  it('issues a session cookie on login and authorizes /api/dashboard/*', async () => {
    process.env.DASHBOARD_AUTH_USER = 'session-user';
    process.env.DASHBOARD_AUTH_PASSWORD = 'session-pass';
    process.env.SESSION_SECRET = 'unit-session-secret';
    delete process.env.API_KEY;
    const app = createApp({ enforceAuth: true });

    const denied = await request(app).get('/api/dashboard/summary');
    expect(denied.status).toBe(401);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'session-user', password: 'session-pass' });
    expect(login.status).toBe(200);
    expect(login.body.authenticated).toBe(true);
    expect(login.body.expiresAt).toBeGreaterThan(Date.now());
    const cookie = extractCookie(login.headers['set-cookie']);

    const allowed = await request(app).get('/api/dashboard/summary').set('Cookie', cookie);
    expect(allowed.status).not.toBe(401);
  });

  it('rejects expired session cookies on /api/dashboard/*', async () => {
    process.env.DASHBOARD_AUTH_USER = 'session-user';
    process.env.DASHBOARD_AUTH_PASSWORD = 'session-pass';
    process.env.SESSION_SECRET = 'unit-session-secret';
    process.env.SESSION_TTL_MS = '50';
    delete process.env.API_KEY;
    const app = createApp({ enforceAuth: true });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'session-user', password: 'session-pass' });
    const cookie = extractCookie(login.headers['set-cookie']);

    await new Promise((r) => setTimeout(r, 80));

    const expired = await request(app).get('/api/dashboard/summary').set('Cookie', cookie);
    expect(expired.status).toBe(401);

    const session = await request(app).get('/api/auth/session').set('Cookie', cookie);
    expect(session.status).toBe(200);
    expect(session.body.authenticated).toBe(false);
  });

  it('logout clears the session cookie so dashboard calls are unauthorized', async () => {
    process.env.DASHBOARD_AUTH_USER = 'session-user';
    process.env.DASHBOARD_AUTH_PASSWORD = 'session-pass';
    process.env.SESSION_SECRET = 'unit-session-secret';
    delete process.env.API_KEY;
    const app = createApp({ enforceAuth: true });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'session-user', password: 'session-pass' });
    const cookie = extractCookie(login.headers['set-cookie']);

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);

    // Token is revoked server-side even if the client resent the old cookie.
    const denied = await request(app).get('/api/dashboard/summary').set('Cookie', cookie);
    expect(denied.status).toBe(401);

    const session = await request(app).get('/api/auth/session').set('Cookie', cookie);
    expect(session.body.authenticated).toBe(false);
  });

  it('touch extends an active session', async () => {
    process.env.DASHBOARD_AUTH_USER = 'session-user';
    process.env.DASHBOARD_AUTH_PASSWORD = 'session-pass';
    process.env.SESSION_SECRET = 'unit-session-secret';
    process.env.SESSION_TTL_MS = '60000';
    delete process.env.API_KEY;
    const app = createApp({ enforceAuth: true });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'session-user', password: 'session-pass' });
    const cookie = extractCookie(login.headers['set-cookie']);
    const firstExp = login.body.expiresAt as number;

    await new Promise((r) => setTimeout(r, 20));
    const touch = await request(app).post('/api/auth/touch').set('Cookie', cookie);
    expect(touch.status).toBe(200);
    expect(touch.body.expiresAt).toBeGreaterThan(firstExp);
  });
});
