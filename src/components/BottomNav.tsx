/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Home, Search, Plus, Bell, User } from 'lucide-react';

interface BottomNavProps {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  onOpenFilterDrawer?: () => void;
  onOpenShortcuts?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab = 'home',
  onSelectTab,
  onOpenFilterDrawer,
  onOpenShortcuts,
}) => {
  const [current, setCurrent] = useState(activeTab);

  const handleTabClick = (tabKey: string) => {
    setCurrent(tabKey);
    if (onSelectTab) onSelectTab(tabKey);
    if (tabKey === 'search' && onOpenFilterDrawer) {
      onOpenFilterDrawer();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-4 py-2 shadow-2xl">
      <div className="max-w-md mx-auto flex items-center justify-between relative">
        {/* Tab 1: Home */}
        <button
          onClick={() => handleTabClick('home')}
          className={`flex flex-col items-center justify-center flex-1 gap-1 py-1 transition-all ${
            current === 'home' ? 'text-[#6b21a8] font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Home className={`w-5 h-5 ${current === 'home' ? 'text-[#6b21a8]' : ''}`} />
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        {/* Tab 2: Search */}
        <button
          onClick={() => handleTabClick('search')}
          className={`flex flex-col items-center justify-center flex-1 gap-1 py-1 transition-all ${
            current === 'search' ? 'text-[#6b21a8] font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Search className={`w-5 h-5 ${current === 'search' ? 'text-[#6b21a8]' : ''}`} />
          <span className="text-[10px] tracking-tight">Search</span>
        </button>

        {/* Center Floating Plus Button */}
        <div className="flex-1 flex justify-center -mt-6">
          <button
            onClick={() => onOpenFilterDrawer && onOpenFilterDrawer()}
            className="w-12 h-12 rounded-full bg-[#6b21a8] hover:bg-[#581c87] text-white flex items-center justify-center shadow-lg shadow-purple-900/30 border-4 border-white transition-all transform hover:scale-105 active:scale-95"
            title="Add property or search filter"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* Tab 3: Alerts */}
        <button
          onClick={() => handleTabClick('alerts')}
          className={`flex flex-col items-center justify-center flex-1 gap-1 py-1 transition-all ${
            current === 'alerts' ? 'text-[#6b21a8] font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Bell className={`w-5 h-5 ${current === 'alerts' ? 'text-[#6b21a8]' : ''}`} />
          <span className="text-[10px] tracking-tight">Alerts</span>
        </button>

        {/* Tab 4: Profile */}
        <button
          onClick={() => handleTabClick('profile')}
          className={`flex flex-col items-center justify-center flex-1 gap-1 py-1 transition-all ${
            current === 'profile' ? 'text-[#6b21a8] font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <User className={`w-5 h-5 ${current === 'profile' ? 'text-[#6b21a8]' : ''}`} />
          <span className="text-[10px] tracking-tight">Profile</span>
        </button>
      </div>
    </div>
  );
};
