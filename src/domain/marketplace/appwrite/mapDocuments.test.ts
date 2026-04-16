import { describe, it, expect } from 'vitest';
import {
  mapProductDocument,
  mapProductDetail,
  mapReviewDocument,
  mapCategoryDocument,
  buildHomeSummaries,
} from './mapDocuments';

describe('mapProductDocument', () => {
  const validRaw = {
    name: 'Test App',
    description: 'A test app',
    image: 'https://img.test/1.png',
    developer: 'Dev1',
    price: 2.5,
    rating: 4.0,
    downloads: 1000,
    categorySlug: 'games',
    isFeatured: true,
  };

  it('maps valid document to CatalogListingProduct', () => {
    const result = mapProductDocument('doc-1', validRaw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('doc-1');
    expect(result!.name).toBe('Test App');
    expect(result!.price).toBe(2.5);
    expect(result!.rating).toBe(4.0);
    expect(result!.downloads).toBe(1000);
    expect(result!.isFeatured).toBe(true);
  });

  it('returns null when name is missing', () => {
    expect(mapProductDocument('doc-1', { ...validRaw, name: '' })).toBeNull();
    expect(mapProductDocument('doc-1', { ...validRaw, name: undefined })).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(mapProductDocument('doc-1', { ...validRaw, description: '' })).toBeNull();
    expect(mapProductDocument('doc-1', { ...validRaw, image: undefined })).toBeNull();
    expect(mapProductDocument('doc-1', { ...validRaw, developer: '' })).toBeNull();
  });

  it('defaults price/rating/downloads to 0', () => {
    const raw = { ...validRaw, price: undefined, rating: undefined, downloads: undefined };
    const result = mapProductDocument('doc-1', raw);
    expect(result!.price).toBe(0);
    expect(result!.rating).toBe(0);
    expect(result!.downloads).toBe(0);
  });

  it('handles isFeatured correctly', () => {
    expect(mapProductDocument('doc-1', { ...validRaw, isFeatured: false })!.isFeatured).toBe(false);
    expect(mapProductDocument('doc-1', { ...validRaw, isFeatured: undefined })!.isFeatured).toBe(false);
    expect(mapProductDocument('doc-1', { ...validRaw, isFeatured: 'yes' })!.isFeatured).toBe(false);
  });

  it('resolves category from categoryLabel when no categorySlug', () => {
    const raw = { ...validRaw, categorySlug: undefined, categoryLabel: 'AI Services' };
    const result = mapProductDocument('doc-1', raw);
    expect(result!.category).toBe('AI Services');
  });

  it('maps platforms and tags as string arrays', () => {
    const raw = { ...validRaw, platforms: ['Web', 'Android'], tags: ['game', 'nft'] };
    const result = mapProductDocument('doc-1', raw);
    expect(result!.platforms).toEqual(['Web', 'Android']);
    expect(result!.tags).toEqual(['game', 'nft']);
  });

  it('filters non-string items from arrays', () => {
    const raw = { ...validRaw, platforms: ['Web', 42, null, 'TON'] };
    const result = mapProductDocument('doc-1', raw);
    expect(result!.platforms).toEqual(['Web', 'TON']);
  });
});

describe('mapProductDetail', () => {
  const validRaw = {
    name: 'Detail App',
    description: 'Detailed description',
    image: 'https://img.test/1.png',
    developer: 'Dev1',
    price: 3.0,
    rating: 4.5,
    downloads: 2000,
    categorySlug: 'apps',
    longDescription: 'Full product description here',
    version: '2.1.0',
    size: '15 MB',
    platforms: ['Web', 'TON'],
    requirements: 'TON Wallet required',
    lastUpdated: '2025-01-15',
    tags: ['productivity', 'ton'],
    images: ['https://img.test/1.png', 'https://img.test/2.png'],
    reviewStatsCount: 42,
  };

  it('maps a full detail document', () => {
    const result = mapProductDetail('doc-detail', validRaw);
    expect(result).not.toBeNull();
    expect(result!.longDescription).toBe('Full product description here');
    expect(result!.version).toBe('2.1.0');
    expect(result!.size).toBe('15 MB');
    expect(result!.images).toHaveLength(2);
    expect(result!.reviewStatsCount).toBe(42);
    expect(result!.tags).toEqual(['productivity', 'ton']);
  });

  it('provides sensible defaults for missing detail fields', () => {
    const minRaw = {
      name: 'Min App',
      description: 'Minimal',
      image: 'https://img.test/1.png',
      developer: 'Dev1',
    };
    const result = mapProductDetail('doc-min', minRaw);
    expect(result).not.toBeNull();
    expect(result!.version).toBe('1.0.0');
    expect(result!.size).toBe('—');
    expect(result!.platforms).toEqual(['Web', 'TON']);
    expect(result!.images).toEqual(['https://img.test/1.png']);
  });

  it('returns null for invalid base document', () => {
    expect(mapProductDetail('doc', { name: '' })).toBeNull();
  });
});

describe('mapReviewDocument', () => {
  const validReview = {
    productId: 'p1',
    author: 'Reviewer',
    rating: 5,
    comment: 'Great app!',
    helpful: 3,
    reviewDate: '2025-03-01',
  };

  it('maps a valid review', () => {
    const result = mapReviewDocument('rev-1', validReview);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('rev-1');
    expect(result!.author).toBe('Reviewer');
    expect(result!.rating).toBe(5);
    expect(result!.comment).toBe('Great app!');
  });

  it('returns null when required fields are missing', () => {
    expect(mapReviewDocument('rev', { ...validReview, author: '' })).toBeNull();
    expect(mapReviewDocument('rev', { ...validReview, rating: undefined })).toBeNull();
    expect(mapReviewDocument('rev', { ...validReview, comment: '' })).toBeNull();
    expect(mapReviewDocument('rev', { ...validReview, reviewDate: undefined })).toBeNull();
    expect(mapReviewDocument('rev', { ...validReview, helpful: undefined })).toBeNull();
  });
});

describe('mapCategoryDocument', () => {
  it('maps a valid category document', () => {
    const raw = { slug: 'games', title: 'Games', description: 'Fun', emoji: '🎮' };
    const result = mapCategoryDocument(raw);
    expect(result).not.toBeNull();
    expect(result!.slug).toBe('games');
    expect(result!.sortOrder).toBe(0);
  });

  it('returns null for invalid slug', () => {
    const raw = { slug: 'invalid-slug', title: 'X', description: 'Y', emoji: '?' };
    expect(mapCategoryDocument(raw)).toBeNull();
  });

  it('returns null for missing required fields', () => {
    expect(mapCategoryDocument({ slug: 'games', title: '' })).toBeNull();
  });

  it('uses default gradient when missing', () => {
    const raw = { slug: 'apps', title: 'Apps', description: 'Apps', emoji: '📱' };
    const result = mapCategoryDocument(raw);
    expect(result!.gradient).toBe('from-gray-500 to-gray-700');
  });
});

describe('buildHomeSummaries', () => {
  it('returns 12 category summaries', () => {
    const result = buildHomeSummaries([], []);
    expect(result).toHaveLength(12);
  });

  it('counts products per category', () => {
    const products = [
      { id: '1', name: 'A', description: 'd', price: 0, rating: 0, downloads: 0, image: '', category: 'Android', developer: 'd', isFeatured: false },
      { id: '2', name: 'B', description: 'd', price: 0, rating: 0, downloads: 0, image: '', category: 'Android', developer: 'd', isFeatured: false },
      { id: '3', name: 'C', description: 'd', price: 0, rating: 0, downloads: 0, image: '', category: 'Games', developer: 'd', isFeatured: false },
    ];
    const result = buildHomeSummaries([], products);
    expect(result.find((s) => s.slug === 'apps')!.count).toBe(2);
    expect(result.find((s) => s.slug === 'games')!.count).toBe(1);
    expect(result.find((s) => s.slug === 'ai')!.count).toBe(0);
  });

  it('uses category table gradient when available', () => {
    const categories = [
      { slug: 'apps' as const, title: 'Android', description: 'd', emoji: '📱', sortOrder: 1, gradient: 'from-red-500 to-blue-500' },
    ];
    const result = buildHomeSummaries(categories, []);
    expect(result.find((s) => s.slug === 'apps')!.gradient).toBe('from-red-500 to-blue-500');
  });
});
