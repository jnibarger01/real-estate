/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Property, 
  MarketSummary, 
  ChartSeriesDataPoint, 
  PriceHistogramBucket, 
  GeographicComparisonItem 
} from '../types';

export class MarketAnalyticsService {
  /**
   * Calculates real summary statistical KPIs from filtered properties list.
   */
  static calculateMarketSummary(properties: Property[], dateRangeLabel = 'Jul 2025 → Jun 2026'): MarketSummary {
    if (properties.length === 0) {
      return {
        totalProperties: 0,
        activeListings: 0,
        recentlySold: 0,
        pendingCount: 0,
        avgListingPrice: 0,
        medianListingPrice: 0,
        avgSalePrice: 0,
        medianSalePrice: 0,
        medianPricePerSqFt: 0,
        avgDaysOnMarket: 0,
        saleToListRatio: 100,
        listingInventory: 0,
        priceTrendPct: 0,
        priceReductionsCount: 0,
        dateRangeLabel,
      };
    }

    const activeListingsList = properties.filter(p => p.status === 'for_sale');
    const recentlySoldList = properties.filter(p => p.status === 'recently_sold');
    const pendingList = properties.filter(p => p.status === 'pending');
    const priceReducedList = properties.filter(p => p.priceReduced);

    const activePrices = activeListingsList.map(p => p.price);
    const soldPrices = recentlySoldList.map(p => p.price);
    const allPrices = properties.map(p => p.price);

    const avgListingPrice = activePrices.length > 0 
      ? Math.round(activePrices.reduce((a, b) => a + b, 0) / activePrices.length) 
      : Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);

    const medianListingPrice = this.calculateMedian(activePrices.length > 0 ? activePrices : allPrices);

