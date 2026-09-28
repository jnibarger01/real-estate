/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * real-estate#38: DashboardPage must split the heavy map/chart panels out of
 * the eager bundle, start those transfers alongside the dashboard queries,
 * and contain lazy-chunk failures so the dashboard shell stays usable.
 */
const TEST_DIR = import.meta.dirname;
const SOURCE_PATH = join(TEST_DIR, '..', 'src', 'dashboard', 'DashboardPage.tsx');
const HEAVY_MODULES = ['PropertyMap', 'ChangeChart', 'ValueDistributionChart', 'PropertyTypesChart'];
const EAGER_MODULES = ['KpiCard', 'DashboardFilters', 'SavedSearches', 'IngestFreshnessBadge', 'PropertyExplorer'];

describe('DashboardPage lazy panel loading (#38)', () => {
  const src = readFileSync(SOURCE_PATH, 'utf8');

  it.each(HEAVY_MODULES)('has no static import of %s', (mod) => {
    const staticImport = new RegExp(`^import\\s+(?:\\w+|\\{[^}]*\\})\\s+from\\s+['"]\\.\\/${mod}['"]`, 'm');
    expect(src).not.toMatch(staticImport);
  });

  it.each(HEAVY_MODULES)('keeps the %s import behind a cached loader', (mod) => {
    expect(src).toMatch(new RegExp(`\\?\\?=\\s*import\\(['"]\\.\\/${mod}['"]\\)`));
  });

  it('primes panel loaders from the authenticated DashboardPage render before queries start', () => {
    const pageStart = src.indexOf('export default function DashboardPage()');
    const preloadCall = src.indexOf('preloadDashboardPanels();', pageStart);
    const firstQuery = src.indexOf('useQuery(', pageStart);
    expect(pageStart).toBeGreaterThanOrEqual(0);
    expect(preloadCall).toBeGreaterThan(pageStart);
    expect(firstQuery).toBeGreaterThan(preloadCall);
  });

  it('does not start heavy imports at module evaluation time', () => {
    const pageStart = src.indexOf('export default function DashboardPage()');
    const beforePage = src.slice(0, pageStart);
    expect(beforePage).not.toMatch(/=\\s*import\\(['"]\\.\\/(?:PropertyMap|ChangeChart|ValueDistributionChart|PropertyTypesChart)['"]\\);/);
  });

  it('hands stable cached loaders to React.lazy', () => {
    expect(src).toContain('const ChangeChart = lazy(loadChangeChart);');
    expect(src).toContain('const ValueDistributionChart = lazy(loadValueDistributionChart);');
    expect(src).toContain('const PropertyTypesChart = lazy(loadPropertyTypesChart);');
    expect(src).toContain('const PropertyMap = lazy(loadPropertyMap);');
  });

  it.each(EAGER_MODULES)('keeps %s eager', (mod) => {
    expect(src).toContain(`from './${mod}'`);
  });

  it('has at least two Suspense boundaries for the lazy panels', () => {
    const boundaries = (src.match(/<Suspense\b/g) ?? []).length;
    expect(boundaries).toBeGreaterThanOrEqual(2);
  });

  it('contains lazy import failures and exposes a reload retry without losing the dashboard shell', () => {
    expect(src).toContain('class LazyPanelErrorBoundary extends React.Component');
    expect(src).toContain('static getDerivedStateFromError()');
    expect(src).toContain('role="alert"');
    expect(src).toContain('window.location.reload()');
    expect(src).toContain('Reload dashboard');
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
