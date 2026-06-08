import { Address } from '@ton/core';
import { logger } from '../../logger.js';
import { getTonClient } from './tonClient.js';

/**
 * NOTE: there is intentionally NO oracle-triggered refund. The escrow contract
 * (contracts/src/escrow.tact) has no oracle refund receiver — the only pre-mint
 * refund is `RefundIfNotMinted` (0x5a8e1f23), which the contract requires to be
 * sent by the BUYER (`sender() == self.buyer`) after the mint grace period. The
 * mint worker therefore marks a stuck license `refund_claimable` and the buyer
 * reclaims the funds from their library (see backend/commerce/refundClaim.ts).
 *
 * This module keeps only the on-chain settle poller used to confirm an escrow
 * has self-destructed.
 */

export interface PollEscrowSettledOpts {
  escrowAddress: string;
  /** Total wait in ms; default 60s. */
  timeoutMs?: number;
  /** Interval in ms; default 3s. */
  intervalMs?: number;
}

/**
 * After a successful OracleRefund the escrow self-destructs. We consider
 * the refund settled when the contract is no longer in `active` state
 * (`uninit` / `frozen` / `nonexistent` mean it sent out its balance and
 * destroyed itself).
 *
 * Returns `true` on success, `false` on timeout (caller should retry next tick).
 */
export async function pollEscrowSettled(opts: PollEscrowSettledOpts): Promise<boolean> {
  const timeout = opts.timeoutMs ?? 60_000;
  const interval = opts.intervalMs ?? 3_000;
  const deadline = Date.now() + timeout;
  const addr = Address.parse(opts.escrowAddress);
  const client = getTonClient();

  while (Date.now() < deadline) {
    try {
      const state = await client.getContractState(addr);
      if (state.state !== 'active') {
        return true;
      }
    } catch (err) {
      logger.warn('[onchain.refund] settle poll attempt failed:', err);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}
