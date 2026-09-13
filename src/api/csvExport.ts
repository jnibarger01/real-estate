/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CSV export helpers for dashboard property search results.
 * Default columns omit owner PII; PII requires explicit confirm + dashboard_app role.
 */

/** Hard cap on rows returned by GET /api/properties/export.csv (documented in README). */
export const CSV_EXPORT_MAX_ROWS = 10_000;

/** Stream response body in chunks at or above this row count. */
export const CSV_EXPORT_STREAM_THRESHOLD = 500;

export const CSV_DEFAULT_COLUMNS = [
  'parcel_id',
  'property_id',
  'apn_display',
  'parcel_number',
  'situs_address',
  'situs_city',
  'situs_zip',
  'landuse_code',
  'landuse_description',
  'year_built',
  'bedrooms',
  'full_baths',
  'half_baths',
  'total_sqft',
  'living_area',
  'tax_year',
  'assessed_value_total',
  'market_value_total',
  'lng',
  'lat',
] as const;

export const CSV_PII_COLUMNS = ['owner_info', 'owner_mailing_address'] as const;

export type CsvDefaultColumn = (typeof CSV_DEFAULT_COLUMNS)[number];
export type CsvPiiColumn = (typeof CSV_PII_COLUMNS)[number];
export type CsvColumn = CsvDefaultColumn | CsvPiiColumn;

export type PiiExportDecision =
  | { ok: true; columns: CsvColumn[]; includePii: boolean }
  | { ok: false; status: 400 | 403; error: string; message: string };

/**
 * Resolve export columns. Owner PII is omitted unless the client sends both
 * include_pii + confirm_pii and the DB role check passes (`dashboard_app`).
 */
export function resolveExportColumns(options: {
  includePii: boolean;
  confirmPii: boolean;
  hasDashboardAppRole: boolean;
}): PiiExportDecision {
  if (!options.includePii) {
    return { ok: true, columns: [...CSV_DEFAULT_COLUMNS], includePii: false };
  }
  if (!options.confirmPii) {
    return {
      ok: false,
      status: 400,
      error: 'pii_confirm_required',
      message: 'Owner PII columns require confirm_pii=true in addition to include_pii=true',
    };
  }
  if (!options.hasDashboardAppRole) {
    return {
      ok: false,
      status: 403,
      error: 'dashboard_app_role_required',
      message: 'Owner PII CSV export requires the dashboard_app database role',
    };
  }
  return {
    ok: true,
    columns: [...CSV_DEFAULT_COLUMNS, ...CSV_PII_COLUMNS],
    includePii: true,
  };
}

export function csvEscape(value: unknown): string {
  if (value == null) return '';
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function csvHeaderLine(columns: readonly string[]): string {
  return columns.map(csvEscape).join(',');
}

export function csvDataLine(row: Record<string, unknown>, columns: readonly string[]): string {
  return columns.map((col) => csvEscape(row[col])).join(',');
}

/** Build a full CSV document (header + rows). Prefer streaming for large exports. */
export function buildCsvDocument(rows: Array<Record<string, unknown>>, columns: readonly string[]): string {
  const lines = [csvHeaderLine(columns)];
  for (const row of rows) lines.push(csvDataLine(row, columns));
  return lines.join('\n') + (rows.length ? '\n' : '');
}

export function exportFilename(includePii: boolean, now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return includePii ? `properties_export_pii_${stamp}.csv` : `properties_export_${stamp}.csv`;
}

/** SQL SELECT list for the chosen columns (whitelist only). */
export function sqlSelectList(columns: readonly CsvColumn[]): string {
  return columns.join(', ');
}
