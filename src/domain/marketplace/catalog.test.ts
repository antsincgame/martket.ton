import { describe, it, expect } from 'vitest';
import type { CatalogListingProduct } from './types';
import {
  filterProductsForCategorySlug,
  sortListingProducts,
  categoryLabelToSlug,
  getHomeSpotlightProductsForProducts,
  getCategoryMetaForInventory,
  getHomeCategorySummariesForProducts,
} from './catalog';

function makeProduct(overrides: Partial<CatalogListingProduct> = {}): CatalogListingProduct {
  return {
    id: '1',
    name: 'Test App',
    description: 'A test app',
    price: 1.5,
    rating: 4.5,
    downloads: 1000,
    image: 'https://img.test/1.png',
    category: 'Android',
    developer: 'Dev1',
    isFeatured: false,
    ...overrides,
  };
}

describe('filterProductsForCategorySlug', () => {
  const inventory = [
    makeProduct({ id: '1', category: 'Android' }),
    makeProduct({ id: '2', category: 'Games' }),
    makeProduct({ id: '3', category: 'AI Services' }),
    makeProduct({ id: '4', category: 'Android', isFeatured: true }),
  ];

  it('filters by category slug', () => {
    const result = filterProductsForCategorySlug('apps', inventory);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.category === 'Android')).toBe(true);
  });

  it('returns featured products for "featured" slug', () => {
    const result = filterProductsForCategorySlug('featured', inventory);
    expect(result).toHaveLength(1);
    expect(result[0].isFeatured).toBe(true);
  });

  it('returns all products for unknown slug', () => {
    const result = filterProductsForCategorySlug('nonexistent', inventory);
    expect(result).toHaveLength(4);
  });

  it('returns empty array for empty inventory', () => {
    expect(filterProductsForCategorySlug('apps', [])).toEqual([]);
  });
});

describe('sortListingProducts', () => {
  const products = [
    makeProduct({ id: '1', rating: 3, price: 5, downloads: 100 }),
    makeProduct({ id: '2', rating: 5, price: 1, downloads: 500 }),
    makeProduct({ id: '3', rating: 4, price: 10, downloads: 50 }),
  ];

  it('sorts by rating descending', () => {
    const sorted = sortListingProducts(products, 'rating');
    expect(sorted.map((p) => p.rating)).toEqual([5, 4, 3]);
  });

  it('sorts by price ascending', () => {
    const sorted = sortListingProducts(products, 'price-low');
    expect(sorted.map((p) => p.price)).toEqual([1, 5, 10]);
  });

  it('sorts by price descending', () => {
    const sorted = sortListingProducts(products, 'price-high');
    expect(sorted.map((p) => p.price)).toEqual([10, 5, 1]);
  });

  it('sorts by popularity (downloads) by default', () => {
    const sorted = sortListingProducts(products, 'popularity');
    expect(sorted.map((p) => p.downloads)).toEqual([500, 100, 50]);
  });

  it('sorts by newest (id desc)', () => {
    const sorted = sortListingProducts(products, 'newest');
    expect(sorted.map((p) => p.id)).toEqual(['3', '2', '1']);
  });

  it('sorts by donations descending', () => {
    const items = [
      makeProduct({ id: '1', donationAmount: 10 }),
      makeProduct({ id: '2', donationAmount: 50 }),
      makeProduct({ id: '3' }),
    ];
    const sorted = sortListingProducts(items, 'donations');
    expect(sorted.map((p) => p.donationAmount ?? 0)).toEqual([50, 10, 0]);
  });

  it('does not mutate original array', () => {
    const original = [...products];
    sortListingProducts(products, 'rating');
    expect(products.map((p) => p.id)).toEqual(original.map((p) => p.id));
  });
});

describe('categoryLabelToSlug', () => {
  it('maps known labels to slugs', () => {
    expect(categoryLabelToSlug('Android')).toBe('apps');
    expect(categoryLabelToSlug('Games')).toBe('games');
    expect(categoryLabelToSlug('AI Services')).toBe('ai');
    expect(categoryLabelToSlug('Developer Tools')).toBe('developer-tools');
    expect(categoryLabelToSlug('Design')).toBe('design');
    expect(categoryLabelToSlug('DeFi')).toBe('defi');
  });

  it('returns null for unknown labels', () => {
    expect(categoryLabelToSlug('Unknown')).toBeNull();
    expect(categoryLabelToSlug('')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(categoryLabelToSlug('  Android  ')).toBe('apps');
  });
});

describe('getHomeSpotlightProductsForProducts', () => {
  it('returns featured products sorted by downloads when 8+ featured', () => {
    const inventory = Array.from({ length: 10 }, (_, i) =>
      makeProduct({ id: String(i), isFeatured: true, downloads: i * 100 }),
    );
    const result = getHomeSpotlightProductsForProducts(inventory);
    expect(result).toHaveLength(8);
    expect(result[0].downloads).toBeGreaterThanOrEqual(result[1].downloads);
  });

  it('fills with non-featured when less than 8 featured', () => {
    const inventory = [
      makeProduct({ id: '1', isFeatured: true, downloads: 500 }),
      makeProduct({ id: '2', isFeatured: false, downloads: 400 }),
      makeProduct({ id: '3', isFeatured: false, downloads: 300 }),
    ];
    const result = getHomeSpotlightProductsForProducts(inventory);
    expect(result).toHaveLength(3);
    expect(result[0].isFeatured).toBe(true);
  });

  it('falls back to first 8 when no featured and no stable IDs match', () => {
    const inventory = Array.from({ length: 20 }, (_, i) =>
      makeProduct({ id: `x${i}`, isFeatured: false }),
    );
    const result = getHomeSpotlightProductsForProducts(inventory);
    expect(result).toHaveLength(8);
  });

  it('returns empty for empty inventory', () => {
    expect(getHomeSpotlightProductsForProducts([])).toEqual([]);
  });
});

describe('getCategoryMetaForInventory', () => {
  const inventory = [
    makeProduct({ category: 'Android' }),
    makeProduct({ category: 'Android' }),
    makeProduct({ category: 'Games' }),
  ];

  it('returns meta with correct count', () => {
    const meta = getCategoryMetaForInventory('apps', inventory);
    expect(meta.slug).toBe('apps');
    expect(meta.title).toBe('Android');
    expect(meta.count).toBe(2);
  });

  it('defaults to apps for undefined slug', () => {
    const meta = getCategoryMetaForInventory(undefined, inventory);
    expect(meta.slug).toBe('apps');
  });

  it('defaults to apps for invalid slug', () => {
    const meta = getCategoryMetaForInventory('invalid', inventory);
    expect(meta.slug).toBe('apps');
  });
});

describe('getHomeCategorySummariesForProducts', () => {
  it('returns 12 home category summaries', () => {
    const inventory = [makeProduct({ category: 'Android' })];
    const summaries = getHomeCategorySummariesForProducts(inventory);
    expect(summaries).toHaveLength(12);
    expect(summaries.every((s) => s.name && s.gradient && s.emoji)).toBe(true);
  });

  it('counts products per category correctly', () => {
    const inventory = [
      makeProduct({ category: 'Android' }),
      makeProduct({ category: 'Android' }),
      makeProduct({ category: 'Games' }),
    ];
    const summaries = getHomeCategorySummariesForProducts(inventory);
    const apps = summaries.find((s) => s.slug === 'apps');
    const games = summaries.find((s) => s.slug === 'games');
    expect(apps?.count).toBe(2);
    expect(games?.count).toBe(1);
  });
});
