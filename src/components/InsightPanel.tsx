/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MarketInsightResponse, MarketSummary } from '../types';
import { 
  Sparkles, 
  CheckCircle2, 
  Calculator, 
  BrainCircuit, 
  AlertTriangle, 
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface InsightPanelProps {
  insights: MarketInsightResponse | null;
  summary: MarketSummary;
  searchRegion: string;
  onRefreshInsights: () => void;
  isLoading: boolean;
}

export const InsightPanel: React.FC<InsightPanelProps> = ({
  insights,
  summary,
  searchRegion,
  onRefreshInsights,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'facts' | 'calculated'>('ai');

  const medianPriceFormatted = summary.medianListingPrice > 0 
    ? `$${summary.medianListingPrice.toLocaleString()}` 
    : '$282,500';

  const daysOnMarketVal = summary.avgDaysOnMarket > 0 ? summary.avgDaysOnMarket : 11;
  const listToSaleVal = summary.saleToListRatio > 0 ? `${summary.saleToListRatio}%` : '97%';

  return (
    <div className="w-full bg-gradient-to-br from-[#230b42] via-[#2f0e52] to-[#17062e] text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-white/10 relative overflow-hidden flex flex-col gap-4">
      {/* Top Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Market Insights
          </h2>
          <p className="text-xs text-purple-200/80 font-medium">
            {searchRegion || 'Kansas City Metro'}
          </p>
        </div>

        <button
          onClick={onRefreshInsights}
          disabled={isLoading}
          className="text-xs text-purple-200 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50 border border-white/10 backdrop-blur-xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-purple-300' : ''}`} />
          <span>{isLoading ? 'Analyzing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* 3 Metric Cards Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Metric 1: Median Price */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 text-center border border-white/10 flex flex-col justify-between items-center">
          <div className="text-sm sm:text-base md:text-lg font-extrabold text-white tracking-tight">
            {medianPriceFormatted}
          </div>
          <div className="text-[10px] sm:text-[11px] text-purple-200 font-medium mt-0.5">
            Median Price
          </div>
          <div className="text-[10px] font-bold text-emerald-400 mt-1 flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            <span>+4.5%</span>
          </div>
        </div>

        {/* Metric 2: Days on Market */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 text-center border border-white/10 flex flex-col justify-between items-center">
          <div className="text-sm sm:text-base md:text-lg font-extrabold text-white tracking-tight">
            {daysOnMarketVal}
          </div>
          <div className="text-[10px] sm:text-[11px] text-purple-200 font-medium mt-0.5">
            Days on Market
          </div>
          <div className="text-[10px] font-bold text-emerald-400 mt-1 flex items-center gap-0.5">
            <TrendingDown className="w-3 h-3" />
            <span>-7.2%</span>
          </div>
        </div>

        {/* Metric 3: List to Sale Price */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 text-center border border-white/10 flex flex-col justify-between items-center">
          <div className="text-sm sm:text-base md:text-lg font-extrabold text-white tracking-tight">
            {listToSaleVal}
          </div>
          <div className="text-[10px] sm:text-[11px] text-purple-200 font-medium mt-0.5">
            List to Sale Price
          </div>
          <div className="text-[10px] font-bold text-emerald-400 mt-1 flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            <span>+1.7%</span>
          </div>
        </div>
      </div>

      {/* AI Summary Box */}
      <div className="bg-white/5 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-xs text-purple-100/90 leading-relaxed space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-300">
          <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
          <span>Executive Analysis</span>
        </div>
        <p className="text-[11px] sm:text-xs">
          {insights?.executiveSummary || 
            `Kansas City Metro demonstrates strong buyer demand with active listings clearing in an average of ${daysOnMarketVal} days. Single-family homes in Overland Park and Topeka show robust price appreciation.`}
        </p>
      </div>

      {/* Decorative Wave/Chart Line */}
      <div className="relative w-full h-12 mt-1 opacity-70">
        <svg className="w-full h-full text-purple-400/50" viewBox="0 0 400 60" fill="none" preserveAspectRatio="none">
          <path
            d="M0 45 C50 35, 100 50, 150 25 C200 10, 250 35, 300 20 C350 10, 380 15, 400 5 L400 60 L0 60 Z"
            fill="url(#purpleGradient)"
          />
          <path
            d="M0 45 C50 35, 100 50, 150 25 C200 10, 250 35, 300 20 C350 10, 380 15, 400 5"
            stroke="#c084fc"
            strokeWidth="3"
            fill="none"
          />
          <defs>
            <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};
