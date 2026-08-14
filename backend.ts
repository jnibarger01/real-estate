import express from 'express';
import dotenv from 'dotenv';
import { timingSafeEqual } from 'node:crypto';
import { executeRentCastTool, isRentCastConfigured, RentCastProviderError } from './src/server/rentcast';
import type { Property, PropertyStatus, PropertyType, SearchFilters } from './src/types';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PROVIDER_CACHE_TTL_MS = Math.max(60_000, Number(process.env.PROVIDER_CACHE_TTL_MS || 300_000));

interface ProviderCacheEntry {
  expiresAt: number;
  data: any;
}

const providerCache = new Map<string, ProviderCacheEntry>();

const propertyStatuses: PropertyStatus[] = ['for_sale', 'recently_sold', 'pending', 'foreclosure'];
const propertyTypes: PropertyType[] = ['single_family', 'condo', 'townhouse', 'multi_family', 'manufactured', 'land'];

const defaultOrigins = [
  'https://jnibarger01.github.io',
  'http://localhost:5173',
  'http://localhost:3000',
];
const configuredOrigins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    if (origin && !allowedOrigins.has(origin)) return res.sendStatus(403);
    return res.sendStatus(204);
  }

  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ success: false, error: 'Origin not allowed.' });
  }

  next();
});

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
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function querySearchParams(query: express.Request['query']): Record<string, unknown> {
  const status = commaSeparated(query.status);
  const types = commaSeparated(query.propertyType);
  if (status && status.some(item => !propertyStatuses.includes(item as PropertyStatus))) {
    throw new RentCastProviderError(`status must contain only: ${propertyStatuses.join(', ')}.`, 400);
  }
  if (types && types.some(item => !propertyTypes.includes(item as PropertyType))) {
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

  if ((filters.minPrice && filters.maxPrice && filters.minPrice > filters.maxPrice) ||
      (filters.minBeds && filters.maxBeds && filters.minBeds > filters.maxBeds) ||
      (filters.minBaths && filters.maxBaths && filters.minBaths > filters.maxBaths) ||
      (filters.minSqft && filters.maxSqft && filters.minSqft > filters.maxSqft)) {
    throw new RentCastProviderError('Minimum filter values cannot exceed maximum values.', 400);
  }

  return {
    location: resolvedLocation,
    zipCode,
    limit: optionalNumber(query.limit, 'limit') || 50,
    filters,
  };
}

function calculateMarketSummary(properties: Property[], dateRangeLabel: string) {
  const active = properties.filter(property => property.status === 'for_sale');
  const sold = properties.filter(property => property.status === 'recently_sold');
  const pending = properties.filter(property => property.status === 'pending');
  const prices = (items: Property[]) => items.map(property => property.price).filter(price => price > 0);
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
  const ppsf = properties.map(property => property.pricePerSqFt).filter(value => value > 0);

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
    avgDaysOnMarket: average(active.map(property => property.daysOnMarket)),
    saleToListRatio: 0,
    listingInventory: active.length,
    priceTrendPct: 0,
    priceReductionsCount: active.filter(property => property.priceReduced).length,
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

app.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    provider: 'rentcast',
    providerConfigured: isRentCastConfigured(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/provider/status', (_req, res) => {
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
      avm: false,
    },
    timestamp: new Date().toISOString(),
  });
});

// Public, normalized property API. Provider credentials remain server-side.
app.get('/api/properties', async (req, res) => {
  try {
    if (!isRentCastConfigured()) throw new RentCastProviderError('Live provider is not configured on the backend.', 503);
    const params = querySearchParams(req.query);
    const { data, cacheStatus } = await cachedProviderTool('zillow_search', params);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('X-Provider-Cache', cacheStatus);
    return res.json({ ...data, source: 'rentcast', retrievedAt: new Date().toISOString() });
  } catch (error) {
    const providerError = error instanceof RentCastProviderError ? error : null;
    return res.status(providerError?.statusCode || 500).json({ error: providerError?.message || 'Unable to search properties.' });
  }
});

app.get('/api/properties/:propertyId', async (req, res) => {
  try {
    if (!isRentCastConfigured()) throw new RentCastProviderError('Live provider is not configured on the backend.', 503);
    const propertyId = req.params.propertyId.trim();
    if (!propertyId) throw new RentCastProviderError('propertyId is required.', 400);
    const { data, cacheStatus } = await cachedProviderTool('zillow_property_details', { propertyId });
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('X-Provider-Cache', cacheStatus);
    return res.json({ data, source: 'rentcast', retrievedAt: new Date().toISOString() });
  } catch (error) {
    const providerError = error instanceof RentCastProviderError ? error : null;
    return res.status(providerError?.statusCode || 500).json({ error: providerError?.message || 'Unable to load property.' });
  }
});

