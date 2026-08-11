/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SearchFilters, PropertyStatus, PropertyType } from '../types';
import { X, RotateCcw, Check, SlidersHorizontal } from 'lucide-react';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onChangeFilters: (newFilters: Partial<SearchFilters>) => void;
  onResetFilters: () => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  onChangeFilters,
  onResetFilters,
}) => {
  if (!isOpen) return null;

  const handleStatusToggle = (st: PropertyStatus) => {
    const list = filters.status || [];
    const next = list.includes(st) ? list.filter(s => s !== st) : [...list, st];
    onChangeFilters({ status: next });
  };

  const handleTypeToggle = (pt: PropertyType) => {
    const list = filters.propertyTypes || [];
    const next = list.includes(pt) ? list.filter(p => p !== pt) : [...list, pt];
    onChangeFilters({ propertyTypes: next });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-base tracking-tight">Search & Market Filters</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-700">
          {/* Location & Radius */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-widest">
              Location & Search Area
            </h3>
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Location Query (Address, City, ZIP)</label>
              <input
                type="text"
                value={filters.locationQuery}
                onChange={(e) => onChangeFilters({ locationQuery: e.target.value })}
                placeholder="e.g. Kansas City, Overland Park 66204, Country Club Plaza 64112"
                className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
              />
            </div>
            <div>
              <div className="flex justify-between text-slate-600 mb-1">
                <span className="font-medium">Search Radius</span>
                <span className="font-bold text-blue-600">{filters.radiusMiles} miles</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="30"
                step="0.5"
                value={filters.radiusMiles}
                onChange={(e) => onChangeFilters({ radiusMiles: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Listing Status */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-widest">
              Listing Status
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'for_sale', label: 'For Sale', color: 'bg-emerald-500' },
                { id: 'recently_sold', label: 'Recently Sold', color: 'bg-blue-500' },
                { id: 'pending', label: 'Pending', color: 'bg-purple-500' },
                { id: 'foreclosure', label: 'Foreclosure', color: 'bg-rose-500' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => handleStatusToggle(item.id as PropertyStatus)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between font-semibold transition-all ${
                    filters.status.includes(item.id as PropertyStatus)
                      ? 'bg-blue-50/80 border-blue-600 text-blue-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    {item.label}
                  </span>
                  {filters.status.includes(item.id as PropertyStatus) && (
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Property Types */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-widest">
              Property Type
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'single_family', label: 'Single Family' },
                { id: 'condo', label: 'Condo / Apt' },
                { id: 'townhouse', label: 'Townhouse' },
                { id: 'multi_family', label: 'Multi-Family' },
                { id: 'manufactured', label: 'Manufactured' },
                { id: 'land', label: 'Land / Lot' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => handleTypeToggle(item.id as PropertyType)}
                  className={`p-2.5 rounded-xl border font-semibold transition-all text-left ${
                    filters.propertyTypes.includes(item.id as PropertyType)
                      ? 'bg-blue-50/80 border-blue-600 text-blue-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Price Range */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-widest">
              Price Range
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-500 mb-1 font-medium">Min Price ($)</label>
                <input
                  type="number"
                  placeholder="No Min"
                  value={filters.minPrice || ''}
                  onChange={(e) => onChangeFilters({ minPrice: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 font-medium">Max Price ($)</label>
                <input
                  type="number"
                  placeholder="No Max"
                  value={filters.maxPrice || ''}
                  onChange={(e) => onChangeFilters({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-900"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Bedrooms & Bathrooms */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-widest">
              Beds & Baths
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 mb-1 font-medium">Min Bedrooms</label>
                <select
                  value={filters.minBeds || 0}
                  onChange={(e) => onChangeFilters({ minBeds: Number(e.target.value) || undefined })}
                  className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-900"
                >
                  <option value={0}>Any Beds</option>
                  <option value={1}>1+ Beds</option>
                  <option value={2}>2+ Beds</option>
                  <option value={3}>3+ Beds</option>
                  <option value={4}>4+ Beds</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1 font-medium">Min Bathrooms</label>
                <select
                  value={filters.minBaths || 0}
                  onChange={(e) => onChangeFilters({ minBaths: Number(e.target.value) || undefined })}
                  className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-900"
                >
                  <option value={0}>Any Baths</option>
                  <option value={1}>1+ Baths</option>
                  <option value={2}>2+ Baths</option>
                  <option value={3}>3+ Baths</option>
                </select>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Square Footage & DOM */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-widest">
              Living Area & Days on Market
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-500 mb-1 font-medium">Min SqFt</label>
                <input
                  type="number"
                  placeholder="Min SqFt"
                  value={filters.minSqft || ''}
                  onChange={(e) => onChangeFilters({ minSqft: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 font-medium">Max Days on Market</label>
                <input
                  type="number"
                  placeholder="e.g. 30"
                  value={filters.maxDaysOnMarket || ''}
                  onChange={(e) => onChangeFilters({ maxDaysOnMarket: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-900"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Special Features */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-widest">
              Property Features & Options
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'isPriceReduced', label: 'Price Reduced' },
                { key: 'hasPool', label: 'Has Swimming Pool' },
                { key: 'hasGarage', label: 'Has Garage' },
                { key: 'isWaterfront', label: 'Waterfront' },
                { key: 'isNewConstruction', label: 'New Construction' },
                { key: 'isOpenHouse', label: 'Open House' },
              ].map(feat => (
                <label
                  key={feat.key}
                  className="flex items-center gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-colors text-slate-800 font-medium"
                >
                  <input
                    type="checkbox"
                    checked={Boolean((filters as any)[feat.key])}
                    onChange={(e) => onChangeFilters({ [feat.key]: e.target.checked })}
                    className="accent-blue-600 rounded"
                  />
                  <span>{feat.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-3">
          <button
            onClick={onResetFilters}
            className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl font-bold w-1/3 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl font-bold transition-all text-center shadow-sm shadow-blue-200"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};
