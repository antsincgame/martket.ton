import React, { useMemo, useState, useCallback } from 'react';
import { TrendingUp, Star, Sparkles, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import SteamProductRow from './SteamProductRow';
import CategorySidebar from './CategorySidebar';
import CategoryFilterChips from './CategoryFilterChips';
import ProductPreview from './ProductPreview';
import { filterProductsForCategorySlug } from '../domain/marketplace/catalog';
import type { CatalogListingProduct, HomeCategorySummary, HomeCategorySlug } from '../domain/marketplace/types';

const PAGE_SIZE = 10;

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
      return copy.sort((a, b) => {
        const da = a.releaseDate ?? '';
        const db = b.releaseDate ?? '';
        return db.localeCompare(da) || Number(b.id) - Number(a.id);
      });
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
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return products;
    return filterProductsForCategorySlug(activeCategory, products);
  }, [products, activeCategory]);

  const sorted = useMemo(() => sortProducts(filtered, activeTab), [filtered, activeTab]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageProducts = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const previewProduct = hoveredProduct ?? pageProducts[0] ?? null;

  const handleHover = useCallback((p: CatalogListingProduct) => setHoveredProduct(p), []);

  const handleTabChange = useCallback((tab: SortTab) => {
    setActiveTab(tab);
    setPage(0);
    setHoveredProduct(null);
  }, []);

  const handleCategoryChange = useCallback((slug: HomeCategorySlug | 'all') => {
    setActiveCategory(slug);
    setPage(0);
    setHoveredProduct(null);
  }, []);

  return (
    <section className="py-8">
      <div className="lg:hidden mb-4">
        <CategoryFilterChips
          categories={categories}
          active={activeCategory}
          onChange={handleCategoryChange}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {/* Tab bar */}
          <div className="flex gap-1 mb-4 bg-[#1A1A1A]/80 border border-[#FFD700]/10 rounded-xl p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[#FFD700]/10 text-[#FFD700] shadow-[0_0_12px_rgba(255,215,0,0.12)] border border-[#FFD700]/20'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Product list */}
          <div className="bg-[#1A1A1A]/50 border border-white/10 rounded-xl p-2">
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[120px_1fr_80px_80px_60px_56px_80px] items-center gap-x-2 px-3 py-1.5 mb-1 border-b border-[#FFD700]/10">
              <span className="text-[9px] uppercase tracking-widest text-[#FFD700]/40 font-semibold">Image</span>
              <span className="text-[9px] uppercase tracking-widest text-[#FFD700]/40 font-semibold pl-1">Name</span>
              <span className="text-[9px] uppercase tracking-widest text-[#FFD700]/40 font-semibold text-center">Platform</span>
              <span className="text-[9px] uppercase tracking-widest text-[#FFD700]/40 font-semibold">Tags</span>
              <span className="text-[9px] uppercase tracking-widest text-[#FFD700]/40 font-semibold text-right">DL</span>
              <span className="text-[9px] uppercase tracking-widest text-[#FFD700]/40 font-semibold text-center">Rate</span>
              <span className="text-[9px] uppercase tracking-widest text-[#FFD700]/40 font-semibold text-right">Price</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${activeCategory}-${safePage}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="space-y-0.5"
              >
                {pageProducts.length > 0 ? (
                  pageProducts.map((product) => (
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 px-1">
              <button
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-[#1A1A1A] border border-[#FFD700]/10 text-gray-300 hover:bg-[#FFD700]/5 hover:border-[#FFD700]/20 hover:text-[#FFD700]"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200 ${
                      i === safePage
                        ? 'bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/25 shadow-[0_0_8px_rgba(255,215,0,0.1)]'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-[#1A1A1A] border border-[#FFD700]/10 text-gray-300 hover:bg-[#FFD700]/5 hover:border-[#FFD700]/20 hover:text-[#FFD700]"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right column: categories + preview (desktop only) */}
        <div className="hidden lg:block w-[280px] flex-shrink-0 space-y-4">
          <CategorySidebar
            categories={categories}
            active={activeCategory}
            onChange={handleCategoryChange}
          />
          <ProductPreview product={previewProduct} />
        </div>
      </div>
    </section>
  );
};

export default StoreBrowser;
