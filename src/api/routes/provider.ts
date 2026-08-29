/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RentCast / live-listing surface preserved from backend.ts.
 * County parcel APIs live on /api/properties/* and must not be overwritten here.
 */

import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { executeRentCastTool, isRentCastConfigured, RentCastProviderError } from '../../server/rentcast.js';
import type { Property, PropertyStatus, PropertyType, SearchFilters } from '../../types.js';

const propertyStatuses: PropertyStatus[] = ['for_sale', 'recently_sold', 'pending', 'foreclosure'];
const propertyTypes: PropertyType[] = ['single_family', 'condo', 'townhouse', 'multi_family', 'manufactured', 'land'];
const PROVIDER_CACHE_TTL_MS = Math.max(60_000, Number(process.env.PROVIDER_CACHE_TTL_MS || 300_000));

interface ProviderCacheEntry {
  expiresAt: number;
  data: unknown;
}

const providerCache = new Map<string, ProviderCacheEntry>();

function optionalNumber(value: unknown, field: string): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RentCastProviderError(`${field} must be a non-negative number.`, 400);
  }
  return parsed;
}

function commaSeparated(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function querySearchParams(query: Record<string, unknown>): Record<string, unknown> {
  const status = commaSeparated(query.status);
  const types = commaSeparated(query.propertyType);
  if (status && status.some((item) => !propertyStatuses.includes(item as PropertyStatus))) {
    throw new RentCastProviderError(`status must contain only: ${propertyStatuses.join(', ')}.`, 400);
  }
  if (types && types.some((item) => !propertyTypes.includes(item as PropertyType))) {
    throw new RentCastProviderError(`propertyType must contain only: ${propertyTypes.join(', ')}.`, 400);
  }

  const city = typeof query.city === 'string' ? query.city.trim() : '';
  const state = typeof query.state === 'string' ? query.state.trim() : '';
  const location = typeof query.location === 'string' ? query.location.trim() : '';
  const zipCode = typeof query.zipCode === 'string' ? query.zipCode.trim() : '';
  const resolvedLocation = location || (city && state ? `${city}, ${state}` : '');

  if (!zipCode && !resolvedLocation) {
    throw new RentCastProviderError('Provide location (city, state) or zipCode.', 400);
  }

  const filters: Partial<SearchFilters> = {
    locationQuery: resolvedLocation || zipCode,
    status: (status || ['for_sale']) as PropertyStatus[],
    propertyTypes: (types || []) as PropertyType[],
    minPrice: optionalNumber(query.minPrice, 'minPrice'),
    maxPrice: optionalNumber(query.maxPrice, 'maxPrice'),
    minBeds: optionalNumber(query.minBeds, 'minBeds'),
    maxBeds: optionalNumber(query.maxBeds, 'maxBeds'),
    minBaths: optionalNumber(query.minBaths, 'minBaths'),
    maxBaths: optionalNumber(query.maxBaths, 'maxBaths'),
    minSqft: optionalNumber(query.minSqft, 'minSqft'),
    maxSqft: optionalNumber(query.maxSqft, 'maxSqft'),
    saleDateRange: (typeof query.saleDateRange === 'string' && ['30d', '90d', '180d', '1y', 'all'].includes(query.saleDateRange)
      ? query.saleDateRange
      : 'all') as SearchFilters['saleDateRange'],
    radiusMiles: 0,
    sortBy: 'best_match',
  };

  return {
    location: resolvedLocation,
    zipCode,
    limit: optionalNumber(query.limit, 'limit') || 50,
    filters,
  };
}

function calculateMarketSummary(properties: Property[], dateRangeLabel: string) {
  const active = properties.filter((property) => property.status === 'for_sale');
  const sold = properties.filter((property) => property.status === 'recently_sold');
  const pending = properties.filter((property) => property.status === 'pending');
  const prices = (items: Property[]) => items.map((property) => property.price).filter((price) => price > 0);
  const median = (values: number[]) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  };
  const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const activePrices = prices(active);
  const soldPrices = prices(sold);
  const allPrices = prices(properties);
  const ppsf = properties.map((property) => property.pricePerSqFt).filter((value) => value > 0);

  return {
    totalProperties: properties.length,
    activeListings: active.length,
    recentlySold: sold.length,
    pendingCount: pending.length,
    avgListingPrice: average(activePrices.length ? activePrices : allPrices),
    medianListingPrice: median(activePrices.length ? activePrices : allPrices),
    avgSalePrice: average(soldPrices.length ? soldPrices : allPrices),
    medianSalePrice: median(soldPrices.length ? soldPrices : allPrices),
    medianPricePerSqFt: median(ppsf),
    avgDaysOnMarket: average(active.map((property) => property.daysOnMarket)),
    saleToListRatio: 0,
    listingInventory: active.length,
    priceTrendPct: 0,
    priceReductionsCount: active.filter((property) => property.priceReduced).length,
    dateRangeLabel,
  };
}

