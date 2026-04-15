import React, { useMemo } from 'react';
import type { CatalogListingProduct } from '../domain/marketplace/types';

interface TagCloudProps {
  products: CatalogListingProduct[];
  selected: Set<string>;
  onChange: (tags: Set<string>) => void;
}

const NEON_PALETTE = [
  { text: 'text-[#00F5FF]', bg: 'bg-[#00F5FF]', border: 'border-[#00F5FF]', glow: 'rgba(0,245,255,' },
  { text: 'text-[#FF00FF]', bg: 'bg-[#FF00FF]', border: 'border-[#FF00FF]', glow: 'rgba(255,0,255,' },
  { text: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]', border: 'border-[#8B5CF6]', glow: 'rgba(139,92,246,' },
  { text: 'text-[#00FF88]', bg: 'bg-[#00FF88]', border: 'border-[#00FF88]', glow: 'rgba(0,255,136,' },
  { text: 'text-[#FFD700]', bg: 'bg-[#FFD700]', border: 'border-[#FFD700]', glow: 'rgba(255,215,0,' },
  { text: 'text-[#FF6B35]', bg: 'bg-[#FF6B35]', border: 'border-[#FF6B35]', glow: 'rgba(255,107,53,' },
];

function sizeClass(rank: number): string {
  if (rank < 3) return 'text-sm font-semibold px-3 py-1.5';
  if (rank < 8) return 'text-xs font-medium px-2.5 py-1';
  return 'text-[11px] font-normal px-2 py-0.5';
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
      .slice(0, 28);
  }, [products]);

  const toggle = (tag: string) => {
    const next = new Set(selected);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    onChange(next);
  };

  const clearAll = () => onChange(new Set());

  return (
    <div className="bg-[#0D0D1A]/80 border border-[#00F5FF]/10 rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#00F5FF]/70">
          Tags
        </h3>
        {selected.size > 0 && (
          <button
            onClick={clearAll}
            className="text-[10px] text-gray-500 hover:text-[#FF00FF] transition-colors uppercase tracking-wider"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tagCounts.map(([tag, count], i) => {
          const isActive = selected.has(tag);
          const palette = NEON_PALETTE[i % NEON_PALETTE.length];
          const size = sizeClass(i);

          return (
            <button
              key={tag}
              onClick={() => toggle(tag)}
              title={`${tag} (${count})`}
              className={`rounded-full border transition-all duration-200 whitespace-nowrap ${size} ${
                isActive
                  ? `${palette.bg}/15 ${palette.border}/50 ${palette.text}`
                  : 'bg-white/[0.04] border-white/10 text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 hover:border-white/20'
              }`}
              style={isActive ? { boxShadow: `0 0 12px ${palette.glow}0.25)` } : undefined}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TagCloud;
