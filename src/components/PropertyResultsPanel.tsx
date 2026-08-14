/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Property, ComparableProperty, SearchFilters } from '../types';
import { 
  Building2, 
  MapPin, 
  SlidersHorizontal,
  Download,
  Sparkles,
  Flame,
  ChevronRight
} from 'lucide-react';

interface PropertyResultsPanelProps {
  properties: Property[];
  comparables: ComparableProperty[];
  selectedProperty: Property | null;
  onSelectProperty: (p: Property) => void;
  onOpenTolerancesModal: () => void;
  sortBy: SearchFilters['sortBy'];
  onChangeSortBy: (sort: SearchFilters['sortBy']) => void;
  onSeeAll?: () => void;
}

export const PropertyResultsPanel: React.FC<PropertyResultsPanelProps> = ({
  properties,
  comparables,
  selectedProperty,
  onSelectProperty,
  onOpenTolerancesModal,
  sortBy,
  onChangeSortBy,
  onSeeAll,
}) => {
  const [activeTab, setActiveTab] = useState<'hot' | 'comparables' | 'results'>('hot');

  const handleDownloadCSV = () => {
    if (!properties || properties.length === 0) return;
    const headers = [
      'ZPID', 'Street Address', 'City', 'State', 'Zip Code',
      'Price ($)', 'Price/SqFt ($)', 'Bedrooms', 'Bathrooms', 'Living SqFt', 'Status'
    ];
    const rows = properties.map(p => [
      p.zpid,
      `"${(p.address.street || '').replace(/"/g, '""')}"`,
      `"${(p.address.city || '').replace(/"/g, '""')}"`,
      p.address.state || '',
      p.address.zipCode || '',
      p.price || 0,
      p.pricePerSqFt || 0,
      p.bedrooms || 0,
      p.bathrooms || 0,
      p.livingAreaSqFt || 0,
      p.status || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `real_estate_properties_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Section Header: Hot Opportunities | See all */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Hot Opportunities
          </h2>
        </div>
        <button
          onClick={onSeeAll || (() => setActiveTab('results'))}
          className="text-xs sm:text-sm font-bold text-[#7e22ce] hover:text-[#6b21a8] transition-colors flex items-center gap-0.5"
        >
          <span>See all</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Toolbar */}
      <div className="flex items-center justify-between bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs gap-2">
        <div className="flex items-center gap-1 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('hot')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'hot'
                ? 'bg-[#6b21a8] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Featured</span>
          </button>

          <button
            onClick={() => setActiveTab('comparables')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'comparables'
                ? 'bg-[#6b21a8] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Top Comps</span>
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'results'
                ? 'bg-[#6b21a8] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>All ({properties.length})</span>
          </button>
        </div>

        <button
          onClick={handleDownloadCSV}
          disabled={properties.length === 0}
          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1 transition-all border border-slate-200 shadow-2xs shrink-0"
          title="Download properties CSV"
        >
          <Download className="w-3.5 h-3.5 text-[#6b21a8]" />
        </button>
      </div>

      {properties.length === 0 && (
        <div role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
          <h3 className="text-base font-bold text-slate-900">No fixture properties match these filters</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Try Kansas City, MO or Overland Park, KS 66204, or broaden the price and property filters.
          </p>
        </div>
      )}

      {/* Tab 1: Featured Hot Opportunities Cards */}
      {activeTab === 'hot' && (
        <AnimatePresence mode="popLayout">
          <motion.div 
            key="hot-grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5"
          >
            {properties.slice(0, 6).map((p, idx) => {
              const isSelected = selectedProperty?.id === p.id;
              const priceFormatted = `$${p.price.toLocaleString()}`;
              const locationLine = `${p.address.city}, ${p.address.state}`;
              const specsLine = `${p.bedrooms} bd • ${p.bathrooms} ba • ${p.livingAreaSqFt?.toLocaleString() || 1200} sqft`;

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.22, delay: idx * 0.04 }}
                  onClick={() => onSelectProperty(p)}
                  className={`bg-white rounded-2xl overflow-hidden border transition-all cursor-pointer hover:shadow-lg flex flex-col justify-between ${
                    isSelected ? 'border-[#6b21a8] ring-2 ring-[#6b21a8]/20 shadow-md' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top Image */}
                  <div className="relative w-full h-36 bg-slate-100 overflow-hidden">
                    <img
                      src={p.images[0]}
                      alt={p.address.street}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {p.priceReduced && (
                      <span className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md shadow-md uppercase">
                        Price Reduced
                      </span>
                    )}
                  </div>

                  {/* Card Details */}
                  <div className="p-3.5 flex flex-col gap-1">
                    <div className="text-base font-extrabold text-slate-900 tracking-tight">
                      {priceFormatted}
                    </div>
                    <div className="text-xs font-semibold text-slate-700 line-clamp-1">
                      {locationLine}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500">
                      {specsLine}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Tab 2: Top Comps */}
      {activeTab === 'comparables' && (
        <AnimatePresence mode="popLayout">
          <motion.div 
            key="comps-list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-3 max-h-[500px] overflow-y-auto pr-1"
          >
            {comparables.map((comp, idx) => {
              const p = comp.property;
              const isSelected = selectedProperty?.id === p.id;

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  onClick={() => onSelectProperty(p)}
                  className={`bg-white p-3.5 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${
                    isSelected ? 'border-[#6b21a8] ring-2 ring-[#6b21a8]/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-extrabold text-[#6b21a8]">
                        {p.address.street}, {p.address.city}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {p.bedrooms} bd • {p.bathrooms} ba • {p.livingAreaSqFt} sqft
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      {comp.similarityScore} Match
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 mt-2 pt-2 text-xs font-bold text-slate-900">
                    <span>${p.price.toLocaleString()}</span>
                    <span className="text-slate-500 font-medium">${p.pricePerSqFt}/sqft</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Tab 3: All Properties List */}
      {activeTab === 'results' && (
        <AnimatePresence mode="popLayout">
          <motion.div 
            key="all-grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[600px] overflow-y-auto pr-1"
          >
            {properties.map((p, idx) => {
              const isSelected = selectedProperty?.id === p.id;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.22, delay: idx * 0.03 }}
                  onClick={() => onSelectProperty(p)}
                  className={`bg-white rounded-2xl overflow-hidden border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between ${
                    isSelected ? 'border-[#6b21a8] ring-2 ring-[#6b21a8]/20' : 'border-slate-200'
                  }`}
                >
                  <div className="relative w-full h-32 bg-slate-100">
                    <img src={p.images[0]} alt={p.address.street} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-extrabold text-slate-900">${p.price.toLocaleString()}</div>
                    <div className="text-xs font-bold text-slate-700 line-clamp-1">{p.address.street}</div>
                    <div className="text-[11px] text-slate-500">{p.address.city}, {p.address.state}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{p.bedrooms} bd • {p.bathrooms} ba • {p.livingAreaSqFt} sqft</div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};
