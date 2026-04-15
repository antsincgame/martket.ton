import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { TrendingUp, Star, Sparkles, Heart, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import SteamProductRow, { ROW_GRID } from './SteamProductRow';
import CategorySidebar from './CategorySidebar';
import CategoryFilterChips from './CategoryFilterChips';
import ProductPreview from './ProductPreview';
import { filterProductsForCategorySlug } from '../domain/marketplace/catalog';
import type { CatalogListingProduct, HomeCategorySummary, HomeCategorySlug } from '../domain/marketplace/types';

const PREVIEW_W = 320;
const PREVIEW_GAP = 16;

const PAGE_SIZE = 10;

type SortTab = 'trending' | 'top-rated' | 'newest' | 'most-blessed';
type ColumnField = 'name' | 'developer' | 'downloads' | 'rating' | 'price';
type SortDir = 'asc' | 'desc';

type SortMode =
  | { type: 'tab'; tab: SortTab }
  | { type: 'column'; field: ColumnField; dir: SortDir };

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

function sortByTab(products: CatalogListingProduct[], tab: SortTab): CatalogListingProduct[] {
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

function sortByColumn(products: CatalogListingProduct[], field: ColumnField, dir: SortDir): CatalogListingProduct[] {
  const copy = [...products];
  const m = dir === 'asc' ? 1 : -1;
  switch (field) {
    case 'name':
      return copy.sort((a, b) => m * a.name.localeCompare(b.name));
    case 'developer':
      return copy.sort((a, b) => m * a.developer.localeCompare(b.developer));
    case 'downloads':
      return copy.sort((a, b) => m * (a.downloads - b.downloads));
    case 'rating':
      return copy.sort((a, b) => m * (a.rating - b.rating));
    case 'price':
      return copy.sort((a, b) => m * (a.price - b.price));
  }
}

function matchesSearch(product: CatalogListingProduct, q: string): boolean {
  const lower = q.toLowerCase();
  if (product.name.toLowerCase().includes(lower)) return true;
  if (product.developer.toLowerCase().includes(lower)) return true;
  if (product.tags?.some((t) => t.toLowerCase().includes(lower))) return true;
  return false;
}

interface StoreBrowserProps {
  products: CatalogListingProduct[];
  categories: HomeCategorySummary[];
}

interface ColumnHeader {
  label: string;
  field: ColumnField | null;
  align: 'left' | 'center' | 'right';
}

const COLUMNS: ColumnHeader[] = [
  { label: '', field: null, align: 'left' },
  { label: 'Name', field: 'name', align: 'left' },
  { label: 'Developer', field: 'developer', align: 'left' },
  { label: '', field: null, align: 'center' },
  { label: '', field: null, align: 'left' },
  { label: 'Downloads', field: 'downloads', align: 'right' },
  { label: 'Rating', field: 'rating', align: 'center' },
  { label: 'Price', field: 'price', align: 'right' },
];

const StoreBrowser: React.FC<StoreBrowserProps> = ({ products, categories }) => {
  const [sortMode, setSortMode] = useState<SortMode>({ type: 'tab', tab: 'trending' });
  const [activeCategory, setActiveCategory] = useState<HomeCategorySlug | 'all'>('all');
  const [hoveredProduct, setHoveredProduct] = useState<CatalogListingProduct | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewH, setPreviewH] = useState(400);

  useEffect(() => {
    if (previewRef.current) {
      setPreviewH(previewRef.current.offsetHeight);
    }
  }, [hoveredProduct]);

  const filtered = useMemo(() => {
    let list = activeCategory === 'all' ? products : filterProductsForCategorySlug(activeCategory, products);
    if (searchQuery.trim()) {
      list = list.filter((p) => matchesSearch(p, searchQuery.trim()));
    }
    return list;
  }, [products, activeCategory, searchQuery]);

  const sorted = useMemo(() => {
    if (sortMode.type === 'tab') return sortByTab(filtered, sortMode.tab);
    return sortByColumn(filtered, sortMode.field, sortMode.dir);
  }, [filtered, sortMode]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageProducts = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleHover = useCallback((p: CatalogListingProduct) => setHoveredProduct(p), []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredProduct(null);
    setMousePos(null);
  }, []);

  const tooltipStyle = useMemo<React.CSSProperties>(() => {
    if (!mousePos) return { display: 'none' };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = mousePos.x + PREVIEW_GAP;
    let top = mousePos.y - previewH / 2;
    if (left + PREVIEW_W > vw - PREVIEW_GAP) {
      left = mousePos.x - PREVIEW_W - PREVIEW_GAP;
    }
    top = Math.max(PREVIEW_GAP, Math.min(top, vh - previewH - PREVIEW_GAP));
    return { position: 'fixed', left, top, width: PREVIEW_W, zIndex: 100, pointerEvents: 'none' as const };
  }, [mousePos, previewH]);

  const handleTabChange = useCallback((tab: SortTab) => {
    setSortMode({ type: 'tab', tab });
    setPage(0);
    setHoveredProduct(null);
  }, []);

  const handleColumnSort = useCallback((field: ColumnField) => {
    setSortMode((prev) => {
      if (prev.type === 'column' && prev.field === field) {
        return { type: 'column', field, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDir: SortDir = field === 'name' || field === 'developer' ? 'asc' : 'desc';
      return { type: 'column', field, dir: defaultDir };
    });
    setPage(0);
    setHoveredProduct(null);
  }, []);

  const handleCategoryChange = useCallback((slug: HomeCategorySlug | 'all') => {
    setActiveCategory(slug);
    setPage(0);
    setHoveredProduct(null);
  }, []);

  const activeTab = sortMode.type === 'tab' ? sortMode.tab : null;

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
          <div className="flex items-center gap-1 mb-3 bg-[#1A1A1A]/80 border border-[#FFD700]/10 rounded-xl p-1">
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

          {/* Product list block (search fused into top) */}
          <div
            className="bg-[#1A1A1A]/50 border border-white/10 rounded-xl overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Search — fused into the table block */}
            <div className="relative px-3 pt-2 pb-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                placeholder="Search by name, developer, or tag..."
                className="w-full pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FFD700]/25 focus:bg-white/[0.07] transition-all duration-200"
              />
            </div>

            {/* Column headers */}
            <div className={`hidden sm:grid ${ROW_GRID} items-center gap-x-2 px-3 py-1.5 border-b border-[#FFD700]/10`}>
              {COLUMNS.map((col, i) => {
                if (!col.label) return <span key={i} />;
                const isSortable = col.field !== null;
                const isActiveCol = sortMode.type === 'column' && sortMode.field === col.field;
                const alignCls = col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start';

                if (!isSortable) return <span key={i} />;

                return (
                  <button
                    key={i}
                    onClick={() => handleColumnSort(col.field!)}
                    className={`flex items-center gap-0.5 ${alignCls} text-[9px] uppercase tracking-widest font-semibold transition-colors duration-150 ${
                      isActiveCol
                        ? 'text-[#FFD700]/80'
                        : 'text-[#FFD700]/40 hover:text-[#FFD700]/60'
                    }`}
                  >
                    <span>{col.label}</span>
                    {isActiveCol && (
                      sortMode.type === 'column' && sortMode.dir === 'asc'
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${JSON.stringify(sortMode)}-${activeCategory}-${safePage}-${searchQuery}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="space-y-0.5 px-2 pb-2"
              >
                {pageProducts.length > 0 ? (
                  pageProducts.map((product) => (
                    <SteamProductRow
                      key={product.id}
                      product={product}
                      isActive={hoveredProduct?.id === product.id}
                      onHover={handleHover}
                    />
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-12 text-sm">
                    {searchQuery.trim() ? 'No products match your search' : 'No products in this category yet'}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Floating preview tooltip */}
          {hoveredProduct && mousePos && (
            <div ref={previewRef} style={tooltipStyle}>
              <ProductPreview product={hoveredProduct} />
            </div>
          )}

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

        {/* Right column: categories (desktop only) */}
        <div className="hidden lg:block w-[280px] flex-shrink-0">
          <CategorySidebar
            categories={categories}
            active={activeCategory}
            onChange={handleCategoryChange}
          />
        </div>
      </div>
    </section>
  );
};

export default StoreBrowser;