function operatorTokenMatches(authorization: string | undefined): boolean {
  const configured = process.env.RESO_SYNC_TOKEN;
  if (!configured || !authorization?.startsWith('Bearer ')) return false;
  const received = authorization.slice('Bearer '.length);
  const expectedBuffer = Buffer.from(configured);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function cachedProviderTool(toolName: string, params: Record<string, unknown>) {
  const cacheKey = `${toolName}:${JSON.stringify(params)}`;
  const cached = providerCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { data: cached.data, cacheStatus: 'HIT' };
  if (cached) providerCache.delete(cacheKey);
  const data = await executeRentCastTool(toolName, params);
  providerCache.set(cacheKey, { data, expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS });
  return { data, cacheStatus: 'MISS' };
}

export function createProviderRouter(): Router {
  const router = Router();

  router.get('/provider/status', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      provider: 'rentcast',
      configured: isRentCastConfigured(),
      cacheTtlSeconds: Math.round(PROVIDER_CACHE_TTL_MS / 1000),
      capabilities: {
        activeSaleListings: true,
        recentPublicRecordSales: true,
        zipMarketStatistics: true,
        pendingStatus: false,
        avm: true,
      },
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/provider/properties', async (req, res) => {
    try {
      if (!isRentCastConfigured()) throw new RentCastProviderError('Live provider is not configured on the backend.', 503);
      const params = querySearchParams(req.query as Record<string, unknown>);
      const { data, cacheStatus } = await cachedProviderTool('zillow_search', params);
      res.setHeader('X-Provider-Cache', cacheStatus);
      return res.json({ ...data as object, source: 'rentcast', retrievedAt: new Date().toISOString() });
    } catch (error) {
      const providerError = error instanceof RentCastProviderError ? error : null;
      return res.status(providerError?.statusCode || 500).json({ error: providerError?.message || 'Unable to search listings.' });
    }
  });

  router.get('/provider/properties/:propertyId', async (req, res) => {
    try {
      if (!isRentCastConfigured()) throw new RentCastProviderError('Live provider is not configured on the backend.', 503);
      const propertyId = req.params.propertyId.trim();
      if (!propertyId) throw new RentCastProviderError('propertyId is required.', 400);
      const { data, cacheStatus } = await cachedProviderTool('zillow_property_details', { propertyId });
      res.setHeader('X-Provider-Cache', cacheStatus);
      return res.json({ data, source: 'rentcast', retrievedAt: new Date().toISOString() });
    } catch (error) {
      const providerError = error instanceof RentCastProviderError ? error : null;
      return res.status(providerError?.statusCode || 500).json({ error: providerError?.message || 'Unable to load listing.' });
    }
  });

  router.get('/market-summary', async (req, res) => {
    try {
      if (!isRentCastConfigured()) throw new RentCastProviderError('Live provider is not configured on the backend.', 503);
      const params = querySearchParams({ ...req.query, status: req.query.status || 'for_sale,recently_sold' } as Record<string, unknown>);
      const { data, cacheStatus } = await cachedProviderTool('zillow_search', params);
      const results = data as { properties?: Property[]; limitations?: string[]; query?: string };
      res.setHeader('X-Provider-Cache', cacheStatus);
      return res.json({
        marketSummary: calculateMarketSummary(results.properties || [], 'Current provider result set'),
        query: results.query,
        limitations: results.limitations || [],
        source: 'rentcast',
        retrievedAt: new Date().toISOString(),
      });
    } catch (error) {
      const providerError = error instanceof RentCastProviderError ? error : null;
      return res.status(providerError?.statusCode || 500).json({ error: providerError?.message || 'Unable to calculate market summary.' });
    }
  });

  router.get('/reso/sync', (_req, res) => {
    const bridgeConfigured = Boolean(process.env.BRIDGE_RESO_BASE_URL?.trim() && process.env.BRIDGE_RESO_ACCESS_TOKEN?.trim());
    res.json({
      enabled: false,
      bridgeConfigured,
      persistenceConfigured: false,
      requiresOperatorToken: true,
      message: 'RESO sync is not enabled on this deployment.',
    });
  });

  router.post('/reso/sync', (req, res) => {
    if (!process.env.RESO_SYNC_TOKEN) {
      return res.status(503).json({ error: 'RESO sync is not configured.' });
    }
    if (!operatorTokenMatches(req.headers.authorization)) {
      return res.status(401).json({ error: 'Operator authorization is required.' });
    }
    return res.status(501).json({
      error: 'RESO sync requires a configured PostgreSQL persistence adapter and is not enabled by this deployment.',
    });
  });

  return router;
}
