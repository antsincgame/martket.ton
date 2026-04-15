import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Gem, Zap, Rocket, Bot, Gamepad2 } from 'lucide-react';
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
      {/* Products */}
      <section className="pt-6 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
              <Gem className="w-6 h-6 text-[#FFD700]" />
              Featured Treasures
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {heroProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-ton-400" />
              Categories
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {categorySummaries.map((category) => {
              const Icon = CATEGORY_ICONS[category.slug];
              return (
                <Link
                  key={category.slug}
                  to={`/category/${category.slug}`}
                  className="group"
                >
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl">
                    <div className={`w-12 h-12 bg-gradient-to-r ${category.gradient} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1 flex items-center">
                      {category.name} <span className="ml-2">{category.emoji}</span>
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {category.count.toLocaleString()} products
                    </p>
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
