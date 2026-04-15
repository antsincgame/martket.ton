import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Zap, Download } from 'lucide-react';
import { getPlatformEntries, formatDownloads } from '../domain/marketplace/platformIcons';
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
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border ${
        isActive
          ? 'bg-[#FFD700]/[0.04] border-[#FFD700]/20 shadow-[0_0_20px_rgba(255,215,0,0.08)]'
          : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/5'
      }`}
      onMouseEnter={() => onHover(product)}
    >
      <img
        src={product.image}
        alt={product.name}
        className={`w-[120px] h-[45px] rounded object-cover flex-shrink-0 transition-all duration-200 ${
          isActive ? 'ring-1 ring-[#FFD700]/30' : ''
        }`}
      />

      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-medium truncate transition-colors duration-150 ${
          isActive ? 'text-[#FFD700]' : 'text-white group-hover:text-gray-100'
        }`}>
          {product.name}
        </h4>
        <div className="flex items-center gap-2 mt-0.5">
          {platforms.length > 0 && (
            <div className="flex items-center gap-0.5" title={platforms.map((p) => p.name).join(', ')}>
              {platforms.map(({ name, icon }) => (
                <img
                  key={name}
                  src={icon}
                  alt={name}
                  className="w-4 h-4 object-contain"
                  title={name}
                />
              ))}
            </div>
          )}
          {tags.map((tag) => (
            <span
              key={tag}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors duration-150 ${
                isActive
                  ? 'bg-[#FFD700]/10 text-[#FFD700]/60 border border-[#FFD700]/10'
                  : 'bg-white/5 text-gray-500 border border-transparent'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1 text-gray-500 text-xs flex-shrink-0 tabular-nums">
        <Download className="w-3 h-3" />
        {formatDownloads(product.downloads)}
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Star className="w-3 h-3 fill-[#FFD700] text-[#FFD700]" />
        <span className="text-xs text-[#FFD700]/80 tabular-nums">{product.rating}</span>
      </div>

      <div className={`flex items-center gap-1 font-semibold text-sm flex-shrink-0 w-[72px] justify-end transition-colors duration-150 ${
        product.price > 0
          ? isActive ? 'text-[#00F5FF]' : 'text-blue-400'
          : 'text-emerald-400'
      }`}>
        <Zap className="w-3.5 h-3.5" />
        {product.price > 0 ? `${product.price} TON` : 'Free'}
      </div>
    </Link>
  );
};

export default SteamProductRow;
