import { Address } from '@ton/core';
import { logger } from '../../logger.js';
import { loadOnchainConfig } from './config.js';
import { sendFromOracle } from './oracleWallet.js';
import { getTonClient } from './tonClient.js';
import { buildTimeoutReleasePayload } from './contractSchemas.js';

export interface TimeoutReleaseInput {
  escrowAddress: string;
}

export interface TimeoutReleaseResult {
  txSeqno: number;
}

/**
 * Anyone (including the oracle wallet) can send TimeoutRelease to an Escrow
 * after the trial window expires. The contract enforces:
 *   - state == FUNDED (1)
 *   - now() > paidAt + trialWindowSec
 * On success the escrow:
 *   - sends `amountNano - fee` to the seller
 *   - sends remaining balance (incl. platform fee) to the treasury
 *   - self-destructs (state = RELEASED = 3)
 *
 * Used by the periodic seller-payout cron in mintWorker.
 */
export async function timeoutRelease(input: TimeoutReleaseInput): Promise<TimeoutReleaseResult> {
  const cfg = loadOnchainConfig();
  if (!cfg.enabled) {
    throw new Error('ONCHAIN_DISABLED');
  }

  const escrow = Address.parse(input.escrowAddress);
  const payload = buildTimeoutReleasePayload();

  // Serialized through the single-flight oracle wallet (H-3) so a payout never
  // collides on seqno with an on-demand mint.
  const seqno = await sendFromOracle([
    { to: escrow, value: 50_000_000n /* 0.05 TON for gas */, bounce: true, body: payload },
  ]);

  logger.info(`[onchain.release] sent TimeoutRelease escrow=${escrow.toString()} seqno=${seqno}`);
  return { txSeqno: seqno };
}

export interface CheckEscrowFundedOpts {
  escrowAddress: string;
}

/**
 * Returns the on-chain state of an escrow contract:
 *   - 'active'      → contract still exists (state could be 0/1/etc.)
 *   - 'destroyed'   → contract released or refunded → self-destructed
 *   - 'unknown'     → query failed
 *
 * Used to detect whether a release has already settled.
 */
export async function checkEscrowAlive(
  opts: CheckEscrowFundedOpts,
): Promise<'active' | 'destroyed' | 'unknown'> {
  try {
    const client = getTonClient();
    const addr = Address.parse(opts.escrowAddress);
    const state = await client.getContractState(addr);
    return state.state === 'active' ? 'active' : 'destroyed';
  } catch (err) {
    logger.warn('[onchain.release] checkEscrowAlive failed:', err instanceof Error ? err.message : err);
    return 'unknown';
  }
}
