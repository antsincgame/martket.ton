import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { CATEGORY_ICONS } from '../domain/marketplace/categoryIcons';
import type { HomeCategorySummary, HomeCategorySlug } from '../domain/marketplace/types';

interface CategorySidebarProps {
  categories: HomeCategorySummary[];
  active: HomeCategorySlug | 'all';
  onChange: (slug: HomeCategorySlug | 'all') => void;
}

const CategorySidebar: React.FC<CategorySidebarProps> = ({ categories, active, onChange }) => {
  return (
    <div className="bg-[#1A1A1A]/80 border border-[#FFD700]/10 rounded-xl p-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-[#FFD700]/50 mb-2 px-2">
        Categories
      </h3>

      <button
        onClick={() => onChange('all')}
        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-r-lg text-sm transition-all duration-200 ${
          active === 'all'
            ? 'border-l-2 border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]'
            : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`}
      >
        <LayoutGrid className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">All Categories</span>
      </button>

      <div className="h-px bg-[#FFD700]/5 my-1.5" />

      <div className="space-y-0.5">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.slug];
          const isActive = active === cat.slug;
          return (
            <button
              key={cat.slug}
              onClick={() => onChange(cat.slug)}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-r-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'border-l-2 border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]'
                  : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate flex-1 text-left">{cat.name}</span>
              <span className={`text-xs flex-shrink-0 ${isActive ? 'text-[#FFD700]/50' : 'text-gray-600'}`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategorySidebar;