app.get('/api/market-summary', async (req, res) => {
  try {
    if (!isRentCastConfigured()) throw new RentCastProviderError('Live provider is not configured on the backend.', 503);
    const params = querySearchParams({ ...req.query, status: req.query.status || 'for_sale,recently_sold' });
    const { data, cacheStatus } = await cachedProviderTool('zillow_search', params);
    const results = data as { properties?: Property[]; limitations?: string[]; query?: string };
    res.setHeader('Cache-Control', 'private, max-age=60');
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

// Sync is deliberately an operator endpoint; it is not part of the public browser contract.
app.get('/api/reso/sync', (_req, res) => {
  const bridgeConfigured = Boolean(process.env.BRIDGE_RESO_BASE_URL?.trim() && process.env.BRIDGE_RESO_ACCESS_TOKEN?.trim());
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    enabled: false,
    bridgeConfigured,
    persistenceConfigured: false,
    requiresOperatorToken: true,
    message: bridgeConfigured
      ? 'Bridge credentials are configured, but a PostgreSQL persistence adapter is required before sync can run.'
      : 'Bridge RESO credentials are not configured.',
  });
});

app.post('/api/reso/sync', (req, res) => {
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

// Compatibility endpoint used by the existing GitHub Pages client.
// Despite the legacy path name, this can now dispatch to a real provider.
app.post('/api/zillow/mcp', async (req, res) => {
  res.setHeader('Cache-Control', 'private, max-age=60');

  if (!isRentCastConfigured()) {
    return res.status(503).json({
      success: false,
      provider: 'rentcast',
      source: 'mock_adapter',
      error: 'Live provider is not configured on the backend.',
      timestamp: new Date().toISOString(),
    });
  }

  const { toolName, params } = req.body || {};
  if (!toolName || typeof toolName !== 'string') {
    return res.status(400).json({ success: false, error: 'toolName is required.' });
  }

  try {
    const { data, cacheStatus } = await cachedProviderTool(toolName, params || {});

    res.setHeader('X-Provider-Cache', cacheStatus);
    return res.json({
      success: true,
      data,
      provider: 'rentcast',
      source: 'mcp_server',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const providerError = error instanceof RentCastProviderError ? error : null;
    const status = providerError?.statusCode || 502;
    console.error('[Live provider request failed]', error);
    return res.status(status).json({
      success: false,
      provider: 'rentcast',
      source: 'mcp_server',
      error: providerError?.message || 'Live property provider request failed.',
      timestamp: new Date().toISOString(),
    });
  }
});

// Keep the existing insights surface usable when Pages points at this backend.
// This endpoint is deterministic unless a separate AI implementation is added later.
app.post('/api/market-insights', (req, res) => {
  const { marketSummary = {}, searchRegion = 'selected area' } = req.body || {};
  const total = Number(marketSummary.totalProperties || 0);
  const median = Number(marketSummary.medianListingPrice || 0);
  const ppsf = Number(marketSummary.medianPricePerSqFt || 0);
  const dom = Number(marketSummary.avgDaysOnMarket || 0);

  res.json({
    isAiGenerated: false,
    executiveSummary: `${searchRegion}: ${total} live/provider-backed records are currently in the filtered result set${median ? ` with a median asking/sale price of $${median.toLocaleString()}` : ''}.`,
    verifiedFacts: [
      `${total} provider-backed records matched the current filters.`,
      ...(median ? [`Median price in the current result set is $${median.toLocaleString()}.`] : []),
    ],
    calculatedMetrics: [
      ...(ppsf ? [`Median price per square foot in the current result set is $${ppsf.toLocaleString()}.`] : []),
      ...(dom ? [`Average days on market for active records in the current result set is ${dom} days.`] : []),
    ],
    aiInterpretations: [],
    missingDataNotes: [
      'This backend response is deterministic and is not an appraisal or forecast.',
      'Pending-listing status is not available from the initial RentCast adapter.',
    ],
    predictions: [],
    generatedAt: new Date().toISOString(),
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`KC Real Estate live data API listening on 0.0.0.0:${PORT}`);
});
