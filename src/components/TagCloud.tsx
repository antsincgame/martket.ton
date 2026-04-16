import React, { useMemo } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { CatalogListingProduct } from '../domain/marketplace/types';

interface TagCloudProps {
  products: CatalogListingProduct[];
  selected: Set<string>;
  onChange: (tags: Set<string>) => void;
  /** "sidebar" — десктопная панель справа; "inline" — горизонтальная лента под списком (mobile). */
  variant?: 'sidebar' | 'inline';
  /** Сколько тэгов показывать. По умолчанию 28 для sidebar, 18 для inline. */
  limit?: number;
}

const NEON_PALETTE: Array<{ text: string; bg: string; border: string; glow: string; shadow: string }> = [
  { text: 'text-[#00F5FF]', bg: 'bg-[#00F5FF]', border: 'border-[#00F5FF]', glow: 'rgba(0,245,255,', shadow: '0,245,255' },
  { text: 'text-[#FF00FF]', bg: 'bg-[#FF00FF]', border: 'border-[#FF00FF]', glow: 'rgba(255,0,255,', shadow: '255,0,255' },
  { text: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]', border: 'border-[#8B5CF6]', glow: 'rgba(139,92,246,', shadow: '139,92,246' },
  { text: 'text-[#00FF88]', bg: 'bg-[#00FF88]', border: 'border-[#00FF88]', glow: 'rgba(0,255,136,', shadow: '0,255,136' },
  { text: 'text-[#FFD700]', bg: 'bg-[#FFD700]', border: 'border-[#FFD700]', glow: 'rgba(255,215,0,', shadow: '255,215,0' },
  { text: 'text-[#FF6B35]', bg: 'bg-[#FF6B35]', border: 'border-[#FF6B35]', glow: 'rgba(255,107,53,', shadow: '255,107,53' },
];

/** Tier: 0 — "top-3" большой glow, 1 — medium, 2 — small. */
function tierClass(tier: 0 | 1 | 2): string {
  if (tier === 0) return 'text-sm font-bold px-3.5 py-1.5 tracking-wide';
  if (tier === 1) return 'text-xs font-semibold px-3 py-1';
  return 'text-[11px] font-medium px-2.5 py-1';
}

const TagCloud: React.FC<TagCloudProps> = ({
  products,
  selected,
  onChange,
  variant = 'sidebar',
  limit,
}) => {
  const effectiveLimit = limit ?? (variant === 'sidebar' ? 28 : 18);

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      for (const t of p.tags ?? []) {
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, effectiveLimit);
  }, [products, effectiveLimit]);

  const ordered = useMemo(() => {
    // Активные тэги всегда сверху, остальные — по популярности.
    const active: typeof tagCounts = [];
    const rest: typeof tagCounts = [];
    for (const entry of tagCounts) {
      (selected.has(entry[0]) ? active : rest).push(entry);
    }
    return [...active, ...rest];
  }, [tagCounts, selected]);

  const toggle = (tag: string) => {
    const next = new Set(selected);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    onChange(next);
  };

  const clearAll = () => onChange(new Set());

  const renderChip = (tag: string, count: number, originalRank: number) => {
    const isActive = selected.has(tag);
    const palette = NEON_PALETTE[originalRank % NEON_PALETTE.length];
    const tier: 0 | 1 | 2 = originalRank < 3 ? 0 : originalRank < 8 ? 1 : 2;
    const size = tierClass(tier);

    return (
      <button
        key={tag}
        onClick={() => toggle(tag)}
        title={`${tag} — ${count} products`}
        className={`relative rounded-full border transition-all duration-200 whitespace-nowrap ${size} ${
          isActive
            ? `${palette.bg}/15 ${palette.border}/60 ${palette.text}`
            : `bg-white/[0.04] border-white/10 text-gray-300 hover:bg-white/[0.08] hover:${palette.text} hover:${palette.border}/40`
        }`}
        style={
          isActive
            ? {
                boxShadow: `0 0 14px ${palette.glow}0.40), inset 0 0 0 1px ${palette.glow}0.25)`,
                textShadow: `0 0 8px ${palette.glow}0.55)`,
              }
            : tier === 0
              ? { boxShadow: `0 0 8px ${palette.glow}0.10)` }
              : undefined
        }
      >
        <span className="relative z-10">{tag}</span>
        {isActive && (
          <span
            aria-hidden
            className="ml-1.5 inline-flex items-center justify-center text-[9px] opacity-75 relative z-10"
          >
            ×
          </span>
        )}
      </button>
    );
  };

  if (tagCounts.length === 0) return null;

  const header = (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[#00F5FF]/70" />
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#00F5FF]/80">Tags</h3>
        {selected.size > 0 && (
          <span className="text-[10px] text-[#FF00FF]/80 tabular-nums font-semibold">
            {selected.size} active
          </span>
        )}
      </div>
      {selected.size > 0 && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#FF00FF] transition-colors uppercase tracking-wider"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className="rounded-xl border border-[#00F5FF]/15 bg-gradient-to-br from-[#0D0D1A]/90 via-[#0A0A0F]/90 to-[#0D0D1A]/90 p-3 sm:p-4 backdrop-blur-sm relative overflow-hidden">
        {/* Neon border shimmer */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-xl opacity-40 pointer-events-none"
          style={{
            background:
              'linear-gradient(120deg, transparent 30%, rgba(0,245,255,0.08) 50%, transparent 70%)',
          }}
        />

        <div className="relative">
          {header}
          <div className="flex flex-wrap gap-1.5">
            {ordered.map(([tag, count]) => {
              const originalRank = tagCounts.findIndex(([t]) => t === tag);
              return renderChip(tag, count, originalRank);
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-[#00F5FF]/15 bg-gradient-to-br from-[#0D0D1A]/90 via-[#0A0A0F]/90 to-[#0D0D1A]/90 p-4 backdrop-blur-sm overflow-hidden">
      {/* Corner neon accents */}
      <div
        aria-hidden
        className="absolute -top-px -left-px w-16 h-px bg-gradient-to-r from-[#00F5FF]/60 to-transparent pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -top-px -right-px w-px h-16 bg-gradient-to-b from-[#FF00FF]/60 to-transparent pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -bottom-px -right-px w-16 h-px bg-gradient-to-l from-[#FFD700]/40 to-transparent pointer-events-none"
      />

      <div className="relative">
        {header}
        <div className="flex flex-wrap gap-1.5">
          {ordered.map(([tag, count]) => {
            const originalRank = tagCounts.findIndex(([t]) => t === tag);
            return renderChip(tag, count, originalRank);
          })}
        </div>
      </div>
    </div>
  );
};

export default TagCloud;
