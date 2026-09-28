/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * real-estate#38: DashboardPage must lazy-load the heavy map/chart panels so
 * first paint after login only pulls the KPI/filters/search code. This is a
 * source-contract test because the unit suite runs in a node environment
 * without a DOM; the Vite production build verifies the lazy chunks exist.
 */
const TEST_DIR = import.meta.dirname;
const SOURCE_PATH = join(TEST_DIR, '..', 'src', 'dashboard', 'DashboardPage.tsx');
const HEAVY_MODULES = ['PropertyMap', 'ChangeChart', 'ValueDistributionChart', 'PropertyTypesChart'];
// Panels that must stay eager: auth shell, filters, KPI cards, saved searches.
const EAGER_MODULES = ['KpiCard', 'DashboardFilters', 'SavedSearches', 'IngestFreshnessBadge', 'PropertyExplorer'];

describe('DashboardPage lazy panel loading (#38)', () => {
  const src = readFileSync(SOURCE_PATH, 'utf8');

  it.each(HEAVY_MODULES)('has no static import of %s', (mod) => {
    const staticImport = new RegExp(`^import\\s+(?:\\w+|\\{[^}]*\\})\\s+from\\s+['"]\\.\\/${mod}['"]`, 'm');
    expect(src).not.toMatch(staticImport);
  });

  it.each(HEAVY_MODULES)('loads %s via React.lazy', (mod) => {
    expect(src).toContain(`lazy(() => import('./${mod}'))`);
  });

  it.each(EAGER_MODULES)('keeps %s eager', (mod) => {
    expect(src).toContain(`from './${mod}'`);
  });

  it('has at least two Suspense boundaries for the lazy panels', () => {
    const boundaries = (src.match(/<Suspense\b/g) ?? []).length;
    expect(boundaries).toBeGreaterThanOrEqual(2);
  });

  it('announces lazy fallbacks to assistive technology', () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('sr-only');
  });

  it('gives the map fallback the same height as the map panel', () => {
    const map = readFileSync(join(TEST_DIR, '..', 'src', 'dashboard', 'PropertyMap.tsx'), 'utf8');
    expect(map).toContain('h-[420px]');
    expect(src).toContain('h-[420px]');
  });
});
