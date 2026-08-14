/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { assertDashboardAuthConfigured } from './auth.js';
import { pool, validateDatabaseOrThrow } from './db/pool.js';

export async function assertProductionReady(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;
  assertDashboardAuthConfigured();
  const inspection = await validateDatabaseOrThrow();
  if (!inspection.queryReadiness.ok) {
    throw new Error(
      `Missing required api.dashboard_* objects: ${inspection.queryReadiness.missing.join(', ')}. Apply sql/api_dashboard_views.sql.`,
    );
  }
  if (process.env.INGEST_MAX_AGE_HOURS !== '0' && !inspection.ingestFreshness.ok) {
    throw new Error(
      `Ingest stamp is stale or missing (maxAgeHours=${inspection.ingestFreshness.maxAgeHours}). Run db/refresh_materialized.sh.`,
    );
  }
  const role = await pool.query<{ current_user: string }>('SELECT current_user');
  const connectedAs = role.rows[0]?.current_user;
  if (connectedAs && connectedAs !== 'dashboard_app') {
    const message = `Connected as ${connectedAs}, not dashboard_app. Production should use the least-privilege role.`;
    if (process.env.REQUIRE_DASHBOARD_APP_ROLE === 'true') {
      throw new Error(message);
    }
    console.warn(message);
  }
}
