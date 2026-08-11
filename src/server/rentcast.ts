import type { Property, PropertyType, SearchFilters } from '../types';

const RENTCAST_BASE_URL = 'https://api.rentcast.io/v1';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type RentCastRecord = Record<string, any>;

export class RentCastProviderError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message);
    this.name = 'RentCastProviderError';
  }
}

export function isRentCastConfigured(): boolean {
  return Boolean(process.env.RENTCAST_API_KEY?.trim());
}

function requireApiKey(): string {
  const apiKey = process.env.RENTCAST_API_KEY?.trim();
  if (!apiKey) {
    throw new RentCastProviderError('RENTCAST_API_KEY is not configured.', 503);
  }
  return apiKey;
}

async function rentCastGet(pathname: string, query: URLSearchParams): Promise<any> {
  const apiKey = requireApiKey();
  const url = `${RENTCAST_BASE_URL}${pathname}?${query.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Api-Key': apiKey,
      'User-Agent': 'kc-real-estate-market-explorer/1.0',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const message = response.status === 401
      ? 'RentCast rejected the API key or subscription.'
      : response.status === 429
        ? 'RentCast rate limit exceeded.'
        : `RentCast request failed with HTTP ${response.status}.`;
    console.error('[RentCast]', response.status, body.slice(0, 500));
    throw new RentCastProviderError(message, response.status === 429 ? 429 : 502);
  }

  return response.json();
}

function normalizePropertyType(value: unknown): PropertyType {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('condo')) return 'condo';
  if (normalized.includes('town')) return 'townhouse';
  if (normalized.includes('multi') || normalized.includes('apartment')) return 'multi_family';
  if (normalized.includes('manufactured') || normalized.includes('mobile')) return 'manufactured';
  if (normalized.includes('land')) return 'land';
  return 'single_family';
}

function toRentCastPropertyTypes(types?: PropertyType[]): string | undefined {
  if (!types?.length) return undefined;
  const mapped = types.map(type => ({
    single_family: 'Single Family',
    condo: 'Condo',
    townhouse: 'Townhouse',
    multi_family: 'Multi-Family',
    manufactured: 'Manufactured',
    land: 'Land',
  })[type]);
  return [...new Set(mapped.filter(Boolean))].join('|') || undefined;
}

function range(min?: number, max?: number): string | undefined {
  if (min == null && max == null) return undefined;
  return `${min ?? '*'}:${max ?? '*'}`;
}

function saleRangeDays(value?: SearchFilters['saleDateRange']): number | undefined {
  switch (value) {
    case '30d': return 30;
    case '90d': return 90;
    case '180d': return 180;
    case '1y': return 365;
    default: return undefined;
  }
}

function parseLocation(params: Record<string, any>): { city?: string; state?: string; zipCode?: string } {
  const filters = params.filters as SearchFilters | undefined;
  const explicitZip = String(params.zipCode || filters?.zipCode || '').match(/\b\d{5}\b/)?.[0];
  if (explicitZip) return { zipCode: explicitZip };

  const location = String(params.location || filters?.locationQuery || '').trim();
  const zip = location.match(/\b\d{5}\b/)?.[0];
  if (zip && !location.includes('/')) return { zipCode: zip };

  // For legacy combined fixture labels, prefer the first city instead of silently
  // narrowing the live query to a ZIP code from the second half of the label.
  const primary = location.split('/')[0].trim().replace(/\s+\d{5}\b.*$/, '').trim();
  const cityState = primary.match(/^(.+?),\s*([A-Za-z]{2})$/);
  if (cityState) return { city: cityState[1].trim(), state: cityState[2].toUpperCase() };

  const cityStateLoose = primary.match(/^(.+?)\s+([A-Za-z]{2})$/);
  if (cityStateLoose) return { city: cityStateLoose[1].trim(), state: cityStateLoose[2].toUpperCase() };

  if (zip) return { zipCode: zip };
  throw new RentCastProviderError('Use a city/state (for example Kansas City, MO) or a 5-digit ZIP code for live searches.', 400);
}

function appendLocation(query: URLSearchParams, params: Record<string, any>): void {
  const location = parseLocation(params);
  if (location.zipCode) query.set('zipCode', location.zipCode);
  if (location.city) query.set('city', location.city);
  if (location.state) query.set('state', location.state);
}

function appendCommonFilters(query: URLSearchParams, filters?: SearchFilters, includePrice = false): void {
  if (!filters) return;
  const propertyType = toRentCastPropertyTypes(filters.propertyTypes);
  const bedrooms = range(filters.minBeds, filters.maxBeds);
  const bathrooms = range(filters.minBaths, filters.maxBaths);
  const squareFootage = range(filters.minSqft, filters.maxSqft);
  const lotSize = range(filters.minLotSqft, filters.maxLotSqft);
  const yearBuilt = range(filters.minYearBuilt, filters.maxYearBuilt);
  const price = range(filters.minPrice, filters.maxPrice);

  if (propertyType) query.set('propertyType', propertyType);
  if (bedrooms) query.set('bedrooms', bedrooms);
  if (bathrooms) query.set('bathrooms', bathrooms);
  if (squareFootage) query.set('squareFootage', squareFootage);
  if (lotSize) query.set('lotSize', lotSize);
  if (yearBuilt) query.set('yearBuilt', yearBuilt);
  if (includePrice && price) query.set('price', price);
}

function listingHistory(record: RentCastRecord) {
  return Object.entries(record.history || {})
    .map(([date, item]: [string, any]) => ({
      date: item?.listedDate || date,
      event: 'Listed' as const,
      price: Number(item?.price || 0),
      source: 'RentCast API',
    }))
    .filter(entry => entry.price > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function taxHistory(record: RentCastRecord) {
  const assessments = record.taxAssessments || {};
  const taxes = record.propertyTaxes || {};
  const years = new Set([...Object.keys(assessments), ...Object.keys(taxes)]);
  return [...years]
    .map(year => ({
      year: Number(year),
      propertyTaxes: Number(taxes[year]?.total || 0),
      taxAssessmentValue: Number(assessments[year]?.value || 0),
      assessmentLand: assessments[year]?.land != null ? Number(assessments[year].land) : undefined,
      assessmentImprovement: assessments[year]?.improvements != null ? Number(assessments[year].improvements) : undefined,
    }))
    .filter(entry => Number.isFinite(entry.year))
    .sort((a, b) => b.year - a.year);
}

function baseProperty(record: RentCastRecord): Pick<Property,
  'id' | 'zpid' | 'address' | 'propertyType' | 'bedrooms' | 'bathrooms' | 'livingAreaSqFt' |
  'lotSizeSqFt' | 'yearBuilt' | 'features' | 'taxHistory' | 'nearbySchools' | 'sourceAttribution' |
  'retrievedAt' | 'isMockData'> {
  const street = [record.addressLine1, record.addressLine2].filter(Boolean).join(', ') || 'Address unavailable';
  return {
    id: String(record.id),
    zpid: String(record.id),
    address: {
      street,
      city: String(record.city || ''),
      state: String(record.state || ''),
      zipCode: String(record.zipCode || ''),
      neighborhood: record.subdivision || undefined,
      lat: Number(record.latitude),
      lng: Number(record.longitude),
    },
    propertyType: normalizePropertyType(record.propertyType),
    bedrooms: Number(record.bedrooms || 0),
    bathrooms: Number(record.bathrooms || 0),
    livingAreaSqFt: Number(record.squareFootage || 0),
    lotSizeSqFt: Number(record.lotSize || 0),
    yearBuilt: Number(record.yearBuilt || 0),
    features: {
      garage: Boolean(record.features?.garage),
      garageSpaces: record.features?.garageSpaces != null ? Number(record.features.garageSpaces) : undefined,
      pool: Boolean(record.features?.pool),
      heating: record.features?.heatingType,
      cooling: record.features?.coolingType,
      stories: record.features?.floorCount != null ? Number(record.features.floorCount) : undefined,
      hoaFeeMonthly: record.hoa?.fee != null ? Number(record.hoa.fee) : undefined,
      architectureStyle: record.features?.architectureType,
    },
    taxHistory: taxHistory(record),
    nearbySchools: [],
    sourceAttribution: `RentCast API${record.mlsName ? ` · ${record.mlsName}` : ''}${record.mlsNumber ? ` #${record.mlsNumber}` : ''}`,
    retrievedAt: new Date().toISOString(),
    isMockData: false,
  };
}

function normalizeListing(record: RentCastRecord): Property {
  const price = Number(record.price || 0);
  const sqft = Number(record.squareFootage || 0);
  const history = listingHistory(record);
  const originalPrice = history.find(entry => entry.price > 0)?.price || price;
  const isForeclosure = String(record.listingType || '').toLowerCase() === 'foreclosure';

  return {
    ...baseProperty(record),
    price,
    originalPrice,
    status: isForeclosure ? 'foreclosure' : 'for_sale',
    pricePerSqFt: sqft > 0 ? Math.round(price / sqft) : 0,
    daysOnMarket: Number(record.daysOnMarket || 0),
    dateListed: record.listedDate || record.createdDate || new Date().toISOString(),
    hoaFee: record.hoa?.fee != null ? Number(record.hoa.fee) : undefined,
    priceReduced: originalPrice > price,
    priceReductionAmount: originalPrice > price ? originalPrice - price : undefined,
    images: [],
    features: {
      ...baseProperty(record).features,
      newConstruction: String(record.listingType || '').toLowerCase() === 'new construction',
    },
    priceHistory: history,
    description: `Live sale listing retrieved from RentCast${record.listingOffice?.name ? `; listing office: ${record.listingOffice.name}` : ''}.`,
  };
}

function normalizeSoldRecord(record: RentCastRecord): Property {
  const price = Number(record.lastSalePrice || 0);
  const sqft = Number(record.squareFootage || 0);
  const saleHistory = Object.entries(record.history || {})
    .map(([date, item]: [string, any]) => ({
      date: item?.date || date,
      event: 'Sold' as const,
      price: Number(item?.price || 0),
      source: 'RentCast public-record data',
    }))
    .filter(entry => entry.price > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return {
    ...baseProperty(record),
    price,
    lastSoldPrice: price || undefined,
    lastSoldDate: record.lastSaleDate || undefined,
    status: 'recently_sold',
    pricePerSqFt: sqft > 0 && price > 0 ? Math.round(price / sqft) : 0,
    daysOnMarket: 0,
    dateListed: record.lastSaleDate || new Date().toISOString(),
    hoaFee: record.hoa?.fee != null ? Number(record.hoa.fee) : undefined,
    priceReduced: false,
    images: [],
    priceHistory: saleHistory,
    description: 'Recent sale record retrieved from RentCast public-record data.',
  };
}

async function searchProperties(params: Record<string, any>) {
  const filters = params.filters as SearchFilters | undefined;
  const requestedStatuses = filters?.status?.length ? filters.status : ['for_sale'];
  const requestedLimit = Math.min(MAX_LIMIT, Math.max(1, Number(params.limit || DEFAULT_LIMIT)));
  const properties: Property[] = [];
  const limitations: string[] = [];

  if (requestedStatuses.includes('for_sale') || requestedStatuses.includes('foreclosure')) {
    const query = new URLSearchParams({ status: 'Active', limit: String(requestedLimit) });
    appendLocation(query, params);
    appendCommonFilters(query, filters, true);
    const listings = await rentCastGet('/listings/sale', query);
    for (const listing of Array.isArray(listings) ? listings : []) {
      const normalized = normalizeListing(listing);
      if (requestedStatuses.includes(normalized.status) || (normalized.status === 'for_sale' && requestedStatuses.includes('for_sale'))) {
        properties.push(normalized);
      }
    }
  }

  if (requestedStatuses.includes('recently_sold')) {
    const query = new URLSearchParams({ limit: String(requestedLimit) });
    appendLocation(query, params);
    appendCommonFilters(query, filters, false);
    const days = saleRangeDays(filters?.saleDateRange);
    if (days) query.set('saleDateRange', String(days));
    const soldRecords = await rentCastGet('/properties', query);
    for (const record of Array.isArray(soldRecords) ? soldRecords : []) {
      if (record.lastSalePrice && record.lastSaleDate) properties.push(normalizeSoldRecord(record));
    }
  }

  if (requestedStatuses.includes('pending')) {
    limitations.push('RentCast sale-listing status exposes Active/Inactive, not a distinct Pending state; pending-only records are not returned by this adapter.');
  }

  const deduped = [...new Map(properties.map(property => [property.id, property])).values()]
    .slice(0, requestedLimit);

  return {
    totalReturned: deduped.length,
    properties: deduped,
    query: params.location || filters?.locationQuery || 'Live search',
    provider: 'rentcast',
    limitations,
  };
}

async function propertyDetails(params: Record<string, any>) {
  const id = String(params.propertyId || params.zpid || '').trim();
  if (!id) throw new RentCastProviderError('propertyId is required.', 400);
  const record = await rentCastGet(`/properties/${encodeURIComponent(id)}`, new URLSearchParams());
  return normalizeSoldRecord(record);
}

async function marketTrends(params: Record<string, any>) {
  const { zipCode } = parseLocation(params);
  if (!zipCode) {
    throw new RentCastProviderError('RentCast market statistics require a 5-digit ZIP code.', 400);
  }
  return rentCastGet('/markets', new URLSearchParams({ zipCode, dataType: 'Sale', historyRange: '12' }));
}

export async function executeRentCastTool(toolName: string, params: Record<string, any>): Promise<any> {
  switch (toolName) {
    case 'zillow_search':
      return searchProperties(params);
    case 'zillow_property_details':
      return propertyDetails(params);
    case 'zillow_market_trends':
      return marketTrends(params);
    case 'zillow_comparables':
      throw new RentCastProviderError('Live comparable scoring is currently calculated client-side from the returned live result set.', 400);
    case 'zillow_zestimate':
      throw new RentCastProviderError('The RentCast AVM endpoint is not enabled in this adapter yet.', 400);
    default:
      throw new RentCastProviderError(`Unsupported real-estate tool: ${toolName}`, 400);
  }
}
