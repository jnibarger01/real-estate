/**
 * Standalone production API (Render). Same Express app as server.ts, no Vite.
 */

import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createApp } from './src/api/app.js';
import { inspectDatabase } from './src/api/db/pool.js';
import { assertProductionReady } from './src/api/startup.js';

dotenv.config();

export function createBackendApp() {
  return createApp();
}

const PORT = Number(process.env.PORT || 3000);

async function start() {
  await assertProductionReady();
  const inspection = await inspectDatabase();
  if (!inspection.database.ok) {
    throw new Error('PostgreSQL startup validation failed: cannot connect to DATABASE_URL / jacen_dev');
  }
  if (!inspection.postgis.ok) {
    throw new Error('PostgreSQL startup validation failed: PostGIS is not installed');
  }
  if (!inspection.queryReadiness.ok) {
    throw new Error(
      `Missing required api.dashboard_* objects: ${inspection.queryReadiness.missing.join(', ')}. Apply sql/api_dashboard_views.sql.`,
    );
  }

  const app = createBackendApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Jackson County dashboard API listening on 0.0.0.0:${PORT} (postgres=${inspection.database.ok} postgis=${inspection.postgis.version})`);
  });
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
