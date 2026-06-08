import { describe, it, expect } from 'vitest';
import { filterProductsByQuery } from './productRepository.js';
import type { Product } from '../domain/types.js';

// filterProductsByQuery only reads name/shortDescription/description/category,
// so partial fixtures cast to Product keep the cases readable.
function p(partial: Partial<Product>): Product {
  return partial as Product;
}

const products = [
  p({ name: 'Neon Dashboard', shortDescription: 'analytics UI', description: 'charts', category: 'tools' }),
  p({ name: 'Forge CLI', shortDescription: 'build tool', description: 'compiles tact', category: 'dev' }),
  p({ name: 'Mars Theme', shortDescription: 'red palette', description: 'dark mode', category: 'design' }),
];

describe('filterProductsByQuery — degraded-mode search matcher', () => {
  it('matches by name, case-insensitively', () => {
    expect(filterProductsByQuery(products, 'forge', 50).map((x) => x.name)).toEqual(['Forge CLI']);
    expect(filterProductsByQuery(products, 'NEON', 50).map((x) => x.name)).toEqual(['Neon Dashboard']);
  });

  it('matches across short-description, description, and category', () => {
    expect(filterProductsByQuery(products, 'analytics', 50).map((x) => x.name)).toEqual(['Neon Dashboard']);
    expect(filterProductsByQuery(products, 'tact', 50).map((x) => x.name)).toEqual(['Forge CLI']);
    expect(filterProductsByQuery(products, 'design', 50).map((x) => x.name)).toEqual(['Mars Theme']);
  });

  it('returns [] for an empty or whitespace-only query', () => {
    expect(filterProductsByQuery(products, '', 50)).toEqual([]);
    expect(filterProductsByQuery(products, '   ', 50)).toEqual([]);
  });

  it('trims surrounding whitespace before matching', () => {
    expect(filterProductsByQuery(products, '  forge  ', 50).map((x) => x.name)).toEqual(['Forge CLI']);
  });

  it('excludes non-matches', () => {
    expect(filterProductsByQuery(products, 'zzz-not-found', 50)).toEqual([]);
  });

  it('caps results at max', () => {
    const reds = [
      p({ name: 'red one' }), p({ name: 'red two' }), p({ name: 'red three' }),
    ];
    expect(filterProductsByQuery(reds, 'red', 2)).toHaveLength(2);
    expect(filterProductsByQuery(reds, 'red', 0)).toHaveLength(0);
  });
});
