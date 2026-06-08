import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  COL_SELLER_PROFILES,
  COL_LISTINGS,
  COL_ORDERS,
  COL_LICENSES,
} from '../commerce/constants.js';

const { mListDocuments } = vi.hoisted(() => ({ mListDocuments: vi.fn() }));
vi.mock('../commerce/appwrite.js', () => ({
  databases: () => ({ listDocuments: mListDocuments }),
  Query: { equal: (...a: unknown[]) => ({ equal: a }), limit: (n: number) => ({ limit: n }) },
}));
vi.mock('../core/profileRepository.js', () => ({ findUserByTonAddress: vi.fn() }));
vi.mock('../core/productRepository.js', () => ({ listProductsByCreator: vi.fn() }));

import { buildAgentStatus } from './status.js';
import { findUserByTonAddress } from '../core/profileRepository.js';
import { listProductsByCreator } from '../core/productRepository.js';

const mFindUser = findUserByTonAddress as unknown as ReturnType<typeof vi.fn>;
const mListProducts = listProductsByCreator as unknown as ReturnType<typeof vi.fn>;

const WALLET = 'EQseller';

beforeEach(() => {
  vi.clearAllMocks();
  mListDocuments.mockImplementation(async (_dbId: string, collectionId: string) => {
    switch (collectionId) {
      case COL_SELLER_PROFILES:
        return { documents: [{ wallet: WALLET, kyc_status: 'approved', storage_status: 'connected', storage_provider: 'r2' }], total: 1 };
      case COL_LISTINGS:
        return { documents: [{ $id: 'l1', status: 'active', distribution_kind: 'r2', distribution_state: 'verified' }], total: 1 };
      case COL_ORDERS:
        return { documents: [{ state: 'paid' }, { state: 'paid' }, { state: 'pending_payment' }], total: 3 };
      case COL_LICENSES:
        return { documents: [{ state: 'minted' }, { state: 'minted' }, { state: 'mint_pending' }], total: 3 };
      default:
        return { documents: [], total: 0 };
    }
  });
  mFindUser.mockResolvedValue({ id: 'creator-1' });
  mListProducts.mockResolvedValue([{ scanStatus: 'clean' }, { scanStatus: 'clean' }, { scanStatus: 'pending' }]);
});

describe('buildAgentStatus — license + scan aggregates (Phase 0.3)', () => {
  it('aggregates licenses by lifecycle state (via License.sellerWallet)', async () => {
    const s = await buildAgentStatus(WALLET);
    expect(s.licenses.total).toBe(3);
    expect(s.licenses.byState).toEqual({ minted: 2, mint_pending: 1 });
  });

  it('aggregates authored products by scan status (via creator_id)', async () => {
    const s = await buildAgentStatus(WALLET);
    expect(s.products.total).toBe(3);
    expect(s.products.byScanStatus).toEqual({ clean: 2, pending: 1 });
  });

  it('still returns listing/order aggregates and onboarding', async () => {
    const s = await buildAgentStatus(WALLET);
    expect(s.listings.byStatus).toEqual({ active: 1 });
    expect(s.orders.byState).toEqual({ paid: 2, pending_payment: 1 });
    expect(s.onboarding.kyc.ok).toBe(true);
  });

  it('degrades gracefully when no catalog profile is linked', async () => {
    mFindUser.mockResolvedValue(null);
    const s = await buildAgentStatus(WALLET);
    expect(s.products).toEqual({ total: 0, byScanStatus: {} });
    expect(s.licenses.total).toBe(3); // licenses still aggregate
  });
});
