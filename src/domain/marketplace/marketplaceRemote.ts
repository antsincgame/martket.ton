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
  getHomeSpotlightProductsForProducts,
} from './catalog';
import { CATALOG_LISTING_PRODUCTS, getSeedDetailOrNull } from './seed';
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
  source: 'appwrite' | 'seed' | 'empty';
}

let inventoryOnce: Promise<MarketplaceInventoryLoad> | null = null;

export function getMarketplaceInventoryOnce(): Promise<MarketplaceInventoryLoad> {
  if (!inventoryOnce) {
    inventoryOnce = loadMarketplaceInventory().then((result) => {
      if (result.source !== 'appwrite') inventoryOnce = null;
      return result;
    });
  }
  return inventoryOnce;
}

function buildFromProducts(
  products: CatalogListingProduct[],
  source: 'appwrite' | 'seed',
): MarketplaceInventoryLoad {
  const categorySummaries = getHomeCategorySummariesForProducts(products);
  const spotlight = getHomeSpotlightProductsForProducts(products);
  return { products, categorySummaries, spotlight, source };
}

function seedFallback(): MarketplaceInventoryLoad {
  if (CATALOG_LISTING_PRODUCTS.length === 0) {
    return { products: [], categorySummaries: [], spotlight: [], source: 'empty' };
  }
  logger.info('[marketplace] Using seed demo data for storefront');
  return buildFromProducts(CATALOG_LISTING_PRODUCTS, 'seed');
}

async function loadMarketplaceInventory(): Promise<MarketplaceInventoryLoad> {
  if (!isAppwriteConfigured) {
    logger.warn('[marketplace] Appwrite not configured — falling back to seed data');
    return seedFallback();
  }
  try {
    const products = await fetchListingProducts();
    if (products.length === 0) {
      return seedFallback();
    }
    return buildFromProducts(products, 'appwrite');
  } catch (err) {
    logger.warn('[marketplace] Failed to load from Appwrite, using seed fallback:', err);
    return seedFallback();
  }
}

async function resolveIdFromSlug(slugOrId: string): Promise<string> {
  const inventory = await getMarketplaceInventoryOnce();
  const match = inventory.products.find(
    (p) => slugify(p.name) === slugOrId,
  );
  return match ? match.id : slugOrId;
}

export function productSlug(product: CatalogListingProduct): string {
  return slugify(product.name);
}

export async function resolveProductDetail(slugOrId: string | undefined): Promise<ProductDetail | null> {
  if (!slugOrId) return null;
  const id = await resolveIdFromSlug(slugOrId);
  if (!isAppwriteConfigured) {
    return getSeedDetailOrNull(id);
  }
  try {
    const detail = await fetchProductDetailById(id);
    return detail ?? getSeedDetailOrNull(id);
  } catch (err) {
    logger.warn('[marketplace] Failed to load product from Appwrite:', err);
    return getSeedDetailOrNull(id);
  }
}

export async function resolveProductReviews(slugOrId: string): Promise<ProductReview[]> {
  const id = await resolveIdFromSlug(slugOrId);
  if (!isAppwriteConfigured) return [];
  try {
    return await fetchReviewsForProduct(id);
  } catch (err) {
    logger.warn('[marketplace] Failed to load reviews from Appwrite:', err);
    return [];
  }
}

export async function resolvePublicDeveloperProfile(
  slugOrId: string
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

  let slug = slugOrId;
  let products = developerNames.get(slug);
  if (!products || products.length === 0) {
    const productById = allProducts.find((p) => p.id === slugOrId);
    if (productById) {
      slug = slugify(productById.developer);
      products = developerNames.get(slug);
    }
  }
  if (!products || products.length === 0) return null;

  const displayName = products[0].developer;
  const totalDownloads = products.reduce((s, p) => s + p.downloads, 0);
  const avgRating = products.reduce((s, p) => s + p.rating, 0) / products.length;

  return {
    slug,
    displayName,
    avatar: '',
    bio: `Creator of ${products.length} product${products.length > 1 ? 's' : ''} on TON Web Store`,
    aboutLong: '',
    bannerUrl: '',
    joinedDate: products[0].releaseDate ?? '2024-01-01',
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
