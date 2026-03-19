import { CATALOG_LISTING_PRODUCTS, getSeedDetailOrNull, REVIEWS_PRODUCT_1 } from './seed';
import type {
  CatalogListingProduct,
  CategoryMeta,
  CategorySlug,
  HomeCategorySlug,
  HomeCategorySummary,
  ProductDetail,
  ProductReview,
} from './types';

const HOME_SPOTLIGHT_IDS = ['1', '2', '3', '4'];

const SLUG_TO_CATEGORY_LABELS: Record<CategorySlug, string[]> = {
  apps: ['Apps'],
  games: ['Games'],
  ai: ['AI Services'],
  'developer-tools': ['Developer Tools'],
  featured: [],
};

const CATEGORY_META_BASE: Record<CategorySlug, Omit<CategoryMeta, 'count'>> = {
  apps: {
    slug: 'apps',
    title: 'Sacred Apps',
    description: 'Discover enlightened applications that elevate your digital experience',
    emoji: '🚀',
  },
  games: {
    slug: 'games',
    title: 'Mystical Games',
    description: 'Immersive gaming experiences for the conscious soul',
    emoji: '🎮',
  },
  ai: {
    slug: 'ai',
    title: 'AI Wisdom Services',
    description: 'Artificial intelligence tools blessed with digital consciousness',
    emoji: '🤖',
  },
  'developer-tools': {
    slug: 'developer-tools',
    title: 'Developer Sacred Tools',
    description: 'Essential tools for enlightened software development',
    emoji: '⚡',
  },
  featured: {
    slug: 'featured',
    title: 'Featured Treasures',
    description: 'Handpicked digital gems blessed by the community',
    emoji: '✨',
  },
};

function isCategorySlug(value: string): value is CategorySlug {
  return value in CATEGORY_META_BASE;
}

const DISPLAY_NAME_BY_HOME_SLUG: Record<HomeCategorySlug, string> = {
  apps: 'Apps',
  games: 'Games',
  ai: 'AI Services',
  'developer-tools': 'Developer Tools',
};

const GRADIENT_BY_HOME_SLUG: Record<HomeCategorySlug, string> = {
  apps: 'from-blue-500 to-purple-600',
  games: 'from-green-500 to-teal-600',
  ai: 'from-purple-500 to-pink-600',
  'developer-tools': 'from-yellow-500 to-orange-600',
};

/** Витрина «Featured» по произвольному каталогу: сначала избранные, иначе стабильные id. */
export function getHomeSpotlightProductsForProducts(
  inventory: CatalogListingProduct[]
): CatalogListingProduct[] {
  const featured = inventory.filter((product) => product.isFeatured);
  if (featured.length >= 4) {
    return [...featured].sort((a, b) => b.downloads - a.downloads).slice(0, 4);
  }
  const byId = new Map(inventory.map((product) => [product.id, product]));
  const fromStableIds = HOME_SPOTLIGHT_IDS.map((id) => byId.get(id)).filter(
    (item): item is CatalogListingProduct => item !== undefined
  );
  if (fromStableIds.length > 0) return fromStableIds;
  return inventory.slice(0, 4);
}

/** Блок «Featured Treasures» на главной — на демо-каталоге. */
export function getHomeSpotlightProducts(): CatalogListingProduct[] {
  return getHomeSpotlightProductsForProducts(CATALOG_LISTING_PRODUCTS);
}

export function getHomeCategorySummariesForProducts(
  inventory: CatalogListingProduct[]
): HomeCategorySummary[] {
  const homeSlugs: HomeCategorySlug[] = ['apps', 'games', 'ai', 'developer-tools'];
  return homeSlugs.map((slug) => ({
    slug,
    name: DISPLAY_NAME_BY_HOME_SLUG[slug],
    count: filterProductsForCategorySlug(slug, inventory).length,
    gradient: GRADIENT_BY_HOME_SLUG[slug],
    emoji: CATEGORY_META_BASE[slug].emoji,
  }));
}

