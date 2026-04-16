import { useEffect, useMemo, useState } from 'react';
import { Gem, TrendingUp, Sparkles, Star } from 'lucide-react';
import CollectionRow from '../components/CollectionRow';
import StoreBrowser from '../components/StoreBrowser';
import LoadingScreen from '../components/LoadingScreen';
import HomeHero from '../components/home/HomeHero';
import HomeStatsBar from '../components/home/HomeStatsBar';
import HomeTrustStrip from '../components/home/HomeTrustStrip';
import HomeValueProp from '../components/home/HomeValueProp';
import HomeCategoryShortcuts from '../components/home/HomeCategoryShortcuts';
import SacredDivider from '../components/developer/SacredDivider';
import { RAIL_SIZE } from '../components/home/homeConstants';
import {
  getMarketplaceInventoryOnce,
  type MarketplaceInventoryLoad,
} from '../domain/marketplace/marketplaceRemote';
import type { CatalogListingProduct } from '../domain/marketplace/types';

function topByDownloads(list: CatalogListingProduct[]): CatalogListingProduct[] {
  return [...list].sort((a, b) => b.downloads - a.downloads).slice(0, RAIL_SIZE);
}

function topByRating(list: CatalogListingProduct[]): CatalogListingProduct[] {
  return [...list]
    .sort((a, b) => b.rating - a.rating || b.downloads - a.downloads)
    .slice(0, RAIL_SIZE);
}

function freshestReleases(list: CatalogListingProduct[]): CatalogListingProduct[] {
  return [...list]
    .filter((p) => p.releaseDate)
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
    .slice(0, RAIL_SIZE);
}

const HomePage = () => {
  const [inventory, setInventory] = useState<MarketplaceInventoryLoad | null>(null);

  useEffect(() => {
    getMarketplaceInventoryOnce().then(setInventory);
  }, []);

  const rails = useMemo(() => {
    if (!inventory) return null;
    return {
      trending: topByDownloads(inventory.products),
      fresh: freshestReleases(inventory.products),
      topRated: topByRating(inventory.products),
    };
  }, [inventory]);

  if (!inventory || !rails) {
    return <LoadingScreen message="Загрузка витрины..." />;
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 space-y-8 sm:space-y-10 pb-16">
        {/* ═══ Hero ═══ */}
        {inventory.spotlight.length > 0 && (
          <div className="pt-4">
            <HomeHero spotlights={inventory.spotlight} />
          </div>
        )}

        {/* ═══ Value proposition (одна строка, задаёт тон) ═══ */}
        <HomeValueProp />

        {/* ═══ Trust strip (proof bar — Steam-like, без dark patterns) ═══ */}
        <HomeTrustStrip />

        {/* ═══ Stats (живая динамика) ═══ */}
        <HomeStatsBar products={inventory.products} />

        {/* ═══ Быстрая навигация по категориям ═══ */}
        <HomeCategoryShortcuts categories={inventory.categorySummaries} />

        {/* ═══ Curated rails ═══ */}
        {inventory.spotlight.length > 0 && (
          <CollectionRow
            title="Featured Treasures"
            icon={Gem}
            products={inventory.spotlight}
          />
        )}

        {rails.trending.length > 0 && (
          <CollectionRow
            title="Trending Now"
            icon={TrendingUp}
            products={rails.trending}
          />
        )}

        {rails.fresh.length > 0 && (
          <CollectionRow
            title="Fresh from the Forge"
            icon={Sparkles}
            products={rails.fresh}
          />
        )}

        {rails.topRated.length > 0 && (
          <CollectionRow
            title="Top Rated by Demiurges"
            icon={Star}
            products={rails.topRated}
          />
        )}

        {/* ═══ Full browser ═══ */}
        <div className="pt-4">
          <SacredDivider label="Explore the Full Vault" color="#00F5FF" icon="◈" />
          <StoreBrowser
            products={inventory.products}
            categories={inventory.categorySummaries}
          />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
