import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Download, Heart, Zap, Gem } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  rating: number;
  downloads: number;
  image: string;
  category: string;
  developer: string;
  isFeatured: boolean;
  donationAmount?: number;
}

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <Link to={`/product/${product.id}`} className="group block h-full">
      <div className="relative h-full flex flex-col bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-purple-500/20">
        {/* Featured Badge */}
        {product.isFeatured && (
          <div className="absolute top-3 left-3 z-10 bg-mystical-gradient px-3 py-1 rounded-full text-xs font-medium text-white flex items-center space-x-1">
            <Gem className="w-3 h-3" />
            <span>Featured</span>
          </div>
        )}

        {/* Donation Badge */}
        {product.donationAmount && product.donationAmount > 0 && (
          <div className="absolute top-3 right-3 z-10 bg-yellow-500/20 border border-yellow-500/30 px-2 py-1 rounded-full text-xs font-medium text-yellow-400 flex items-center space-x-1">
            <Heart className="w-3 h-3" />
            <span>{product.donationAmount} TON</span>
          </div>
        )}

        {/* Product Image — fixed aspect ratio */}
        <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-blue-500/20 relative overflow-hidden flex-shrink-0">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Product Info — flex-grow to equalize heights */}
        <div className="p-4 flex flex-col flex-grow">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-white text-sm group-hover:text-ton-400 transition-colors line-clamp-1 flex-1">
              {product.name}
            </h3>
            <div className="flex items-center space-x-1 text-ton-400 font-display font-bold text-sm flex-shrink-0">
              <Zap className="w-3.5 h-3.5" />
              <span>{product.price} TON</span>
            </div>
          </div>

          <p className="text-gray-400 text-xs mb-2 line-clamp-2 flex-grow">
            {product.description}
          </p>

          {/* Developer */}
          <p className="text-purple-400 text-xs mb-2 font-medium truncate">
            by {product.developer}
          </p>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs mt-auto">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 text-yellow-400">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{product.rating}</span>
              </div>
              <div className="flex items-center space-x-1 text-gray-400">
                <Download className="w-3.5 h-3.5" />
                <span>{product.downloads.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-gray-500 text-[0.65rem]">
              {product.category}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
