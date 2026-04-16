import { useMemo, useState, memo } from 'react';
import { Search, Hash, X, ChevronDown } from 'lucide-react';
import type { CatalogListingProduct } from '../domain/marketplace/types';

interface FacetTagFilterProps {
  products: CatalogListingProduct[];
  selected: Set<string>;
  onChange: (tags: Set<string>) => void;
}

const INITIAL_LIMIT = 12;

const FacetTagFilter = memo(({ products, selected, onChange }: FacetTagFilterProps) => {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      for (const t of p.tags ?? []) {
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [products]);

  const filteredTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tagCounts;
    return tagCounts.filter(([t]) => t.toLowerCase().includes(q));
  }, [tagCounts, query]);

  const visibleTags = useMemo(() => {
    if (expanded || query.trim()) return filteredTags;
    return filteredTags.filter(([t]) => !selected.has(t)).slice(0, INITIAL_LIMIT);
  }, [filteredTags, expanded, query, selected]);

  const hiddenCount = filteredTags.length - visibleTags.length;
  const activeList = tagCounts.filter(([t]) => selected.has(t));

  const toggle = (tag: string) => {
    const next = new Set(selected);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    onChange(next);
  };

  const clearAll = () => onChange(new Set());

  return (
    <div className="bg-[#0D0D1A]/80 border border-[#00F5FF]/10 rounded-xl p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#00F5FF]/60">
          <Hash className="w-3.5 h-3.5" />
          Tags
          {tagCounts.length > 0 && (
            <span className="text-gray-600 normal-case tracking-normal">· {tagCounts.length}</span>
          )}
        </h3>
        {selected.size > 0 && (
          <button
            onClick={clearAll}
            className="text-[10px] text-gray-500 hover:text-[#FF00FF] transition-colors uppercase tracking-wider font-semibold"
          >
            Clear {selected.size}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-2.5">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter tags…"
          className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-[#0A0A0F] border border-white/5 focus:border-[#00F5FF]/30 text-xs text-gray-200 placeholder:text-gray-600 outline-none transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Active pinned */}
      {activeList.length > 0 && (
        <div className="mb-2.5 pb-2.5 border-b border-white/[0.04]">
          <div className="flex flex-wrap gap-1.5">
            {activeList.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => toggle(tag)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00F5FF]/15 border border-[#00F5FF]/40 text-[#00F5FF] text-[11px] font-semibold transition-all hover:bg-[#00F5FF]/25 hover:border-[#00F5FF]/60"
                style={{ boxShadow: '0 0 10px rgba(0,245,255,0.2)' }}
              >
                <span>{tag}</span>
                <span className="text-[9px] text-[#00F5FF]/60 tabular-nums">{count}</span>
                <X className="w-3 h-3 opacity-70" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Available tags */}
      {visibleTags.length === 0 ? (
        <p className="text-center text-[11px] text-gray-600 py-3">
          {query.trim() ? 'No tags match' : 'No tags available'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-[260px] overflow-y-auto scrollbar-hide pr-1">
          {visibleTags.map(([tag, count]) => (
            <button
              key={tag}
              onClick={() => toggle(tag)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10 text-gray-400 text-[11px] font-medium transition-all hover:bg-[#00F5FF]/10 hover:border-[#00F5FF]/30 hover:text-[#00F5FF]"
            >
              <span>{tag}</span>
              <span className="text-[9px] text-gray-600 tabular-nums">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Show more */}
      {!expanded && !query.trim() && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/5 text-[10px] font-semibold uppercase tracking-widest text-gray-500 hover:text-[#00F5FF] hover:border-[#00F5FF]/30 transition-all"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Show {hiddenCount} more
        </button>
      )}
      {expanded && !query.trim() && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/5 text-[10px] font-semibold uppercase tracking-widest text-gray-500 hover:text-[#FF00FF] hover:border-[#FF00FF]/30 transition-all"
        >
          <ChevronDown className="w-3.5 h-3.5 rotate-180" />
          Collapse
        </button>
      )}
    </div>
  );
});

FacetTagFilter.displayName = 'FacetTagFilter';

export default FacetTagFilter;
