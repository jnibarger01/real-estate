/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Badge } from '../components/ui/badge';
import {
  formatIngestStamp,
  ingestBadgeStatus,
  ingestStatusLabel,
  type IngestFreshnessView,
} from './ingestFreshness';

type Props = {
  freshness?: IngestFreshnessView | null;
  loading?: boolean;
};

const STATUS_CLASS: Record<ReturnType<typeof ingestBadgeStatus>, string> = {
  fresh: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  stale: 'border-amber-300 bg-amber-50 text-amber-950',
  unknown: 'border-slate-200 bg-slate-50 text-slate-600',
};

export default function IngestFreshnessBadge({ freshness, loading }: Props) {
  if (loading) {
    return (
      <Badge
        variant="outline"
        className="border-slate-200 bg-slate-50 text-slate-400"
        data-testid="ingest-freshness-badge"
        data-status="loading"
      >
        Ingest: …
      </Badge>
    );
  }

  const status = ingestBadgeStatus(freshness);
  const stamp = formatIngestStamp(freshness?.refreshedAt);
  const label = ingestStatusLabel(status);
  const title =
    freshness?.maxAgeHours != null && freshness.maxAgeHours > 0
      ? `Source ${freshness.source ?? 'mart'}. SLA ${freshness.maxAgeHours}h.`
      : `Source ${freshness?.source ?? 'mart'}.`;

  return (
    <Badge
      variant="outline"
      className={STATUS_CLASS[status]}
      data-testid="ingest-freshness-badge"
      data-status={status}
      data-refreshed-at={freshness?.refreshedAt ?? ''}
      title={title}
      role="status"
    >
      Ingest: {stamp} · {label}
    </Badge>
  );
}
