import { Address, internal, SendMode } from '@ton/core';
import { logger } from '../../logger.js';
import { loadOnchainConfig } from './config.js';
import { getOracleWallet } from './oracleWallet.js';
import { getTonClient } from './tonClient.js';
import { buildOracleRefundPayload } from './contractSchemas.js';

export interface OracleRefundInput {
  escrowAddress: string;
}

export interface OracleRefundResult {
  txSeqno: number;
}

/**
 * Treasury (oracle wallet acts as treasury here) sends OracleRefund to the
 * Escrow. Contract enforces:
 *   - escrow.state == FUNDED
 *   - sender == treasury
 *   - no LicenseItem has been registered yet (licenseAddress == zero)
 *
 * On success the escrow self-destructs and forwards its full balance
 * back to the buyer. Used by mintWorker when a license never made it
 * on-chain after MAX_ATTEMPTS.
 */
export async function oracleRefund(input: OracleRefundInput): Promise<OracleRefundResult> {
  const cfg = loadOnchainConfig();
  if (!cfg.enabled) {
    throw new Error('ONCHAIN_DISABLED');
  }

  const escrow = Address.parse(input.escrowAddress);
  const payload = buildOracleRefundPayload();

  const oracle = await getOracleWallet();
  const seqno = await oracle.wallet.getSeqno();
  await oracle.wallet.sendTransfer({
    seqno,
    secretKey: oracle.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [
      internal({
        to: escrow,
        value: 50_000_000n,
        bounce: true,
        body: payload,
      }),
    ],
  });

  logger.info(`[onchain.refund] sent OracleRefund escrow=${escrow.toString()} seqno=${seqno}`);
  return { txSeqno: seqno };
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
