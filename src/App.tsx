/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Property, 
  SearchFilters, 
  MarketSummary, 
  ComparableProperty, 
  ComparableTolerances, 
  MarketInsightResponse,
} from './types';
import { ZillowMcpClient } from './services/ZillowMcpClient';
import { MarketAnalyticsService } from './services/MarketAnalyticsService';
import { PropertyComparisonService } from './services/PropertyComparisonService';
import { MapDataTransformer } from './services/MapDataTransformer';
import { LocalMarketInsightService } from './services/LocalMarketInsightService';
import { runtimeConfig } from './config/runtime';

// UI Components
import { MobileHeroHeader } from './components/MobileHeroHeader';
import { FilterToolbar } from './components/FilterToolbar';
import { FilterDrawer } from './components/FilterDrawer';
import { MapSection } from './components/MapSection';
import { KpiSummaryBar } from './components/KpiSummaryBar';
import { InsightPanel } from './components/InsightPanel';
import { PropertyResultsPanel } from './components/PropertyResultsPanel';
import { PropertyDetailDrawer } from './components/PropertyDetailDrawer';
import { ComparableTolerancesModal } from './components/ComparableTolerancesModal';
import { AnalyticsSection } from './components/AnalyticsSection';
import { McpStatusModal } from './components/McpStatusModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { BottomNav } from './components/BottomNav';
import { ChevronRight } from 'lucide-react';

const DEFAULT_FILTERS: SearchFilters = {
  locationQuery: 'Kansas City, MO / Overland Park 66204',
  radiusMiles: 10,
  status: ['for_sale', 'recently_sold', 'pending'],
  propertyTypes: ['single_family', 'condo', 'townhouse'],
  saleDateRange: '1y',
  sortBy: 'best_match',
};

const DEFAULT_TOLERANCES: ComparableTolerances = {
  maxDistanceMiles: 5.0,
  maxSqftDiffPct: 35,
  maxAgeDiffYears: 25,
  saleRecencyMonths: 24,
  bedBathVariance: 2,
};

