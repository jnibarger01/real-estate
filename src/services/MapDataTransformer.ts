/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Property, MapViewport } from '../types';

export interface MapCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  properties: Property[];
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  dominantStatus: 'for_sale' | 'recently_sold' | 'pending' | 'foreclosure';
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number; // 0.0 to 1.0
  weight: number;
}

const NO_LISTING_PHOTO = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#e5e7eb"/>
  <path d="M420 520V350l180-140 180 140v170H650V410H550v110H420Z" fill="#9ca3af"/>
  <text x="600" y="610" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" fill="#4b5563">No listing photo supplied</text>
</svg>`)} `;

export class MapDataTransformer {
  /**
   * Normalizes raw provider / MCP responses into strict Property models.
   * Live records intentionally keep unavailable fields empty instead of inventing estimates.
   */
  static normalizePropertyData(raw: any): Property {
    const defaultDate = new Date().toISOString().split('T')[0];
    const rawAddr = raw.address || raw.propertyAddress || {};
    const street = rawAddr.street || rawAddr.streetAddress || raw.street || 'Address Unavailable';
    const city = rawAddr.city || raw.city || 'Unknown City';
    const state = rawAddr.state || raw.state || 'XX';
    const zipCode = String(rawAddr.zipCode || rawAddr.zipcode || raw.zipCode || '00000');
    const lat = Number(raw.latitude ?? raw.lat ?? rawAddr.latitude ?? rawAddr.lat ?? 38.9842);
    const lng = Number(raw.longitude ?? raw.lng ?? rawAddr.longitude ?? rawAddr.lng ?? -94.6685);

    const price = Number(raw.price ?? raw.unformattedPrice ?? raw.listPrice ?? 0);
    const livingAreaSqFt = Number(raw.livingArea ?? raw.livingAreaSqFt ?? raw.sqft ?? raw.buildingArea ?? 0);
    const pricePerSqFt = price && livingAreaSqFt ? Math.round(price / livingAreaSqFt) : Number(raw.pricePerSqFt || 0);
    const isMockData = Boolean(raw.isMockData);
    const images = Array.isArray(raw.images) && raw.images.length > 0 ? raw.images : [NO_LISTING_PHOTO];

    return {
      id: String(raw.id || raw.zpid || `prop-${Math.random().toString(36).substring(2, 9)}`),
      zpid: String(raw.zpid || raw.id || '0000000'),
      address: {
        street,
        city,
        state,
        zipCode,
        neighborhood: rawAddr.neighborhood || raw.neighborhood || undefined,
        lat: isNaN(lat) ? 38.9842 : lat,
        lng: isNaN(lng) ? -94.6685 : lng,
      },
      price,
      originalPrice: raw.originalPrice != null ? Number(raw.originalPrice) : undefined,
      lastSoldPrice: raw.lastSoldPrice != null ? Number(raw.lastSoldPrice) : undefined,
      lastSoldDate: raw.lastSoldDate || undefined,
      status: (['for_sale', 'recently_sold', 'pending', 'foreclosure'].includes(raw.status)
        ? raw.status
        : (raw.homeStatus === 'RECENTLY_SOLD' ? 'recently_sold' : raw.homeStatus === 'PENDING' ? 'pending' : 'for_sale')),
      propertyType: (['single_family', 'condo', 'townhouse', 'multi_family', 'manufactured', 'land'].includes(raw.propertyType)
        ? raw.propertyType
        : 'single_family'),
      bedrooms: Number(raw.bedrooms ?? raw.beds ?? 0),
      bathrooms: Number(raw.bathrooms ?? raw.baths ?? 0),
      livingAreaSqFt,
      lotSizeSqFt: Number(raw.lotSizeSqFt ?? raw.lotSize ?? 0),
      yearBuilt: Number(raw.yearBuilt ?? 0),
      pricePerSqFt,
      daysOnMarket: Number(raw.daysOnMarket ?? raw.daysOnZillow ?? 0),
      dateListed: raw.dateListed || defaultDate,
      zestimate: raw.zestimate != null ? Number(raw.zestimate) : undefined,
      rentZestimate: raw.rentZestimate != null ? Number(raw.rentZestimate) : undefined,
      hoaFee: raw.hoaFee != null ? Number(raw.hoaFee) : undefined,
      priceReduced: Boolean(raw.priceReduced || (raw.originalPrice != null && price < Number(raw.originalPrice))),
      priceReductionAmount: raw.priceReductionAmount != null
        ? Number(raw.priceReductionAmount)
        : (raw.originalPrice != null && price < Number(raw.originalPrice) ? Number(raw.originalPrice) - price : undefined),
      priceReductionDate: raw.priceReductionDate || undefined,
      images,
      features: raw.features || {},
      priceHistory: Array.isArray(raw.priceHistory) ? raw.priceHistory : [],
      taxHistory: Array.isArray(raw.taxHistory) ? raw.taxHistory : [],
      nearbySchools: Array.isArray(raw.nearbySchools) ? raw.nearbySchools : [],
      description: raw.description || (isMockData ? 'Fixture property record.' : 'Property data provided by the configured real-estate source.'),
      sourceAttribution: raw.sourceAttribution || (isMockData ? 'Local fixture dataset' : 'Configured real-estate provider'),
      retrievedAt: raw.retrievedAt || new Date().toISOString(),
      isMockData,
    };
  }