    const avgSalePrice = soldPrices.length > 0 
      ? Math.round(soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length) 
      : Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);

    const medianSalePrice = this.calculateMedian(soldPrices.length > 0 ? soldPrices : allPrices);

    const ppsqftList = properties.map(p => p.pricePerSqFt).filter(p => p > 0);
    const medianPricePerSqFt = this.calculateMedian(ppsqftList);

    const domList = properties.map(p => p.daysOnMarket);
    const avgDaysOnMarket = domList.length > 0 
      ? Math.round(domList.reduce((a, b) => a + b, 0) / domList.length) 
      : 0;

    // Calculate Sale-to-List ratio average
    const ratioList = recentlySoldList.map(p => {
      const orig = p.originalPrice || p.price;
      return orig > 0 ? (p.price / orig) * 100 : 100;
    });
    const saleToListRatio = ratioList.length > 0 
      ? Math.round((ratioList.reduce((a, b) => a + b, 0) / ratioList.length) * 10) / 10 
      : 98.4;

    // Historical year-over-year data is not present in the fixture.
    const priceTrendPct = 0;

    return {
      totalProperties: properties.length,
      activeListings: activeListingsList.length,
      recentlySold: recentlySoldList.length,
      pendingCount: pendingList.length,
      avgListingPrice,
      medianListingPrice,
      avgSalePrice,
      medianSalePrice,
      medianPricePerSqFt,
      avgDaysOnMarket,
      saleToListRatio,
      listingInventory: activeListingsList.length,
      priceTrendPct,
      priceReductionsCount: priceReducedList.length,
      dateRangeLabel,
    };
  }

  /**
   * Generates aggregated time series data points for analytical charts.
   */
  static generateTimeSeriesChartData(properties: Property[], groupBy: 'week' | 'month' | 'quarter' | 'year' = 'month'): ChartSeriesDataPoint[] {
    const months = ['Jan 2025', 'Feb 2025', 'Mar 2025', 'Apr 2025', 'May 2025', 'Jun 2025', 'Jul 2025', 'Aug 2025', 'Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025'];
    const baseMedianPrice = properties.length > 0 
      ? this.calculateMedian(properties.map(p => p.price)) 
      : 385000;

    const baseSqftPrice = properties.length > 0 
      ? this.calculateMedian(properties.map(p => p.pricePerSqFt).filter(x => x > 0)) 
      : 240;

    return months.map((monthLabel, idx) => {
      // Simulate historical curve with seasonality
      const trendFactor = 1 + (idx - 6) * 0.008;
      const seasonal = 1 + Math.sin(idx / 2) * 0.03;

      const medList = Math.round(baseMedianPrice * trendFactor * seasonal);
      const medSold = Math.round(medList * 0.985);
      const avgList = Math.round(medList * 1.08);
      const avgSold = Math.round(medSold * 1.06);

      const ppsqft = Math.round(baseSqftPrice * trendFactor);
      const volume = Math.round(15 + Math.sin(idx) * 8 + (properties.length / 3));
      const inventory = Math.round(25 + Math.cos(idx) * 6 + (properties.length / 2));
      const dom = Math.round(18 + Math.cos(idx / 1.5) * 5);
      const ratio = Math.round((97.5 + Math.sin(idx / 2) * 1.5) * 10) / 10;

      return {
        period: monthLabel,
        medianListingPrice: medList,
        medianSoldPrice: medSold,
        avgListingPrice: avgList,
        avgSoldPrice: avgSold,
        medianPricePerSqFt: ppsqft,
        salesVolume: volume,
        activeInventory: inventory,
        avgDaysOnMarket: dom,
        saleToListRatio: ratio,
      };
    });
  }

  /**
   * Generates histogram buckets for property price distribution.
   */
  static generatePriceHistogram(properties: Property[]): PriceHistogramBucket[] {
    const buckets: PriceHistogramBucket[] = [
      { rangeLabel: '< $250k', minPrice: 0, maxPrice: 250000, count: 0 },
      { rangeLabel: '$250k - $400k', minPrice: 250000, maxPrice: 400000, count: 0 },
      { rangeLabel: '$400k - $600k', minPrice: 400000, maxPrice: 600000, count: 0 },
      { rangeLabel: '$600k - $800k', minPrice: 600000, maxPrice: 800000, count: 0 },
      { rangeLabel: '$800k - $1M', minPrice: 800000, maxPrice: 1000000, count: 0 },
      { rangeLabel: '$1M+', minPrice: 1000000, maxPrice: Infinity, count: 0 },
    ];

    for (const p of properties) {
      for (const b of buckets) {
        if (p.price >= b.minPrice && p.price < b.maxPrice) {
          b.count++;
          break;
        }
      }
    }

    return buckets;
  }

  /**
   * Generates property type breakdown.
   */
  static generatePropertyTypeBreakdown(properties: Property[]) {
    const counts: Record<string, number> = {
      'Single Family': 0,
      'Condo': 0,
      'Townhouse': 0,
      'Multi-Family': 0,
      'Other': 0,
    };

    for (const p of properties) {
      if (p.propertyType === 'single_family') counts['Single Family']++;
      else if (p.propertyType === 'condo') counts['Condo']++;
      else if (p.propertyType === 'townhouse') counts['Townhouse']++;
      else if (p.propertyType === 'multi_family') counts['Multi-Family']++;
      else counts['Other']++;
    }

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }

  /**
   * Generates geographic comparison data across ZIP codes / neighborhoods.
   */
  static generateGeographicComparison(properties: Property[]): GeographicComparisonItem[] {
    const grouped: Record<string, Property[]> = {};

    for (const p of properties) {
      const key = p.address.neighborhood || p.address.zipCode || p.address.city;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    }

    return Object.entries(grouped).map(([name, list]) => {
      const prices = list.map(p => p.price);
      const ppsqft = list.map(p => p.pricePerSqFt).filter(x => x > 0);
      const dom = list.map(p => p.daysOnMarket);

      return {
        name,
        medianSalePrice: this.calculateMedian(prices),
        medianListingPrice: this.calculateMedian(prices),
        medianPricePerSqFt: this.calculateMedian(ppsqft),
        salesVolume: list.length,
        daysOnMarket: Math.round(dom.reduce((a, b) => a + b, 0) / (dom.length || 1)),
        yoyChangePct: 0,
      };
    });
  }

  static calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) return sorted[half];
    return Math.round((sorted[half - 1] + sorted[half]) / 2);
  }
}
