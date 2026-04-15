import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Zap, Download } from 'lucide-react';
import { getPlatformEntries, formatDownloads } from '../domain/marketplace/platformIcons';
import type { CatalogListingProduct } from '../domain/marketplace/types';

export const ROW_GRID = 'grid-cols-[120px_1fr_90px_56px_80px_72px_56px_80px]';

interface SteamProductRowProps {
  product: CatalogListingProduct;
  isActive: boolean;
  onHover: (product: CatalogListingProduct) => void;
}

const SteamProductRow: React.FC<SteamProductRowProps> = ({ product, isActive, onHover }) => {
  const platforms = getPlatformEntries(product.platforms ?? []).slice(0, 3);
  const tags = (product.tags ?? []).slice(0, 2);

  return (
    <Link
      to={`/product/${product.id}`}
      className={`group grid ${ROW_GRID} items-center gap-x-2 px-3 py-2 rounded-lg transition-all duration-200 border ${
        isActive
          ? 'bg-[#FFD700]/[0.04] border-[#FFD700]/20 shadow-[0_0_20px_rgba(255,215,0,0.08)]'
          : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/5'
      }`}
      onMouseEnter={() => onHover(product)}
    >
      {/* COL 1: Thumbnail */}
      <img
        src={product.image}
        alt={product.name}
        className={`w-[120px] h-[45px] rounded object-cover transition-all duration-200 ${
          isActive ? 'ring-1 ring-[#FFD700]/30' : ''
        }`}
      />

      {/* COL 2: Name */}
      <div className="min-w-0 pl-1">
        <h4 className={`text-sm font-medium truncate transition-colors duration-150 ${
          isActive ? 'text-[#FFD700]' : 'text-white group-hover:text-gray-100'
        }`}>
          {product.name}
        </h4>
      </div>

      {/* COL 3: Developer */}
      <span className="text-[10px] text-gray-500 truncate block group-hover:text-gray-400 transition-colors">
        {product.developer}
      </span>

      {/* COL 4: Platforms (vertical, max 3, sized to row height) */}
      <div
        className="flex flex-col items-center justify-center gap-0.5 h-[45px]"
        title={getPlatformEntries(product.platforms ?? []).map((p) => p.name).join(', ')}
      >
        {platforms.map(({ name, icon }) => {
          const size = platforms.length === 1 ? 'w-7 h-7' : platforms.length === 2 ? 'w-5 h-5' : 'w-[14px] h-[14px]';
          return (
            <img key={name} src={icon} alt={name} className={`${size} object-contain`} title={name} />
          );
        })}
      </div>

      {/* COL 5: Tags */}
      <div className="flex flex-col items-start gap-0.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`text-[9px] leading-tight px-1.5 py-px rounded truncate max-w-full transition-colors duration-150 ${
              isActive
                ? 'bg-[#00F5FF]/10 text-[#00F5FF]/70 border border-[#00F5FF]/10'
                : 'bg-white/5 text-gray-500 border border-transparent'
            }`}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* COL 6: Downloads */}
      <div className="flex items-center justify-end gap-1 text-gray-500 tabular-nums">
        <Download className="w-3 h-3 flex-shrink-0" />
        <span className="text-[11px]">{formatDownloads(product.downloads)}</span>
      </div>

      {/* COL 7: Rating */}
      <div className="flex items-center justify-center gap-0.5">
        <Star className="w-3 h-3 fill-[#FFD700] text-[#FFD700] flex-shrink-0" />
        <span className="text-[11px] text-[#FFD700]/80 tabular-nums">{product.rating}</span>
      </div>

      {/* COL 8: Price */}
      <div className={`flex items-center justify-end gap-1 font-semibold text-[13px] transition-colors duration-150 ${
        product.price > 0
          ? isActive ? 'text-[#00F5FF]' : 'text-blue-400'
          : 'text-emerald-400'
      }`}>
        <Zap className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="tabular-nums">{product.price > 0 ? `${product.price}` : 'Free'}</span>
      </div>
    </Link>
  );
};

export default SteamProductRow;
