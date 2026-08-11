/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Menu, 
  Bell, 
  Search, 
  SlidersHorizontal, 
  Database, 
  Sparkles,
  MapPin,
  Keyboard
} from 'lucide-react';
import kcSkylineImg from '../assets/images/kc_skyline_hero_1786041016879.jpg';
import { DeploymentMode } from '../config/runtime';

interface MobileHeroHeaderProps {
  currentArea: string;
  mcpSource: 'mcp_server' | 'mock_adapter';
  deploymentMode: DeploymentMode;
  onOpenMenu: () => void;
  onOpenMcpModal: () => void;
  onOpenShortcutsModal?: () => void;
  onSearchSubmit: (query: string) => void;
}

export const MobileHeroHeader: React.FC<MobileHeroHeaderProps> = ({
  currentArea,
  mcpSource,
  deploymentMode,
  onOpenMenu,
  onOpenMcpModal,
  onOpenShortcutsModal,
  onSearchSubmit,
}) => {
  const [searchInput, setSearchInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearchSubmit(searchInput.trim());
    }
  };

  return (
    <div className="w-full bg-gradient-to-b from-[#2a0e4e] via-[#370f5e] to-[#1c0836] text-white">
      {/* Top Navbar */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between border-b border-white/10">
        {/* Left Hamburger */}
        <button
          onClick={onOpenMenu}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-xs"
          title="Open Filters & Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Center Title */}
        <div className="text-center">
          <h1 className="font-bold text-base md:text-lg text-white tracking-tight leading-tight">
            KC Real Estate Market Explorer
          </h1>
          <p className="text-[11px] text-purple-200/90 font-medium tracking-wide">
            Kansas City Metro Housing Intelligence
          </p>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* MCP Server Badge */}
          <button
            onClick={onOpenMcpModal}
            className={`hidden sm:flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full uppercase transition-all ${
              mcpSource === 'mcp_server'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
            title="Click to inspect Zillow MCP"
          >
            <Database className="w-3 h-3" />
            <span>{deploymentMode === 'static' ? 'Local Dataset' : mcpSource === 'mcp_server' ? 'MCP Connected' : 'Local Adapter'}</span>
          </button>

          {onOpenShortcutsModal && (
            <button
              onClick={onOpenShortcutsModal}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-xs hidden xs:flex"
              title="Shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}

          {/* Bell Notification */}
          <button
            onClick={onOpenMenu}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-xs relative"
            title="Notifications & Alerts"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple-400" />
          </button>
        </div>
      </div>

      {/* Hero Banner with Kansas City Skyline Backdrop */}
      <div className="relative max-w-6xl mx-auto px-4 pt-8 pb-12 overflow-hidden flex flex-col items-center text-center min-h-[220px] justify-center">
        {/* Background Skyline Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={kcSkylineImg}
            alt="Kansas City Skyline"
            className="w-full h-full object-cover opacity-40 mix-blend-luminosity scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2a0e4e]/80 via-[#370f5e]/70 to-[#1c0836]" />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-snug drop-shadow-md">
            Explore Kansas City Housing.
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/90 font-medium tracking-wide">
            Fixture-backed properties, comparables, mapping, and market analytics.
          </p>
        </div>

        {/* Floating Search Bar */}
        <form 
          onSubmit={handleSubmit} 
          className="relative z-20 w-full max-w-lg mt-6 bg-white rounded-2xl shadow-2xl p-1.5 pl-4 flex items-center justify-between border border-white/20"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
            <Search className="w-4 h-4 text-purple-400 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search city, area, or ZIP code"
              list="kc-supported-markets"
              className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
            />
            <datalist id="kc-supported-markets">
              <option value="Kansas City, MO" />
              <option value="Overland Park, KS 66204" />
            </datalist>
          </div>
          <button
            type="submit"
            className="bg-[#6b21a8] hover:bg-[#581c87] text-white p-2.5 sm:px-4 sm:py-2.5 rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0"
          >
            <Search className="w-4 h-4 text-white" />
            <span className="hidden sm:inline text-xs">Search</span>
          </button>
        </form>
      </div>
    </div>
  );
};
