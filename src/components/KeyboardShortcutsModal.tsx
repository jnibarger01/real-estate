/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Keyboard, Command, Sparkles, SlidersHorizontal, Map, RotateCcw, Sliders } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'F', secondary: 'Ctrl + K', description: 'Open / toggle Search Filters Drawer', icon: SlidersHorizontal },
    { key: 'M', secondary: null, description: 'Focus and scroll to Interactive Map View', icon: Map },
    { key: 'R', secondary: null, description: 'Reset all search filters & tolerances', icon: RotateCcw },
    { key: 'C', secondary: null, description: 'Adjust Comparable Search Tolerances', icon: Sliders },
    { key: '?', secondary: 'Shift + /', description: 'Show / hide this Keyboard Shortcuts dialog', icon: Keyboard },
    { key: 'Esc', secondary: null, description: 'Close any active modal or slide-over drawer', icon: X },
  ];

  const mapNavigationShortcuts = [
    { key: '↑ ↓ ← →', description: 'Pan interactive map when map is focused' },
    { key: '+ / -', description: 'Zoom in or zoom out map level' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Keyboard Shortcuts</h3>
              <p className="text-xs text-slate-500">Power user accessibility navigation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Shortcuts List */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Global Navigation
          </div>
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {shortcuts.map((sc) => {
              const Icon = sc.icon;
              return (
                <div key={sc.key} className="flex items-center justify-between p-2.5 bg-slate-50/50 hover:bg-blue-50/40 transition-colors text-xs">
                  <div className="flex items-center gap-2.5 text-slate-700 font-medium">
                    <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{sc.description}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {sc.secondary && (
                      <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-500 shadow-2xs">
                        {sc.secondary}
                      </kbd>
                    )}
                    <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono font-bold text-slate-800 shadow-2xs">
                      {sc.key}
                    </kbd>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Map Focus Shortcuts */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Map Controls (When Map is Focused)
          </div>
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {mapNavigationShortcuts.map((sc) => (
              <div key={sc.key} className="flex items-center justify-between p-2.5 bg-slate-50/50 text-xs">
                <span className="text-slate-600 font-medium">{sc.description}</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono font-bold text-slate-800 shadow-2xs">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer tip */}
        <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Press <kbd className="px-1 bg-white border border-blue-200 rounded font-mono font-bold text-[10px]">?</kbd> at any time to open or dismiss this shortcuts guide.</span>
        </div>
      </div>
    </div>
  );
};
