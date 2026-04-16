import React from 'react';
import { Star, Download, Heart, Zap, MessageSquare, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getPlatformEntries, formatDate } from '../domain/marketplace/platformIcons';
import { slugify } from '../utils/slugify';
import type { CatalogListingProduct } from '../domain/marketplace/types';

interface ProductPreviewProps {
  product: CatalogListingProduct | null;
  floating?: boolean;
}

const ProductPreview: React.FC<ProductPreviewProps> = ({ product, floating }) => {
  if (!product) return null;

  const platforms = getPlatformEntries(product.platforms ?? []);
  const tags = product.tags ?? [];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={product.id}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-gradient-to-b from-[#1A1A1A] to-[#0D0D1A] border border-[#FFD700]/15 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(255,215,0,0.06)]"
      >
        <div className="aspect-video relative">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D1A] via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-white font-bold text-lg leading-tight line-clamp-1 drop-shadow-lg">
              {product.name}
            </h3>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-gray-400 text-sm line-clamp-3 leading-relaxed">
            {product.description}
          </p>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-[#00F5FF]/10 text-[#00F5FF]/80 text-[10px] px-2 py-0.5 rounded-full border border-[#00F5FF]/15"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {platforms.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {platforms.map(({ name, icon }) => (
                <div
                  key={name}
                  className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1"
                >
                  <img src={icon} alt={name} className="w-4 h-4 object-contain" />
                  <span className="text-[10px] text-gray-400">{name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1 text-[#FFD700]">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-medium">{product.rating}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <Download className="w-3.5 h-3.5" />
              <span className="text-xs">{product.downloads.toLocaleString()}</span>
            </div>
            {product.reviewCount != null && product.reviewCount > 0 && (
              <div className="flex items-center gap-1 text-gray-400">
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="text-xs">{product.reviewCount}</span>
              </div>
            )}
            {(product.donationAmount ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-pink-400">
                <Heart className="w-3.5 h-3.5" />
                <span className="text-xs">{product.donationAmount} TON</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#FFD700]/10">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">by {product.developer}</span>
              {product.releaseDate && (
                <div className="flex items-center gap-1 text-gray-600">
                  <Calendar className="w-3 h-3" />
                  <span className="text-[10px]">{formatDate(product.releaseDate)}</span>
                </div>
              )}
            </div>
            <div className={`flex items-center gap-1 font-bold text-sm ${
              product.price > 0 ? 'text-[#00F5FF]' : 'text-emerald-400'
            }`}>
              <Zap className="w-4 h-4" />
              {product.price > 0 ? `${product.price} TON` : 'Free'}
            </div>
          </div>

          {!floating && (
            <Link
              to={`/product/${slugify(product.name)}`}
              className="block w-full text-center bg-gradient-to-r from-[#FFD700]/20 to-[#FFD700]/10 border border-[#FFD700]/30 hover:border-[#FFD700]/50 hover:from-[#FFD700]/30 hover:to-[#FFD700]/15 hover:shadow-[0_0_15px_rgba(255,215,0,0.15)] text-[#FFD700] text-sm font-semibold py-2.5 rounded-lg transition-all duration-200 uppercase tracking-wider"
            >
              View Details
            </Link>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProductPreview;
