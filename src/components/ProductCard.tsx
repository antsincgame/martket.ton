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
    <Link to={`/product/${product.id}`} className="group block">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20">
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

        {/* Product Image */}
        <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-blue-500/20 relative overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Product Info */}
        <div className="p-5">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-white text-lg group-hover:text-ton-400 transition-colors line-clamp-1">
              {product.name}
            </h3>
            <div className="flex items-center space-x-1 text-ton-400 font-display font-bold">
              <Zap className="w-4 h-4" />
              <span>{product.price} TON</span>
            </div>
          </div>

          <p className="text-gray-400 text-sm mb-3 line-clamp-2">
            {product.description}
          </p>

          {/* Developer */}
          <p className="text-purple-400 text-sm mb-3 font-medium">
            by {product.developer} 🪄
          </p>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1 text-yellow-400">
                <Star className="w-4 h-4 fill-current" />
                <span>{product.rating}</span>
              </div>
              <div className="flex items-center space-x-1 text-gray-400">
                <Download className="w-4 h-4" />
                <span>{product.downloads.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-gray-500 text-xs">
              {product.category} 🚀
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;