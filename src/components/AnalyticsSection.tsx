/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Property, ChartSeriesDataPoint } from '../types';
import { MarketAnalyticsService } from '../services/MarketAnalyticsService';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart as PieIcon, 
  Building, 
  Map, 
  Maximize2,
  Calendar,
  Layers
} from 'lucide-react';

interface AnalyticsSectionProps {
  properties: Property[];
  onFilterByPriceRange?: (min: number, max: number) => void;
  onFilterByPropertyType?: (type: string) => void;
}

const DONUT_COLORS = ['#3182ce', '#38a169', '#d69e2e', '#e53e3e', '#805ad5'];

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  properties,
  onFilterByPriceRange,
  onFilterByPropertyType,
}) => {
  const [groupBy, setGroupBy] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  // Compute analytics series datasets
  const timeSeriesData = MarketAnalyticsService.generateTimeSeriesChartData(properties, groupBy);
  const priceHistogramData = MarketAnalyticsService.generatePriceHistogram(properties);
  const propertyTypeBreakdown = MarketAnalyticsService.generatePropertyTypeBreakdown(properties);
  const geographicComparisonData = MarketAnalyticsService.generateGeographicComparison(properties);

  const formatCurrency = (val: number) => `$${val.toLocaleString()}`;

  return (
    <div className="space-y-6 mt-8 pt-6 border-t border-slate-200">
      {/* Analytics Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Market Analytics & Historical Visualizations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Browser-side exploratory analytics derived from the current fixture dataset. Trend series are modeled illustrations, not verified historical Zillow records.
          </p>
        </div>

        {/* Group By Time Period Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold self-start sm:self-auto">
          {(['week', 'month', 'quarter', 'year'] as const).map(period => (
            <button
              key={period}
              onClick={() => setGroupBy(period)}
              className={`px-3 py-1 rounded-lg capitalize transition-all ${
                groupBy === period
                  ? 'bg-white text-blue-600 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Grid 1: Price Trends & $/SqFt Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Median & Avg Price Trends */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Home Pricing Trend
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Listing vs Sold</span>
          </div>

          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, '']}
                  contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '12px', fontSize: '11px', borderColor: '#1E293B' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="medianListingPrice" name="Median Listing Price" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="medianSoldPrice" name="Median Sold Price" stroke="#16a34a" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="avgListingPrice" name="Avg Listing Price" stroke="#d97706" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Median $/SqFt Trend */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <Maximize2 className="w-4 h-4 text-teal-600" />
              Price per Square Foot ($/sqft)
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Intensity Trend</span>
          </div>

          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value: any) => [`$${value} / sq ft`, '$/SqFt']}
                  contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '12px', fontSize: '11px', borderColor: '#1E293B' }}
                />
                <Line type="monotone" dataKey="medianPricePerSqFt" name="Median $/SqFt" stroke="#0d9488" strokeWidth={2.5} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid 2: Sales Volume & Inventory Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 3: Sales Volume Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest">
              Sales Volume (Transactions)
            </h3>
          </div>
          <div className="h-56 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '12px', fontSize: '11px', borderColor: '#1E293B' }} />
                <Bar dataKey="salesVolume" name="Completed Sales" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Active Inventory Trend */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest">
              Listing Inventory
            </h3>
          </div>
          <div className="h-56 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '12px', fontSize: '11px', borderColor: '#1E293B' }} />
                <Line type="monotone" dataKey="activeInventory" name="Active Listings" stroke="#ea580c" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Days on Market */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest">
              Days on Market (DOM)
            </h3>
          </div>
          <div className="h-56 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '12px', fontSize: '11px', borderColor: '#1E293B' }} />
                <Bar dataKey="avgDaysOnMarket" name="Avg DOM" fill="#9333ea" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid 3: Distribution Histogram & Property Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Price Distribution Histogram */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest">
              Price Distribution Histogram
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Click bar to filter map</span>
          </div>

          <div className="h-56 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priceHistogramData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="rangeLabel" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '12px', fontSize: '11px', borderColor: '#1E293B' }} />
                <Bar
                  dataKey="count"
                  name="Property Count"
                  fill="#0d9488"
                  radius={[6, 6, 0, 0]}
                  onClick={(entry) => {
                    if (onFilterByPriceRange && entry) {
                      onFilterByPriceRange(entry.minPrice, entry.maxPrice);
                    }
                  }}
                  className="cursor-pointer hover:opacity-80"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Property Type Breakdown Donut Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest">
              Property Type Distribution
            </h3>
          </div>

          <div className="h-56 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={propertyTypeBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {propertyTypeBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '12px', fontSize: '11px', borderColor: '#1E293B' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid 4: Geographic Neighborhood Comparison Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
            <Map className="w-4 h-4 text-blue-600" />
            Geographic Neighborhood & ZIP Code Market Comparison
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Cross-Area Benchmark</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-2.5 px-3">Neighborhood / ZIP</th>
                <th className="py-2.5 px-3">Median Sale Price</th>
                <th className="py-2.5 px-3">Median $/SqFt</th>
                <th className="py-2.5 px-3">Volume</th>
                <th className="py-2.5 px-3">Avg Days on Market</th>
                <th className="py-2.5 px-3">YoY Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {geographicComparisonData.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-slate-900">{item.name}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">${item.medianSalePrice.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-slate-600">${item.medianPricePerSqFt}</td>
                  <td className="py-2.5 px-3 text-slate-600">{item.salesVolume} homes</td>
                  <td className="py-2.5 px-3 text-slate-600">{item.daysOnMarket} days</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block bg-slate-50 text-slate-600 border border-slate-200 text-[11px] font-bold px-2 py-0.5 rounded">
                      Unavailable
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
