/**
 * Issue #38: heavy dashboard panels load lazily and stay out of first paint.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('src/dashboard/DashboardPage.tsx', 'utf8');
const HEAVY = ['PropertyMap', 'ChangeChart', 'ValueDistributionChart', 'PropertyTypesChart'];

describe('DashboardPage lazy panels', () => {
  it('has no static import of the map or chart modules', () => {
    for (const name of HEAVY) {
      expect(page, name).not.toMatch(new RegExp(`^import\\s+${name}\\b`, 'm'));
      expect(page, name).toMatch(new RegExp(`const ${name} = lazy\\(\\(\\) => import\\('\\./${name}'\\)\\)`));
    }
  });

  it('wraps each lazy panel in Suspense with an announced fallback', () => {
    expect((page.match(/<Suspense fallback=/g) ?? []).length).toBeGreaterThanOrEqual(HEAVY.length);
    expect(page).toMatch(/role="status"/);
    expect(page).toMatch(/className="sr-only"/);
  });

  it('keeps KPI cards, filters, saved searches, and explorer eager', () => {
    for (const name of ['KpiCard', 'DashboardFilters', 'SavedSearches', 'PropertyExplorer']) {
      expect(page, name).toMatch(new RegExp(`^import ${name}\\b`, 'm'));
    }
  });
});

describe('vite manualChunks', () => {
  it('keeps react/clsx out of the lazy map/charts chunks', async () => {
    const config = (await import('../vite.config.ts')).default as unknown as (env: {
      mode: string;
      command: string;
    }) => { build: { rollupOptions: { output: { manualChunks: (id: string) => string | undefined } } } };
    const chunk = config({ mode: 'production', command: 'build' }).build.rollupOptions.output.manualChunks;
    expect(chunk('/x/node_modules/maplibre-gl/dist/maplibre-gl.js')).toBe('map');
    expect(chunk('/x/node_modules/recharts/es6/index.js')).toBe('charts');
    expect(chunk('/x/node_modules/d3-scale/src/index.js')).toBe('charts');
    for (const shared of ['react', 'react-dom', 'scheduler', 'clsx']) {
      expect(chunk(`/x/node_modules/${shared}/index.js`), shared).toBe('react');
    }
    expect(chunk('/x/src/dashboard/PropertyMap.tsx')).toBeUndefined();
  });
});
