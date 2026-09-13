/**
 * Pure helpers for the DashboardApp ingest freshness badge.
 * Read-only; no PII. SLA comes from the API (`maxAgeHours`).
 */

export type IngestFreshnessView = {
  ok: boolean;
  source: string;
  refreshedAt: string | null;
  ageHours: number | null;
  maxAgeHours: number;
};

export type IngestBadgeStatus = 'fresh' | 'stale' | 'unknown';

export function ingestBadgeStatus(freshness: IngestFreshnessView | null | undefined): IngestBadgeStatus {
  if (!freshness || freshness.refreshedAt == null || freshness.refreshedAt === '') return 'unknown';
  if (freshness.maxAgeHours === 0) return 'fresh';
  return freshness.ok ? 'fresh' : 'stale';
}

/** Human-readable ingest stamp for the badge (UTC). */
export function formatIngestStamp(refreshedAt: string | null | undefined): string {
  if (refreshedAt == null || refreshedAt === '') return 'never';
  const d = new Date(refreshedAt);
  if (Number.isNaN(d.getTime())) return String(refreshedAt);
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

export function ingestStatusLabel(status: IngestBadgeStatus): string {
  if (status === 'fresh') return 'Fresh';
  if (status === 'stale') return 'Stale';
  return 'Unknown';
}
