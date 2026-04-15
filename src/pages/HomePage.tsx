import { useEffect, useMemo, useState } from 'react';
import { Gem, TrendingUp, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ProductCard from '../components/ProductCard';
import CollectionRow from '../components/CollectionRow';
import CategoryFilterChips from '../components/CategoryFilterChips';
import LoadingScreen from '../components/LoadingScreen';
import {
  getMarketplaceInventoryOnce,
  type MarketplaceInventoryLoad,
} from '../domain/marketplace/marketplaceRemote';
import { filterProductsForCategorySlug } from '../domain/marketplace/catalog';
import type { HomeCategorySlug } from '../domain/marketplace/types';

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25 },
};

const HomePage = () => {
  const [inventory, setInventory] = useState<MarketplaceInventoryLoad | null>(null);
  const [activeCategory, setActiveCategory] = useState<HomeCategorySlug | 'all'>('all');

  useEffect(() => {
    getMarketplaceInventoryOnce().then(setInventory);
  }, []);

  const trending = useMemo(() => {
    if (!inventory) return [];
    return [...inventory.products].sort((a, b) => b.downloads - a.downloads).slice(0, 10);
  }, [inventory]);

  const newest = useMemo(() => {
    if (!inventory) return [];
    return [...inventory.products].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 10);
  }, [inventory]);

  const filteredProducts = useMemo(() => {
    if (!inventory) return [];
    if (activeCategory === 'all') return inventory.products;
    return filterProductsForCategorySlug(activeCategory, inventory.products);
  }, [inventory, activeCategory]);

  if (!inventory) {
    return <LoadingScreen message="Загрузка витрины..." />;
  }

  const isAll = activeCategory === 'all';

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <CategoryFilterChips
          categories={inventory.categorySummaries}
          active={activeCategory}
          onChange={setActiveCategory}
        />
      </div>

      <AnimatePresence mode="wait">
        {isAll ? (
          <motion.div key="discovery" {...fadeSlide}>
            <div className="max-w-7xl mx-auto px-4">
              <CollectionRow
                title="Featured Treasures"
                icon={Gem}
                products={inventory.spotlight}
              />
              <CollectionRow
                title="Trending in the Forge"
                icon={TrendingUp}
                products={trending}
              />
              <CollectionRow
                title="Newly Forged"
                icon={Sparkles}
                products={newest}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div key={activeCategory} {...fadeSlide}>
            <section className="max-w-7xl mx-auto px-4 py-6">
              <h2 className="text-xl font-display font-bold text-white mb-6">
                Browse {inventory.categorySummaries.find((c) => c.slug === activeCategory)?.name ?? activeCategory}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
                {filteredProducts.length === 0 && (
                  <p className="col-span-full text-center text-gray-500 py-12">
                    No products in this category yet
                  </p>
                )}
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomePage;
