import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { CATEGORY_ICONS } from '../domain/marketplace/categoryIcons';
import type { HomeCategorySummary, HomeCategorySlug } from '../domain/marketplace/types';

interface CategoryFilterChipsProps {
  categories: HomeCategorySummary[];
  active: HomeCategorySlug | 'all';
  onChange: (slug: HomeCategorySlug | 'all') => void;
}

const CategoryFilterChips: React.FC<CategoryFilterChipsProps> = ({ categories, active, onChange }) => {
  const isActive = (slug: string) => slug === active;

  return (
    <div className="overflow-x-auto scrollbar-hide py-2">
      <div className="flex gap-2 min-w-max px-1">
        <button
          onClick={() => onChange('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap transition-all duration-200 ${
            isActive('all')
              ? 'bg-blue-500/10 border-blue-500/50 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.4)]'
              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          All
        </button>

        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.slug];
          return (
            <button
              key={cat.slug}
              onClick={() => onChange(cat.slug)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                isActive(cat.slug)
                  ? 'bg-blue-500/10 border-blue-500/50 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryFilterChips;
