/**
 * CSV export unit tests — pure helpers + schema + auth gates; no PostGIS required.
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CSV_DEFAULT_COLUMNS,
  CSV_EXPORT_MAX_ROWS,
  CSV_PII_COLUMNS,
  buildCsvDocument,
  csvEscape,
  exportFilename,
  resolveExportColumns,
} from '../src/api/csvExport.ts';
import { buildPropertySearchWhere } from '../src/api/propertySearchFilters.ts';
import { exportQuerySchema } from '../src/api/schemas.ts';
import { createApp } from '../src/api/app.ts';

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

describe('CSV_EXPORT_MAX_ROWS', () => {
  it('is 10000', () => {
    expect(CSV_EXPORT_MAX_ROWS).toBe(10_000);
  });
});

describe('resolveExportColumns', () => {
  it('omits owner PII by default', () => {
    const decision = resolveExportColumns({
      includePii: false,
      confirmPii: false,
      hasDashboardAppRole: true,
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.includePii).toBe(false);
    expect(decision.columns).toEqual([...CSV_DEFAULT_COLUMNS]);
    expect(decision.columns).not.toContain('owner_info');
    expect(decision.columns).not.toContain('owner_mailing_address');
  });

  it('requires confirm_pii when include_pii is set', () => {
    const decision = resolveExportColumns({
      includePii: true,
      confirmPii: false,
      hasDashboardAppRole: true,
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.status).toBe(400);
    expect(decision.error).toBe('pii_confirm_required');
  });

  it('requires dashboard_app role for PII columns', () => {
    const decision = resolveExportColumns({
      includePii: true,
      confirmPii: true,
      hasDashboardAppRole: false,
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.status).toBe(403);
    expect(decision.error).toBe('dashboard_app_role_required');
  });

  it('includes PII columns when confirmed and role-checked', () => {
    const decision = resolveExportColumns({
      includePii: true,
      confirmPii: true,
      hasDashboardAppRole: true,
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.columns).toEqual([...CSV_DEFAULT_COLUMNS, ...CSV_PII_COLUMNS]);
  });
});

describe('csvEscape / buildCsvDocument', () => {
  it('quotes commas and doubled quotes', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape(null)).toBe('');
  });

  it('builds a header + rows document without PII by default columns', () => {
    const csv = buildCsvDocument(
      [
        {
          parcel_id: 'P1',
          property_id: 1,
          situs_address: '100 MAIN ST',
          owner_info: 'SHOULD NOT APPEAR',
        },
      ],
      ['parcel_id', 'property_id', 'situs_address'],
    );
    expect(csv).toContain('parcel_id,property_id,situs_address');
    expect(csv).toContain('P1,1,100 MAIN ST');
    expect(csv).not.toContain('SHOULD NOT APPEAR');
    expect(csv).not.toContain('owner_info');
  });
});

describe('exportFilename', () => {
  it('marks PII exports in the filename', () => {
    const when = new Date('2026-09-13T12:00:00Z');
    expect(exportFilename(false, when)).toBe('properties_export_2026-09-13.csv');
    expect(exportFilename(true, when)).toBe('properties_export_pii_2026-09-13.csv');
  });
});

describe('exportQuerySchema', () => {
  it('accepts search filters and caps limit at CSV_EXPORT_MAX_ROWS', () => {
    const parsed = exportQuerySchema.parse({
      city: 'KANSAS CITY',
      minValue: '100000',
      include_pii: 'true',
      confirm_pii: '1',
    });
    expect(parsed.city).toBe('KANSAS CITY');
    expect(parsed.minValue).toBe(100000);
    expect(parsed.include_pii).toBe(true);
    expect(parsed.confirm_pii).toBe(true);
    expect(parsed.limit).toBe(CSV_EXPORT_MAX_ROWS);
    expect(() => exportQuerySchema.parse({ limit: CSV_EXPORT_MAX_ROWS + 1 })).toThrow();
  });
});

describe('buildPropertySearchWhere', () => {
  it('applies the same city/value filters search uses', () => {
    const built = buildPropertySearchWhere({
      city: 'KANSAS CITY',
      minValue: 200000,
      maxValue: 500000,
    });
    expect(built.whereSql).toContain('situs_city ILIKE');
    expect(built.whereSql).toContain('market_value_total >=');
    expect(built.whereSql).toContain('market_value_total <=');
    expect(built.params).toEqual(['KANSAS CITY', 200000, 500000]);
  });
});

describe('CSV export HTTP gates (no PostGIS)', () => {
  beforeEach(() => {
    process.env.DASHBOARD_AUTH_USER = 'session-user';
    process.env.DASHBOARD_AUTH_PASSWORD = 'session-pass';
    process.env.SESSION_SECRET = 'unit-session-secret';
    delete process.env.API_KEY;
  });

  afterEach(() => {
    restoreEnv();
  });

  it('requires auth before touching the database', async () => {
    const app = createApp({ enforceAuth: true });
    const res = await request(app).get('/api/properties/export.csv');
    expect(res.status).toBe(401);
  });

  it('rejects include_pii without confirm_pii before querying rows', async () => {
    const app = createApp({ enforceAuth: true });
    const login = await request(app)
      .post('/api/auth/login')
      .send({
        username: process.env.DASHBOARD_AUTH_USER,
        password: process.env.DASHBOARD_AUTH_PASSWORD,
      });
    const setCookie = login.headers['set-cookie'];
    const raw = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const cookie = raw.find((c) => c.startsWith('dashboard_session='))!.split(';')[0]!;

    const res = await request(app)
      .get('/api/properties/export.csv')
      .query({ include_pii: 'true' })
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('pii_confirm_required');
  });
});
