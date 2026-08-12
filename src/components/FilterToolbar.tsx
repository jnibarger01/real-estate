/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { SearchFilters, PropertyStatus, PropertyType, SavedSearch } from '../types';
import { 
  X, 
  SlidersHorizontal, 
  Bookmark, 
  BookmarkCheck, 
  Trash2, 
  Plus, 
  ChevronDown, 
  Clock, 
  Check,
  Sparkles
} from 'lucide-react';

interface FilterToolbarProps {
  filters: SearchFilters;
  onChangeFilters: (newFilters: Partial<SearchFilters>) => void;
  onOpenDrawer: () => void;
  onResetFilters: () => void;
}

const STORAGE_KEY = 'real_estate_saved_searches_v1';

const PRESET_SEARCHES: SavedSearch[] = [
  {
    id: 'preset-1',
    name: 'Kansas City Single Family ($250k - $600k)',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    filters: {
      locationQuery: 'Kansas City, MO / Overland Park 66204',
      radiusMiles: 10,
      status: ['for_sale', 'pending'],
      propertyTypes: ['single_family'],
      minPrice: 250000,
      maxPrice: 600000,
      minBeds: 3,
      saleDateRange: '1y',
      sortBy: 'best_match',
    }
  },
  {
    id: 'preset-2',
    name: 'Overland Park Investment Comps',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    filters: {
      locationQuery: 'Overland Park, KS 66204',
      radiusMiles: 5,
      status: ['recently_sold'],
      propertyTypes: ['single_family', 'condo', 'townhouse'],
      saleDateRange: '1y',
      sortBy: 'recently_sold',
    }
  }
];

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  filters,
  onChangeFilters,
  onOpenDrawer,
  onResetFilters,
}) => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isSavedMenuOpen, setIsSavedMenuOpen] = useState(false);
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load saved searches from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSavedSearches(parsed);
          return;
        }
      }
    } catch (err) {
      console.error('Error loading saved searches from localStorage:', err);
    }
    // Fallback default presets if empty
    setSavedSearches(PRESET_SEARCHES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PRESET_SEARCHES));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSavedMenuOpen(false);
        setIsSavingInline(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveToLocalStorage = (list: SavedSearch[]) => {
    setSavedSearches(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.error('Error saving searches to localStorage:', err);
    }
  };

  const generateDefaultName = (): string => {
    const loc = filters.locationQuery ? filters.locationQuery.split('/')[0].trim() : 'Search';
    const parts: string[] = [loc];
    if (filters.minPrice || filters.maxPrice) {
      const min = filters.minPrice ? `$${Math.round(filters.minPrice / 1000)}k` : '$0';
      const max = filters.maxPrice ? `$${Math.round(filters.maxPrice / 1000)}k` : 'Any';
      parts.push(`${min}-${max}`);
    } else if (filters.minBeds) {
      parts.push(`${filters.minBeds}+ Beds`);
    }
    return parts.join(' • ');
  };

  const handleStartSave = () => {
    setNewSearchName(generateDefaultName());
    setIsSavingInline(true);
  };

  const handleConfirmSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = newSearchName.trim() || generateDefaultName();
    const newEntry: SavedSearch = {
      id: `saved-${Date.now()}`,
      name: finalName,
      createdAt: new Date().toISOString(),
      filters: { ...filters },
    };

    const updated = [newEntry, ...savedSearches];
    saveToLocalStorage(updated);
    setIsSavingInline(false);
    setJustSavedId(newEntry.id);
    setTimeout(() => setJustSavedId(null), 2500);
  };

  const handleDeleteSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedSearches.filter(s => s.id !== id);
    saveToLocalStorage(updated);
  };

  const handleApplySearch = (saved: SavedSearch) => {
    onChangeFilters(saved.filters);
    setIsSavedMenuOpen(false);
  };
  const toggleAlerts = (saved: SavedSearch, event: React.MouseEvent) => {
    event.stopPropagation();
    saveToLocalStorage(savedSearches.map(item => item.id === saved.id ? { ...item, alertsEnabled: !item.alertsEnabled } : item));
  };

  const summarizeFilters = (f: SearchFilters): string => {
    const parts: string[] = [];
    if (f.status && f.status.length > 0) {
      parts.push(f.status.map(s => s.replace('_', ' ')).join('/'));
    }
    if (f.minPrice || f.maxPrice) {
      const min = f.minPrice ? `$${Math.round(f.minPrice / 1000)}k` : '$0';
      const max = f.maxPrice ? `$${Math.round(f.maxPrice / 1000)}k` : 'Any';
      parts.push(`${min}-${max}`);
    }
    if (f.minBeds) parts.push(`${f.minBeds}+ Beds`);
    if (f.isPriceReduced) parts.push('Price Reduced');
    if (f.hasPool) parts.push('Pool');
    return parts.join(' • ') || 'Default Filters';
  };

  const toggleStatus = (st: PropertyStatus) => {
    const current = filters.status || [];
    const updated = current.includes(st)
      ? current.filter(s => s !== st)
      : [...current, st];
    onChangeFilters({ status: updated });
  };

  const activeChips: { label: string; onRemove: () => void }[] = [];

  if (filters.status && filters.status.length > 0) {
    activeChips.push({
      label: `Status: ${filters.status.map(s => s.replace('_', ' ')).join(', ')}`,
      onRemove: () => onChangeFilters({ status: ['for_sale', 'recently_sold', 'pending'] }),
    });
  }

  if (filters.minPrice || filters.maxPrice) {
    const minStr = filters.minPrice ? `$${(filters.minPrice / 1000).toFixed(0)}k` : '$0';
    const maxStr = filters.maxPrice ? `$${(filters.maxPrice / 1000).toFixed(0)}k` : 'Any';
    activeChips.push({
      label: `Price: ${minStr} - ${maxStr}`,
      onRemove: () => onChangeFilters({ minPrice: undefined, maxPrice: undefined }),
    });
  }

  if (filters.minBeds) {
    activeChips.push({
      label: `Beds: ${filters.minBeds}+`,
      onRemove: () => onChangeFilters({ minBeds: undefined }),
    });
  }

  if (filters.isPriceReduced) {
    activeChips.push({
      label: 'Price Reduced',
      onRemove: () => onChangeFilters({ isPriceReduced: false }),
    });
  }

  if (filters.isWaterfront) {
    activeChips.push({
      label: 'Waterfront',
      onRemove: () => onChangeFilters({ isWaterfront: false }),
    });
  }

  if (filters.hasPool) {
    activeChips.push({
      label: 'Pool',
      onRemove: () => onChangeFilters({ hasPool: false }),
    });
  }

  if (filters.hasGarage) {
    activeChips.push({
      label: 'Garage',
      onRemove: () => onChangeFilters({ hasGarage: false }),
    });
  }

  return (
    <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
      {/* Quick Toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onOpenDrawer}
          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-semibold transition-all border border-slate-200"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
          <span>All Filters</span>
          {activeChips.length > 0 && (
            <span className="bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold ml-0.5">
              {activeChips.length}
            </span>
          )}
        </button>

        {/* Saved Searches Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsSavedMenuOpen(!isSavedMenuOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all border ${
              isSavedMenuOpen || justSavedId
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="Access or save custom search filter configurations"
          >
            {justSavedId ? (
              <BookmarkCheck className="w-3.5 h-3.5 text-blue-600 animate-bounce" />
            ) : (
              <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>Saved Searches</span>
            {savedSearches.length > 0 && (
              <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-md font-bold">
                {savedSearches.length}
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {/* Saved Searches Dropdown Menu */}
          {isSavedMenuOpen && (
            <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 text-xs flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Bookmark className="w-4 h-4 text-blue-600" />
                  <span>Saved Search Criteria</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Stored in browser</span>
              </div>

              {/* Inline Save Current Search Form */}
              {isSavingInline ? (
                <form onSubmit={handleConfirmSave} className="bg-blue-50/80 border border-blue-200 rounded-xl p-2.5 flex flex-col gap-2">
                  <div className="text-[11px] font-bold text-blue-900 flex items-center justify-between">
                    <span>Name this search config:</span>
                    <button
                      type="button"
                      onClick={() => setIsSavingInline(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newSearchName}
                    onChange={(e) => setNewSearchName(e.target.value)}
                    placeholder="e.g., Kansas City 3+ Beds under $500k"
                    className="w-full bg-white border border-blue-200 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                    autoFocus
                  />
                  <div className="text-[10px] text-slate-500 italic">
                    Summary: {summarizeFilters(filters)}
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsSavingInline(false)}
                      className="px-2.5 py-1 rounded-lg text-slate-600 hover:bg-slate-200 font-medium text-[11px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs"
                    >
                      <Check className="w-3 h-3" />
                      Save Search
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={handleStartSave}
                  className="w-full py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200/80 flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                >
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Save Current Filters as Preset</span>
                </button>
              )}

              {/* Saved List */}
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">
                {savedSearches.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 italic text-[11px]">
                    No saved searches yet. Click above to save your active filters for quick access.
                  </div>
                ) : (
                  savedSearches.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleApplySearch(item)}
                      className="group flex items-start justify-between p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/60 hover:bg-blue-50/50 cursor-pointer transition-all"
                    >
                      <div className="flex-1 pr-2">
                        <div className="font-bold text-slate-800 text-xs group-hover:text-blue-900 flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {justSavedId === item.id && (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                              New
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          {summarizeFilters(item.filters)}
                        </div>
                        <div className="text-[9px] text-slate-400 flex items-center gap-1 mt-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                        <button onClick={(event) => toggleAlerts(item, event)} disabled title="Coming soon — requires a backend notification service" className="text-[10px] font-semibold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200 cursor-not-allowed">Notify me</button>
                        <span className="text-[10px] font-semibold text-blue-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 group-hover:border-blue-300">
                          Apply
                        </span>
                        <button
                          onClick={(e) => handleDeleteSearch(item.id, e)}
                          className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete saved search"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

        {/* Status Pills */}
        <button
          onClick={() => toggleStatus('for_sale')}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 ${
            filters.status.includes('for_sale')
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          For Sale
        </button>

        <button
          onClick={() => toggleStatus('recently_sold')}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 ${
            filters.status.includes('recently_sold')
              ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Recently Sold
        </button>

        <button
          onClick={() => toggleStatus('pending')}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 ${
            filters.status.includes('pending')
              ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-2xs'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          Pending
        </button>

        {/* Feature quick toggles */}
        <button
          onClick={() => onChangeFilters({ isPriceReduced: !filters.isPriceReduced })}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            filters.isPriceReduced
              ? 'bg-amber-50 text-amber-800 border-amber-200 shadow-2xs'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          Price Reduced
        </button>

        <button
          onClick={() => onChangeFilters({ hasPool: !filters.hasPool })}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            filters.hasPool
              ? 'bg-sky-50 text-sky-800 border-sky-200 shadow-2xs'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          Pool
        </button>
      </div>

      {/* Active Chips List */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          <span className="text-slate-400 text-[11px] font-medium hidden md:inline">Active:</span>
          {activeChips.map((chip, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-slate-50 text-slate-800 border border-slate-200 text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-2xs"
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                className="hover:text-red-600 p-0.5 rounded-full transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={onResetFilters}
            className="text-[11px] text-red-600 hover:underline font-semibold ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
