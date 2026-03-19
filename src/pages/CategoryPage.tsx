import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Filter, SortDesc, Grid, List, Star, TrendingUp } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import LoadingScreen from '../components/LoadingScreen';
import { filterProductsForCategorySlug, sortListingProducts } from '../domain/marketplace/catalog';
import {
  getMarketplaceInventoryOnce,
  resolveCategoryMeta,
  type MarketplaceInventoryLoad,
} from '../domain/marketplace/marketplaceRemote';

const CategoryPage = () => {
  const { category } = useParams();
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('popularity');
  const [showFilters, setShowFilters] = useState(false);
  const [inventory, setInventory] = useState<MarketplaceInventoryLoad | null>(null);

  useEffect(() => {
    getMarketplaceInventoryOnce().then(setInventory);
  }, []);

  const currentCategory = useMemo(
    () => (inventory ? resolveCategoryMeta(category, inventory.products) : null),
    [category, inventory]
  );

  const products = useMemo(() => {
    if (!inventory) return [];
    const raw = filterProductsForCategorySlug(category ?? '', inventory.products);
    return sortListingProducts(raw, sortBy);
  }, [category, sortBy, inventory]);

  if (!inventory || !currentCategory) {
    return <LoadingScreen message="Загрузка категории..." />;
  }

  const filters = [
    { label: 'Price Range', options: ['Free', '0-5 TON', '5-15 TON', '15+ TON'] },
    { label: 'Rating', options: ['4.5+ Stars', '4.0+ Stars', '3.5+ Stars', 'All Ratings'] },
    { label: 'Platform', options: ['macOS', 'Windows', 'Linux', 'Cross-platform'] },
    { label: 'Features', options: ['AI Powered', 'Open Source', 'Offline Mode', 'Cloud Sync'] }
  ];

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Category Header */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">{currentCategory.emoji}</div>
          <h1 className="text-4xl font-display font-bold text-white mb-4">
            {currentCategory.title}
          </h1>
          <p className="text-gray-400 text-lg mb-6 max-w-2xl mx-auto">
            {currentCategory.description}
          </p>
          <div className="text-ton-400 font-semibold">
            {currentCategory.count.toLocaleString()} sacred treasures available
          </div>
        </div>

        {/* Filters and Sort Bar */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
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
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white/10 border border-white/20 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-ton-500"
                >
                  <option value="popularity">Most Popular</option>
                  <option value="rating">Highest Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="newest">Newest First</option>
                  <option value="donations">Most Blessed</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-ton-500 text-white' : 'bg-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-ton-500 text-white' : 'bg-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {filters.map((filter) => (
                  <div key={filter.label}>
                    <h3 className="font-semibold text-white mb-3">{filter.label}</h3>
                    <div className="space-y-2">
                      {filter.options.map((option) => (
                        <label key={option} className="flex items-center space-x-2 text-gray-400 hover:text-white cursor-pointer">
                          <input type="checkbox" className="rounded border-gray-600 bg-white/10" />
                          <span className="text-sm">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
            <Star className="w-6 h-6 mr-3 text-yellow-400" />
            Featured in {currentCategory.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.filter((item) => item.isFeatured).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
            <TrendingUp className="w-6 h-6 mr-3 text-purple-400" />
            Most Blessed Products ❤️
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...products]
              .sort((a, b) => (b.donationAmount ?? 0) - (a.donationAmount ?? 0))
              .slice(0, 4)
              .map((product) => (
                <ProductCard key={`blessed-${product.id}`} product={product} />
              ))}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-display font-bold text-white mb-6">
            All {currentCategory.title}
          </h2>
          
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <div key={product.id} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                  <div className="flex items-center space-x-6">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-20 h-20 rounded-xl object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-2">{product.name}</h3>
                      <p className="text-gray-400 mb-2">{product.description}</p>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-1 text-yellow-400">
                          <Star className="w-4 h-4 fill-current" />
                          <span>{product.rating}</span>
                        </div>
                        <span className="text-gray-400">{product.downloads.toLocaleString()} downloads</span>
                        <span className="text-purple-400">by {product.developer}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-ton-400 mb-1">{product.price} TON</div>
                      {product.donationAmount && (
                        <div className="text-sm text-pink-400">❤️ {product.donationAmount} TON blessed</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center mt-12">
          <button type="button" className="bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-full transition-all duration-300 border border-white/20">
            Load More Sacred Treasures ✨
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryPage;
