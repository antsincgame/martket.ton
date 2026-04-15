import { logger } from '../../lib/logger';
import { isAppwriteConfigured } from '../../lib/appwriteClient';
import {
  fetchListingProducts,
  fetchProductDetailById,
  fetchReviewsForProduct,
} from './appwrite/repository';
import {
  getCategoryMetaForInventory,
  getHomeCategorySummariesForProducts,
  getHomeSpotlightProducts,
  getHomeSpotlightProductsForProducts,
  getProductDetail,
  getProductReviews,
} from './catalog';
import { CATALOG_LISTING_PRODUCTS } from './seed';
import type {
  CatalogListingProduct,
  CategoryMeta,
  HomeCategorySummary,
  ProductDetail,
  ProductReview,
} from './types';

export interface MarketplaceInventoryLoad {
  products: CatalogListingProduct[];
  categorySummaries: HomeCategorySummary[];
  spotlight: CatalogListingProduct[];
  source: 'appwrite' | 'seed';
}

let inventoryOnce: Promise<MarketplaceInventoryLoad> | null = null;

/** Один запрос к витрине на сессию вкладки (повторные вызовы — тот же Promise). */
export function getMarketplaceInventoryOnce(): Promise<MarketplaceInventoryLoad> {
  if (!inventoryOnce) inventoryOnce = loadMarketplaceInventory();
  return inventoryOnce;
}

async function loadFromAppwrite(): Promise<MarketplaceInventoryLoad | null> {
  if (!isAppwriteConfigured) return null;
  try {
    const remoteProducts = await fetchListingProducts();
    const seedById = new Map(CATALOG_LISTING_PRODUCTS.map((p) => [p.id, p]));
    for (const rp of remoteProducts) {
      seedById.set(rp.id, rp);
    }
    const products = [...seedById.values()];
    if (products.length === 0) {
      logger.warn('[marketplace] Каталог пуст — используется сид.');
      return null;
    }
    const categorySummaries = getHomeCategorySummariesForProducts(products);
    const spotlight = getHomeSpotlightProductsForProducts(products);
    return { products, categorySummaries, spotlight, source: 'appwrite' };
  } catch (error) {
    logger.warn('[marketplace] Ошибка загрузки Appwrite, fallback на сид.', error);
    return null;
  }
}

function loadFromSeed(): MarketplaceInventoryLoad {
  const products = CATALOG_LISTING_PRODUCTS;
  return {
    products,
    categorySummaries: getHomeCategorySummariesForProducts(products),
    spotlight: getHomeSpotlightProducts(),
    source: 'seed',
  };
}

/** Полный снимок витрины: Appwrite при наличии конфигурации и непустом каталоге, иначе демо-сид. */
export async function loadMarketplaceInventory(): Promise<MarketplaceInventoryLoad> {
  const remote = await loadFromAppwrite();
  if (remote) return remote;
  return loadFromSeed();
}

/** Карточка товара: Appwrite → сид. */
export async function resolveProductDetail(productId: string | undefined): Promise<ProductDetail | null> {
  if (!productId) return null;
  if (isAppwriteConfigured) {
    try {
      const fromDb = await fetchProductDetailById(productId);
      if (fromDb) return fromDb;
    } catch (error) {
      logger.warn('[marketplace] Не удалось загрузить товар из Appwrite.', error);
    }
  }
  return getProductDetail(productId);
}

/** Отзывы: Appwrite → сид. */
export async function resolveProductReviews(productId: string): Promise<ProductReview[]> {
  if (isAppwriteConfigured) {
    try {
      const fromDb = await fetchReviewsForProduct(productId);
      if (fromDb.length > 0) return fromDb;
    } catch (error) {
      logger.warn('[marketplace] Не удалось загрузить отзывы из Appwrite.', error);
    }
  }
  return getProductReviews(productId);
}

export function resolveCategoryMeta(
  slug: string | undefined,
  inventory: CatalogListingProduct[]
): CategoryMeta {
  return getCategoryMetaForInventory(slug, inventory);
}
