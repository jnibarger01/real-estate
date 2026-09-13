import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

/**
 * Fast policy checks for issue #14 (Pages vs authenticated product split).
 * The full canary Pages build + dist scan runs in CI via
 * scripts/check-pages-auth-split.sh.
 */
describe('pages vs authenticated product split', () => {
  it('documents the Pages env checklist in ARCHITECTURE.md', () => {
    const architecture = readFileSync('docs/ARCHITECTURE.md', 'utf8');
    expect(architecture).toMatch(/Pages vs authenticated product/i);
    expect(architecture).toContain('VITE_API_BASE_URL');
    expect(architecture).toContain('VITE_API_KEY');
    expect(architecture).toMatch(/forbidden/i);
    expect(architecture).toContain('scripts/check-pages-auth-split.sh');
  });

  it('README GitHub Pages section links ARCHITECTURE and the CI guard', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toMatch(/## GitHub Pages/);
    expect(readme).toContain('docs/ARCHITECTURE.md');
    expect(readme).toContain('check-pages-auth-split');
  });

  it('deploy-pages only injects the public VITE_API_BASE_URL', () => {
    const wf = readFileSync('.github/workflows/deploy-pages.yml', 'utf8');
    const viteEnvLines = wf.split('\n').filter((line) => /^\s+VITE_[A-Z0-9_]+:/.test(line));
    expect(viteEnvLines.length).toBeGreaterThan(0);
    for (const line of viteEnvLines) {
      expect(line).toMatch(/VITE_API_BASE_URL:/);
      expect(line).not.toMatch(
        /VITE_(API_KEY|ALLOW_FIXTURE_ADAPTER|DASHBOARD_|SESSION_|RENTCAST_|GEMINI_|.*PASSWORD|.*SECRET|.*TOKEN)/,
      );
    }
  });

  it('policy script passes without rebuilding', () => {
    execFileSync('bash', ['scripts/check-pages-auth-split.sh', '--policy'], {
      stdio: 'pipe',
    });
  });
});
