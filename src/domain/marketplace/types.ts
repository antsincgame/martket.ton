/** Карточка товара в ленте и на главной — совместима с `ProductCard`. */
export interface CatalogListingProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  rating: number;
  downloads: number;
  image: string;
  category: string;
  developer: string;
  isFeatured: boolean;
  donationAmount?: number;
  platforms?: string[];
  tags?: string[];
  reviewCount?: number;
  releaseDate?: string;
}

export interface CategoryMeta {
  slug: CategorySlug;
  title: string;
  description: string;
  emoji: string;
  /** Количество товаров в категории (по демо-каталогу). */
  count: number;
}

export interface ProductDetail extends CatalogListingProduct {
  longDescription: string;
  reviewStatsCount: number;
  images: string[];
  version: string;
  size: string;
  platforms: string[];
  requirements: string;
  lastUpdated: string;
  tags: string[];
}

export interface ProductReview {
  id: string;
  author: string;
  authorAvatar?: string;
  userId?: string;
  rating: number;
  date: string;
  comment: string;
  helpful: number;
}

export interface DeveloperProfile {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  website?: string;
  tonWallet?: string;
  joinedDate: string;
  productCount: number;
  totalDownloads: number;
}

export interface PublicDeveloperProfile {
  slug: string;
  displayName: string;
  avatar: string;
  bio: string;
  aboutLong: string;
  bannerUrl: string;
  website?: string;
  github?: string;
  telegram?: string;
  twitter?: string;
  joinedDate: string;
  productCount: number;
  totalDownloads: number;
  avgRating: number;
  featuredProductIds: string[];
  products: CatalogListingProduct[];
}

export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  joinedDate: string;
  reviewCount: number;
}

export type CategorySlug =
  | 'apps'
  | 'games'
  | 'ai'
  | 'developer-tools'
  | 'design'
  | 'defi'
  | 'education'
  | 'security'
  | 'media'
  | 'social'
  | 'health'
  | 'utilities'
  | 'featured';

export type HomeCategorySlug = Exclude<CategorySlug, 'featured'>;

export interface HomeCategorySummary {
  slug: HomeCategorySlug;
  name: string;
  count: number;
  gradient: string;
  emoji: string;
}
