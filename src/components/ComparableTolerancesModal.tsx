/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ComparableTolerances } from '../types';
import { X, SlidersHorizontal, RotateCcw, Check } from 'lucide-react';

interface ComparableTolerancesModalProps {
  isOpen: boolean;
  onClose: () => void;
  tolerances: ComparableTolerances;
  onChangeTolerances: (newTolerances: ComparableTolerances) => void;
  onReset: () => void;
}

export const ComparableTolerancesModal: React.FC<ComparableTolerancesModalProps> = ({
  isOpen,
  onClose,
  tolerances,
  onChangeTolerances,
  onReset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-[#f8f7f2] w-full max-w-lg rounded-2xl shadow-2xl border border-[#d6d1c4] overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="bg-[#2d3748] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[#d69e2e]" />
            <h2 className="font-semibold text-sm">Comparable Property Search Tolerances</h2>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs text-[#2d3748]">
          {/* Max Distance */}
          <div>
            <div className="flex justify-between font-medium mb-1">
              <span>Maximum Geographic Distance</span>
              <span className="font-bold text-[#2b6cb0]">{tolerances.maxDistanceMiles} miles</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={tolerances.maxDistanceMiles}
              onChange={(e) => onChangeTolerances({ ...tolerances, maxDistanceMiles: Number(e.target.value) })}
              className="w-full accent-[#2b6cb0]"
            />
          </div>

          {/* Max Sqft Variance % */}
          <div>
            <div className="flex justify-between font-medium mb-1">
              <span>Maximum Square Footage Variance</span>
              <span className="font-bold text-[#2b6cb0]">±{tolerances.maxSqftDiffPct}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={tolerances.maxSqftDiffPct}
              onChange={(e) => onChangeTolerances({ ...tolerances, maxSqftDiffPct: Number(e.target.value) })}
              className="w-full accent-[#2b6cb0]"
            />
          </div>

          {/* Max Age Difference */}
          <div>
            <div className="flex justify-between font-medium mb-1">
              <span>Maximum Age Variance (Year Built)</span>
              <span className="font-bold text-[#2b6cb0]">±{tolerances.maxAgeDiffYears} years</span>
            </div>
            <input
              type="range"
              min="1"
              max="35"
              step="1"
              value={tolerances.maxAgeDiffYears}
              onChange={(e) => onChangeTolerances({ ...tolerances, maxAgeDiffYears: Number(e.target.value) })}
              className="w-full accent-[#2b6cb0]"
            />
          </div>

          {/* Bed/Bath Variance */}
          <div>
            <div className="flex justify-between font-medium mb-1">
              <span>Bed / Bath Count Variance</span>
              <span className="font-bold text-[#2b6cb0]">±{tolerances.bedBathVariance} count</span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              step="1"
              value={tolerances.bedBathVariance}
              onChange={(e) => onChangeTolerances({ ...tolerances, bedBathVariance: Number(e.target.value) })}
              className="w-full accent-[#2b6cb0]"
            />
          </div>
        </div>

        <div className="p-4 bg-white border-t border-[#d6d1c4] flex items-center justify-between">
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 font-medium text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            onClick={onClose}
            className="bg-[#2b6cb0] hover:bg-[#2c5282] text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-2xs"
          >
            Apply & Recalculate
          </button>
        </div>
      </div>
    </div>
  );
};
