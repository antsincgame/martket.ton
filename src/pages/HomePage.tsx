import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, TrendingUp, Gem, Star, Zap, Heart, Rocket, Bot, Gamepad2 } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import LoadingScreen from '../components/LoadingScreen';
import {
  getMarketplaceInventoryOnce,
  type MarketplaceInventoryLoad,
} from '../domain/marketplace/marketplaceRemote';
import type { HomeCategorySlug } from '../domain/marketplace/types';
import type { LucideIcon } from 'lucide-react';

const CATEGORY_ICONS: Record<HomeCategorySlug, LucideIcon> = {
  apps: Rocket,
  games: Gamepad2,
  ai: Bot,
  'developer-tools': Zap,
};

const HomePage = () => {
  const [inventory, setInventory] = useState<MarketplaceInventoryLoad | null>(null);

  useEffect(() => {
    getMarketplaceInventoryOnce().then(setInventory);
  }, []);

  if (!inventory) {
    return <LoadingScreen message="Загрузка витрины..." />;
  }

  const categorySummaries = inventory.categorySummaries;
  const spotlightProducts = inventory.spotlight;
  const heroProducts = spotlightProducts.slice(0, 8);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-teal-500/10"></div>
        <div className="relative max-w-7xl mx-auto text-center">
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 bg-ton-gradient rounded-full flex items-center justify-center animate-float">
                <Gem className="w-10 h-10 text-white animate-sparkle" />
              </div>
              <div className="absolute -top-2 -right-2 text-yellow-400 animate-pulse">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="absolute -bottom-2 -left-2 text-purple-400 animate-pulse">
                <Star className="w-6 h-6" />
              </div>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              TonForge
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto">
            NFT-Licensed Software Marketplace on TON
          </p>
          
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Покупайте цифровые продукты с NFT-лицензиями, 72h escrow и device activation на базе TON blockchain.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link
              to="/category/apps"
              className="bg-ton-gradient hover:scale-105 text-white font-semibold px-8 py-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-ton-500/50 flex items-center space-x-2"
            >
              <Sparkles className="w-5 h-5" />
              <span>Исследовать приложения</span>
            </Link>
            <Link
              to="/developer/register"
              className="bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-full transition-all duration-300 border border-white/20 flex items-center space-x-2"
            >
              <Heart className="w-5 h-5 text-red-400" />
              <span>Стать издателем</span>
            </Link>
          </div>

          {/* Featured Treasures */}
          {heroProducts.length > 0 && (
            <div className="mt-4">
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center justify-center gap-3">
                <Gem className="w-6 h-6 text-mystical-400 animate-sparkle" />
                Featured Treasures
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
                {heroProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold text-white mb-4 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 mr-3 text-ton-400" />
              Sacred Categories
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Explore our mystical collection of digital treasures, each category blessed with unique energy ✨
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categorySummaries.map((category) => {
              const Icon = CATEGORY_ICONS[category.slug];
              return (
                <Link
                  key={category.slug}
                  to={`/category/${category.slug}`}
                  className="group"
                >
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                    <div className={`w-16 h-16 bg-gradient-to-r ${category.gradient} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2 flex items-center">
                      {category.name} <span className="ml-2">{category.emoji}</span>
                    </h3>
                    <p className="text-gray-400 text-sm mb-3">
                      {category.count.toLocaleString()} products
                    </p>
                    <div className="text-ton-400 text-sm font-medium group-hover:text-ton-300">
                      Explore Collection →
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
