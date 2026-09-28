import { describe, expect, it, vi } from 'vitest';
import { injectRobotsMeta, pagesNoIndex, PAGES_ROBOTS_META, PAGES_ROBOTS_TXT } from '../src/vitePlugins/pagesNoIndex.ts';

const HTML = '<!doctype html>\n<html lang="en">\n  <head>\n    <title>x</title>\n  </head>\n</html>';

function run(mode: string) {
  const plugin = pagesNoIndex(mode);
  const html = (plugin.transformIndexHtml as (h: string) => string)(HTML);
  const emitFile = vi.fn();
  (plugin.generateBundle as (this: unknown) => void).call({ emitFile });
  return { html, emitFile };
}

describe('pagesNoIndex plugin', () => {
  it('pages mode injects noindex meta and emits a sitewide-disallow robots.txt', () => {
    const { html, emitFile } = run('pages');
    expect(html).toContain(PAGES_ROBOTS_META);
    expect(emitFile).toHaveBeenCalledWith({ type: 'asset', fileName: 'robots.txt', source: PAGES_ROBOTS_TXT });
    expect(PAGES_ROBOTS_TXT).toMatch(/^User-agent: \*\nDisallow: \/\n$/);
    expect(emitFile.mock.calls.some(([f]) => /sitemap/i.test(f.fileName))).toBe(false);
  });

  it('product build is unchanged', () => {
    const { html, emitFile } = run('production');
    expect(html).toBe(HTML);
    expect(emitFile).not.toHaveBeenCalled();
  });

  it('does not duplicate an existing robots meta', () => {
    const once = injectRobotsMeta(HTML);
    expect(injectRobotsMeta(once)).toBe(once);
  });
});
