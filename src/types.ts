/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PropertyStatus = 'for_sale' | 'recently_sold' | 'pending' | 'foreclosure';

export type PropertyType = 
  | 'single_family' 
  | 'condo' 
  | 'townhouse' 
  | 'multi_family' 
  | 'manufactured' 
  | 'land';

export interface PropertyAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  neighborhood?: string;
  lat: number;
  lng: number;
}

export interface PriceHistoryEntry {
  date: string;
  event: 'Listed' | 'Sold' | 'Price Change' | 'Pending' | 'Relisted' | 'Listing Removed';
  price: number;
  priceChange?: number;
  priceChangePct?: number;
  source?: string;
}

export interface TaxHistoryEntry {
  year: number;
  propertyTaxes: number;
  taxAssessmentValue: number;
  assessmentLand?: number;
  assessmentImprovement?: number;
}

export interface NearbySchool {
  name: string;
  rating: number; // 1-10
  grades: string; // e.g. "K-5", "6-8"
  distanceMiles: number;
  schoolType: 'Public' | 'Private' | 'Charter';
}

export interface PropertyFeatures {
  waterfront?: boolean;
  pool?: boolean;
  garage?: boolean;
  garageSpaces?: number;
  newConstruction?: boolean;
  openHouse?: boolean;
  openHouseDate?: string;
  heating?: string;
  cooling?: string;
  stories?: number;
  hoaFeeMonthly?: number;
  architectureStyle?: string;
}

export interface Property {
  id: string;
  zpid: string;
  address: PropertyAddress;
  price: number;
  originalPrice?: number;
  lastSoldPrice?: number;
  lastSoldDate?: string;
  status: PropertyStatus;
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  livingAreaSqFt: number;
  lotSizeSqFt: number;
  yearBuilt: number;
  pricePerSqFt: number;
  daysOnMarket: number;
  dateListed: string;
  zestimate?: number;
  rentZestimate?: number;
  hoaFee?: number;
  priceReduced: boolean;
  priceReductionAmount?: number;
  priceReductionDate?: string;
  images: string[];
  features: PropertyFeatures;
  priceHistory: PriceHistoryEntry[];
  taxHistory: TaxHistoryEntry[];
  nearbySchools: NearbySchool[];
  description?: string;
  sourceAttribution: string;
  retrievedAt: string;
  isMockData?: boolean;
}

export interface MarketSummary {
  totalProperties: number;
  activeListings: number;
  recentlySold: number;
  pendingCount: number;
  avgListingPrice: number;
  medianListingPrice: number;
  avgSalePrice: number;
  medianSalePrice: number;
  medianPricePerSqFt: number;
  avgDaysOnMarket: number;
  saleToListRatio: number; // percentage, e.g. 98.5
  listingInventory: number;
  priceTrendPct: number; // e.g. +6.4%
  priceReductionsCount: number;
  dateRangeLabel: string;
}

export interface ComparableProperty {
  property: Property;
  similarityScore: number; // 0 - 100
  comparisonFactors: string[];
  priceDiffPct: number; // % difference from reference property price
  distanceMiles: number;
}

export interface ComparableTolerances {
  maxDistanceMiles: number; // default 1.0
  maxSqftDiffPct: number; // default 15%
  maxAgeDiffYears: number; // default 10
  saleRecencyMonths: number; // default 12
  bedBathVariance: number; // default 1
}

export interface MapViewport {
  southWest: { lat: number; lng: number };
  northEast: { lat: number; lng: number };
  center: { lat: number; lng: number };
  zoom: number;
}

export interface SearchFilters {
  locationQuery: string; // address, city, state, or ZIP
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  radiusMiles: number;
  viewport?: MapViewport;
  status: PropertyStatus[];
  propertyTypes: PropertyType[];
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  minLotSqft?: number;
  maxLotSqft?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  maxDaysOnMarket?: number;
  minPricePerSqFt?: number;
  maxPricePerSqFt?: number;
  maxHoaFee?: number;
  isNewConstruction?: boolean;
  isOpenHouse?: boolean;
  isPriceReduced?: boolean;
  isWaterfront?: boolean;
  hasGarage?: boolean;
  hasPool?: boolean;
  saleDateRange: '30d' | '90d' | '180d' | '1y' | 'all';
  sortBy: 'best_match' | 'price_asc' | 'price_desc' | 'recently_listed' | 'recently_sold' | 'price_sqft' | 'days_on_market' | 'distance' | 'price_reduction';
  polygonBounds?: { lat: number; lng: number }[];
}

export interface SavedSearch {
  id: string;
  name: string;
  createdAt: string;
  filters: SearchFilters;
}

export interface ChartSeriesDataPoint {
  period: string; // e.g. "Jul 2025" or "Q1 2025"
  medianListingPrice: number;
  medianSoldPrice: number;
  avgListingPrice: number;
  avgSoldPrice: number;
  medianPricePerSqFt: number;
  salesVolume: number;
  activeInventory: number;
  avgDaysOnMarket: number;
  saleToListRatio: number;
}

export interface GeographicComparisonItem {
  name: string; // Neighborhood or ZIP code
  medianSalePrice: number;
  medianListingPrice: number;
  medianPricePerSqFt: number;
  salesVolume: number;
  daysOnMarket: number;
  yoyChangePct: number;
}

export interface PriceHistogramBucket {
  rangeLabel: string;
  minPrice: number;
  maxPrice: number;
  count: number;
}

export interface MarketInsightResponse {
  verifiedFacts: string[];
  calculatedMetrics: string[];
  aiInterpretations: string[];
  missingDataNotes: string[];
  executiveSummary: string;
  predictions: string[];
  generatedAt: string;
  isAiGenerated: boolean;
}

export interface ZillowMcpToolRequest {
  toolName: 'zillow_search' | 'zillow_property_details' | 'zillow_comparables' | 'zillow_market_trends' | 'zillow_zestimate';
  params: Record<string, any>;
}

export interface ZillowMcpToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  source: 'mcp_server' | 'mock_adapter';
  timestamp: string;
}
