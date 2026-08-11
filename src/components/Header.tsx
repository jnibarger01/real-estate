/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  RotateCcw, 
  RefreshCw, 
  Search, 
  Database,
  SlidersHorizontal,
  Activity,
  Keyboard
} from 'lucide-react';

interface HeaderProps {
  currentArea: string;
  propertyCount: number;
  dateRange: string;
  isMcpActive: boolean;
  mcpSource: 'mcp_server' | 'mock_adapter';
  onResetFilters: () => void;
  onRefreshData: () => void;
  onOpenFilters: () => void;
  onOpenMcpModal: () => void;
  onSearchSubmit: (query: string) => void;
  onOpenShortcutsModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentArea,
  propertyCount,
  dateRange,
  isMcpActive,
  mcpSource,
  onResetFilters,
  onRefreshData,
  onOpenFilters,
  onOpenMcpModal,
  onSearchSubmit,
  onOpenShortcutsModal,
}) => {
  const [searchInput, setSearchInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearchSubmit(searchInput.trim());
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-30 shadow-sm transition-all">
      <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: App Title & Active Location */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm text-white shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-slate-900 tracking-tight">
                RE-Market Explorer
              </h1>
              <span 
                onClick={onOpenMcpModal}
                className={`cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase transition-all ${
                  mcpSource === 'mcp_server'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
                title="Click to view Zillow MCP tool inspector"
              >
                <Database className="w-3 h-3" />
                {mcpSource === 'mcp_server' ? 'Zillow MCP Connected' : 'Zillow MCP Mock Mode'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span className="flex items-center gap-1 font-semibold text-slate-800">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                {currentArea || 'All Regions'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                {dateRange}
              </span>
              <span>•</span>
              <span className="font-bold text-blue-600">
                {propertyCount.toLocaleString()} properties
              </span>
            </div>
          </div>
        </div>

        {/* Center: Search Bar */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-md w-full">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search address, city, ZIP code (e.g. Kansas City, Overland Park 66204, Country Club Plaza)..."
              className="w-full bg-slate-100 focus:bg-white text-xs text-slate-800 placeholder-slate-400 pl-9 pr-20 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold px-3 py-1 rounded-lg transition-all shadow-xs"
            >
              Search
            </button>
          </div>
        </form>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={onOpenFilters}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-md shadow-blue-100 transition-all"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          <button
            onClick={onResetFilters}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 transition-all shadow-2xs"
            title="Reset all search filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={onRefreshData}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg border border-slate-200 transition-all shadow-2xs"
            title="Fetch latest Zillow MCP data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh MCP</span>
          </button>

          {onOpenShortcutsModal && (
            <button
              onClick={onOpenShortcutsModal}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-200 transition-all shadow-2xs"
              title="Keyboard Shortcuts Cheat Sheet (Press ?)"
            >
              <Keyboard className="w-4 h-4 text-blue-600" />
              <kbd className="hidden sm:inline text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-300 px-1 py-0.2 rounded">?</kbd>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