  /**
   * Filters properties based on current map viewport bounding box.
   */
  static filterPropertiesByViewport(properties: Property[], viewport?: MapViewport): Property[] {
    if (!viewport || !viewport.southWest || !viewport.northEast) return properties;
    const { southWest, northEast } = viewport;
    return properties.filter(p => {
      const { lat, lng } = p.address;
      return (
        lat >= Math.min(southWest.lat, northEast.lat) &&
        lat <= Math.max(southWest.lat, northEast.lat) &&
        lng >= Math.min(southWest.lng, northEast.lng) &&
        lng <= Math.max(southWest.lng, northEast.lng)
      );
    });
  }

  /**
   * Clusters properties dynamically based on high-performance O(N) grid cell binning.
   */
  static clusterProperties(properties: Property[], zoom: number): { clusters: MapCluster[]; unclustered: Property[] } {
    if (zoom >= 15 || properties.length <= 1) {
      return { clusters: [], unclustered: properties };
    }

    const cellSize = 0.08 / Math.pow(2, Math.max(0, zoom - 8));
    const gridMap = new Map<string, Property[]>();

    for (const p of properties) {
      const cellX = Math.floor(p.address.lat / cellSize);
      const cellY = Math.floor(p.address.lng / cellSize);
      const key = `${cellX}_${cellY}`;

      const existing = gridMap.get(key);
      if (existing) {
        existing.push(p);
      } else {
        gridMap.set(key, [p]);
      }
    }

    const clusters: MapCluster[] = [];
    const unclustered: Property[] = [];
    let clusterIndex = 0;

    gridMap.forEach((group, key) => {
      if (group.length > 1) {
        const totalLat = group.reduce((sum, item) => sum + item.address.lat, 0);
        const totalLng = group.reduce((sum, item) => sum + item.address.lng, 0);
        const prices = group.map(g => g.price);
        const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

        clusters.push({
          id: `cluster-${key}-${clusterIndex++}-${group.length}`,
          lat: totalLat / group.length,
          lng: totalLng / group.length,
          count: group.length,
          properties: group,
          avgPrice,
          minPrice: Math.min(...prices),
          maxPrice: Math.max(...prices),
          dominantStatus: group[0].status,
        });
      } else {
        unclustered.push(group[0]);
      }
    });

    return { clusters, unclustered };
  }

  /**
   * Computes normalized heatmap points from properties and price/density values.
   */
  static generateHeatmapPoints(properties: Property[]): HeatmapPoint[] {
    if (properties.length === 0) return [];
    const maxPrice = Math.max(...properties.map(p => p.price), 1);

    return properties.map(p => ({
      lat: p.address.lat,
      lng: p.address.lng,
      intensity: Math.min(1.0, Math.max(0.2, p.price / maxPrice)),
      weight: p.price,
    }));
  }

  /**
   * Calculates Haversine distance in miles between two coordinates.
   */
  static calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }
}
