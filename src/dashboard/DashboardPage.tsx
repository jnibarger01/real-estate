/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useQuery } from '@tanstack/react-query';
import { Activity, Building2, DollarSign, Home, TrendingDown, TrendingUp } from 'lucide-react';
import { api, compactCurrency, currency, formatNumber, isUnauthorized, toNumber } from '../lib/api';
import { runtimeConfig } from '../config/runtime';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import KpiCard from './KpiCard';
import ChangeChart from './ChangeChart';
import ValueDistributionChart from './ValueDistributionChart';
import PropertyTypesChart from './PropertyTypesChart';
import PropertyExplorer from './PropertyExplorer';
import PropertyMap from './PropertyMap';
import DashboardFilters, { type DashboardFiltersState } from './DashboardFilters';
import SavedSearches from './SavedSearches';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { useAuth } from '../auth/AuthContext';

export default function DashboardPage() {
  const { logout, session } = useAuth();
  const [filters, setFilters] = useState<DashboardFiltersState>({});
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ lng: number; lat: number } | null>(null);

  const summary = useQuery({ queryKey: ['summary'], queryFn: api.summary });
  const distribution = useQuery({ queryKey: ['value-distribution'], queryFn: api.valueDistribution });
  const trends = useQuery({ queryKey: ['sales-trends'], queryFn: api.salesTrends });
  const types = useQuery({ queryKey: ['property-types'], queryFn: api.propertyTypes });

  const queries = [summary, distribution, trends, types];
  const hasError = queries.some((q) => q.isError);
  const unauthorized = queries.some((q) => isUnauthorized(q.error));
  const isLoading = queries.some((q) => q.isLoading);

  const yoy = summary.data?.yoy_value_change_pct ?? 0;
  const TrendIcon = yoy >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
                <Building2 className="size-6 text-violet-700" />
                Jackson County Property Intelligence
              </h1>
              <p className="text-sm text-slate-500">
                {isLoading ? 'Loading market data…' : `${formatNumber(toNumber(summary.data?.total_properties))} residential parcels across Jackson County, MO. Data source: jackson-county-gis`}
              </p>
            </div>
            {session?.authRequired && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void logout()}
                data-testid="logout-button"
              >
                Log out
              </Button>
            )}
          </div>
          <DashboardFilters value={filters} onChange={setFilters} className="mt-4" />
          <SavedSearches filters={filters} onApply={setFilters} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {runtimeConfig.isPagesBuild && (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
            data-testid="pages-not-pii"
          >
            This GitHub Pages host is not the authenticated property-records app. Owner names and mailing
            addresses are only available from the same-origin API deploy (`bun run start`), not from a
            static bundle.
          </div>
        )}
        {unauthorized && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert" data-testid="auth-required">
            Sign-in is required. Your session may have expired — use Log out / Sign in to continue. A static
            Pages client cannot carry a usable API key.
          </div>
        )}
        {hasError && !unauthorized && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            Some dashboard data failed to load. Confirm this page is served from the API origin and that
            Postgres is reachable.
          </div>
        )}

        {/* KPI cards */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Key metrics">
          <KpiCard
            icon={<Home className="size-5" />}
            label="Properties"
            value={isLoading ? undefined : formatNumber(toNumber(summary.data?.total_properties))}
            help="Residential parcels"
          />
          <KpiCard
            icon={<DollarSign className="size-5" />}
            label="Avg Market Value"
            value={isLoading ? undefined : currency(toNumber(summary.data?.avg_market_value))}
            help={`Median ${summary.data ? currency(toNumber(summary.data.median_market_value)) : '—'}`}
          />
          <KpiCard
            icon={<Activity className="size-5" />}
            label="Total Market Value"
            value={isLoading ? undefined : compactCurrency(toNumber(summary.data?.total_market_value))}
            help={`${summary.data ? `${formatNumber(toNumber(summary.data.total_properties))} parcels` : ''}`}
          />
          <KpiCard
            icon={<TrendIcon className="size-5" />}
            label="Value Change (YoY)"
            testId="kpi-yoy"
            value={isLoading ? undefined : `${yoy >= 0 ? '+' : ''}${yoy.toFixed(2)}%`}
            help={
              summary.data?.yoy_to_year
                ? `Avg market value, ${summary.data.yoy_to_year} vs ${summary.data.yoy_from_year}`
                : 'Avg market value, latest vs prior year'
            }
            trend={summary.data ? yoy : undefined}
          />
        </section>

        {/* Charts row */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Market trends">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-slate-500">Average Market Value</CardTitle>
              <p className="text-xs text-slate-400">Five-year trend, all residential parcels</p>
            </CardHeader>
            <CardContent>
              {trends.isLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <ChangeChart data={trends.data ?? []} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-slate-500">Market Value Distribution</CardTitle>
              <p className="text-xs text-slate-400">Parcel count by market value bucket</p>
            </CardHeader>
            <CardContent>
              {distribution.isLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <ValueDistributionChart data={distribution.data ?? []} />
              )}
            </CardContent>
          </Card>
        </section>

        {/* Property type mix + map */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm text-slate-500">Property Type Mix</CardTitle>
              <p className="text-xs text-slate-400">By land-use category</p>
            </CardHeader>
            <CardContent>
              {types.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <PropertyTypesChart data={types.data ?? []} />
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm text-slate-500">Property Map</CardTitle>
                <p className="text-xs text-slate-400">Pan/zoom to query parcels by map bounds</p>
              </div>
            </CardHeader>
            <CardContent>
              <PropertyMap
                onSelect={(parcelId, propertyId) => {
                  setSelectedParcelId(parcelId);
                  setSelectedPropertyId(propertyId);
                }}
                selectedParcelId={selectedParcelId}
                focus={focus}
              />
            </CardContent>
          </Card>
        </section>

        {/* Explorer table */}
        <PropertyExplorer
          filters={filters}
          selectedPropertyId={selectedPropertyId}
          selectedParcelId={selectedParcelId}
          onSelectProperty={(r) => {
            setSelectedPropertyId(r.property_id);
            setSelectedParcelId(r.parcel_id);
            if (r.lng != null && r.lat != null) setFocus({ lng: Number(r.lng), lat: Number(r.lat) });
          }}
          onClearSelection={() => {
            setSelectedPropertyId(null);
            setSelectedParcelId(null);
          }}
        />
      </main>
    </div>
  );
}