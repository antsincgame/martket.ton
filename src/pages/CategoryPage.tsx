import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Filter, SortDesc, Grid, List, Star } from 'lucide-react';
import { logger } from '../lib/logger';
import { CATEGORY_ICONS } from '../domain/marketplace/categoryIcons';
import type { HomeCategorySlug } from '../domain/marketplace/types';
import ProductCard from '../components/ProductCard';
import Breadcrumbs from '../components/Breadcrumbs';
import LoadingScreen from '../components/LoadingScreen';
import {
  getMarketplaceInventoryOnce,
  type MarketplaceInventoryLoad,
} from '../domain/marketplace/marketplaceRemote';
import type { CatalogListingProduct } from '../domain/marketplace/types';
import { categoryLabelToSlug } from '../domain/marketplace/catalog';

const categoryInfo: Record<string, { title: string; labels: string[]; description: string }> = {
  apps: { title: 'Android', labels: ['Android'], description: 'Native Android apps for productivity, lifestyle, and TON ecosystem' },
  games: { title: 'Games', labels: ['Games'], description: 'Immersive gaming experiences with NFT rewards' },
  ai: { title: 'AI Services', labels: ['AI Services'], description: 'Artificial intelligence tools powered by cutting-edge models' },
  'developer-tools': { title: 'Developer Tools', labels: ['Developer Tools'], description: 'Essential tools for modern software development' },
  design: { title: 'Design & Creative', labels: ['Design'], description: 'Creative tools for designers, artists, and content creators' },
  defi: { title: 'Finance & DeFi', labels: ['DeFi'], description: 'Wallets, portfolio trackers, and decentralized finance tools' },
  education: { title: 'Education', labels: ['Education'], description: 'Courses, tutors, and learning platforms for Web3 and beyond' },
  security: { title: 'Security & Privacy', labels: ['Security'], description: 'VPN, firewalls, and security tools for the decentralized world' },
  media: { title: 'Media & Entertainment', labels: ['Media'], description: 'Streaming, podcasts, and content creation tools' },
  social: { title: 'Social & Communication', labels: ['Social'], description: 'Encrypted messaging, collaboration, and community tools' },
  health: { title: 'Health & Wellness', labels: ['Health'], description: 'Meditation, fitness, sleep tracking, and mental health' },
  utilities: { title: 'Utilities & System', labels: ['Utilities'], description: 'Monitoring, backups, and system administration tools' },
  featured: { title: 'Featured Treasures', labels: [], description: 'Handpicked digital gems blessed by the community' },
};

type SortKey = 'popularity' | 'rating' | 'price-low' | 'price-high' | 'newest';

const ITEMS_PER_PAGE = 24;

function sortProducts(items: CatalogListingProduct[], key: SortKey): CatalogListingProduct[] {
  const sorted = [...items];
  switch (key) {
    case 'rating': return sorted.sort((a, b) => b.rating - a.rating);
    case 'price-low': return sorted.sort((a, b) => a.price - b.price);
    case 'price-high': return sorted.sort((a, b) => b.price - a.price);
    case 'newest': return sorted.sort((a, b) => (b.id > a.id ? 1 : -1));
    default: return sorted.sort((a, b) => b.downloads - a.downloads);
  }
}

const CategoryPage = () => {
  const { id } = useParams();
  const category = id ?? 'apps';
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortKey>('popularity');
  const [showFilters, setShowFilters] = useState(false);
  const [inventory, setInventory] = useState<MarketplaceInventoryLoad | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    let cancelled = false;
    getMarketplaceInventoryOnce()
      .then((data) => {
        if (!cancelled) setInventory(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // Failsafe: render an empty inventory so we don't get stuck in
          // perpetual loading. The user can retry via navigation.
          setInventory({ products: [], spotlight: [], collections: [] } as unknown as MarketplaceInventoryLoad);
          logger.warn('[CategoryPage] inventory load failed:', err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [category, sortBy]);

  const currentCategory = categoryInfo[category] ?? categoryInfo['apps'];

  const filteredProducts = useMemo(() => {
    if (!inventory) return [];
    const all = inventory.products;
    if (category === 'featured') return all.filter((p) => p.isFeatured);
    const labels = new Set(currentCategory.labels);
    if (labels.size === 0) return all;
    return all.filter((p) => {
      const slug = categoryLabelToSlug(p.category);
      return slug === category || labels.has(p.category);
    });
  }, [inventory, category, currentCategory.labels]);

  const sorted = useMemo(() => sortProducts(filteredProducts, sortBy), [filteredProducts, sortBy]);
  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  if (!inventory) {
    return <LoadingScreen message="Loading category..." />;
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[{ label: currentCategory.title }]} />

        <div className="text-center mb-12">
          {(() => {
            const CatIcon = CATEGORY_ICONS[category as HomeCategorySlug];
            return CatIcon ? (
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <CatIcon className="w-8 h-8 text-ton-400" />
              </div>
            ) : null;
          })()}
          <h1 className="text-4xl font-display font-bold text-white mb-4">{currentCategory.title}</h1>
          <p className="text-gray-400 text-lg mb-6 max-w-2xl mx-auto">{currentCategory.description}</p>
          <div className="text-ton-400 font-semibold">
            {filteredProducts.length.toLocaleString()} product{filteredProducts.length !== 1 ? 's' : ''} available
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Filter className="w-5 h-5" />
                <span>Filters</span>
              </button>

              <div className="flex items-center space-x-2">
                <SortDesc className="w-5 h-5 text-gray-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="bg-white/10 border border-white/20 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-ton-500"
                >
                  <option value="popularity">Most Popular</option>
                  <option value="rating">Highest Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-ton-500 text-white' : 'bg-white/10 text-gray-400 hover:text-white'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-ton-500 text-white' : 'bg-white/10 text-gray-400 hover:text-white'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {showFilters && (
            <p className="mt-4 pt-4 border-t border-white/10 text-sm text-gray-500">
              Advanced filters coming soon. Use sorting above to narrow results.
            </p>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">No products in this category yet.</p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {visible.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {visible.map((product) => (
                  <div key={product.id} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                    <div className="flex items-center space-x-6">
                      <img src={product.image} alt={product.name} className="w-20 h-20 rounded-xl object-cover" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-semibold text-white mb-1 truncate">{product.name}</h3>
                        <p className="text-gray-400 mb-2 text-sm line-clamp-1">{product.description}</p>
                        <div className="flex items-center space-x-4 text-sm">
                          <span className="flex items-center space-x-1 text-yellow-400">
                            <Star className="w-4 h-4 fill-current" />
                            <span>{product.rating}</span>
                          </span>
                          <span className="text-gray-400">{product.downloads.toLocaleString()} downloads</span>
                          <span className="text-purple-400">by {product.developer}</span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-ton-400 flex-shrink-0">{product.price} TON</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasMore && (
              <div className="text-center mt-12">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-full transition-all duration-300 border border-white/20"
                >
                  Show more ({sorted.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CategoryPage;
