import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.ts';
import { assertDashboardAuthConfigured } from '../src/api/auth.ts';

const AUTH_KEYS = ['DASHBOARD_AUTH_USER', 'DASHBOARD_AUTH_PASSWORD', 'API_KEY'] as const;

const original = Object.fromEntries(AUTH_KEYS.map((key) => [key, process.env[key]]));

function clearAuthEnv() {
  for (const key of AUTH_KEYS) delete process.env[key];
}

afterEach(() => {
  for (const key of AUTH_KEYS) {
    if (original[key] == null) delete process.env[key];
    else process.env[key] = original[key];
  }
});

describe('dashboard auth contract', () => {
  it('refuses to construct a production app without credentials', () => {
    clearAuthEnv();
    expect(() => createApp({ enforceAuth: true })).toThrow(/Dashboard auth is required/);
    expect(() => assertDashboardAuthConfigured()).toThrow(/Dashboard auth is required/);
  });

  it('does not fail-open once credentials are configured', async () => {
    process.env.DASHBOARD_AUTH_USER = 'dashboard-user';
    process.env.DASHBOARD_AUTH_PASSWORD = 'dashboard-pass';
    delete process.env.API_KEY;
    const app = createApp({ enforceAuth: false });

    const denied = await request(app).get('/api/properties/search?limit=1');
    expect(denied.status).toBe(401);

    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);

    const allowed = await request(app)
      .get('/api/properties/search?limit=1')
      .auth('dashboard-user', 'dashboard-pass');
    expect(allowed.status).not.toBe(401);
  });

  it('accepts X-Api-Key when API_KEY is configured', async () => {
    clearAuthEnv();
    process.env.API_KEY = 'shared-gate';
    const app = createApp({ enforceAuth: true });
    const denied = await request(app).get('/api/dashboard/summary');
    expect(denied.status).toBe(401);
    const allowed = await request(app).get('/api/dashboard/summary').set('x-api-key', 'shared-gate');
    expect(allowed.status).not.toBe(401);
  });
});
