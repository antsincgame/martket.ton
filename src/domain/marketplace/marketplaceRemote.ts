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
import { fetchPublishedCatalogProducts } from './publishedProducts';
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

/** Append `extra` products that aren't already present (dedupe by id). */
function mergeUnique(
  base: CatalogListingProduct[],
  extra: CatalogListingProduct[],
): CatalogListingProduct[] {
  const ids = new Set(base.map((p) => p.id));
  const additions = extra.filter((p) => !ids.has(p.id));
  return additions.length > 0 ? [...base, ...additions] : base;
}

function mergeWithSeed(liveProducts: CatalogListingProduct[]): CatalogListingProduct[] {
  const seedExtras = CATALOG_LISTING_PRODUCTS.filter(
    (p) => !liveProducts.some((lp) => lp.id === p.id),
  );
  if (seedExtras.length > 0) {
    logger.info(`[marketplace] Merged ${seedExtras.length} seed products with ${liveProducts.length} live products`);
  }
  return [...liveProducts, ...seedExtras];
}

async function loadMarketplaceInventory(): Promise<MarketplaceInventoryLoad> {
  if (!isAppwriteConfigured) {
    logger.warn('[marketplace] Appwrite not configured — falling back to seed data');
    return seedFallback();
  }
  try {
    const appwriteProducts = await fetchListingProducts();

    // H-9: also pull seller products published via the backend API. Without this,
    // products created through the seller/TonForge flow (core.legacy_products)
    // never reached the storefront, which only read marketplace.products. Kept
    // fail-safe: a fetch/parse error here must NOT break the storefront, so we
    // fall back to just the Appwrite products.
    let published: CatalogListingProduct[] = [];
    try {
      published = await fetchPublishedCatalogProducts();
    } catch (err) {
      logger.warn('[marketplace] Failed to load published API products (continuing):', err);
    }

    const live = mergeUnique(appwriteProducts, published);
    const merged = mergeWithSeed(live);
    if (merged.length === 0) {
      return { products: [], categorySummaries: [], spotlight: [], source: 'empty' };
    }
    return buildFromProducts(merged, live.length > 0 ? 'appwrite' : 'seed');
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

/**
 * Synthesize a ProductDetail from a catalog row already in the loaded inventory.
 * H-9: products pulled from /api/products live in the catalog grid but not in
 * marketplace.products / seed, so fetchProductDetailById misses them — without
 * this fallback their detail page 404s. Fills the detail-only fields with
 * sensible defaults derived from the catalog row.
 */
async function detailFromInventory(id: string): Promise<ProductDetail | null> {
  const inventory = await getMarketplaceInventoryOnce();
  const p = inventory.products.find((x) => x.id === id);
  if (!p) return null;
  return {
    ...p,
    longDescription: p.description,
    reviewStatsCount: p.reviewCount ?? 0,
    images: [p.image],
    version: '1.0.0',
    size: '',
    platforms: p.platforms ?? [],
    requirements: '',
    lastUpdated: p.releaseDate ?? '',
    tags: p.tags ?? [],
  };
}

export async function resolveProductDetail(slugOrId: string | undefined): Promise<ProductDetail | null> {
  if (!slugOrId) return null;
  const id = await resolveIdFromSlug(slugOrId);
  if (!isAppwriteConfigured) {
    return getSeedDetailOrNull(id) ?? (await detailFromInventory(id));
  }
  try {
    const detail = await fetchProductDetailById(id);
    return detail ?? getSeedDetailOrNull(id) ?? (await detailFromInventory(id));
  } catch (err) {
    logger.warn('[marketplace] Failed to load product from Appwrite:', err);
    return getSeedDetailOrNull(id) ?? (await detailFromInventory(id));
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
