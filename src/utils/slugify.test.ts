import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('converts latin text to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('transliterates cyrillic characters', () => {
    expect(slugify('Привет мир')).toBe('privet-mir');
  });

  it('handles mixed cyrillic and latin', () => {
    expect(slugify('Мой App Store')).toBe('moy-app-store');
  });

  it('removes leading and trailing hyphens', () => {
    expect(slugify('  Hello  ')).toBe('hello');
  });

  it('collapses multiple hyphens into one', () => {
    expect(slugify('foo   bar   baz')).toBe('foo-bar-baz');
  });

  it('removes special characters', () => {
    expect(slugify('Hello! @World# $%^&*()')).toBe('hello-world');
  });

  it('returns "developer" for empty string', () => {
    expect(slugify('')).toBe('developer');
  });

  it('returns "developer" for string with only special characters', () => {
    expect(slugify('!@#$%')).toBe('developer');
  });

  it('handles numbers correctly', () => {
    expect(slugify('Product 123')).toBe('product-123');
  });

  it('handles ё correctly', () => {
    expect(slugify('ёжик')).toBe('yozhik');
  });

  it('handles щ and ш correctly', () => {
    expect(slugify('щётка шапка')).toBe('shchyotka-shapka');
  });
});