export default function App() {
  // Application State
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [comparables, setComparables] = useState<ComparableProperty[]>([]);
  const [marketSummary, setMarketSummary] = useState<MarketSummary>({
    totalProperties: 0,
    activeListings: 0,
    recentlySold: 0,
    pendingCount: 0,
    medianListingPrice: 0,
    avgListingPrice: 0,
    medianSalePrice: 0,
    avgSalePrice: 0,
    medianPricePerSqFt: 0,
    avgPricePerSqFt: 0,
    avgDaysOnMarket: 0,
    saleToListRatio: 0,
    priceReductionsCount: 0,
    priceTrendPct: 0,
  });

  const [tolerances, setTolerances] = useState<ComparableTolerances>(DEFAULT_TOLERANCES);
  const [insights, setInsights] = useState<MarketInsightResponse | null>(null);
  const [mcpSource, setMcpSource] = useState<'mcp_server' | 'mock_adapter'>('mock_adapter');
  const [isInsightsLoading, setIsInsightsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals & Drawers state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isTolerancesModalOpen, setIsTolerancesModalOpen] = useState(false);
  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Filter change handler
  const handleFilterChange = (updated: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...updated }));
  };

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setTolerances(DEFAULT_TOLERANCES);
  }, []);

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.tagName === 'SELECT' ||
         target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        setIsFilterDrawerOpen(false);
        setIsDetailDrawerOpen(false);
        setIsTolerancesModalOpen(false);
        setIsMcpModalOpen(false);
        setIsShortcutsModalOpen(false);
        return;
      }

      if ((e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setIsFilterDrawerOpen(prev => !prev);
        return;
      }

      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const mapElem = document.getElementById('interactive-map-container');
        if (mapElem) {
          mapElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          mapElem.focus();
        }
        return;
      }

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setIsShortcutsModalOpen(prev => !prev);
        return;
      }

      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleResetFilters();
        return;
      }

      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsTolerancesModalOpen(prev => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetFilters]);

  // Fetch Zillow MCP Data
  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await ZillowMcpClient.executeTool('zillow_search', {
        location: filters.locationQuery,
        radiusMiles: filters.radiusMiles,
        status: filters.status,
        propertyTypes: filters.propertyTypes,
        filters,
      });

      if (response.data?.properties) {
        const fetchedProps: Property[] = response.data.properties.map((p: any) =>
          MapDataTransformer.normalizePropertyData(p)
        );

        setProperties(fetchedProps);
        setMcpSource(response.source);

        const summary = MarketAnalyticsService.calculateMarketSummary(fetchedProps);
        setMarketSummary(summary);

        setSelectedProperty(current =>
          fetchedProps.find(property => property.id === current?.id) || fetchedProps[0] || null
        );
      }
    } catch (err) {
      console.error('Failed to execute Zillow MCP search:', err);
      setLoadError('Property data could not be loaded. Please try again.');
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute Top Comparables
  useEffect(() => {
    if (selectedProperty && properties.length > 0) {
      const comps = PropertyComparisonService.findTopComparables(
        selectedProperty,
        properties,
        tolerances,
        8
      );
      setComparables(comps);
    } else {
      setComparables([]);
    }
  }, [selectedProperty, properties, tolerances]);

  // Fetch AI Market Insights
  const handleFetchInsights = async () => {
    if (runtimeConfig.isStatic) {
      setInsights(LocalMarketInsightService.generate(properties, marketSummary, filters.locationQuery));
      return;
    }

    setIsInsightsLoading(true);
    try {
      const res = await fetch(runtimeConfig.apiUrl('/api/market-insights'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketSummary,
          sampleProperties: properties.slice(0, 5),
          searchRegion: filters.locationQuery,
          filterDetails: filters,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setInsights(data);
      } else {
        setInsights(LocalMarketInsightService.generate(properties, marketSummary, filters.locationQuery));
      }
    } catch (err) {
      console.error('Failed to fetch AI market insights:', err);
      setInsights(LocalMarketInsightService.generate(properties, marketSummary, filters.locationQuery));
    } finally {
      setIsInsightsLoading(false);
    }
  };

  useEffect(() => {
    if (properties.length > 0) {
      handleFetchInsights();
    }
  }, [properties, marketSummary, filters.locationQuery]);

  const handleSelectProperty = (p: Property) => {
    setSelectedProperty(p);
    setIsDetailDrawerOpen(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F4F5F7] text-slate-800 font-sans antialiased flex flex-col pb-20 selection:bg-purple-600 selection:text-white">
      {/* 1. Mobile & Desktop Top Bar + Skyline Hero Banner */}
      <MobileHeroHeader
        currentArea={filters.locationQuery}
        mcpSource={mcpSource}
        deploymentMode={runtimeConfig.deploymentMode}
        onOpenMenu={() => setIsFilterDrawerOpen(true)}
        onOpenMcpModal={() => setIsMcpModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onSearchSubmit={(q) => handleFilterChange({ locationQuery: q })}
      />

      {/* 2. Quick Filter Toolbar Bar */}
      <div className="max-w-6xl w-full mx-auto px-3 sm:px-4 mt-3">
        <FilterToolbar
          filters={filters}
          onChangeFilters={handleFilterChange}
          onOpenDrawer={() => setIsFilterDrawerOpen(true)}
          onResetFilters={handleResetFilters}
        />
      </div>

      {/* 3. Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 space-y-6">
        {loadError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {loadError}
          </div>
        )}
        {/* Quick KPI Stat Cards (2x2 / 4-card grid) */}
        <KpiSummaryBar summary={marketSummary} />

        {/* Section: Explore Map */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Explore Map
            </h2>
            <button
              onClick={() => {
                const mapElem = document.getElementById('interactive-map-container');
                if (mapElem) mapElem.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs sm:text-sm font-bold text-[#7e22ce] hover:text-[#6b21a8] transition-colors flex items-center gap-0.5"
            >
              <span>See all</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <MapSection
            properties={properties}
            selectedProperty={selectedProperty}
            onSelectProperty={(p) => setSelectedProperty(p)}
            medianPrice={marketSummary.medianListingPrice}
          />
        </section>

        {/* Section: Hot Opportunities (Properties Grid) */}
        <section className="pt-2">
          <PropertyResultsPanel
            properties={properties}
            comparables={comparables}
            selectedProperty={selectedProperty}
            onSelectProperty={handleSelectProperty}
            onOpenTolerancesModal={() => setIsTolerancesModalOpen(true)}
            sortBy={filters.sortBy}
            onChangeSortBy={(sort) => handleFilterChange({ sortBy: sort })}
            onSeeAll={() => setIsFilterDrawerOpen(true)}
          />
        </section>

        {/* Section: Market Insights Card */}
        <section className="pt-2">
          <InsightPanel
            insights={insights}
            summary={marketSummary}
            searchRegion={filters.locationQuery}
            onRefreshInsights={handleFetchInsights}
            isLoading={isInsightsLoading}
            deploymentMode={runtimeConfig.deploymentMode}
          />
        </section>

        {/* Section: Analytics Visualizations */}
        <section className="pt-2">
          <AnalyticsSection
            properties={properties}
            onFilterByPriceRange={(min, max) => handleFilterChange({ minPrice: min, maxPrice: max })}
            onFilterByPropertyType={(type) => handleFilterChange({ propertyTypes: [type as any] })}
          />
        </section>
      </main>

      {/* 4. Bottom Navigation Bar */}
      <BottomNav
        onOpenFilterDrawer={() => setIsFilterDrawerOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
      />

      {/* Modals & Drawers */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={filters}
        onChangeFilters={handleFilterChange}
        onResetFilters={handleResetFilters}
      />

      <PropertyDetailDrawer
        isOpen={isDetailDrawerOpen}
        property={selectedProperty}
        onClose={() => setIsDetailDrawerOpen(false)}
      />

      <ComparableTolerancesModal
        isOpen={isTolerancesModalOpen}
        onClose={() => setIsTolerancesModalOpen(false)}
        tolerances={tolerances}
        onChangeTolerances={(t) => setTolerances(t)}
        onReset={() => setTolerances(DEFAULT_TOLERANCES)}
      />

      <McpStatusModal
        isOpen={isMcpModalOpen}
        onClose={() => setIsMcpModalOpen(false)}
        mcpSource={mcpSource}
        deploymentMode={runtimeConfig.deploymentMode}
        onRefreshData={loadData}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  );
}
