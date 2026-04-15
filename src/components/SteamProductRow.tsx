import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Star, Zap, Download } from 'lucide-react';
import { formatDownloads } from '../domain/marketplace/platformIcons';
import type { CatalogListingProduct } from '../domain/marketplace/types';

export const ROW_GRID = 'grid-cols-[7.5rem_1fr_9rem_10rem_5rem_4.5rem_5rem]';

const PLATFORM_CFG: Record<string, { label: string; color: string }> = {
  Windows: { label: 'Windows', color: '#4A9EAA' },
  macOS: { label: 'macOS', color: '#8B5A8B' },
  Linux: { label: 'Linux', color: '#4A8B5A' },
  iOS: { label: 'iOS', color: '#6B5A8B' },
  Android: { label: 'Android', color: '#4A8B5A' },
  Web: { label: 'Web', color: '#8B7A3A' },
};

interface SteamProductRowProps {
  product: CatalogListingProduct;
  isActive: boolean;
  onHover: (product: CatalogListingProduct) => void;
  onHoverEnd: () => void;
}

const SteamProductRow: React.FC<SteamProductRowProps> = ({ product, isActive, onHover, onHoverEnd }) => {
  const navigate = useNavigate();
  const platforms = (product.platforms ?? []).slice(0, 3);

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
          ? 'bg-white/[0.03] border-white/10'
          : 'bg-transparent border-transparent hover:bg-white/[0.02] hover:border-white/5'
      }`}
      onClick={handleRowClick}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/product/${product.id}`); }}
    >
      {/* Thumbnail */}
      <img
        src={product.image}
        alt={product.name}
        className="w-full h-[2.8rem] rounded object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-200"
        onMouseEnter={() => onHover(product)}
        onMouseLeave={onHoverEnd}
      />

      {/* Name */}
      <div
        className="min-w-0 pl-1"
        onMouseEnter={() => onHover(product)}
        onMouseLeave={onHoverEnd}
      >
        <h4 className={`text-sm font-medium truncate transition-colors duration-150 ${
          isActive ? 'text-gray-100' : 'text-gray-300 group-hover:text-gray-200'
        }`}>
          {product.name}
        </h4>
      </div>

      {/* Developer */}
      <div className="min-w-0" data-dev-link>
        <Link
          to={`/developer/${encodeURIComponent(product.developer)}`}
          className="group/dev flex items-center gap-1 min-w-0"
        >
          <span className="text-xs truncate text-cyan-700 group-hover/dev:text-cyan-500 transition-colors duration-200">
            {product.developer}
          </span>
        </Link>
      </div>

      {/* Platforms */}
      <div className="grid grid-cols-2 gap-0.5 justify-items-center">
        {platforms.map((p) => {
          const cfg = PLATFORM_CFG[p];
          if (!cfg) return null;
          return (
            <span
              key={p}
              className="text-[0.55rem] font-medium tracking-wide px-1.5 py-0.5 rounded border w-full text-center"
              style={{
                color: cfg.color,
                borderColor: `${cfg.color}30`,
                backgroundColor: `${cfg.color}0A`,
              }}
            >
              {cfg.label}
            </span>
          );
        })}
      </div>

      {/* Downloads */}
      <div className="flex items-center justify-end gap-1 text-gray-600 tabular-nums">
        <Download className="w-3 h-3 flex-shrink-0" />
        <span className="text-[0.7rem]">{formatDownloads(product.downloads)}</span>
      </div>

      {/* Rating */}
      <div className="flex items-center justify-center gap-0.5">
        <Star className="w-3 h-3 fill-amber-700 text-amber-700 flex-shrink-0" />
        <span className="text-[0.7rem] text-amber-700/80 tabular-nums">{product.rating}</span>
      </div>

      {/* Price */}
      <div className={`flex items-center justify-end gap-1 font-semibold text-[0.8rem] transition-colors duration-150 ${
        product.price > 0
          ? 'text-cyan-800'
          : 'text-emerald-700'
      }`}>
        <Zap className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="tabular-nums">{product.price > 0 ? `${product.price}` : 'Free'}</span>
      </div>
    </div>
  );
};

export default SteamProductRow;
