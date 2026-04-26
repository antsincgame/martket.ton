import type { FC } from 'react';
import type { AdminTab } from './tabs.config';

export interface AdminTabsNavProps {
  tabs: readonly AdminTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}

export const AdminTabsNav: FC<AdminTabsNavProps> = ({ tabs, activeTabId, onTabChange }) => (
  <div className="rounded-xl border border-[#FFD700]/10 bg-[#1A1A1A] p-1.5 mb-8">
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTabId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-[#FFD700] text-[#0A0A0A] shadow-[0_0_15px_rgba(255,215,0,0.25)]'
                : 'text-[#999999] hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);
