/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MarketSummary } from '../types';

interface KpiSummaryBarProps {
  summary: MarketSummary;
}

export const KpiSummaryBar: React.FC<KpiSummaryBarProps> = ({ summary }) => {
  const activeListingsFormatted = summary.activeListings.toLocaleString();
  const pendingCount = summary.pendingCount.toLocaleString();
  const priceReducedCount = summary.priceReductionsCount.toLocaleString();
  const saleToListRatio = summary.recentlySold > 0 && summary.saleToListRatio > 0
    ? `${summary.saleToListRatio}%`
    : '—';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-1">
      {/* Card 1: Active Listings */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-100 shadow-sm text-center flex flex-col justify-center items-center hover:shadow-md transition-all">
        <div className="text-xl sm:text-2xl font-extrabold text-[#581c87] tracking-tight">
          {activeListingsFormatted}
        </div>
        <div className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">
          Active Listings
        </div>
      </div>

      {/* Card 2: New Today */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-100 shadow-sm text-center flex flex-col justify-center items-center hover:shadow-md transition-all">
        <div className="text-xl sm:text-2xl font-extrabold text-[#581c87] tracking-tight">
          {pendingCount}
        </div>
        <div className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">
          Pending
        </div>
      </div>

      {/* Card 3: Price Reduced */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-100 shadow-sm text-center flex flex-col justify-center items-center hover:shadow-md transition-all">
        <div className="text-xl sm:text-2xl font-extrabold text-[#581c87] tracking-tight">
          {priceReducedCount}
        </div>
        <div className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">
          Price Reduced
        </div>
      </div>

      {/* Card 4: Market Health */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-100 shadow-sm text-center flex flex-col justify-center items-center hover:shadow-md transition-all">
        <div className="text-xl sm:text-2xl font-extrabold text-[#581c87] tracking-tight">
          {saleToListRatio}
        </div>
        <div className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">
          Sale-to-list
        </div>
      </div>
    </div>
  );
};
