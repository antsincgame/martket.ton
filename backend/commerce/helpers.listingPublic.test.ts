import { describe, it, expect } from 'vitest';
import { mapListingPublic } from './helpers.js';
import { DEFAULT_PLATFORM_FEE_BPS } from './constants.js';
import { computeOrderAmounts } from './money.js';
import type { AppwriteDoc } from '../domain/appwrite-helpers.js';

const SELLER_RAW = '1000000000'; // 1 TON

function listingDoc(over: Record<string, unknown> = {}): AppwriteDoc {
  return {
    $id: 'lst1',
    sellerWallet: 'EQseller',
    catalogProductId: 'prod1',
    title: 'Thing',
    description: 'desc',
    currency: 'TON',
    priceAmountRaw: SELLER_RAW,
    priceUsd: '5',
    decimals: 9,
    platformFeeBps: DEFAULT_PLATFORM_FEE_BPS,
    status: 'active',
    deliveryType: 'file',
    ...over,
  } as unknown as AppwriteDoc;
}

describe('mapListingPublic — buyer-total enrichment', () => {
  it('exposes the authoritative buyer total = seller price + clamped fee', () => {
    const out = mapListingPublic(listingDoc());
    const expected = computeOrderAmounts(SELLER_RAW, DEFAULT_PLATFORM_FEE_BPS);
    expect(out.platformFeeRaw).toBe(expected.feeNano);
    expect(out.buyerTotalRaw).toBe(expected.totalAmountNano);
    expect(out.effectivePlatformFeeBps).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(typeof out.buyerTotalTonHuman).toBe('string');
  });

  it('clamps a below-minimum fee up to the platform default (K-2 parity)', () => {
    const out = mapListingPublic(listingDoc({ platformFeeBps: 0 }));
    const expected = computeOrderAmounts(SELLER_RAW, DEFAULT_PLATFORM_FEE_BPS);
    // stored 0 is clamped to the platform minimum for the buyer total…
    expect(out.effectivePlatformFeeBps).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(out.buyerTotalRaw).toBe(expected.totalAmountNano);
    // …while the raw stored value is still surfaced unchanged, for transparency.
    expect(out.platformFeeBps).toBe(0);
  });

  it('does not compute a TON total for a missing price', () => {
    const out = mapListingPublic(listingDoc({ priceAmountRaw: '' }));
    expect(out.buyerTotalRaw).toBeNull();
    expect(out.platformFeeTonHuman).toBeNull();
  });
});
