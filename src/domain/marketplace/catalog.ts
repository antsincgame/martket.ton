import type {
  CatalogListingProduct,
  CategoryMeta,
  CategorySlug,
  HomeCategorySlug,
  HomeCategorySummary,
  ProductDetail,
  ProductReview,
} from './types';

const HOME_SPOTLIGHT_IDS = ['1', '4', '7', '10', '12', '15', '17', '5'];

const SLUG_TO_CATEGORY_LABELS: Record<CategorySlug, string[]> = {
  apps: ['Android'],
  games: ['Games'],
  ai: ['AI Services'],
  'developer-tools': ['Developer Tools'],
  design: ['Design'],
  defi: ['DeFi'],
  education: ['Education'],
  security: ['Security'],
  media: ['Media'],
  social: ['Social'],
  health: ['Health'],
  utilities: ['Utilities'],
  featured: [],
};

const CATEGORY_META_BASE: Record<CategorySlug, Omit<CategoryMeta, 'count'>> = {
  apps: {
    slug: 'apps',
    title: 'Android',
    description: 'Native Android apps for productivity, lifestyle, and TON ecosystem',
    emoji: '📱',
  },
  games: {
    slug: 'games',
    title: 'Games',
    description: 'Immersive gaming experiences with NFT rewards',
    emoji: '🎮',
  },
  ai: {
    slug: 'ai',
    title: 'AI Services',
    description: 'Artificial intelligence tools powered by cutting-edge models',
    emoji: '🤖',
  },
  'developer-tools': {
    slug: 'developer-tools',
    title: 'Developer Tools',
    description: 'Essential tools for modern software development',
    emoji: '⚡',
  },
  design: {
    slug: 'design',
    title: 'Design & Creative',
    description: 'Creative tools for designers, artists, and content creators',
    emoji: '🎨',
  },
  defi: {
    slug: 'defi',
    title: 'Finance & DeFi',
    description: 'Wallets, portfolio trackers, and decentralized finance tools',
    emoji: '💰',
  },
  education: {
    slug: 'education',
    title: 'Education',
    description: 'Courses, tutors, and learning platforms for Web3 and beyond',
    emoji: '📚',
  },
  security: {
    slug: 'security',
    title: 'Security & Privacy',
    description: 'VPN, firewalls, and security tools for the decentralized world',
    emoji: '🔒',
  },
  media: {
    slug: 'media',
    title: 'Media & Entertainment',
    description: 'Streaming, podcasts, and content creation tools',
    emoji: '🎬',
  },
  social: {
    slug: 'social',
    title: 'Social & Communication',
    description: 'Encrypted messaging, collaboration, and community tools',
    emoji: '💬',
  },
  health: {
    slug: 'health',
    title: 'Health & Wellness',
    description: 'Meditation, fitness, sleep tracking, and mental health',
    emoji: '🧘',
  },
  utilities: {
    slug: 'utilities',
    title: 'Utilities & System',
    description: 'Monitoring, backups, and system administration tools',
    emoji: '🔧',
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
  apps: 'Android',
  games: 'Games',
  ai: 'AI Services',
  'developer-tools': 'Developer Tools',
  design: 'Design & Creative',
  defi: 'Finance & DeFi',
  education: 'Education',
  security: 'Security & Privacy',
  media: 'Media & Entertainment',
  social: 'Social & Communication',
  health: 'Health & Wellness',
  utilities: 'Utilities & System',
};

const GRADIENT_BY_HOME_SLUG: Record<HomeCategorySlug, string> = {
  apps: 'from-blue-500 to-purple-600',
  games: 'from-green-500 to-teal-600',
  ai: 'from-purple-500 to-pink-600',
  'developer-tools': 'from-yellow-500 to-orange-600',
  design: 'from-pink-500 to-rose-600',
  defi: 'from-amber-500 to-yellow-600',
  education: 'from-indigo-500 to-blue-600',
  security: 'from-red-500 to-rose-700',
  media: 'from-violet-500 to-purple-600',
  social: 'from-cyan-500 to-blue-500',
  health: 'from-emerald-500 to-green-600',
  utilities: 'from-slate-500 to-zinc-600',
};

/** Витрина «Featured» по произвольному каталогу: сначала избранные, иначе стабильные id. */
export function getHomeSpotlightProductsForProducts(
  inventory: CatalogListingProduct[]
): CatalogListingProduct[] {
  const featured = inventory.filter((product) => product.isFeatured);
  if (featured.length >= 8) {
    return [...featured].sort((a, b) => b.downloads - a.downloads).slice(0, 8);
  }
  if (featured.length > 0) {
    const rest = inventory
      .filter((p) => !p.isFeatured)
      .sort((a, b) => b.downloads - a.downloads);
    return [...featured, ...rest].slice(0, 8);
  }
  const byId = new Map(inventory.map((product) => [product.id, product]));
  const fromStableIds = HOME_SPOTLIGHT_IDS.map((id) => byId.get(id)).filter(
    (item): item is CatalogListingProduct => item !== undefined
  );
  if (fromStableIds.length > 0) return fromStableIds;
  return inventory.slice(0, 8);
}

/** @deprecated Use getHomeSpotlightProductsForProducts with real data. Returns empty for clean site. */
export function getHomeSpotlightProducts(): CatalogListingProduct[] {
  return [];
}

export function getHomeCategorySummariesForProducts(
  inventory: CatalogListingProduct[]
): HomeCategorySummary[] {
  const homeSlugs: HomeCategorySlug[] = [
    'apps', 'games', 'ai', 'developer-tools',
    'design', 'defi', 'education', 'security',
    'media', 'social', 'health', 'utilities',
  ];
  return homeSlugs.map((slug) => ({
    slug,
    name: DISPLAY_NAME_BY_HOME_SLUG[slug],
    count: filterProductsForCategorySlug(slug, inventory).length,
    gradient: GRADIENT_BY_HOME_SLUG[slug],
    emoji: CATEGORY_META_BASE[slug].emoji,
  }));
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

/**
 * Обратное отображение: human-label категории (e.g. "Android", "AI Services")
 * → slug маршрута (e.g. "apps", "ai"). Возвращает `null`, если совпадений нет.
 */
export function categoryLabelToSlug(label: string): CategorySlug | null {
  const trimmed = label.trim();
  for (const [slug, labels] of Object.entries(SLUG_TO_CATEGORY_LABELS) as [CategorySlug, string[]][]) {
    if (labels.includes(trimmed)) return slug;
  }
  return null;
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

/** @deprecated Seed fallback removed. Returns null — real products come from Appwrite API. */
export function getProductDetail(_productId: string | undefined): ProductDetail | null {
  return null;
}

/** @deprecated Seed fallback removed. Returns [] — real reviews come from Appwrite API. */
export function getProductReviews(_productId: string): ProductReview[] {
  return [];
}
