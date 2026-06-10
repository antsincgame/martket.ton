import { describe, it, expect } from 'vitest';
import { mapApiProduct } from './publishedProducts';

describe('mapApiProduct (H-9 legacy → catalog)', () => {
  it('maps a complete published product', () => {
    const out = mapApiProduct({
      id: 'p1',
      name: 'Cool App',
      short_description: 'short',
      description: 'long',
      price_usd: 9.99,
      category: 'tools',
      image: 'https://cdn/x.png',
      rating: 4.5,
      reviews_count: 12,
      downloads: 300,
      created_at: '2026-01-01',
      creator_name: 'Alice',
    });
    expect(out).toMatchObject({
      id: 'p1',
      name: 'Cool App',
      description: 'short',
      price: 9.99,
      priceUsd: 9.99,
      rating: 4.5,
      downloads: 300,
      image: 'https://cdn/x.png',
      category: 'tools',
      developer: 'Alice',
      isFeatured: false,
      reviewCount: 12,
      releaseDate: '2026-01-01',
    });
  });

  it('skips rows with no id or name (no broken cards)', () => {
    expect(mapApiProduct({ name: 'x' })).toBeNull();
    expect(mapApiProduct({ id: 'p2' })).toBeNull();
    expect(mapApiProduct({})).toBeNull();
  });

  it('falls back for missing image / developer / description', () => {
    const out = mapApiProduct({ id: 'p3', name: 'Bare' });
    expect(out?.image).toBe('/app-icon.svg');
    expect(out?.developer).toBe('Demiurge');
    expect(out?.description).toBe('');
    expect(out?.category).toBe('other');
    expect(out?.price).toBe(0);
    expect(out?.priceUsd).toBeUndefined();
  });

  it('ignores non-finite/garbage numerics', () => {
    const out = mapApiProduct({ id: 'p4', name: 'N', price_usd: 'free', rating: NaN, downloads: '5' });
    expect(out?.price).toBe(0);
    expect(out?.rating).toBe(0);
    expect(out?.downloads).toBe(0);
  });
});
