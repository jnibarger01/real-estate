import { MarketInsightResponse, MarketSummary, Property } from '../types';

export class LocalMarketInsightService {
  static generate(
    properties: Property[],
    summary: MarketSummary,
    searchRegion: string,
  ): MarketInsightResponse {
    const region = searchRegion || 'Kansas City Metro';
    const reducedShare = properties.length > 0
      ? Math.round((summary.priceReductionsCount / properties.length) * 100)
      : 0;

    const interpretations: string[] = [];
    if (properties.length === 0) {
      interpretations.push('The current filters are too narrow to support a local market interpretation.');
    } else {
      interpretations.push(
        summary.activeListings > summary.recentlySold
          ? 'Within this fixture sample, active listings outnumber recently sold properties.'
          : 'Within this fixture sample, recently sold properties meet or outnumber active listings.',
      );
      interpretations.push(
        reducedShare >= 25
          ? 'Price reductions are relatively common in the current filtered sample.'
          : 'Price reductions are not widespread in the current filtered sample.',
      );
    }

    return {
      executiveSummary: properties.length > 0
        ? `${region} currently contains ${properties.length} matching fixture properties. The median price is $${summary.medianListingPrice.toLocaleString()} and the calculated average time on market is ${summary.avgDaysOnMarket} days.`
        : `No fixture properties match the current ${region} filters. Broaden the location or filters to generate a local market snapshot.`,
      verifiedFacts: [
        `${properties.length} fixture properties match the current filters.`,
        `${summary.activeListings} are for sale, ${summary.pendingCount} are pending, and ${summary.recentlySold} are marked recently sold.`,
        `${summary.priceReductionsCount} matching properties are flagged as price reduced.`,
      ],
      calculatedMetrics: [
        `Median price: $${summary.medianListingPrice.toLocaleString()}.`,
        `Median price per square foot: $${summary.medianPricePerSqFt.toLocaleString()}.`,
        `Average days on market: ${summary.avgDaysOnMarket} days.`,
        `Price-reduced share of this sample: ${reducedShare}%.`,
      ],
      aiInterpretations: interpretations,
      missingDataNotes: [
        'This static demo does not verify live listing availability, pricing, or listing history.',
        'Forecasts, live Zillow/MCP data, and Gemini-generated insights require a separately hosted backend.',
      ],
      predictions: [],
      generatedAt: new Date().toISOString(),
      isAiGenerated: false,
    };
  }
}
