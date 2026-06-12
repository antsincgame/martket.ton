import { describe, it, expect } from 'vitest';
import { computeBestsellers, type OrderForBestseller } from './bestsellers.js';

const L2C = new Map<string, string>([
  ['lstA', 'prodA'],
  ['lstA2', 'prodA'], // two listings of the same product
  ['lstB', 'prodB'],
  ['lstOrphan', ''], // no catalog mapping (empty)
]);

function o(p: Partial<OrderForBestseller>): OrderForBestseller {
  return { state: 'paid', listingId: 'lstA', createdAt: '2026-06-01T00:00:00.000Z', buyerWallet: 'EQbuyer', ...p };
}

describe('computeBestsellers', () => {
  it('counts paid/fulfilled per catalog product across listings, ranked', () => {
    const ranked = computeBestsellers(
      [
        o({ listingId: 'lstA', state: 'paid' }),
        o({ listingId: 'lstA2', state: 'fulfilled' }), // same product prodA
        o({ listingId: 'lstB', state: 'paid' }),
        o({ listingId: 'lstA', state: 'pending_payment' }), // not a sale
        o({ listingId: 'lstA', state: 'refunded' }), // not a sale
      ],
      L2C,
    );
    expect(ranked[0]).toEqual({ catalogProductId: 'prodA', salesCount: 2 });
    expect(ranked[1]).toEqual({ catalogProductId: 'prodB', salesCount: 1 });
  });

  it('skips orders whose listing has no catalog mapping', () => {
    const ranked = computeBestsellers([o({ listingId: 'lstOrphan' }), o({ listingId: 'lstUnknown' })], L2C);
    expect(ranked).toEqual([]);
  });

  it('honors the time window', () => {
    const ranked = computeBestsellers(
      [
        o({ listingId: 'lstA', createdAt: '2026-01-01T00:00:00.000Z' }), // old
        o({ listingId: 'lstB', createdAt: '2026-06-10T00:00:00.000Z' }), // recent
      ],
      L2C,
      { sinceIso: '2026-06-01T00:00:00.000Z' },
    );
    expect(ranked).toEqual([{ catalogProductId: 'prodB', salesCount: 1 }]);
  });

  it('excludes self-purchases (buyer == listing seller) from the rank', () => {
    const listingToSeller = new Map<string, string>([['lstA', 'EQalice'], ['lstB', 'EQbob']]);
    const ranked = computeBestsellers(
      [
        o({ listingId: 'lstA', buyerWallet: 'EQalice' }), // seller buying own → excluded
        o({ listingId: 'lstA', buyerWallet: 'EQreal' }),  // real buyer → counts
        o({ listingId: 'lstB', buyerWallet: 'EQbob' }),   // seller buying own → excluded
      ],
      L2C,
      { listingToSeller },
    );
    expect(ranked).toEqual([{ catalogProductId: 'prodA', salesCount: 1 }]);
  });

  it('applies the limit', () => {
    const ranked = computeBestsellers(
      [o({ listingId: 'lstA' }), o({ listingId: 'lstB' })],
      L2C,
      { limit: 1 },
    );
    expect(ranked).toHaveLength(1);
  });
});
