import React from 'react';
import { Star, Download, Heart, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { CatalogListingProduct } from '../domain/marketplace/types';

interface ProductPreviewProps {
  product: CatalogListingProduct | null;
}

const ProductPreview: React.FC<ProductPreviewProps> = ({ product }) => {
  if (!product) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={product.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden"
      >
        <div className="aspect-video relative">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-white font-semibold text-lg leading-tight line-clamp-1">
              {product.name}
            </h3>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-gray-400 text-sm line-clamp-3 leading-relaxed">
            {product.description}
          </p>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-yellow-400">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-medium">{product.rating}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <Download className="w-4 h-4" />
              <span>{product.downloads.toLocaleString()}</span>
            </div>
            {(product.donationAmount ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-pink-400">
                <Heart className="w-4 h-4" />
                <span>{product.donationAmount} TON</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="text-xs text-gray-500">by {product.developer}</span>
            <div className="flex items-center gap-1 text-ton-400 font-bold text-sm">
              <Zap className="w-4 h-4" />
              {product.price} TON
            </div>
          </div>

          <Link
            to={`/product/${product.id}`}
            className="block w-full text-center bg-ton-gradient hover:brightness-110 text-white text-sm font-semibold py-2.5 rounded-lg transition-all"
          >
            View Details
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProductPreview;
