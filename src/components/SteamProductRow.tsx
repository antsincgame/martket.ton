import React, { memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Star, Download } from 'lucide-react';
import { formatDownloads } from '../domain/marketplace/platformIcons';
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

const SteamProductRow: React.FC<SteamProductRowProps> = memo(({ product, isActive, onHover, onHoverEnd }) => {
  const navigate = useNavigate();
  const platforms = (product.platforms ?? []).map((p) => PLATFORM_SHORT[p] ?? p);
  const tags = (product.tags ?? []).slice(0, 3);
  const isFree = product.price === 0;

  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-stop]')) return;
    navigate(`/product/${product.id}`);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      className={`group flex items-center gap-4 px-4 py-3 cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-white/[0.05]'
          : 'bg-transparent hover:bg-white/[0.03]'
      }`}
      onClick={handleRowClick}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/product/${product.id}`); }}
      onMouseEnter={() => onHover(product)}
      onMouseLeave={onHoverEnd}
    >
      {/* Capsule image */}
      <img
        src={product.image}
        alt={product.name}
        loading="lazy"
        className={`w-[120px] h-[56px] rounded-lg object-cover flex-shrink-0 transition-all duration-200 ${
          isActive ? 'ring-1 ring-[#00F5FF]/40 shadow-[0_0_12px_rgba(0,245,255,0.15)]' : ''
        }`}
      />

      {/* Title + developer + tags */}
      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-semibold truncate transition-colors duration-150 ${
          isActive ? 'text-white' : 'text-gray-200 group-hover:text-white'
        }`}>
          {product.name}
        </h4>
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0 overflow-hidden">
          <Link
            to={`/developer/${encodeURIComponent(product.developer)}`}
            data-stop
            className="text-xs text-gray-500 hover:text-gray-300 underline decoration-gray-700 underline-offset-2 transition-colors truncate flex-shrink-0 max-w-[120px]"
          >
            {product.developer}
          </Link>
          {tags.length > 0 && <span className="text-gray-700 text-xs flex-shrink-0">·</span>}
          {tags.map((tag, i) => (
            <React.Fragment key={tag}>
              {i > 0 && <span className="text-gray-700 text-[10px] flex-shrink-0">·</span>}
              <span className="text-[11px] text-[#00F5FF]/50 truncate flex-shrink min-w-0">{tag}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Platforms */}
      <div className="hidden md:flex items-center gap-0.5 text-[10px] text-gray-600 flex-shrink-0">
        {platforms.map((p, i) => (
          <React.Fragment key={p}>
            {i > 0 && <span className="text-gray-700">·</span>}
            <span>{p}</span>
          </React.Fragment>
        ))}
      </div>

      {/* Rating + Downloads */}
      <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1">
          <Download className="w-3 h-3 text-gray-600" />
          <span className="text-[11px] text-gray-500 tabular-nums">{formatDownloads(product.downloads)}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Star className="w-3 h-3 fill-[#FFD700] text-[#FFD700]" />
          <span className="text-[11px] text-[#FFD700]/70 tabular-nums">{product.rating}</span>
        </div>
      </div>

      {/* Buy button */}
      <button
        data-stop
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/product/${product.id}`);
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
  );
});

SteamProductRow.displayName = 'SteamProductRow';

export default SteamProductRow;
