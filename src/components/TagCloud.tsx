import React, { useMemo } from 'react';
import { Tag } from 'lucide-react';
import type { CatalogListingProduct } from '../domain/marketplace/types';

interface TagCloudProps {
  products: CatalogListingProduct[];
  selected: Set<string>;
  onChange: (tags: Set<string>) => void;
}

const TagCloud: React.FC<TagCloudProps> = ({ products, selected, onChange }) => {
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      for (const t of p.tags ?? []) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
  }, [products]);

  const toggle = (tag: string) => {
    const next = new Set(selected);
    if (next.has(tag)) {
      next.delete(tag);
    } else {
      next.add(tag);
    }
    onChange(next);
  };

  const clearAll = () => onChange(new Set());

  if (tagCounts.length === 0) return null;

  return (
    <div className="bg-[#111]/80 border border-white/5 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-[0.65rem] font-semibold uppercase tracking-widest text-gray-500">
          Tags
        </h3>
        {selected.size > 0 && (
          <button
            onClick={clearAll}
            className="text-[0.6rem] text-gray-600 hover:text-gray-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tagCounts.map(([tag, count]) => {
          const isActive = selected.has(tag);
          return (
            <button
              key={tag}
              onClick={() => toggle(tag)}
              className={`inline-flex items-center gap-1 text-[0.6rem] px-2 py-1 rounded-md border transition-all duration-150 ${
                isActive
                  ? 'border-cyan-800/40 bg-cyan-900/20 text-cyan-500'
                  : 'border-white/5 bg-white/[0.02] text-gray-500 hover:text-gray-400 hover:border-white/10 hover:bg-white/[0.04]'
              }`}
            >
              <Tag className="w-2.5 h-2.5" />
              {tag}
              <span className="text-[0.5rem] opacity-50">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TagCloud;
