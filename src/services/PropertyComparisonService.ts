/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Property, ComparableProperty, ComparableTolerances } from '../types';
import { MapDataTransformer } from './MapDataTransformer';

export const DEFAULT_COMPARABLE_TOLERANCES: ComparableTolerances = {
  maxDistanceMiles: 2.5,
  maxSqftDiffPct: 25,
  maxAgeDiffYears: 15,
  saleRecencyMonths: 24,
  bedBathVariance: 1,
};

export class PropertyComparisonService {
  /**
   * Identifies top comparable properties for a reference property, calculates similarity scores (0-100),
   * and provides explicit comparison explanations.
   */
  static findTopComparables(
    targetProperty: Property,
    allProperties: Property[],
    tolerances: ComparableTolerances = DEFAULT_COMPARABLE_TOLERANCES,
    limit: number = 6
  ): ComparableProperty[] {
    const candidates = allProperties.filter(p => p.id !== targetProperty.id);
    const results: ComparableProperty[] = [];

    for (const candidate of candidates) {
      const distanceMiles = MapDataTransformer.calculateDistanceMiles(
        targetProperty.address.lat,
        targetProperty.address.lng,
        candidate.address.lat,
        candidate.address.lng
      );

      // Check strict distance cutoff
      if (distanceMiles > tolerances.maxDistanceMiles) continue;

      // Sqft variance %
      const sqftDiffPct = targetProperty.livingAreaSqFt > 0
        ? Math.abs((candidate.livingAreaSqFt - targetProperty.livingAreaSqFt) / targetProperty.livingAreaSqFt) * 100
        : 0;
      if (sqftDiffPct > tolerances.maxSqftDiffPct) continue;

      // Age variance
      const ageDiff = Math.abs(candidate.yearBuilt - targetProperty.yearBuilt);
      if (ageDiff > tolerances.maxAgeDiffYears) continue;

      // Bed/bath variance
      const bedDiff = Math.abs(candidate.bedrooms - targetProperty.bedrooms);
      const bathDiff = Math.abs(candidate.bathrooms - targetProperty.bathrooms);
      if (bedDiff > tolerances.bedBathVariance || bathDiff > tolerances.bedBathVariance) continue;

      // Calculate similarity score (100 base)
      let score = 100;

      // Distance penalty (up to -20 pts)
      score -= Math.min(20, (distanceMiles / tolerances.maxDistanceMiles) * 20);

      // Sqft penalty (up to -25 pts)
      score -= Math.min(25, (sqftDiffPct / tolerances.maxSqftDiffPct) * 25);

      // Property type bonus/penalty (-15 if different type)
      const typeMatch = candidate.propertyType === targetProperty.propertyType;
      if (!typeMatch) score -= 15;

      // Age penalty (up to -10 pts)
      score -= Math.min(10, (ageDiff / tolerances.maxAgeDiffYears) * 10);

      // Bed/Bath penalty
      score -= (bedDiff + bathDiff) * 5;

      // Status adjustment (recently sold properties receive higher baseline comparability)
      if (candidate.status === 'recently_sold') {
        score += 3;
      }

      const finalScore = Math.max(10, Math.min(99.9, Math.round(score * 10) / 10));

      // Build human readable factors
      const factors: string[] = [];
      if (typeMatch) {
        const typeLabel = candidate.propertyType === 'condo' ? 'Appartement / Condo' : 'Single-family home';
        factors.push(`Same property type (${typeLabel})`);
      } else {
        factors.push(`Different type (${candidate.propertyType})`);
      }

      const sqftDelta = Math.abs(candidate.livingAreaSqFt - targetProperty.livingAreaSqFt);
      factors.push(`${sqftDelta} sqft delta (${Math.round(sqftDiffPct)}%)`);

      if (distanceMiles < 0.2) {
        factors.push(`${Math.round(distanceMiles * 5280)} ft away`);
      } else {
        factors.push(`${distanceMiles} mi away`);
      }

      if (bedDiff === 0 && bathDiff === 0) {
        factors.push(`Exact ${candidate.bedrooms}bed / ${candidate.bathrooms}bath layout`);
      }

      const priceDiffPct = targetProperty.price > 0
        ? Math.round(((candidate.price - targetProperty.price) / targetProperty.price) * 100)
        : 0;

      results.push({
        property: candidate,
        similarityScore: finalScore,
        comparisonFactors: factors,
        priceDiffPct,
        distanceMiles,
      });
    }

    // Sort by similarity score descending
    results.sort((a, b) => b.similarityScore - a.similarityScore);
    return results.slice(0, limit);
  }
}
