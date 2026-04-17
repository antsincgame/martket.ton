import type {
  CatalogListingProduct,
  CategoryMeta,
  CategorySlug,
  HomeCategorySlug,
  HomeCategorySummary,
  ProductDetail,
  ProductReview,
} from '../types';

interface RawProductFields {
  name?: unknown;
  description?: unknown;
  longDescription?: unknown;
  price?: unknown;
  rating?: unknown;
  downloads?: unknown;
  image?: unknown;
  categoryLabel?: unknown;
  categorySlug?: unknown;
  developer?: unknown;
  isFeatured?: unknown;
  donationAmount?: unknown;
  reviewStatsCount?: unknown;
  images?: unknown;
  version?: unknown;
  size?: unknown;
  platforms?: unknown;
  requirements?: unknown;
  lastUpdated?: unknown;
  tags?: unknown;
}

interface RawCategoryFields {
  slug?: unknown;
  title?: unknown;
  description?: unknown;
  emoji?: unknown;
  gradient?: unknown;
  sortOrder?: unknown;
}

interface RawReviewFields {
  productId?: unknown;
  author?: unknown;
  rating?: unknown;
  comment?: unknown;
  helpful?: unknown;
  reviewDate?: unknown;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function slugFromLabels(raw: RawProductFields): CategorySlug {
  const fromSlug = asNonEmptyString(raw.categorySlug);
  if (fromSlug && isCategorySlug(fromSlug)) return fromSlug;
  const label = asNonEmptyString(raw.categoryLabel);
  const map: Record<string, CategorySlug> = {
    Apps: 'apps',
    Games: 'games',
    'AI Services': 'ai',
    'Developer Tools': 'developer-tools',
  };
  if (label && label in map) return map[label];
  return 'apps';
}

function isCategorySlug(value: string): value is CategorySlug {
  return ['apps', 'games', 'ai', 'developer-tools', 'featured'].includes(value);
}

function labelFromSlug(slug: string): string {
  const map: Record<string, string> = {
    apps: 'Android',
    games: 'Games',
    ai: 'AI Services',
    'developer-tools': 'Developer Tools',
    design: 'Design',
    defi: 'DeFi',
    education: 'Education',
    security: 'Security',
    media: 'Media',
    social: 'Social',
    health: 'Health',
    utilities: 'Utilities',
  };
  return map[slug] ?? 'Android';
}

export function mapProductDocument(
  documentId: string,
  raw: Record<string, unknown>
): CatalogListingProduct | null {
  const data = raw as RawProductFields;
  const name = asNonEmptyString(data.name);
  const description = asNonEmptyString(data.description);
  const image = asNonEmptyString(data.image);
  const developer = asNonEmptyString(data.developer);
  if (!name || !description || !image || !developer) return null;
  const price = asNumber(data.price) ?? 0;
  const rating = asNumber(data.rating) ?? 0;
  const downloads = asNumber(data.downloads) ?? 0;
  const slug = slugFromLabels(data);
  const category = asNonEmptyString(data.categoryLabel) ?? labelFromSlug(slug);
  const donation = asNumber(data.donationAmount);

  const platformsRaw = asStringArray(data.platforms);
  const tagsRaw = asStringArray(data.tags);
  const reviewStatsCount = asNumber(data.reviewStatsCount);
  const lastUpdated = asNonEmptyString(data.lastUpdated);

  return {
    id: documentId,
    name,
    description,
    price,
    rating,
    downloads,
    image,
    category,
    developer,
    isFeatured: asBoolean(data.isFeatured),
    donationAmount: donation === null ? undefined : donation,
    platforms: platformsRaw.length > 0 ? platformsRaw : undefined,
    tags: tagsRaw.length > 0 ? tagsRaw : undefined,
    reviewCount: reviewStatsCount ?? undefined,
    releaseDate: lastUpdated ?? undefined,
  };
}

export function mapProductDetail(documentId: string, raw: Record<string, unknown>): ProductDetail | null {
  const listing = mapProductDocument(documentId, raw);
  if (!listing) return null;
  const data = raw as RawProductFields;
  const longDescription =
    asNonEmptyString(data.longDescription) ??
    `${listing.description}\n\n— Catalog description (Appwrite).`;
  const reviewStatsCount = asNumber(data.reviewStatsCount) ?? Math.max(1, Math.floor(listing.downloads / 200));
  const imagesRaw = asStringArray(data.images);
  const images = imagesRaw.length > 0 ? imagesRaw : [listing.image];
  const version = asNonEmptyString(data.version) ?? '1.0.0';
  const size = asNonEmptyString(data.size) ?? '—';
  const platformsRaw = asStringArray(data.platforms);
  const platforms = platformsRaw.length > 0 ? platformsRaw : ['Web', 'TON'];
  const requirements = asNonEmptyString(data.requirements) ?? 'Check with the developer';
  const lastUpdated =
    asNonEmptyString(data.lastUpdated) ?? new Date().toISOString().slice(0, 10);
  const tagsRaw = asStringArray(data.tags);
  const tags = tagsRaw.length > 0 ? tagsRaw : [listing.category];

  return {
    ...listing,
    longDescription,
    reviewStatsCount,
    images,
    version,
    size,
    platforms,
    requirements,
    lastUpdated,
    tags,
  };
}

export function mapReviewDocument(documentId: string, raw: Record<string, unknown>): ProductReview | null {
  const data = raw as RawReviewFields;
  const productId = asNonEmptyString(data.productId);
  const author = asNonEmptyString(data.author);
  const comment = asNonEmptyString(data.comment);
  const date = asNonEmptyString(data.reviewDate);
  const rating = asNumber(data.rating);
  const helpful = asNumber(data.helpful);
  if (!productId || !author || !comment || !date || rating === null || helpful === null) return null;
  return {
    id: documentId,
    author,
    rating,
    date,
    comment,
    helpful,
  };
}

export type CategoryTableRow = Omit<CategoryMeta, 'count'> & {
  sortOrder: number;
  gradient: string;
};

export function mapCategoryDocument(raw: Record<string, unknown>): CategoryTableRow | null {
  const data = raw as RawCategoryFields;
  const slug = asNonEmptyString(data.slug);
  const title = asNonEmptyString(data.title);
  const description = asNonEmptyString(data.description);
  const emoji = asNonEmptyString(data.emoji);
  if (!slug || !title || !description || !emoji) return null;
  const validSlugs: CategorySlug[] = [
    'apps', 'games', 'ai', 'developer-tools', 'design', 'defi',
    'education', 'security', 'media', 'social', 'health', 'utilities', 'featured',
  ];
  if (!validSlugs.includes(slug as CategorySlug)) return null;
  const sortOrder = asNumber(data.sortOrder) ?? 0;
  const gradient = asNonEmptyString(data.gradient) ?? 'from-gray-500 to-gray-700';
  return { slug: slug as CategorySlug, title, description, emoji, sortOrder, gradient };
}

const CATEGORY_LABEL_TO_HOME_SLUG: Record<string, HomeCategorySlug> = {
  Android: 'apps',
  Games: 'games',
  'AI Services': 'ai',
  'Developer Tools': 'developer-tools',
  Design: 'design',
  DeFi: 'defi',
  Education: 'education',
  Security: 'security',
  Media: 'media',
  Social: 'social',
  Health: 'health',
  Utilities: 'utilities',
};

function homeSlugForListingProduct(product: CatalogListingProduct): HomeCategorySlug | null {
  return CATEGORY_LABEL_TO_HOME_SLUG[product.category] ?? null;
}

export function buildHomeSummaries(categories: CategoryTableRow[], products: CatalogListingProduct[]): HomeCategorySummary[] {
  const homeSlugs: HomeCategorySlug[] = [
    'apps', 'games', 'ai', 'developer-tools', 'design', 'defi',
    'education', 'security', 'media', 'social', 'health', 'utilities',
  ];
  const countFor = (slug: HomeCategorySlug) =>
    products.filter((p) => homeSlugForListingProduct(p) === slug).length;

  const nameForSlug: Record<HomeCategorySlug, string> = {
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

  const bySlug = new Map(categories.map((c) => [c.slug, c]));

  return homeSlugs.map((slug) => {
    const row = bySlug.get(slug);
    return {
      slug,
      name: nameForSlug[slug],
      count: countFor(slug),
      gradient: row?.gradient ?? 'from-gray-600 to-gray-800',
      emoji: row?.emoji ?? '✨',
    };
  });
}
