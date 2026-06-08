import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  COL_ORDERS,
  COL_ENTITLEMENTS,
  COL_LISTINGS,
  COL_LISTING_SECRETS,
  ORDER_STATE,
} from '../constants.js';

// Mock Appwrite + side-effect modules; let helpers/constants/logger run real.
const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
}));

vi.mock('../appwrite.js', () => ({
  databases: () => ({
    getDocument: mocks.getDocument,
    listDocuments: mocks.listDocuments,
    createDocument: mocks.createDocument,
    updateDocument: mocks.updateDocument,
  }),
  ID: { unique: () => 'ent_generated_id' },
  Query: { equal: (...a: unknown[]) => ['equal', ...a], limit: (n: number) => ['limit', n] },
}));
vi.mock('../audit.js', () => ({ writeAudit: vi.fn(() => Promise.resolve()) }));
vi.mock('../../core/ledgerService.js', () => ({ recordLedgerEntry: vi.fn(() => Promise.resolve()) }));

import { reconcileOrderAfterMint } from './reconcileOrderAfterMint.js';

const LICENSE = {
  orderId: 'ord1',
  listingId: 'lst1',
  buyerWallet: 'EQbuyer',
  nftAddress: 'EQnftAddress',
  escrowAddress: 'EQescrow',
};

function mockOrderState(state: string): void {
  mocks.getDocument.mockImplementation((_db: string, col: string) => {
    if (col === COL_ORDERS) {
      return Promise.resolve({ $id: 'ord1', state, amountRaw: '1700000000', listingSnapshotTitle: 'App' });
    }
    if (col === COL_LISTINGS) return Promise.resolve({ assetFileId: '', title: 'App' });
    return Promise.reject(new Error(`unexpected getDocument ${col}`));
  });
}

function mockEntitlements(documents: unknown[]): void {
  mocks.listDocuments.mockImplementation((_db: string, col: string) => {
    if (col === COL_ENTITLEMENTS) return Promise.resolve({ documents });
    if (col === COL_LISTING_SECRETS) return Promise.resolve({ documents: [{ deliveryPayload: 'secret-link' }] });
    return Promise.resolve({ documents: [] });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.LEGACY_ORDERS_OMIT_FIELDS;
  delete process.env.LEGACY_ENTITLEMENTS_OMIT_FIELDS;
  mockOrderState(ORDER_STATE.PENDING_PAYMENT);
  mockEntitlements([]);
});

describe('reconcileOrderAfterMint', () => {
  it('no-ops when orderId or nftAddress is missing', async () => {
    const r = await reconcileOrderAfterMint({ ...LICENSE, orderId: '' });
    expect(r).toEqual({ reconciled: false, orderState: null });
    expect(mocks.getDocument).not.toHaveBeenCalled();

    const r2 = await reconcileOrderAfterMint({ ...LICENSE, nftAddress: '' });
    expect(r2.reconciled).toBe(false);
  });

  it('returns reconciled:false when the order is not found', async () => {
    mocks.getDocument.mockRejectedValueOnce(new Error('404'));
    const r = await reconcileOrderAfterMint(LICENSE);
    expect(r).toEqual({ reconciled: false, orderState: null });
    expect(mocks.updateDocument).not.toHaveBeenCalled();
  });

  it('is idempotent: an already-PAID order is left untouched', async () => {
    mockOrderState(ORDER_STATE.PAID);
    const r = await reconcileOrderAfterMint(LICENSE);
    expect(r).toEqual({ reconciled: true, orderState: ORDER_STATE.PAID });
    expect(mocks.createDocument).not.toHaveBeenCalled();
    expect(mocks.updateDocument).not.toHaveBeenCalled();
  });

  it('finalizes a pending order → PAID and creates the entitlement once', async () => {
    const r = await reconcileOrderAfterMint(LICENSE);
    expect(r).toEqual({ reconciled: true, orderState: ORDER_STATE.PAID });
    expect(mocks.createDocument).toHaveBeenCalledTimes(1);
    expect(mocks.updateDocument).toHaveBeenCalledTimes(1);
    const [, col, , payload] = mocks.updateDocument.mock.calls[0]!;
    expect(col).toBe(COL_ORDERS);
    expect(payload).toMatchObject({ state: ORDER_STATE.PAID, licenseAddress: 'EQnftAddress' });
  });

  it('does not create a second entitlement when one already exists', async () => {
    mockEntitlements([{ $id: 'ent_existing' }]);
    const r = await reconcileOrderAfterMint(LICENSE);
    expect(r.reconciled).toBe(true);
    expect(mocks.createDocument).not.toHaveBeenCalled();
    expect(mocks.updateDocument).toHaveBeenCalledTimes(1);
  });

  it('honours LEGACY_ORDERS_OMIT_FIELDS by dropping the omitted field from the order write', async () => {
    process.env.LEGACY_ORDERS_OMIT_FIELDS = 'licenseAddress';
    await reconcileOrderAfterMint(LICENSE);
    const payload = mocks.updateDocument.mock.calls[0]![3] as Record<string, unknown>;
    expect(payload).toHaveProperty('state', ORDER_STATE.PAID);
    expect(payload).not.toHaveProperty('licenseAddress');
  });

  it('never re-PAIDs an already-terminal order (REFUNDED / CANCELLED)', async () => {
    for (const term of [ORDER_STATE.REFUNDED, ORDER_STATE.CANCELLED]) {
      vi.clearAllMocks();
      mockOrderState(term);
      mockEntitlements([]);
      const r = await reconcileOrderAfterMint(LICENSE);
      expect(r).toEqual({ reconciled: true, orderState: term });
      expect(mocks.createDocument).not.toHaveBeenCalled();
      expect(mocks.updateDocument).not.toHaveBeenCalled();
    }
  });

  it('treats a concurrent entitlement insert (409) as a no-op and still finalizes the order', async () => {
    mocks.createDocument.mockRejectedValueOnce({ code: 409 });
    const r = await reconcileOrderAfterMint(LICENSE);
    expect(r).toEqual({ reconciled: true, orderState: ORDER_STATE.PAID });
    expect(mocks.updateDocument).toHaveBeenCalledTimes(1); // order still finalized → PAID
  });

  it('re-throws a non-unique entitlement insert failure', async () => {
    mocks.createDocument.mockRejectedValueOnce(new Error('network down'));
    await expect(reconcileOrderAfterMint(LICENSE)).rejects.toThrow('network down');
  });
});
