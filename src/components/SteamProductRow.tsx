import React, { memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Star, Download } from 'lucide-react';
import { formatDownloads } from '../domain/marketplace/platformIcons';
import { slugify } from '../utils/slugify';
import type { CatalogListingProduct } from '../domain/marketplace/types';

const PLATFORM_SHORT: Record<string, string> = {
  Windows: 'Win',
  macOS: 'Mac',
  Linux: 'Linux',
  iOS: 'iOS',
  Android: 'Android',
  Web: 'Web',
};

interface SteamProductRowProps {
  product: CatalogListingProduct;
  isActive: boolean;
  onHover: (product: CatalogListingProduct) => void;
  onHoverEnd: () => void;
}

/**
 * Гарантированный краткий «лид» под заголовком на мобильной карточке.
 * Приоритет:
 *   1) непустой product.description (как правило, 1 предложение из seed/CMS)
 *   2) top-2 тэга через `·` — «Productivity · Zen»
 *   3) категория как последний fallback
 *   4) пустая строка → lead не рендерится
 */
function computeLead(product: CatalogListingProduct): string {
  const desc = product.description?.trim();
  if (desc) return desc;
  const tags = (product.tags ?? []).filter((t) => t && t.trim().length > 0).slice(0, 2);
  if (tags.length > 0) return tags.join(' · ');
  return product.category?.trim() ?? '';
}

const SteamProductRow: React.FC<SteamProductRowProps> = memo(
  ({ product, isActive, onHover, onHoverEnd }) => {
    const navigate = useNavigate();
    const platforms = (product.platforms ?? []).map((p) => PLATFORM_SHORT[p] ?? p);
    const tags = (product.tags ?? []).slice(0, 3);
    const isFree = product.price === 0;
    const productPath = `/product/${slugify(product.name)}`;
    const developerPath = `/developer/${slugify(product.developer)}`;
    const lead = computeLead(product);

    const handleRowClick = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-stop]')) return;
      navigate(productPath);
    };

    return (
      <div
        role="link"
        tabIndex={0}
        className={`group cursor-pointer transition-all duration-200 ${
          isActive ? 'bg-white/[0.05]' : 'bg-transparent hover:bg-white/[0.03] active:bg-white/[0.08]'
        }`}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') navigate(productPath);
        }}
        onMouseEnter={() => onHover(product)}
        onMouseLeave={onHoverEnd}
      >
        {/* ═══ Mobile layout (<sm): compact row + lead + category ═══ */}
        <div className="sm:hidden flex gap-3 p-3">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className={`w-24 h-24 rounded-xl object-cover flex-shrink-0 ${
              isActive ? 'ring-1 ring-[#00F5FF]/40' : ''
            }`}
          />
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-gray-100 leading-snug line-clamp-2 mb-1">
                {product.name}
              </h4>
              <Link
                to={developerPath}
                data-stop
                className="inline-block text-[11px] text-gray-500 hover:text-[#00F5FF] underline decoration-gray-700 decoration-dotted underline-offset-2 transition-colors truncate max-w-full"
              >
                by {product.developer}
              </Link>
              {/* Краткий лид: ~1 строка для быстрой сканируемости (description → tags → category). */}
              {lead && (
                <p className="text-[11px] text-gray-400/80 leading-snug line-clamp-1 mt-1">
                  {lead}
                </p>
              )}
            </div>

            <div className="flex items-end justify-between gap-2 mt-2">
              <div className="flex items-center gap-2 text-[11px] text-gray-400 min-w-0 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Star className="w-3 h-3 fill-[#FFD700] text-[#FFD700]" />
                  <span className="tabular-nums text-[#FFD700]/80">{product.rating}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Download className="w-3 h-3 text-gray-600" />
                  <span className="tabular-nums">{formatDownloads(product.downloads)}</span>
                </span>
                {product.category && (
                  <span className="inline-flex items-center text-[10px] uppercase tracking-wider text-[#00F5FF]/70 border border-[#00F5FF]/20 rounded-full px-1.5 py-0.5 bg-[#00F5FF]/5">
                    {product.category}
                  </span>
                )}
              </div>
              <button
                data-stop
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(productPath);
                }}
                className={`flex-shrink-0 px-3 rounded-lg text-xs font-bold border transition-all duration-200 min-w-[84px] min-h-[44px] text-center ${
                  isFree
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 active:bg-emerald-500/25'
                    : 'bg-[#00F5FF]/10 border-[#00F5FF]/30 text-[#00F5FF] active:bg-[#00F5FF]/25'
                }`}
              >
                {isFree ? 'Free' : `${product.price} TON`}
              </button>
            </div>
          </div>
        </div>

        {/* ═══ Desktop layout (≥sm): как раньше — капсула 120×56 с inline данными ═══ */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-3">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className={`w-[120px] h-[56px] rounded-lg object-cover flex-shrink-0 transition-all duration-200 ${
              isActive ? 'ring-1 ring-[#00F5FF]/40 shadow-[0_0_12px_rgba(0,245,255,0.15)]' : ''
            }`}
          />

          <div className="flex-1 min-w-0">
            <h4
              className={`text-sm font-semibold truncate transition-colors duration-150 ${
                isActive ? 'text-white' : 'text-gray-200 group-hover:text-white'
              }`}
            >
              {product.name}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0 overflow-hidden">
              <Link
                to={developerPath}
                data-stop
                className="text-xs text-gray-500 hover:text-gray-300 underline decoration-gray-700 underline-offset-2 transition-colors truncate flex-shrink-0 max-w-[120px]"
              >
                {product.developer}
              </Link>
              {tags.length > 0 && <span className="text-gray-700 text-xs flex-shrink-0">·</span>}
              {tags.map((tag, i) => (
                <React.Fragment key={tag}>
                  {i > 0 && <span className="text-gray-700 text-[10px] flex-shrink-0">·</span>}
                  <span className="text-[11px] text-[#00F5FF]/50 truncate flex-shrink min-w-0">
                    {tag}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-0.5 text-[10px] text-gray-600 flex-shrink-0">
            {platforms.map((p, i) => (
              <React.Fragment key={p}>
                {i > 0 && <span className="text-gray-700">·</span>}
                <span>{p}</span>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3 text-gray-600" />
              <span className="text-[11px] text-gray-500 tabular-nums">
                {formatDownloads(product.downloads)}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-[#FFD700] text-[#FFD700]" />
              <span className="text-[11px] text-[#FFD700]/70 tabular-nums">{product.rating}</span>
            </div>
          </div>

          <button
            data-stop
            onClick={(e) => {
              e.stopPropagation();
              navigate(productPath);
            }}
            className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 min-w-[76px] text-center ${
              isFree
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'bg-[#00F5FF]/10 border-[#00F5FF]/25 text-[#00F5FF] hover:bg-[#00F5FF]/20 hover:border-[#00F5FF]/40 hover:shadow-[0_0_12px_rgba(0,245,255,0.15)]'
            }`}
          >
            {isFree ? 'Free' : `${product.price} TON`}
          </button>
        </div>
      </div>
    );
  },
);

SteamProductRow.displayName = 'SteamProductRow';

export default SteamProductRow;
