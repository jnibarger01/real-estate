/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Typed API client for the dashboard endpoints. The browser never
 * talks to Postgres directly — everything goes through these routes.
 */

import type { Geometry } from 'geojson';
import { runtimeConfig } from '../config/runtime';

export interface DashboardSummary {
  total_properties: number | string;
  distinct_cities: number | string;
  distinct_zips: number | string;
  avg_market_value: number | string;
  median_market_value: number | string;
  total_market_value: number | string;
  max_market_value: number | string;
  median_sqft: number | string;
  median_price_per_sqft: number | string;
  with_sqft: number | string;
  under_1m: number | string;
  over_1m: number | string;
  yoy_value_change_pct: number | null;
  yoy_from_year: number | null;
  yoy_to_year: number | null;
  queried_at?: string;
  refreshed_at?: string | null;
}

export interface ValueDistributionDatum {
  bucket: number;
  bucket_min: number;
  bucket_max: number;
  property_count: number;
}

export interface SalesTrendDatum {
  year: number;
  avg_market_value: number;
  total_market_value: number;
  property_count: number;
}

export interface PropertyTypeDatum {
  code: string;
  label: string;
  property_count: number;
  avg_market_value: number;
  median_market_value: number;
  pct: number;
}

export interface PropertyRecord {
  parcel_id: string;
  property_id: number;
  apn_display: string | null;
  parcel_number: string | null;
  situs_address: string | null;
  situs_city: string | null;
  situs_zip: string | null;
  landuse_code: string | null;
  landuse_description: string | null;
  year_built: number | null;
  stories: number | null;
  bedrooms: number | null;
  full_baths: number | null;
  half_baths: number | null;
  total_sqft: number | null;
  living_area: number | null;
  tax_year: string | null;
  assessed_value_total: number | string | null;
  market_value_total: number | string | null;
  owner_info: string | null;
  owner_mailing_address: string | null;
  lng: number | null;
  lat: number | null;
}

export interface PropertySearchResponse {
  results: PropertyRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface SearchFilters {
  q?: string;
  city?: string;
  owner?: string;
  parcel?: string;
  landuse?: string;
  minValue?: number;
  maxValue?: number;
  minBeds?: number;
  maxBeds?: number;
  minSqft?: number;
  maxSqft?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PropertyDetail {
  property_id: number;
  assessment: Record<string, unknown>;
  parcel: Record<string, unknown>;
  ownership: { owner_info: string | null; owner_mailing_address: string | null };
  geometry: { lng: number | null; lat: number | null; centroid: unknown };
  parcels: Array<{ parcel_id: string; parcel_number: string | null }>;
}

export type GeoJsonGeometry = Geometry;

export interface MapFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: {
      parcel_id: string;
      property_id: number;
      market_value_total: number;
      situs_address?: string | null;
    };
    geometry: GeoJsonGeometry;
  }>;
  total: number;
  limit: number;
  truncated: boolean;
  zoom?: number | null;
  geometry?: 'centroid' | 'simplified' | 'polygon';
}

export interface MapSummaryDatum {
  code: string;
  label: string;
  property_count: number;
}


export type SavedSearchQueryParams = {
  q?: string;
  city?: string;
  parcel?: string;
  landuse?: string;
  minValue?: number;
  maxValue?: number;
  minBeds?: number;
  maxBeds?: number;
  minSqft?: number;
  maxSqft?: number;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type SavedSearch = {
  id: string;
  username: string;
  label: string;
  query_params: SavedSearchQueryParams;
  created_at: string;
};

export type AuthSessionResponse = {
  authenticated: boolean;
  authRequired: boolean;
  username?: string;
  expiresAt?: number;
  issuedAt?: number;
  ttlMs: number;
  idleWarningMs: number;
};

function emitUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('dashboard:unauthorized'));
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

async function request<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(runtimeConfig.apiUrl(path), window.location.origin);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  const headers: HeadersInit = {};
  if (runtimeConfig.apiKey) headers['x-api-key'] = runtimeConfig.apiKey;
  const res = await fetch(url.toString(), { headers, credentials: 'same-origin' });
  if (!res.ok) {
    if (res.status === 401) emitUnauthorized();
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body?.message || body?.error || `Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(runtimeConfig.apiUrl(path), window.location.origin);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init?.headers || {}),
  };
  if (runtimeConfig.apiKey) (headers as Record<string, string>)['x-api-key'] = runtimeConfig.apiKey;
  const res = await fetch(url.toString(), { ...init, headers, credentials: 'same-origin' });
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/auth/login') emitUnauthorized();
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body?.message || body?.error || `Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}


