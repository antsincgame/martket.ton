import { useEffect, useState } from 'react';
import { Gem } from 'lucide-react';
import CollectionRow from '../components/CollectionRow';
import StoreBrowser from '../components/StoreBrowser';
import LoadingScreen from '../components/LoadingScreen';
import {
  getMarketplaceInventoryOnce,
  type MarketplaceInventoryLoad,
} from '../domain/marketplace/marketplaceRemote';

const HomePage = () => {
  const [inventory, setInventory] = useState<MarketplaceInventoryLoad | null>(null);

  useEffect(() => {
    getMarketplaceInventoryOnce().then(setInventory);
  }, []);

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
