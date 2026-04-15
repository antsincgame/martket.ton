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
import { CATALOG_LISTING_PRODUCTS, SEED_DEVELOPERS } from './seed';
import { slugify } from '../../utils/slugify';
import type {
  CatalogListingProduct,
  CategoryMeta,
  HomeCategorySummary,
  ProductDetail,
  ProductReview,
  PublicDeveloperProfile,
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
      const seed = seedById.get(rp.id);
      if (seed) {
        seedById.set(rp.id, {
          ...seed,
          ...rp,
          platforms: rp.platforms ?? seed.platforms,
          tags: rp.tags ?? seed.tags,
          reviewCount: rp.reviewCount ?? seed.reviewCount,
          releaseDate: rp.releaseDate ?? seed.releaseDate,
          donationAmount: rp.donationAmount ?? seed.donationAmount,
        });
      } else {
        seedById.set(rp.id, rp);
      }
    }
    // Дедупликация по name+developer — удаляем дубли (приоритет у записей с меньшим id, т.е. seed)
    const seen = new Map<string, boolean>();
    const products = [...seedById.values()].filter((p) => {
      const key = `${p.name}||${p.developer}`;
      if (seen.has(key)) return false;
      seen.set(key, true);
      return true;
    });
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

/** Маппинг SEED_DEVELOPERS по slug для быстрого поиска. */
const SEED_DEV_BY_SLUG = new Map(
  SEED_DEVELOPERS.map((d) => [slugify(d.name), d])
);

/** Публичный профиль разработчика по slug. Мёрджит SEED_DEVELOPERS + каталог. */
export async function resolvePublicDeveloperProfile(
  slug: string
): Promise<PublicDeveloperProfile | null> {
  const inventory = await getMarketplaceInventoryOnce();
  const allProducts = inventory.products;

  const developerNames = new Map<string, CatalogListingProduct[]>();
  for (const p of allProducts) {
    const devSlug = slugify(p.developer);
    const arr = developerNames.get(devSlug) ?? [];
    arr.push(p);
    developerNames.set(devSlug, arr);
  }

  const products = developerNames.get(slug);
  if (!products || products.length === 0) return null;

  const displayName = products[0].developer;
  const totalDownloads = products.reduce((s, p) => s + p.downloads, 0);
  const avgRating = products.reduce((s, p) => s + p.rating, 0) / products.length;

  const seedDev = SEED_DEV_BY_SLUG.get(slug);

  return {
    slug,
    displayName,
    avatar: seedDev?.avatar ?? '',
    bio: seedDev?.bio ?? `Creator of ${products.length} product${products.length > 1 ? 's' : ''} on TON Web Store`,
    aboutLong: seedDev?.aboutLong ?? '',
    bannerUrl: seedDev?.bannerUrl ?? '',
    website: seedDev?.website,
    github: seedDev?.github,
    telegram: seedDev?.telegram,
    twitter: seedDev?.twitter,
    joinedDate: seedDev?.joinedDate ?? products[0].releaseDate ?? '2024-01-01',
    productCount: products.length,
    totalDownloads,
    avgRating: Math.round(avgRating * 10) / 10,
    featuredProductIds: products.filter((p) => p.isFeatured).map((p) => p.id).slice(0, 4),
    products: [...products].sort((a, b) => b.downloads - a.downloads),
  };
}

export function resolveCategoryMeta(
  slug: string | undefined,
  inventory: CatalogListingProduct[]
): CategoryMeta {
  return getCategoryMetaForInventory(slug, inventory);
}
