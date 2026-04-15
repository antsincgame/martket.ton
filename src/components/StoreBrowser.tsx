import React, { useMemo, useState, useCallback } from 'react';
import { TrendingUp, Star, Sparkles, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import SteamProductRow from './SteamProductRow';
import CategorySidebar from './CategorySidebar';
import ProductPreview from './ProductPreview';
import { filterProductsForCategorySlug } from '../domain/marketplace/catalog';
import type { CatalogListingProduct, HomeCategorySummary, HomeCategorySlug } from '../domain/marketplace/types';

type SortTab = 'trending' | 'top-rated' | 'newest' | 'most-blessed';

interface TabDef {
  id: SortTab;
  label: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'top-rated', label: 'Top Rated', icon: Star },
  { id: 'newest', label: 'Newest', icon: Sparkles },
  { id: 'most-blessed', label: 'Most Blessed', icon: Heart },
];

function sortProducts(products: CatalogListingProduct[], tab: SortTab): CatalogListingProduct[] {
  const copy = [...products];
  switch (tab) {
    case 'trending':
      return copy.sort((a, b) => b.downloads - a.downloads);
    case 'top-rated':
      return copy.sort((a, b) => b.rating - a.rating || b.downloads - a.downloads);
    case 'newest':
      return copy.sort((a, b) => Number(b.id) - Number(a.id));
    case 'most-blessed':
      return copy.sort((a, b) => (b.donationAmount ?? 0) - (a.donationAmount ?? 0));
  }
}

interface StoreBrowserProps {
  products: CatalogListingProduct[];
  categories: HomeCategorySummary[];
}

const StoreBrowser: React.FC<StoreBrowserProps> = ({ products, categories }) => {
  const [activeTab, setActiveTab] = useState<SortTab>('trending');
  const [activeCategory, setActiveCategory] = useState<HomeCategorySlug | 'all'>('all');
  const [hoveredProduct, setHoveredProduct] = useState<CatalogListingProduct | null>(null);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return products;
    return filterProductsForCategorySlug(activeCategory, products);
  }, [products, activeCategory]);

  const sorted = useMemo(() => sortProducts(filtered, activeTab), [filtered, activeTab]);

  const previewProduct = hoveredProduct ?? sorted[0] ?? null;

  const handleHover = useCallback((p: CatalogListingProduct) => setHoveredProduct(p), []);

  return (
    <section className="py-8">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column: tabs + list */}
        <div className="flex-1 min-w-0">
          {/* Tab bar */}
          <div className="flex gap-1 mb-4 bg-white/[0.03] border border-white/10 rounded-xl p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-500/15 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.2)]'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Product list */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${activeCategory}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="space-y-0.5"
              >
                {sorted.length > 0 ? (
                  sorted.map((product) => (
                    <SteamProductRow
                      key={product.id}
                      product={product}
                      isActive={previewProduct?.id === product.id}
                      onHover={handleHover}
                    />
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-12 text-sm">
                    No products in this category yet
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right column: categories + preview */}
        <div className="w-full lg:w-[280px] flex-shrink-0 space-y-4">
          <CategorySidebar
            categories={categories}
            active={activeCategory}
            onChange={setActiveCategory}
          />
          <div className="hidden lg:block">
            <ProductPreview product={previewProduct} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default StoreBrowser;
