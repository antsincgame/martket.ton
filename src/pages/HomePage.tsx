import { useEffect, useState } from 'react';
import { Gem } from 'lucide-react';
import CollectionRow from '../components/CollectionRow';
import StoreBrowser from '../components/StoreBrowser';
import LoadingScreen from '../components/LoadingScreen';
import {
  getMarketplaceInventoryOnce,
  type MarketplaceInventoryLoad,
} from '../domain/marketplace/marketplaceRemote';
import { logger } from '../lib/logger';

const HomePage = () => {
  const [inventory, setInventory] = useState<MarketplaceInventoryLoad | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMarketplaceInventoryOnce()
      .then((data) => {
        if (!cancelled) setInventory(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Не удалось загрузить витрину';
        logger.warn('[HomePage] inventory load failed', err);
        setLoadError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError && !inventory) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-white mb-3">Витрина временно недоступна</h1>
        <p className="text-gray-400 mb-6">{loadError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-ton-gradient text-white font-semibold px-6 py-3 rounded-full"
        >
          Перезагрузить
        </button>
      </div>
    );
  }

  if (!inventory) {
    return <LoadingScreen message="Загрузка витрины..." />;
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4">
        <CollectionRow
          title="Featured Treasures"
          icon={Gem}
          products={inventory.spotlight}
        />

        <StoreBrowser
          products={inventory.products}
          categories={inventory.categorySummaries}
        />
      </div>
    </div>
  );
};

export default HomePage;
