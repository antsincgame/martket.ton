import React, { useMemo } from 'react';
import { Tag, Hash } from 'lucide-react';
import type { CatalogListingProduct } from '../domain/marketplace/types';

interface TagCloudProps {
  products: CatalogListingProduct[];
  selected: Set<string>;
  onChange: (tags: Set<string>) => void;
}

const TagCloud: React.FC<TagCloudProps> = ({ products, selected, onChange }) => {
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      for (const t of p.tags ?? []) {
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [products]);

  const toggle = (tag: string) => {
    const next = new Set(selected);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    onChange(next);
  };

  const clearAll = () => onChange(new Set());

  return (
    <div className="bg-[#1A1A1A]/80 border border-[#FFD700]/10 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2 px-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[#FFD700]/50">
          Tags
        </h3>
        {selected.size > 0 && (
          <button
            onClick={clearAll}
            className="text-[10px] text-gray-500 hover:text-[#FFD700] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        {tagCounts.map(([tag, count]) => {
          const isActive = selected.has(tag);
          return (
            <button
              key={tag}
              onClick={() => toggle(tag)}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-r-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'border-l-2 border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]'
                  : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
            >
              {isActive ? (
                <Tag className="w-4 h-4 flex-shrink-0" />
              ) : (
                <Hash className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="truncate flex-1 text-left">{tag}</span>
              <span className={`text-xs flex-shrink-0 ${isActive ? 'text-[#FFD700]/50' : 'text-gray-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TagCloud;
