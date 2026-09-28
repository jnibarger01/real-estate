import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { pagesNoIndex } from './src/vitePlugins/pagesNoIndex';

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss(), pagesNoIndex(mode)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Function form so shared deps (clsx, react-dom/scheduler) are not
          // swept into the lazy map/charts chunks and pulled into first paint.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            // Core runtime used by first paint; keep it out of lazy chunks.
            if (/node_modules\/(react|react-dom|scheduler|clsx)\//.test(id)) return 'react';
            if (/node_modules\/maplibre-gl\//.test(id)) return 'map';
            if (/node_modules\/(recharts|victory-vendor|d3-[^/]+|internmap|decimal\.js-light)\//.test(id)) return 'charts';
            if (/node_modules\/@tanstack\/(react-table|table-core)\//.test(id)) return 'table';
            if (/node_modules\/@tanstack\/(react-query|query-core)\//.test(id)) return 'query';
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
