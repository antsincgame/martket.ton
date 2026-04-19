import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE importing the SUT so the mocks take effect.
vi.mock('../licenseRepository.js', () => ({
  createLicense: vi.fn(),
  countLicensesForCollection: vi.fn(),
  findLicenseByOrderId: vi.fn(),
}));
vi.mock('../../tonforge/mintWorker.js', () => ({
  triggerMintLoop: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  ensureLicenseForOrder,
  ListingNoCollectionError,
} from './ensureLicenseForOrder.js';
import {
  createLicense,
  countLicensesForCollection,
  findLicenseByOrderId,
} from '../licenseRepository.js';
import { triggerMintLoop } from '../../tonforge/mintWorker.js';
import { LICENSE_STATE } from '../constants.js';

const VALID_COLLECTION = 'EQAaaa_aaa_aaa_aaa_aaa_aaa_aaa_aaa_aaa_aaa_aaa_a';

const fakeLicense = {
  $id: 'lic_1',
  state: LICENSE_STATE.MINT_PENDING,
} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureLicenseForOrder', () => {
  const order = { $id: 'ord_1', listingId: 'lst_1', buyerWallet: 'EQbuyer' };

  it('returns existing license without creating a new one', async () => {
    (findLicenseByOrderId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(fakeLicense);
    const result = await ensureLicenseForOrder(
      order,
      { collection_address: VALID_COLLECTION },
      '2099-01-01T00:00:00.000Z',
    );
    expect(result).toBe(fakeLicense);
    expect(createLicense).not.toHaveBeenCalled();
    expect(triggerMintLoop).not.toHaveBeenCalled();
  });

  it('throws ListingNoCollectionError when collection_address is missing', async () => {
    (findLicenseByOrderId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      ensureLicenseForOrder(order, {}, '2099-01-01T00:00:00.000Z'),
    ).rejects.toBeInstanceOf(ListingNoCollectionError);
    expect(createLicense).not.toHaveBeenCalled();
  });

  it('throws ListingNoCollectionError when collection_address is whitespace', async () => {
    (findLicenseByOrderId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      ensureLicenseForOrder(order, { collection_address: '   ' }, '2099-01-01T00:00:00.000Z'),
    ).rejects.toBeInstanceOf(ListingNoCollectionError);
  });

  it('creates license in MINT_PENDING and triggers mint loop', async () => {
    (findLicenseByOrderId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (countLicensesForCollection as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(7);
    (createLicense as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(fakeLicense);

    const result = await ensureLicenseForOrder(
      order,
      {
        collection_address: VALID_COLLECTION,
        catalogProductId: 'cat_1',
        sellerWallet: 'EQseller',
      },
      '2099-01-01T00:00:00.000Z',
    );

    expect(createLicense).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ord_1',
        listingId: 'lst_1',
        buyerWallet: 'EQbuyer',
        collectionAddress: VALID_COLLECTION,
        collectionIndex: 7,
        initialState: LICENSE_STATE.MINT_PENDING,
      }),
    );
    expect(triggerMintLoop).toHaveBeenCalled();
    expect(result).toBe(fakeLicense);
  });

  it('still creates license when countLicensesForCollection rejects (defaults to 0)', async () => {
    (findLicenseByOrderId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (countLicensesForCollection as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    (createLicense as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(fakeLicense);

    const result = await ensureLicenseForOrder(
      order,
      { collection_address: VALID_COLLECTION },
      '2099-01-01T00:00:00.000Z',
    );

    expect(result).toBe(fakeLicense);
    expect(createLicense).toHaveBeenCalledWith(
      expect.objectContaining({ collectionIndex: 0 }),
    );
  });
});
