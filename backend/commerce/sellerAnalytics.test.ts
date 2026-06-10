import { describe, it, expect } from 'vitest';
import { computeSellerAnalytics, type OrderForAnalytics } from './sellerAnalytics.js';

function order(p: Partial<OrderForAnalytics>): OrderForAnalytics {
  return {
    state: 'paid',
    amountRaw: '1025000000', // 1.025 TON buyer total
    sellerNetAmountRaw: '1000000000', // 1 TON seller cut
    listingId: 'lst1',
    title: 'Product One',
    ...p,
  };
}

describe('computeSellerAnalytics', () => {
  it('counts only paid/fulfilled as sales and splits revenue', () => {
    const a = computeSellerAnalytics([
      order({ state: 'paid' }),
      order({ state: 'fulfilled' }),
      order({ state: 'pending_payment' }),
      order({ state: 'refunded' }),
      order({ state: 'cancelled' }),
    ]);
    expect(a.totals.salesCount).toBe(2);
    // gross = 2 * 1.025, net = 2 * 1.0, fees = gross - net = 0.05
    expect(a.totals.grossRevenueTonRaw).toBe('2050000000');
    expect(a.totals.sellerNetTonRaw).toBe('2000000000');
    expect(a.totals.platformFeesTonRaw).toBe('50000000');
    expect(a.totals.refundsCount).toBe(1);
    expect(a.totals.refundedTonRaw).toBe('1025000000');
    expect(a.totals.pendingCount).toBe(1);
    expect(a.byState).toEqual({ paid: 1, fulfilled: 1, pending_payment: 1, refunded: 1, cancelled: 1 });
  });

  it('ranks top products by sales count', () => {
    const a = computeSellerAnalytics([
      order({ listingId: 'A', title: 'Alpha', state: 'paid' }),
      order({ listingId: 'A', title: 'Alpha', state: 'fulfilled' }),
      order({ listingId: 'B', title: 'Beta', state: 'paid' }),
      order({ listingId: 'A', title: 'Alpha', state: 'pending_payment' }), // not a sale
    ]);
    expect(a.topProducts[0]).toMatchObject({ listingId: 'A', title: 'Alpha', salesCount: 2 });
    expect(a.topProducts[1]).toMatchObject({ listingId: 'B', salesCount: 1 });
  });

  it('is safe on empty input and malformed amounts', () => {
    expect(computeSellerAnalytics([]).totals.salesCount).toBe(0);
    const a = computeSellerAnalytics([order({ amountRaw: 'not-a-number', sellerNetAmountRaw: '' })]);
    expect(a.totals.grossRevenueTonRaw).toBe('0');
    expect(a.totals.salesCount).toBe(1);
  });
});
