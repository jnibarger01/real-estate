/**
 * Vite plugin for the public GitHub Pages shell (`vite build --mode pages`).
 * Emits a sitewide-disallow robots.txt and injects a robots noindex meta so
 * crawlers stay out of the static shell. The authenticated same-origin
 * product build is untouched (plugin only applies in `pages` mode).
 */
import type { Plugin } from 'vite';

export const PAGES_ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';
export const PAGES_ROBOTS_META = '<meta name="robots" content="noindex, nofollow" />';

export function injectRobotsMeta(html: string): string {
  if (/<meta\s+name=["']robots["']/i.test(html)) return html;
  return html.replace(/<head(\s[^>]*)?>/i, (open) => `${open}\n    ${PAGES_ROBOTS_META}`);
}

export function pagesNoIndex(mode: string): Plugin {
  const enabled = mode === 'pages';
  return {
    name: 'pages-noindex',
    apply: 'build',
    transformIndexHtml(html) {
      return enabled ? injectRobotsMeta(html) : html;
    },
    generateBundle() {
      if (!enabled) return;
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: PAGES_ROBOTS_TXT });
    },
  };
}
