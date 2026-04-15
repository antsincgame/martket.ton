import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Zap } from 'lucide-react';
import type { CatalogListingProduct } from '../domain/marketplace/types';

interface SteamProductRowProps {
  product: CatalogListingProduct;
  isActive: boolean;
  onHover: (product: CatalogListingProduct) => void;
}

const SteamProductRow: React.FC<SteamProductRowProps> = ({ product, isActive, onHover }) => {
  return (
    <Link
      to={`/product/${product.id}`}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 border ${
        isActive
          ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
          : 'bg-transparent border-transparent hover:bg-white/5'
      }`}
      onMouseEnter={() => onHover(product)}
    >
      <img
        src={product.image}
        alt={product.name}
        className="w-[120px] h-[45px] rounded object-cover flex-shrink-0"
      />

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-white truncate">{product.name}</h4>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">{product.category}</span>
          <div className="flex items-center gap-0.5 text-yellow-400">
            <Star className="w-3 h-3 fill-current" />
            <span className="text-xs">{product.rating}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 text-ton-400 font-semibold text-sm flex-shrink-0">
        <Zap className="w-3.5 h-3.5" />
        {product.price} TON
      </div>
    </Link>
  );
};

export default SteamProductRow;
