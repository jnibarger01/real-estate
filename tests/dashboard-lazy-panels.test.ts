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

  it.each(HEAVY_MODULES)('starts the %s dynamic import during dashboard module evaluation', (mod) => {
    expect(src).toMatch(new RegExp(`const\\s+\\w+Module\\s*=\\s*import\\(['"]\\.\\/${mod}['"]\\)`));
  });

  it('hands the preloaded modules to React.lazy instead of delaying import until query completion', () => {
    expect(src).toContain('const ChangeChart = lazy(() => changeChartModule);');
    expect(src).toContain('const ValueDistributionChart = lazy(() => valueDistributionChartModule);');
    expect(src).toContain('const PropertyTypesChart = lazy(() => propertyTypesChartModule);');
    expect(src).toContain('const PropertyMap = lazy(() => propertyMapModule);');
  });

  it.each(EAGER_MODULES)('keeps %s eager', (mod) => {
    expect(src).toContain(`from './${mod}'`);
  });

  it('has at least two Suspense boundaries for the lazy panels', () => {
    const boundaries = (src.match(/<Suspense\b/g) ?? []).length;
    expect(boundaries).toBeGreaterThanOrEqual(2);
  });

  it('contains lazy import failures and exposes a reload retry without losing the dashboard shell', () => {
    expect(src).toContain('class LazyPanelErrorBoundary extends Component');
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
