import { describe, expect, it } from 'vitest';
import { PropertySearchService } from '../src/services/PropertySearchService';
import type { Property, SearchFilters } from '../src/types';
const property = (id: string, lat: number, lng: number, price: number): Property => ({ id, zpid: id, address: { street: id, city: 'Kansas City', state: 'MO', zipCode: '64101', lat, lng }, price, status: 'for_sale', propertyType: 'single_family', bedrooms: 3, bathrooms: 2, livingAreaSqFt: 1500, lotSizeSqFt: 0, yearBuilt: 2000, pricePerSqFt: price / 1500, daysOnMarket: 3, dateListed: '2026-01-01', priceReduced: false, images: [], features: {}, priceHistory: [], taxHistory: [], nearbySchools: [], sourceAttribution: 'test', retrievedAt: '2026-01-01' });
const filters: SearchFilters = { locationQuery: '', radiusMiles: 10, status: ['for_sale'], propertyTypes: ['single_family'], saleDateRange: 'all', sortBy: 'price_asc' };
describe('PropertySearchService', () => it('filters by drawn polygon and sorts results', () => {
  const result = PropertySearchService.filterProperties([property('inside', 1, 1, 300), property('outside', 5, 5, 100)], { ...filters, polygonBounds: [{ lat: 0, lng: 0 }, { lat: 0, lng: 2 }, { lat: 2, lng: 2 }, { lat: 2, lng: 0 }] });
  expect(result.map(value => value.id)).toEqual(['inside']);
}));
