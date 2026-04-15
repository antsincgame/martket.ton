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
      .slice(0, 24);
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
            className="text-[10px] text-gray-500 hover:text-[#FFD700] transition-colors uppercase tracking-wider"
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
                  ? 'border-l-2 border-[#00F5FF] bg-[#00F5FF]/10 text-[#00F5FF]'
                  : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
            >
              {isActive ? (
                <Tag className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <Hash className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="truncate flex-1 text-left text-xs">{tag}</span>
              <span className={`text-[10px] flex-shrink-0 ${isActive ? 'text-[#00F5FF]/50' : 'text-gray-600'}`}>
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
