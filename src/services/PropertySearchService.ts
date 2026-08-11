/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Property, SearchFilters } from '../types';
import { MapDataTransformer } from './MapDataTransformer';

export class PropertySearchService {
  /**
   * Filters property list based on structured SearchFilters.
   */
  static filterProperties(properties: Property[], filters: SearchFilters, searchCenter?: { lat: number; lng: number }): Property[] {
    let result = [...properties];

    // 1. Text / Location Search
    if (filters.locationQuery && filters.locationQuery.trim()) {
      const normalizeLocation = (value: string) => value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      const queries = filters.locationQuery
        .split('/')
        .map(normalizeLocation)
        .filter(Boolean);
      result = result.filter(p => {
        const addr = normalizeLocation(`${p.address.street} ${p.address.city} ${p.address.state} ${p.address.zipCode} ${p.address.neighborhood || ''}`);
        return queries.some(query =>
          query.split(' ').every(token => addr.split(' ').includes(token))
        );
      });
    }

    // 2. Status Filter
    if (filters.status && filters.status.length > 0) {
      result = result.filter(p => filters.status.includes(p.status));
    }

    // 3. Property Types
    if (filters.propertyTypes && filters.propertyTypes.length > 0) {
      result = result.filter(p => filters.propertyTypes.includes(p.propertyType));
    }

    // 4. Price range
    if (filters.minPrice !== undefined && filters.minPrice > 0) {
      result = result.filter(p => p.price >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
      result = result.filter(p => p.price <= filters.maxPrice!);
    }

    // 5. Bedrooms & Bathrooms
    if (filters.minBeds !== undefined && filters.minBeds > 0) {
      result = result.filter(p => p.bedrooms >= filters.minBeds!);
    }
    if (filters.maxBeds !== undefined && filters.maxBeds > 0) {
      result = result.filter(p => p.bedrooms <= filters.maxBeds!);
    }
    if (filters.minBaths !== undefined && filters.minBaths > 0) {
      result = result.filter(p => p.bathrooms >= filters.minBaths!);
    }
    if (filters.maxBaths !== undefined && filters.maxBaths > 0) {
      result = result.filter(p => p.bathrooms <= filters.maxBaths!);
    }

    // 6. Square Footage & Lot Size
    if (filters.minSqft !== undefined && filters.minSqft > 0) {
      result = result.filter(p => p.livingAreaSqFt >= filters.minSqft!);
    }
    if (filters.maxSqft !== undefined && filters.maxSqft > 0) {
      result = result.filter(p => p.livingAreaSqFt <= filters.maxSqft!);
    }

    // 7. Days on Market
    if (filters.maxDaysOnMarket !== undefined && filters.maxDaysOnMarket > 0) {
      result = result.filter(p => p.daysOnMarket <= filters.maxDaysOnMarket!);
    }

    // 8. Feature toggles
    if (filters.isPriceReduced) {
      result = result.filter(p => p.priceReduced);
    }
    if (filters.isWaterfront) {
      result = result.filter(p => p.features.waterfront);
    }
    if (filters.hasPool) {
      result = result.filter(p => p.features.pool);
    }
    if (filters.hasGarage) {
      result = result.filter(p => p.features.garage);
    }
    if (filters.isNewConstruction) {
      result = result.filter(p => p.features.newConstruction || p.yearBuilt >= 2024);
    }
    if (filters.isOpenHouse) {
      result = result.filter(p => p.features.openHouse);
    }

    // 9. Radius filter if search center provided
    if (searchCenter && filters.radiusMiles && filters.radiusMiles > 0) {
      result = result.filter(p => {
        const dist = MapDataTransformer.calculateDistanceMiles(
          searchCenter.lat,
          searchCenter.lng,
          p.address.lat,
          p.address.lng
        );
        return dist <= filters.radiusMiles;
      });
    }

    // 10. Polygon bounds if specified
    if (filters.polygonBounds && filters.polygonBounds.length >= 3) {
      result = result.filter(p => this.isPointInPolygon(p.address.lat, p.address.lng, filters.polygonBounds!));
    }

    // 11. Sorting
    return this.sortProperties(result, filters.sortBy, searchCenter);
  }

  /**
   * Sorts properties list based on sortBy metric.
   */
  static sortProperties(properties: Property[], sortBy: SearchFilters['sortBy'], searchCenter?: { lat: number; lng: number }): Property[] {
    const list = [...properties];

    switch (sortBy) {
      case 'price_asc':
        return list.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return list.sort((a, b) => b.price - a.price);
      case 'recently_listed':
        return list.sort((a, b) => new Date(b.dateListed).getTime() - new Date(a.dateListed).getTime());
      case 'recently_sold':
        return list.sort((a, b) => {
          const dateA = a.lastSoldDate ? new Date(a.lastSoldDate).getTime() : 0;
          const dateB = b.lastSoldDate ? new Date(b.lastSoldDate).getTime() : 0;
          return dateB - dateA;
        });
      case 'price_sqft':
        return list.sort((a, b) => a.pricePerSqFt - b.pricePerSqFt);
      case 'days_on_market':
        return list.sort((a, b) => a.daysOnMarket - b.daysOnMarket);
      case 'price_reduction':
        return list.sort((a, b) => (b.priceReductionAmount || 0) - (a.priceReductionAmount || 0));
      case 'distance':
        if (searchCenter) {
          return list.sort((a, b) => {
            const distA = MapDataTransformer.calculateDistanceMiles(searchCenter.lat, searchCenter.lng, a.address.lat, a.address.lng);
            const distB = MapDataTransformer.calculateDistanceMiles(searchCenter.lat, searchCenter.lng, b.address.lat, b.address.lng);
            return distA - distB;
          });
        }
        return list;
      case 'best_match':
      default:
        // Best match prioritizes price-reduced active listings & recent entries
        return list.sort((a, b) => {
          const scoreA = (a.priceReduced ? 20 : 0) - a.daysOnMarket + (a.status === 'for_sale' ? 10 : 0);
          const scoreB = (b.priceReduced ? 20 : 0) - b.daysOnMarket + (b.status === 'for_sale' ? 10 : 0);
          return scoreB - scoreA;
        });
    }
  }

  /**
   * Ray-casting algorithm to test if a point is inside a polygon boundary.
   */
  private static isPointInPolygon(lat: number, lng: number, polygon: { lat: number; lng: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;
      const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
