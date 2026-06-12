import React, { memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Download, Zap, Gem, Sparkles } from 'lucide-react';
import { slugify } from '../utils/slugify';
import DemoUiBadge from './DemoUiBadge';
import WishlistHeart from './WishlistHeart';
import type { CatalogListingProduct } from '../domain/marketplace/types';

interface ProductCardProps {
  product: CatalogListingProduct;
}

const ProductCard: React.FC<ProductCardProps> = memo(({ product }) => {
  const navigate = useNavigate();
  const productPath = `/product/${slugify(product.name)}`;
  const developerPath = `/developer/${slugify(product.developer)}`;

  return (
    <Link to={productPath} className="group block h-full">
      <div className="relative h-full flex flex-col rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.03] bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.06] hover:border-[#FFD700]/15 hover:shadow-[0_8px_60px_rgba(255,215,0,0.06)]">

        {/* Badges */}
        {product.isFeatured && (
          <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 bg-[#8B5CF6]/15 backdrop-blur-sm border border-[#8B5CF6]/25 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#8B5CF6]">
            <Gem className="w-3 h-3" />
            Featured
          </div>
        )}

        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          <WishlistHeart productId={product.id} />
          <DemoUiBadge variant="inline" tint="cyan" />
        </div>

        {product.donationAmount && product.donationAmount > 0 && (
          <div className="absolute top-12 right-3 z-10 inline-flex items-center gap-1 bg-[#FFD700]/5 backdrop-blur-sm border border-[#FFD700]/20 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#FFD700]">
            <Sparkles className="w-3 h-3" />
            {product.donationAmount} TON
          </div>
        )}

        {/* Image */}
        <div className="aspect-video relative overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#0D0D1A] to-[#12121F]">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-t-2xl pointer-events-none" />
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-grow">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-white text-sm group-hover:text-[#FFD700] transition-colors duration-300 line-clamp-1 flex-1">
              {product.name}
            </h3>
            <div className="flex items-center gap-1 text-[#FFD700] font-display font-bold text-sm flex-shrink-0">
              <Zap className="w-3.5 h-3.5" />
              {product.price}
            </div>
          </div>

          <p className="text-gray-500 text-xs mb-2 line-clamp-2 flex-grow leading-relaxed">
            {product.description}
          </p>

          <p className="text-gray-600 text-xs mb-3 font-medium truncate">
            by{' '}
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(developerPath); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); navigate(developerPath); } }}
              className="text-[#FFD700]/70 hover:text-[#FFD700] transition-colors cursor-pointer"
            >
              {product.developer}
            </span>
          </p>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[#FFD700]">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span className="font-semibold">{product.rating}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Download className="w-3.5 h-3.5" />
                <span>{product.downloads.toLocaleString()}</span>
              </div>
            </div>
            <span className="text-gray-700 text-[10px] uppercase tracking-wider font-medium">
              {product.category}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
