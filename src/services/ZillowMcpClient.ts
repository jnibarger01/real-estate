/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ZillowMcpToolRequest,
  ZillowMcpToolResponse,
  SearchFilters,
  ComparableTolerances,
} from '../types';
import { LruCache } from '../server/lruCache';
import { MapDataTransformer } from './MapDataTransformer';
import { PropertySearchService } from './PropertySearchService';
import { PropertyComparisonService } from './PropertyComparisonService';
import { runtimeConfig } from '../config/runtime';

interface CacheEntry<T> {
  data: T;
  source: 'mcp_server' | 'mock_adapter';
}

export class ZillowMcpClient {
  private static cache = new LruCache<CacheEntry<any>>(200, 5 * 60 * 1000);
  private static activeController: AbortController | null = null;

  private static validateParams(toolName: ZillowMcpToolRequest['toolName'], params: Record<string, any>): string | null {
    if (!toolName) return 'Missing toolName';

    switch (toolName) {
      case 'zillow_search':
        if (!params.location && !params.zipCode && !params.city && !params.viewport) {
          return 'At least one location identifier (location, city, zipCode, or viewport) is required for zillow_search.';
        }
        break;
      case 'zillow_property_details':
      case 'zillow_zestimate':
        if (!params.zpid && !params.propertyId) {
          return 'zpid or propertyId parameter is required for property details / zestimate lookup.';
        }
        break;
      case 'zillow_comparables':
        if (!params.zpid && !params.propertyId) {
          return 'zpid or propertyId parameter is required for comparable property analysis.';
        }
        break;
      case 'zillow_market_trends':
        if (!params.location && !params.zipCode && !params.city) {
          return 'location, city, or zipCode parameter is required for market trends analysis.';
        }
        break;
    }
    return null;
  }

  static async executeTool<T = any>(
    toolName: ZillowMcpToolRequest['toolName'],
    params: Record<string, any>
  ): Promise<ZillowMcpToolResponse<T>> {
    const validationError = this.validateParams(toolName, params);
    if (validationError) {
      return {
        success: false,
        error: `Parameter Validation Error: ${validationError}`,
        source: 'mcp_server',
        timestamp: new Date().toISOString(),
      };
    }

    const cacheKey = `${toolName}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached.data,
        source: cached.source,
        timestamp: new Date().toISOString(),
      };
    }

    if (this.activeController) {
      this.activeController.abort();
    }
    this.activeController = new AbortController();

    if (runtimeConfig.allowFixtures) {
      const fallbackData = await this.executeLocalMockAdapter(toolName, params);
      this.cache.set(cacheKey, { data: fallbackData, source: 'mock_adapter' });
      return {
        success: true,
        data: fallbackData as T,
        source: 'mock_adapter',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (runtimeConfig.apiKey) headers['x-api-key'] = runtimeConfig.apiKey;
      const response = await fetch(runtimeConfig.apiUrl('/api/zillow/mcp'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ toolName, params }),
        signal: this.activeController.signal,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) {
        return {
          success: false,
          error: result.error || `Provider request failed (${response.status})`,
          source: 'mcp_server',
          timestamp: new Date().toISOString(),
        };
      }
      if (result.success && result.data) {
        this.cache.set(cacheKey, { data: result.data, source: result.source || 'mcp_server' });
        return result;
      }
      return {
        success: false,
        error: 'Provider returned an empty payload.',
        source: 'mcp_server',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          success: false,
          error: 'aborted',
          source: 'mcp_server',
          timestamp: new Date().toISOString(),
        };
      }
      return {
        success: false,
        error: err?.message || 'Provider request failed.',
        source: 'mcp_server',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private static async executeLocalMockAdapter(toolName: ZillowMcpToolRequest['toolName'], params: Record<string, any>) {
    const { INITIAL_REAL_ESTATE_PROPERTIES } = await import('../data/mockRealEstateData');
    switch (toolName) {
      case 'zillow_search': {
        const filters: SearchFilters = params.filters || {
          locationQuery: params.location || params.city || params.zipCode || '',
          radiusMiles: params.radiusMiles || 10,
          status: params.status || ['for_sale', 'recently_sold', 'pending'],
          propertyTypes: params.propertyTypes || ['single_family', 'condo', 'townhouse'],
          saleDateRange: '1y',
          sortBy: params.sortBy || 'best_match',
        };

        const filtered = PropertySearchService.filterProperties(
          INITIAL_REAL_ESTATE_PROPERTIES.map(p => MapDataTransformer.normalizePropertyData(p)),
          filters,
          params.searchCenter
        );

        return {
          totalReturned: filtered.length,
          properties: filtered,
          query: params.location || 'All Locations',
        };
      }

      case 'zillow_property_details': {
        const zpid = String(params.zpid || params.propertyId);
        const found = INITIAL_REAL_ESTATE_PROPERTIES.find(p => p.zpid === zpid || p.id === zpid);
        if (!found) {
          throw new Error(`Unknown property id: ${zpid}`);
        }
        return MapDataTransformer.normalizePropertyData(found);
      }

      case 'zillow_comparables': {
        const zpid = String(params.zpid || params.propertyId);
        const refProperty = INITIAL_REAL_ESTATE_PROPERTIES.find(p => p.zpid === zpid || p.id === zpid);
        if (!refProperty) {
          throw new Error(`Unknown property id: ${zpid}`);
        }
        const normalizedRef = MapDataTransformer.normalizePropertyData(refProperty);
        const normalizedAll = INITIAL_REAL_ESTATE_PROPERTIES.map(p => MapDataTransformer.normalizePropertyData(p));
        const tolerances: ComparableTolerances = params.tolerances || {
          maxDistanceMiles: 5.0,
          maxSqftDiffPct: 35,
          maxAgeDiffYears: 25,
          saleRecencyMonths: 24,
          bedBathVariance: 2,
        };

        const comps = PropertyComparisonService.findTopComparables(normalizedRef, normalizedAll, tolerances, 8);

        return {
          referenceProperty: normalizedRef,
          comparables: comps,
          tolerancesUsed: tolerances,
        };
      }

      case 'zillow_market_trends': {
        return {
          location: params.location || 'Selected Search Region',
          medianPrice: 395000,
          yoyPriceChangePct: 6.4,
          avgDaysOnMarket: 19,
          inventoryCount: 42,
          saleToListRatio: 98.6,
        };
      }

      default:
        throw new Error(`Unknown fixture tool: ${toolName}`);
    }
  }

  static clearCache() {
    this.cache.clear();
  }
}
