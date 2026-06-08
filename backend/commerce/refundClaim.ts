/**
 * Buyer-claim refund decision (Blocker #1).
 *
 * The escrow contract's only pre-mint refund is `RefundIfNotMinted`
 * (contracts/src/escrow.tact:167), which is BUYER-only by design
 * (`sender() == self.buyer`) and gated on:
 *   - escrow state == FUNDED
 *   - licenseAddress == zero (no NFT registered)
 *   - now > paidAt + MINT_GRACE_SEC
 * The oracle structurally cannot refund pre-mint, so when a mint never
 * completes we surface the claim to the buyer instead of looping on an
 * impossible oracle broadcast.
 *
 * This module is the PURE decision: it gates the UI/endpoint so we don't offer
 * a claim the contract would reject. The contract remains the final authority.
 */

import type { LicenseRecord } from './licenseRepository.js';
import { LICENSE_STATE } from './constants.js';

/** Must match contracts/src/escrow.tact `MINT_GRACE_SEC`. */
export const MINT_GRACE_SEC = 600;

/**
 * Gas (nano) the buyer attaches to the RefundIfNotMinted message. The escrow
 * returns its remaining balance (SendRemainingBalance), so the buyer nets the
 * escrowed funds back minus this gas. Mirrors the 0.05 TON used elsewhere
 * (ConfirmDelivery / BuyerBurn / TimeoutRelease).
 */
export const REFUND_CLAIM_GAS_NANO = '50000000';

export type RefundClaimCode =
  | 'CLAIMABLE'
  | 'GRACE_NOT_ELAPSED'
  | 'NO_ESCROW'
  | 'ALREADY_MINTED'
  | 'ALREADY_REFUNDED'
  | 'NOT_REFUNDABLE_STATE';

export interface RefundClaimDecision {
  claimable: boolean;
  /** ISO time when the on-chain grace period elapses (claim becomes valid). */
  availableAt: string | null;
  reason: string;
  code: RefundClaimCode;
}

// A claim is offered while the license is failed-but-not-yet-claimed. The
// worker refines `mint_failed` → `refund_claimable`, but the claim is valid
// from either state once the grace period passes (mint_failed is terminal for
// minting — the mint cycle only retries `mint_pending`).
const REFUNDABLE_STATES = new Set<string>([
  LICENSE_STATE.MINT_FAILED,
  LICENSE_STATE.REFUND_CLAIMABLE,
]);

/**
 * Decide whether the buyer can reclaim escrowed funds for a license whose mint
 * never completed. `nowMs` is the current epoch ms.
 *
 * The on-chain `paidAt` is approximated by the license creation time — the
 * license is created at order-confirm, immediately after the buyer's payment is
 * verified, so it is at or after the escrow's `paidAt`. The grace check is
 * therefore conservative (never offers a claim before the contract would
 * accept it).
 */
export function decideRefundClaim(license: LicenseRecord, nowMs: number): RefundClaimDecision {
  if (license.nftAddress) {
    return {
      claimable: false,
      availableAt: null,
      reason: 'License NFT already minted — use BuyerBurn to refund within the trial window.',
      code: 'ALREADY_MINTED',
    };
  }
  if (license.state === LICENSE_STATE.REFUNDED || license.state === LICENSE_STATE.REFUND_PENDING) {
    return {
      claimable: false,
      availableAt: null,
      reason: 'A refund is already in progress or has completed.',
      code: 'ALREADY_REFUNDED',
    };
  }
  if (!REFUNDABLE_STATES.has(license.state)) {
    return {
      claimable: false,
      availableAt: null,
      reason: 'License is not in a refundable state.',
      code: 'NOT_REFUNDABLE_STATE',
    };
  }
  if (!license.escrowAddress) {
    return {
      claimable: false,
      availableAt: null,
      reason: 'No escrow is associated with this license.',
      code: 'NO_ESCROW',
    };
  }

  const paidAtMs = Date.parse(license.$createdAt);
  const baseMs = Number.isFinite(paidAtMs) ? paidAtMs : nowMs;
  const availableAtMs = baseMs + MINT_GRACE_SEC * 1000;
  const availableAt = new Date(availableAtMs).toISOString();

  if (nowMs < availableAtMs) {
    return {
      claimable: false,
      availableAt,
      reason: 'The on-chain grace period has not elapsed yet.',
      code: 'GRACE_NOT_ELAPSED',
    };
  }

  return {
    claimable: true,
    availableAt,
    reason: license.mintError ? `mint_failed: ${license.mintError}` : 'The mint did not complete in time.',
    code: 'CLAIMABLE',
  };
}
