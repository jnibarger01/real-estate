/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local full-stack entry: shared API app + Vite middleware.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { createApp } from './src/api/app.js';
import { inspectDatabase } from './src/api/db/pool.js';
import { assertProductionReady } from './src/api/startup.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  await assertProductionReady();
  const app = createApp();
  const inspection = await inspectDatabase();
  if (!inspection.database.ok) {
    console.warn('PostgreSQL is not reachable. Dashboard endpoints will return 5xx until DATABASE_URL/jacen_dev is available.');
  } else if (!inspection.postgis.ok || !inspection.queryReadiness.ok) {
    console.warn('Database connected but query readiness is degraded:', inspection);
  }

  // SPA document is public; /api/* (except health/auth) requires session, Basic, or API key.
  // This enables login UI, idle warning, and logout without browser-cached Basic credentials.

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use((await import('express')).default.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dashboard API listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
