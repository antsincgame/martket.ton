import { describe, expect, it } from 'vitest';
import { decideRefundClaim, MINT_GRACE_SEC, REFUND_CLAIM_GAS_NANO } from './refundClaim.js';
import { LICENSE_STATE } from './constants.js';
import type { LicenseRecord } from './licenseRepository.js';

const NOW = Date.parse('2026-06-08T12:00:00.000Z');
const GRACE_MS = MINT_GRACE_SEC * 1000;
const CREATED_BEFORE_GRACE = new Date(NOW - GRACE_MS - 60_000).toISOString();

function license(overrides: Partial<LicenseRecord> = {}): LicenseRecord {
  return {
    $id: 'lic1',
    orderId: 'ord1',
    listingId: 'lst1',
    catalogProductId: '',
    buyerWallet: 'EQbuyer',
    sellerWallet: 'EQseller',
    escrowAddress: 'EQescrow',
    collectionAddress: 'EQcoll',
    nftAddress: '',
    mintTxHash: '',
    burnTxHash: '',
    refundTxHash: '',
    refundReason: '',
    mintQueryId: '',
    mintError: 'POLL_TIMEOUT',
    state: LICENSE_STATE.MINT_FAILED,
    mintAttempts: 3,
    collectionIndex: 0,
    trialEndsAt: null,
    mintedAt: null,
    lastMintAttemptAt: null,
    burnedAt: null,
    refundedAt: null,
    releasedAt: null,
    $createdAt: CREATED_BEFORE_GRACE,
    $updatedAt: CREATED_BEFORE_GRACE,
    ...overrides,
  };
}

describe('decideRefundClaim — buyer-claim refund gate', () => {
  it('claimable: mint_failed, escrow funded, no NFT, grace elapsed', () => {
    const d = decideRefundClaim(license(), NOW);
    expect(d.claimable).toBe(true);
    expect(d.code).toBe('CLAIMABLE');
    expect(d.availableAt).toBe(new Date(Date.parse(CREATED_BEFORE_GRACE) + GRACE_MS).toISOString());
  });

  it('claimable from the refund_claimable state too', () => {
    expect(decideRefundClaim(license({ state: LICENSE_STATE.REFUND_CLAIMABLE }), NOW).claimable).toBe(true);
  });

  it('NOT claimable before the grace period elapses — but returns availableAt', () => {
    const fresh = license({ $createdAt: new Date(NOW - 60_000).toISOString() }); // 1 min ago
    const d = decideRefundClaim(fresh, NOW);
    expect(d.claimable).toBe(false);
    expect(d.code).toBe('GRACE_NOT_ELAPSED');
    expect(d.availableAt).toBe(new Date(NOW - 60_000 + GRACE_MS).toISOString());
  });

  it('NOT claimable once an NFT is registered (buyer must BuyerBurn)', () => {
    expect(decideRefundClaim(license({ nftAddress: 'EQnft' }), NOW).code).toBe('ALREADY_MINTED');
  });

  it('NOT claimable when a refund is already pending or complete', () => {
    expect(decideRefundClaim(license({ state: LICENSE_STATE.REFUND_PENDING }), NOW).code).toBe('ALREADY_REFUNDED');
    expect(decideRefundClaim(license({ state: LICENSE_STATE.REFUNDED }), NOW).code).toBe('ALREADY_REFUNDED');
  });

  it('NOT claimable for non-refundable states (mint_pending / minted)', () => {
    expect(decideRefundClaim(license({ state: LICENSE_STATE.MINT_PENDING }), NOW).code).toBe('NOT_REFUNDABLE_STATE');
    expect(decideRefundClaim(license({ state: LICENSE_STATE.MINTED }), NOW).code).toBe('NOT_REFUNDABLE_STATE');
  });

  it('NOT claimable without an escrow address', () => {
    expect(decideRefundClaim(license({ escrowAddress: '' }), NOW).code).toBe('NO_ESCROW');
  });

  it('exposes the contract grace + gas constants', () => {
    expect(MINT_GRACE_SEC).toBe(600);
    expect(REFUND_CLAIM_GAS_NANO).toBe('50000000');
  });
});
