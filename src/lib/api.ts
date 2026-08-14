/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Typed API client for the dashboard endpoints. The browser never
 * talks to Postgres directly — everything goes through these routes.
 */

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
  landuse?: string;
  minValue?: number;
  maxValue?: number;
  minBeds?: number;
  maxBeds?: number;
  minSqft?: number;
  maxSqft?: number;
  limit?: number;
  offset?: number;
}

export interface MapFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: {
      parcel_id: string;
      property_id: number;
      market_value_total: number;
    };
    geometry: any;
  }>;
  total: number;
  limit: number;
  truncated: boolean;
}

export interface MapSummaryDatum {
  code: string;
  label: string;
  property_count: number;
}

async function request<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(runtimeConfig.apiUrl(path), window.location.origin);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || body?.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

export const api = {
  summary: () => request<DashboardSummary>('/api/dashboard/summary'),
  valueDistribution: () => request<ValueDistributionDatum[]>('/api/dashboard/value-distribution'),
  salesTrends: () => request<SalesTrendDatum[]>('/api/dashboard/sales-trends'),
  propertyTypes: () => request<PropertyTypeDatum[]>('/api/dashboard/property-types'),
  searchProperties: (filters: SearchFilters) => request<PropertySearchResponse>('/api/properties/search', { ...filters }),
  mapProperties: (bbox: [number, number, number, number], limit = 8000) =>
    request<MapFeatureCollection>('/api/map/properties', { bbox: bbox.join(','), limit }),
  mapSummary: (bbox: [number, number, number, number]) =>
    request<MapSummaryDatum[]>('/api/map/summary', { bbox: bbox.join(',') }),
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