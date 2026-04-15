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
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-2">
        Categories
      </h3>

      <button
        onClick={() => onChange('all')}
        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-all duration-150 ${
          active === 'all'
            ? 'bg-blue-500/10 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.25)]'
            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`}
      >
        <LayoutGrid className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">All Categories</span>
      </button>

      <div className="h-px bg-white/5 my-1.5" />

      <div className="space-y-0.5">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.slug];
          const isActive = active === cat.slug;
          return (
            <button
              key={cat.slug}
              onClick={() => onChange(cat.slug)}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-blue-500/10 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.25)]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate flex-1 text-left">{cat.name}</span>
              <span className="text-xs text-gray-600 flex-shrink-0">{cat.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategorySidebar;
