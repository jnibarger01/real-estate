import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.ts';

const original = process.env.NODE_ENV;

afterEach(() => {
  if (original == null) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = original;
});

describe('Helmet CSP', () => {
  it('production responses include default-src self', async () => {
    process.env.NODE_ENV = 'production';
    const res = await request(createApp({ enforceAuth: false })).get('/healthz');
    const csp = res.headers['content-security-policy'];
    expect(csp, 'CSP header missing').toBeTruthy();
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).toMatch(/base-uri 'none'/);
    expect(csp).toMatch(/worker-src[^;]*blob:/);
  });

  it('non-production leaves CSP off for Vite HMR', async () => {
    process.env.NODE_ENV = 'development';
    const res = await request(createApp({ enforceAuth: false })).get('/healthz');
    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});

describe('browser entry under CSP', () => {
  it('main.tsx configures zod jitless before any other import (no eval probe)', async () => {
    const { readFileSync } = await import('node:fs');
    const main = readFileSync('src/main.tsx', 'utf8');
    const firstImport = main.split('\n').find((line) => line.startsWith('import '));
    expect(firstImport).toBe("import './lib/zodCsp';");
    expect(readFileSync('src/lib/zodCsp.ts', 'utf8')).toMatch(/z\.config\(\{\s*jitless:\s*true\s*\}\)/);
  });
});
