import { Address } from '@ton/core';
import { logger } from '../../logger.js';
import { getTonClient } from './tonClient.js';

export interface OracleRefundInput {
  escrowAddress: string;
}

export interface OracleRefundResult {
  txSeqno: number;
}

/**
 * DEPRECATED / UNSUPPORTED. The escrow contract (contracts/src/escrow.tact)
 * has no oracle-triggered refund receiver. The only pre-mint refund is
 * `RefundIfNotMinted` (0x5a8e1f23), which the contract requires to be sent by
 * the BUYER (`sender() == self.buyer`) after the mint grace period — the
 * oracle cannot trigger it.
 *
 * A previous implementation broadcast an invented `OracleRefund` opcode
 * (0xbf21e1ee) that silently bounced on-chain while the DB was optimistically
 * marked `refund_pending`, stranding buyers in a state that never settled. We
 * now fail loudly so the caller surfaces the real path instead.
 */
export async function oracleRefund(_input: OracleRefundInput): Promise<OracleRefundResult> {
  throw new Error(
    'ORACLE_REFUND_UNSUPPORTED: escrow has no oracle refund receiver; ' +
      'the buyer must call RefundIfNotMinted after the mint grace period',
  );
}

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
