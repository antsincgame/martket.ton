import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Zap, Download, MessageSquare } from 'lucide-react';
import { getPlatformEntries, formatDownloads, formatDate } from '../domain/marketplace/platformIcons';
import type { CatalogListingProduct } from '../domain/marketplace/types';

interface SteamProductRowProps {
  product: CatalogListingProduct;
  isActive: boolean;
  onHover: (product: CatalogListingProduct) => void;
}

const SteamProductRow: React.FC<SteamProductRowProps> = ({ product, isActive, onHover }) => {
  const platforms = getPlatformEntries(product.platforms ?? []);
  const tags = (product.tags ?? []).slice(0, 2);

  return (
    <Link
      to={`/product/${product.id}`}
      className={`group grid grid-cols-[120px_1fr_80px_80px_60px_56px_80px] items-center gap-x-2 px-3 py-2 rounded-lg transition-all duration-200 border ${
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

      {/* COL 2: Name + Developer */}
      <div className="min-w-0 pl-1">
        <h4 className={`text-sm font-medium truncate transition-colors duration-150 ${
          isActive ? 'text-[#FFD700]' : 'text-white group-hover:text-gray-100'
        }`}>
          {product.name}
        </h4>
        <span className="text-[10px] text-gray-600 truncate block">{product.developer}</span>
      </div>

      {/* COL 3: Platforms */}
      <div className="flex items-center justify-center gap-0.5" title={platforms.map((p) => p.name).join(', ')}>
        {platforms.map(({ name, icon }) => (
          <img key={name} src={icon} alt={name} className="w-[14px] h-[14px] object-contain" title={name} />
        ))}
      </div>

      {/* COL 4: Tags */}
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

      {/* COL 5: Downloads */}
      <div className="flex items-center justify-end gap-1 text-gray-500 tabular-nums">
        <Download className="w-3 h-3 flex-shrink-0" />
        <span className="text-[11px]">{formatDownloads(product.downloads)}</span>
      </div>

      {/* COL 6: Rating */}
      <div className="flex items-center justify-center gap-0.5">
        <Star className="w-3 h-3 fill-[#FFD700] text-[#FFD700] flex-shrink-0" />
        <span className="text-[11px] text-[#FFD700]/80 tabular-nums">{product.rating}</span>
      </div>

      {/* COL 7: Price */}
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
