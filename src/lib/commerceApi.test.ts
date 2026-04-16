import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { commerceUrl } from './commerceApi';

beforeEach(() => {
  vi.stubEnv('VITE_COMMERCE_API_URL', 'http://localhost:8081');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('commerceUrl', () => {
  it('builds URL with /api/v1/commerce prefix', () => {
    expect(commerceUrl('/config')).toBe('http://localhost:8081/api/v1/commerce/config');
  });

  it('adds leading slash if missing', () => {
    expect(commerceUrl('sellers/register')).toBe(
      'http://localhost:8081/api/v1/commerce/sellers/register',
    );
  });

  it('handles custom base URL', () => {
    vi.stubEnv('VITE_COMMERCE_API_URL', 'https://api.prod.com/');
    expect(commerceUrl('/listings')).toBe('https://api.prod.com/api/v1/commerce/listings');
  });

  it('handles path with query params', () => {
    expect(commerceUrl('/orders/abc123')).toBe(
      'http://localhost:8081/api/v1/commerce/orders/abc123',
    );
  });

  it('handles empty path', () => {
    expect(commerceUrl('/')).toBe('http://localhost:8081/api/v1/commerce/');
  });

  it('preserves URL encoding in path segments', () => {
    expect(commerceUrl('/sellers/EQ%2Btest/listings')).toBe(
      'http://localhost:8081/api/v1/commerce/sellers/EQ%2Btest/listings',
    );
  });
});
