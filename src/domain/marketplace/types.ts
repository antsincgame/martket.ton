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
  /** Идентификатор документа в Appwrite или стабильный строковый ключ в сиде */
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  helpful: number;
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
