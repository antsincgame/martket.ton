import { CATALOG_LISTING_PRODUCTS, getSeedDetailOrNull, REVIEWS_PRODUCT_1 } from './seed';
import type {
  CatalogListingProduct,
  CategoryMeta,
  CategorySlug,
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

/** Блок «Featured Treasures» на главной — фиксированный набор id из демо-каталога. */
export function getHomeSpotlightProducts(): CatalogListingProduct[] {
  return HOME_SPOTLIGHT_IDS
    .map((productId) => CATALOG_LISTING_PRODUCTS.find((item) => item.id === productId))
    .filter((item): item is CatalogListingProduct => item !== undefined);
}

export function getHomeCategorySummaries(): HomeCategorySummary[] {
  const rows: HomeCategorySummary[] = [
    {
      slug: 'apps',
      name: 'Apps',
      count: getProductsForCategorySlug('apps').length,
      gradient: 'from-blue-500 to-purple-600',
      emoji: '🚀',
    },
    {
      slug: 'games',
      name: 'Games',
      count: getProductsForCategorySlug('games').length,
      gradient: 'from-green-500 to-teal-600',
      emoji: '🎮',
    },
    {
      slug: 'ai',
      name: 'AI Services',
      count: getProductsForCategorySlug('ai').length,
      gradient: 'from-purple-500 to-pink-600',
      emoji: '🤖',
    },
    {
      slug: 'developer-tools',
      name: 'Developer Tools',
      count: getProductsForCategorySlug('developer-tools').length,
      gradient: 'from-yellow-500 to-orange-600',
      emoji: '⚡',
    },
  ];
  return rows;
}

export function getProductsForCategorySlug(slug: string): CatalogListingProduct[] {
  if (!isCategorySlug(slug)) {
    return [...CATALOG_LISTING_PRODUCTS];
  }
  if (slug === 'featured') {
    return CATALOG_LISTING_PRODUCTS.filter((product) => product.isFeatured);
  }
  const labels = SLUG_TO_CATEGORY_LABELS[slug];
  return CATALOG_LISTING_PRODUCTS.filter((product) => labels.includes(product.category));
}

export function getCategoryMeta(slug: string | undefined): CategoryMeta {
  const normalized = slug && isCategorySlug(slug) ? slug : 'apps';
  const base = CATEGORY_META_BASE[normalized];
  const products = getProductsForCategorySlug(normalized);
  return {
    ...base,
    count: products.length,
  };
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
      id: 1,
      author: 'SacredUser',
      rating: 5,
      date: new Date().toISOString().slice(0, 10),
      comment: `Отличная находка: «${name}». Жду полноценных отзывов из базы.`,
      helpful: 3,
    },
    {
      id: 2,
      author: 'TONWanderer',
      rating: 4,
      date: new Date().toISOString().slice(0, 10),
      comment: 'Демо-отзыв: после подключения Appwrite здесь будут реальные данные.',
      helpful: 1,
    },
  ];
}