async function mutateRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(runtimeConfig.apiUrl(path), window.location.origin);
  const headers: HeadersInit = {
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers || {}),
  };
  if (runtimeConfig.apiKey) (headers as Record<string, string>)['x-api-key'] = runtimeConfig.apiKey;
  const res = await fetch(url.toString(), { ...init, headers, credentials: 'same-origin' });
  if (!res.ok) {
    if (res.status === 401) emitUnauthorized();
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body?.message || body?.error || `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const authApi = {
  session: () => authRequest<AuthSessionResponse>('/api/auth/session'),
  login: (username: string, password: string) =>
    authRequest<AuthSessionResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => authRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST', body: '{}' }),
  touch: () => authRequest<AuthSessionResponse>('/api/auth/touch', { method: 'POST', body: '{}' }),
};


export function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

export const api = {
  summary: () => request<DashboardSummary>('/api/dashboard/summary'),
  valueDistribution: () => request<ValueDistributionDatum[]>('/api/dashboard/value-distribution'),
  salesTrends: () => request<SalesTrendDatum[]>('/api/dashboard/sales-trends'),
  propertyTypes: () => request<PropertyTypeDatum[]>('/api/dashboard/property-types'),
  distributions: (dimension: 'property_type' | 'value_band' | 'assessment_class' = 'property_type') =>
    request<{ dimension: string; items: PropertyTypeDatum[] }>('/api/dashboard/distributions', { dimension }),
  searchProperties: (filters: SearchFilters) => request<PropertySearchResponse>('/api/properties/search', { ...filters }),
  getProperty: (id: number) => request<PropertyDetail>(`/api/properties/${id}`),
  marketTrends: () => request<{ series: SalesTrendDatum[]; semantics: string }>('/api/market/trends'),
  sales: (q?: string) => request<{ results: unknown[]; semantics: string; note: string }>('/api/sales', { q, limit: 25 }),
  mapProperties: (bbox: [number, number, number, number], limit?: number, zoom?: number) =>
    request<MapFeatureCollection>('/api/map/properties', { bbox: bbox.join(','), limit, zoom }),
  mapSummary: (bbox: [number, number, number, number]) =>
    request<MapSummaryDatum[]>('/api/map/summary', { bbox: bbox.join(',') }),
  listSavedSearches: () => request<{ items: SavedSearch[] }>('/api/dashboard/saved-searches'),
  createSavedSearch: (body: { label: string; query_params: SavedSearchQueryParams }) =>
    mutateRequest<SavedSearch>('/api/dashboard/saved-searches', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteSavedSearch: (id: string) =>
    mutateRequest<void>(`/api/dashboard/saved-searches/${id}`, { method: 'DELETE' }),
  /**
   * Download CSV for the current search filters.
   * Owner PII columns require includePii + confirmPii (server also checks dashboard_app role).
   */
  exportSearchCsv: async (
    filters: SearchFilters,
    options: { includePii?: boolean; confirmPii?: boolean; limit?: number } = {},
  ): Promise<{ filename: string; rowCount: number; includePii: boolean }> => {
    const url = new URL(runtimeConfig.apiUrl('/api/properties/export.csv'), window.location.origin);
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== '' && k !== 'offset' && k !== 'limit') url.searchParams.set(k, String(v));
    }
    if (options.limit != null) url.searchParams.set('limit', String(options.limit));
    if (options.includePii) url.searchParams.set('include_pii', 'true');
    if (options.confirmPii) url.searchParams.set('confirm_pii', 'true');
    const headers: HeadersInit = {};
    if (runtimeConfig.apiKey) headers['x-api-key'] = runtimeConfig.apiKey;
    const res = await fetch(url.toString(), { headers, credentials: 'same-origin' });
    if (!res.ok) {
      if (res.status === 401) emitUnauthorized();
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body?.message || body?.error || `Export failed (${res.status})`, res.status);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match?.[1] || 'properties_export.csv';
    const rowCount = Number(res.headers.get('X-Export-Row-Count') || 0);
    const includePii = res.headers.get('X-Export-Include-Pii') === '1';
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
    return { filename, rowCount, includePii };
  },
};

export const currency = (v: number) =>
  '$' + Math.round(v).toLocaleString('en-US');

export const compactCurrency = (v: number) => {
  if (v >= 1_000_000_000) return '$' + (v / 1_000_000_000).toFixed(1) + 'B';
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(1) + 'K';
  return '$' + v.toFixed(0);
};

export const formatNumber = (v: number) => v.toLocaleString('en-US');