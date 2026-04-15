import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Star, Zap, Download, Wand2 } from 'lucide-react';
import { getPlatformEntries, formatDownloads } from '../domain/marketplace/platformIcons';
import type { CatalogListingProduct } from '../domain/marketplace/types';

export const ROW_GRID = 'grid-cols-[7.5rem_1fr_10rem_6.5rem_5rem_4.5rem_3.5rem_5rem]';

interface SteamProductRowProps {
  product: CatalogListingProduct;
  isActive: boolean;
  onHover: (product: CatalogListingProduct) => void;
}

const SteamProductRow: React.FC<SteamProductRowProps> = ({ product, isActive, onHover }) => {
  const navigate = useNavigate();
  const platforms = getPlatformEntries(product.platforms ?? []).slice(0, 3);
  const platformTitle = platforms.map((p) => p.name).join(', ');
  const tags = (product.tags ?? []).slice(0, 2);

  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-dev-link]')) return;
    navigate(`/product/${product.id}`);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      className={`group grid ${ROW_GRID} items-center gap-x-2 px-3 py-2 rounded-lg transition-all duration-200 border cursor-pointer ${
        isActive
          ? 'bg-[#FFD700]/[0.04] border-[#FFD700]/20 shadow-[0_0_20px_rgba(255,215,0,0.08)]'
          : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/5'
      }`}
      onClick={handleRowClick}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/product/${product.id}`); }}
      onMouseEnter={() => onHover(product)}
    >
      {/* Thumbnail */}
      <img
        src={product.image}
        alt={product.name}
        className={`w-full h-[2.8rem] rounded object-cover transition-all duration-200 ${
          isActive ? 'ring-1 ring-[#FFD700]/30' : ''
        }`}
      />

      {/* Name */}
      <div className="min-w-0 pl-1">
        <h4 className={`text-sm font-medium truncate transition-colors duration-150 ${
          isActive ? 'text-[#FFD700]' : 'text-white group-hover:text-gray-100'
        }`}>
          {product.name}
        </h4>
      </div>

      {/* Developer — Neon Demiurge link */}
      <div className="min-w-0" data-dev-link>
        <Link
          to={`/developer/${encodeURIComponent(product.developer)}`}
          className="group/dev flex items-center gap-1.5 min-w-0"
        >
          <Wand2 className="w-3.5 h-3.5 flex-shrink-0 text-[#FFD700]/60 group-hover/dev:text-[#FFD700] transition-colors duration-200" />
          <span className="text-sm font-semibold truncate text-[#FFD700] group-hover/dev:text-[#FFE066] transition-all duration-200 drop-shadow-[0_0_8px_rgba(255,215,0,0.4)] group-hover/dev:drop-shadow-[0_0_16px_rgba(255,215,0,0.7)]">
            {product.developer}
          </span>
        </Link>
      </div>

      {/* Platforms — horizontal row, rem-sized icons */}
      <div className="flex items-center justify-center gap-1" title={platformTitle}>
        {platforms.map(({ name, icon }) => (
          <img key={name} src={icon} alt={name} className="w-7 h-7 object-contain" title={name} />
        ))}
      </div>

      {/* Tags */}
      <div className="flex flex-col items-start gap-0.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`text-[0.55rem] leading-tight px-1.5 py-px rounded truncate max-w-full transition-colors duration-150 ${
              isActive
                ? 'bg-[#00F5FF]/10 text-[#00F5FF]/70 border border-[#00F5FF]/10'
                : 'bg-white/5 text-gray-500 border border-transparent'
            }`}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Downloads */}
      <div className="flex items-center justify-end gap-1 text-gray-500 tabular-nums">
        <Download className="w-3 h-3 flex-shrink-0" />
        <span className="text-[0.7rem]">{formatDownloads(product.downloads)}</span>
      </div>

      {/* Rating */}
      <div className="flex items-center justify-center gap-0.5">
        <Star className="w-3 h-3 fill-[#FFD700] text-[#FFD700] flex-shrink-0" />
        <span className="text-[0.7rem] text-[#FFD700]/80 tabular-nums">{product.rating}</span>
      </div>

      {/* Price */}
      <div className={`flex items-center justify-end gap-1 font-semibold text-[0.8rem] transition-colors duration-150 ${
        product.price > 0
          ? isActive ? 'text-[#00F5FF]' : 'text-blue-400'
          : 'text-emerald-400'
      }`}>
        <Zap className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="tabular-nums">{product.price > 0 ? `${product.price}` : 'Free'}</span>
      </div>
    </div>
  );
};

export default SteamProductRow;
