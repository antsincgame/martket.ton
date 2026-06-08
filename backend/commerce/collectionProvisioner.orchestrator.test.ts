import { describe, it, expect, vi, beforeEach } from 'vitest';

// The pure helpers (deriveAppId, buildSellerMetadataUris, buildOffchainContent)
// are covered in collectionProvisioner.test.ts. Here we pin the ORCHESTRATOR's
// deterministic branches — the config gate and the idempotent short-circuit —
// which need no Tact build artifact and no network. The deploy path itself is
// testnet-verified via the runbook (it requires the artifact + a funded wallet).

vi.mock('../config/network.js', () => ({ getNetworkConfig: vi.fn() }));
vi.mock('./sellerCollectionRepository.js', () => ({
  findSellerCollection: vi.fn(),
  upsertPendingCollection: vi.fn(),
  markDeployed: vi.fn(),
  markFailed: vi.fn(),
}));

import { provisionSellerCollection, ProvisionConfigError } from './collectionProvisioner.js';
import { getNetworkConfig } from '../config/network.js';
import { findSellerCollection, upsertPendingCollection } from './sellerCollectionRepository.js';

const mCfg = getNetworkConfig as unknown as ReturnType<typeof vi.fn>;
const mFind = findSellerCollection as unknown as ReturnType<typeof vi.fn>;
const mUpsert = upsertPendingCollection as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('provisionSellerCollection — config gate + idempotency', () => {
  it('throws ProvisionConfigError when COLLECTION_OWNER is unconfigured (no deploy attempted)', async () => {
    mCfg.mockReturnValue({ collectionOwnerMnemonic: '', collectionOwnerAddress: '' });
    await expect(provisionSellerCollection('EQseller', 'testnet')).rejects.toBeInstanceOf(ProvisionConfigError);
    expect(mFind).not.toHaveBeenCalled();
  });

  it('throws ProvisionConfigError when only the mnemonic is missing', async () => {
    mCfg.mockReturnValue({ collectionOwnerMnemonic: '', collectionOwnerAddress: 'EQowner' });
    await expect(provisionSellerCollection('EQseller', 'testnet')).rejects.toBeInstanceOf(ProvisionConfigError);
  });

  it('short-circuits to alreadyDeployed for a seller whose collection is already on-chain', async () => {
    mCfg.mockReturnValue({ collectionOwnerMnemonic: 'word word word', collectionOwnerAddress: 'EQowner' });
    mFind.mockResolvedValue({
      $id: 'rec1',
      status: 'deployed',
      collectionAddress: 'EQexistingCollection',
      appId: '777',
    });

    const result = await provisionSellerCollection('EQseller', 'testnet');

    expect(result).toEqual({
      collectionAddress: 'EQexistingCollection',
      status: 'deployed',
      alreadyDeployed: true,
      appId: '777',
    });
    // The deploy path (record intent → on-chain deploy) is never entered.
    expect(mUpsert).not.toHaveBeenCalled();
  });
});
