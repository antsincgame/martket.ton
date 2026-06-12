import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import LoadingScreen from '../components/LoadingScreen';
import { useWishlist } from '../contexts/WishlistContext';
import {
  getMarketplaceInventoryOnce,
  type MarketplaceInventoryLoad,
} from '../domain/marketplace/marketplaceRemote';
import { logger } from '../lib/logger';

const WishlistPage = () => {
  const { savedIds, ready, isAuthenticated } = useWishlist();
  const [inventory, setInventory] = useState<MarketplaceInventoryLoad | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMarketplaceInventoryOnce()
      .then((data) => { if (!cancelled) setInventory(data); })
      .catch((err) => logger.warn('[WishlistPage] inventory load failed', err));
    return () => { cancelled = true; };
  }, []);

  const saved = useMemo(
    () => (inventory ? inventory.products.filter((p) => savedIds.has(p.id)) : []),
    [inventory, savedIds],
  );
  // Saved ids whose product isn't in the current inventory (unpublished/removed/
  // not yet loaded). Surface them instead of silently dropping — otherwise the
  // heart shows "saved" on a card while this page claims the wishlist is empty.
  const unavailableCount = useMemo(
    () => (inventory ? [...savedIds].filter((id) => !inventory.products.some((p) => p.id === id)).length : 0),
    [inventory, savedIds],
  );

  if (!ready || !inventory) return <LoadingScreen message="Loading your wishlist..." />;

  return (
    <div className="min-h-screen max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-display font-bold uppercase tracking-widest text-white flex items-center gap-3 mb-8">
        <Heart className="w-7 h-7 text-[#FF3B6B]" />
        Wishlist
      </h1>

      {!isAuthenticated ? (
        <div className="text-center py-20">
          <p className="text-gray-400 mb-6">Sign in to save products to your wishlist.</p>
          <Link to="/sign-in" className="bg-ton-gradient text-white font-semibold px-6 py-3 rounded-full">
            Sign in
          </Link>
        </div>
      ) : savedIds.size === 0 ? (
        <div className="text-center py-20">
          <Heart className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">Your wishlist is empty.</p>
          <Link to="/" className="text-[#00F5FF] hover:underline text-sm">Browse the catalog</Link>
        </div>
      ) : (
        <>
          {unavailableCount > 0 && (
            <p className="text-xs text-amber-300/80 mb-4">
              {unavailableCount} saved item{unavailableCount === 1 ? ' is' : 's are'} currently unavailable
              (unpublished or removed) and not shown.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {saved.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default WishlistPage;
