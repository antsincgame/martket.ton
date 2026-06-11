import { describe, it, expect } from 'vitest';
import { effectiveSellerPriceRaw, isSaleActive } from './money.js';

const LIST = '1000000000'; // 1 TON
const SALE = '700000000'; // 0.7 TON
const NOW = Date.parse('2026-06-11T00:00:00.000Z');

describe('effectiveSellerPriceRaw / isSaleActive', () => {
  it('uses the sale price when active (no end date)', () => {
    const l = { priceAmountRaw: LIST, sale_price_amount_raw: SALE, sale_ends_at: null };
    expect(isSaleActive(l, NOW)).toBe(true);
    expect(effectiveSellerPriceRaw(l, NOW)).toBe(SALE);
  });

  it('uses the sale price when the end is in the future', () => {
    const l = { priceAmountRaw: LIST, sale_price_amount_raw: SALE, sale_ends_at: '2026-12-31T00:00:00.000Z' };
    expect(effectiveSellerPriceRaw(l, NOW)).toBe(SALE);
  });

  it('falls back to list when the sale has expired', () => {
    const l = { priceAmountRaw: LIST, sale_price_amount_raw: SALE, sale_ends_at: '2026-01-01T00:00:00.000Z' };
    expect(isSaleActive(l, NOW)).toBe(false);
    expect(effectiveSellerPriceRaw(l, NOW)).toBe(LIST);
  });

  it('ignores a sale that is not below the list price (safety)', () => {
    const l = { priceAmountRaw: LIST, sale_price_amount_raw: '1200000000', sale_ends_at: null };
    expect(isSaleActive(l, NOW)).toBe(false);
    expect(effectiveSellerPriceRaw(l, NOW)).toBe(LIST);
  });

  it('falls back to list when there is no sale or a garbage value', () => {
    expect(effectiveSellerPriceRaw({ priceAmountRaw: LIST, sale_price_amount_raw: null }, NOW)).toBe(LIST);
    expect(effectiveSellerPriceRaw({ priceAmountRaw: LIST, sale_price_amount_raw: 'abc' }, NOW)).toBe(LIST);
    expect(isSaleActive({ priceAmountRaw: LIST, sale_price_amount_raw: '0' }, NOW)).toBe(false);
  });
});