export function getHomeCategorySummaries(): HomeCategorySummary[] {
  return getHomeCategorySummariesForProducts(CATALOG_LISTING_PRODUCTS);
}

export function filterProductsForCategorySlug(
  slug: string,
  inventory: CatalogListingProduct[]
): CatalogListingProduct[] {
  if (!isCategorySlug(slug)) {
    return [...inventory];
  }
  if (slug === 'featured') {
    return inventory.filter((product) => product.isFeatured);
  }
  const labels = SLUG_TO_CATEGORY_LABELS[slug];
  return inventory.filter((product) => labels.includes(product.category));
}

export function getProductsForCategorySlug(slug: string): CatalogListingProduct[] {
  return filterProductsForCategorySlug(slug, CATALOG_LISTING_PRODUCTS);
}

export function getCategoryMetaForInventory(
  slug: string | undefined,
  inventory: CatalogListingProduct[]
): CategoryMeta {
  const normalized = slug && isCategorySlug(slug) ? slug : 'apps';
  const base = CATEGORY_META_BASE[normalized];
  const products = filterProductsForCategorySlug(normalized, inventory);
  return {
    ...base,
    count: products.length,
  };
}

export function getCategoryMeta(slug: string | undefined): CategoryMeta {
  return getCategoryMetaForInventory(slug, CATALOG_LISTING_PRODUCTS);
}

export function sortListingProducts(
  products: CatalogListingProduct[],
  sortBy: string
): CatalogListingProduct[] {
  const next = [...products];
  switch (sortBy) {
    case 'rating':
      return next.sort((a, b) => b.rating - a.rating);
    case 'price-low':
      return next.sort((a, b) => a.price - b.price);
    case 'price-high':
      return next.sort((a, b) => b.price - a.price);
    case 'donations':
      return next.sort((a, b) => (b.donationAmount ?? 0) - (a.donationAmount ?? 0));
    case 'newest':
      return next.sort((a, b) => Number(b.id) - Number(a.id));
    case 'popularity':
    default:
      return next.sort((a, b) => b.downloads - a.downloads);
  }
}

export function getProductDetail(productId: string | undefined): ProductDetail | null {
  if (!productId) return null;
  const rich = getSeedDetailOrNull(productId);
  if (rich) return { ...rich, id: productId };
  const listing = CATALOG_LISTING_PRODUCTS.find((item) => item.id === productId);
  if (!listing) return null;
  return buildDetailFromListing(listing);
}

function buildDetailFromListing(listing: CatalogListingProduct): ProductDetail {
  return {
    ...listing,
    longDescription: `${listing.description}\n\n— Демо-карточка: полное описание будет из backend.`,
    reviewStatsCount: Math.max(1, Math.floor(listing.downloads / 200)),
    images: [listing.image],
    version: '1.0.0',
    size: '—',
    platforms: ['Web', 'TON'],
    requirements: 'Уточняйте у разработчика',
    lastUpdated: new Date().toISOString().slice(0, 10),
    tags: [listing.category],
  };
}

export function getProductReviews(productId: string): ProductReview[] {
  if (productId === '1') return REVIEWS_PRODUCT_1;
  const listing = CATALOG_LISTING_PRODUCTS.find((item) => item.id === productId);
  const name = listing?.name ?? 'этот продукт';
  return [
    {
      id: 'seed-review-a',
      author: 'SacredUser',
      rating: 5,
      date: new Date().toISOString().slice(0, 10),
      comment: `Отличная находка: «${name}». Жду полноценных отзывов из базы.`,
      helpful: 3,
    },
    {
      id: 'seed-review-b',
      author: 'TONWanderer',
      rating: 4,
      date: new Date().toISOString().slice(0, 10),
      comment: 'Демо-отзыв: данные из Appwrite подменят этот текст при непустой коллекции reviews.',
      helpful: 1,
    },
  ];
}
