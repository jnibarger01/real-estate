import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.ts';
import { SESSION_COOKIE } from '../src/api/session.ts';
import {
  resetSavedSearchesStoreForTests,
  sanitizeSavedSearchParams,
} from '../src/api/savedSearchesStore.ts';
import { createSavedSearchSchema } from '../src/api/schemas.ts';

const AUTH_KEYS = [
  'DASHBOARD_AUTH_USER',
  'DASHBOARD_AUTH_PASSWORD',
  'DASHBOARD_AUTH_USERS',
  'API_KEY',
  'SESSION_SECRET',
] as const;

const original = Object.fromEntries(AUTH_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of AUTH_KEYS) {
    if (original[key] == null) delete process.env[key];
    else process.env[key] = original[key];
  }
}

function extractCookie(setCookie: string[] | string | undefined): string {
  const raw = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const line = raw.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  expect(line).toBeTruthy();
  return line!.split(';')[0]!;
}

beforeEach(() => {
  resetSavedSearchesStoreForTests({ mode: 'memory' });
  process.env.DASHBOARD_AUTH_USER = 'session-user';
  process.env.DASHBOARD_AUTH_PASSWORD = 'session-pass';
  process.env.SESSION_SECRET = 'unit-session-secret';
  delete process.env.API_KEY;
});

afterEach(() => {
  restoreEnv();
  resetSavedSearchesStoreForTests({ mode: 'auto' });
});

describe('saved search sanitization', () => {
  it('keeps filter query params and strips owner PII keys', () => {
    expect(
      sanitizeSavedSearchParams({
        q: 'MAIN ST',
        city: 'KANSAS CITY',
        minValue: 100000,
        owner: 'JANE DOE',
        owner_info: 'JANE DOE',
      }),
    ).toEqual({
      q: 'MAIN ST',
      city: 'KANSAS CITY',
      minValue: 100000,
    });
  });

  it('rejects create bodies that include owner keys', () => {
    expect(() =>
      createSavedSearchSchema.parse({
        label: 'PII leak',
        query_params: { owner: 'JANE DOE' },
      }),
    ).toThrow();
  });
});

describe('authenticated saved searches API', () => {
  it('requires auth', async () => {
    const app = createApp({ enforceAuth: true });
    const res = await request(app).get('/api/dashboard/saved-searches');
    expect(res.status).toBe(401);
  });

  it('save → list → same filters; delete removes the row', async () => {
    const app = createApp({ enforceAuth: true });
    const login = await request(app)
      .post('/api/auth/login')
      .send({
        username: process.env.DASHBOARD_AUTH_USER,
        password: process.env.DASHBOARD_AUTH_PASSWORD,
      });
    const cookie = extractCookie(login.headers['set-cookie']);

    const created = await request(app)
      .post('/api/dashboard/saved-searches')
      .set('Cookie', cookie)
      .send({
        label: 'KC mid',
        query_params: { city: 'KANSAS CITY', minValue: 200000, maxValue: 500000 },
      });
    expect(created.status).toBe(201);
    expect(created.body.label).toBe('KC mid');
    expect(created.body.query_params).toEqual({
      city: 'KANSAS CITY',
      minValue: 200000,
      maxValue: 500000,
    });
    expect(created.body.query_params.owner).toBeUndefined();

    const listed = await request(app).get('/api/dashboard/saved-searches').set('Cookie', cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.items[0].query_params).toEqual(created.body.query_params);

    // Simulate reload: new request with same session still returns the bookmark.
    const reloaded = await request(app).get('/api/dashboard/saved-searches').set('Cookie', cookie);
    expect(reloaded.body.items[0].id).toBe(created.body.id);

    const deleted = await request(app)
      .delete(`/api/dashboard/saved-searches/${created.body.id}`)
      .set('Cookie', cookie);
    expect(deleted.status).toBe(204);

    const after = await request(app).get('/api/dashboard/saved-searches').set('Cookie', cookie);
    expect(after.body.items).toHaveLength(0);
  });

  it('scopes bookmarks to the authenticated user', async () => {
    process.env.DASHBOARD_AUTH_USERS = `session-user:${process.env.DASHBOARD_AUTH_PASSWORD},other-user:${process.env.DASHBOARD_AUTH_PASSWORD}`;
    const app = createApp({ enforceAuth: true });

    const opsLogin = await request(app).post('/api/auth/login').send({
      username: 'session-user',
      password: process.env.DASHBOARD_AUTH_PASSWORD,
    });
    const opsCookie = extractCookie(opsLogin.headers['set-cookie']);
    await request(app)
      .post('/api/dashboard/saved-searches')
      .set('Cookie', opsCookie)
      .send({ label: 'ops only', query_params: { city: 'RAYTOWN' } });

    const otherLogin = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'other-user',
        password: process.env.DASHBOARD_AUTH_PASSWORD,
      });
    const otherCookie = extractCookie(otherLogin.headers['set-cookie']);
    const otherList = await request(app).get('/api/dashboard/saved-searches').set('Cookie', otherCookie);
    expect(otherList.body.items).toHaveLength(0);
  });
});
