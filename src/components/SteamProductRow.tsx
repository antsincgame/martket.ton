import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Star, Zap, Download } from 'lucide-react';
import { formatDownloads } from '../domain/marketplace/platformIcons';
import type { CatalogListingProduct } from '../domain/marketplace/types';

export const ROW_GRID = 'grid-cols-[5rem_1fr_9rem_3.5rem_3rem_4rem]';

const PLATFORM_CFG: Record<string, { label: string; color: string }> = {
  Windows: { label: 'Windows', color: '#00F5FF' },
  macOS: { label: 'macOS', color: '#FF00FF' },
  Linux: { label: 'Linux', color: '#00FF88' },
  iOS: { label: 'iOS', color: '#8B5CF6' },
  Android: { label: 'Android', color: '#00FF88' },
  Web: { label: 'Web', color: '#FFD700' },
};

interface SteamProductRowProps {
  product: CatalogListingProduct;
  isActive: boolean;
  onHover: (product: CatalogListingProduct) => void;
  onHoverEnd: () => void;
}

const SteamProductRow: React.FC<SteamProductRowProps> = ({ product, isActive, onHover, onHoverEnd }) => {
  const navigate = useNavigate();
  const platforms = product.platforms ?? [];
  const desc = product.description?.length > 300
    ? product.description.slice(0, 297) + '...'
    : product.description;

  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-dev-link]')) return;
    navigate(`/product/${product.id}`);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      className={`group rounded-lg transition-all duration-200 border cursor-pointer px-3 py-2.5 ${
        isActive
          ? 'bg-[#FFD700]/[0.04] border-[#FFD700]/20 shadow-[0_0_20px_rgba(255,215,0,0.08)]'
          : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/5'
      }`}
      onClick={handleRowClick}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/product/${product.id}`); }}
    >
      {/* App name */}
      <h4
        className={`text-sm font-semibold mb-1.5 transition-colors duration-150 ${
          isActive ? 'text-[#FFD700]' : 'text-white group-hover:text-gray-100'
        }`}
        onMouseEnter={() => onHover(product)}
        onMouseLeave={onHoverEnd}
      >
        {product.name}
      </h4>

      {/* Content row */}
      <div className={`grid ${ROW_GRID} items-center gap-x-3`}>
        {/* Thumbnail */}
        <img
          src={product.image}
          alt={product.name}
          className={`w-full h-[3.2rem] rounded object-cover transition-all duration-200 ${
            isActive ? 'ring-1 ring-[#FFD700]/30' : ''
          }`}
          onMouseEnter={() => onHover(product)}
          onMouseLeave={onHoverEnd}
        />

        {/* Developer */}
        <div className="min-w-0" data-dev-link>
          <Link
            to={`/developer/${encodeURIComponent(product.developer)}`}
            className="text-xs truncate text-gray-400 underline decoration-gray-600 underline-offset-2 hover:text-white hover:decoration-gray-400 transition-colors duration-200 block"
          >
            {product.developer}
          </Link>
        </div>

        {/* Platforms */}
        <div className="grid grid-cols-2 gap-1">
          {platforms.map((p) => {
            const cfg = PLATFORM_CFG[p];
            if (!cfg) return null;
            return (
              <span
                key={p}
                className="text-[0.55rem] font-bold tracking-wide px-1 py-px rounded border leading-none"
                style={{
                  color: cfg.color,
                  borderColor: `${cfg.color}40`,
                  backgroundColor: `${cfg.color}15`,
                }}
              >
                {cfg.label}
              </span>
            );
          })}
        </div>

        {/* Downloads */}
        <div className="flex items-center justify-end gap-0.5 text-gray-500 tabular-nums">
          <Download className="w-3 h-3 flex-shrink-0" />
          <span className="text-[0.65rem]">{formatDownloads(product.downloads)}</span>
        </div>

        {/* Rating */}
        <div className="flex items-center justify-center gap-0.5">
          <Star className="w-3 h-3 fill-[#FFD700] text-[#FFD700] flex-shrink-0" />
          <span className="text-[0.65rem] text-[#FFD700]/80 tabular-nums">{product.rating}</span>
        </div>

        {/* Price */}
        <div className={`flex items-center justify-end gap-0.5 font-semibold text-[0.75rem] transition-colors duration-150 ${
          product.price > 0
            ? isActive ? 'text-[#00F5FF]' : 'text-blue-400'
            : 'text-emerald-400'
        }`}>
          <Zap className="w-3 h-3 flex-shrink-0" />
          <span className="tabular-nums">{product.price > 0 ? `${product.price}` : 'Free'}</span>
        </div>
      </div>

      {/* Description */}
      {desc && (
        <p className="mt-1.5 text-[0.7rem] leading-relaxed text-gray-500 line-clamp-2">
          {desc}
        </p>
      )}
    </div>
  );
};

export default SteamProductRow;
