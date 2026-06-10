import { internal, SendMode, type Address, type Cell } from '@ton/core';
import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, type OpenedContract } from '@ton/ton';
import { logger } from '../../logger.js';
import { loadOnchainConfig } from './config.js';
import { getTonClient } from './tonClient.js';

interface OracleHandle {
  wallet: OpenedContract<WalletContractV4>;
  publicKey: Buffer;
  secretKey: Buffer;
}

let cached: OracleHandle | null = null;

// ─── Single-flight oracle wallet (H-3) ───────────────────────────────
//
// The oracle wallet is ONE WalletContractV4 with one monotonic seqno. Two
// concurrent sends (e.g. an on-demand mint fired by order-confirm racing the
// periodic payout cycle) each read the same seqno N and broadcast with it; the
// wallet accepts one external message and silently drops the other, so a mint
// or a seller payout never executes (yet the code thinks it sent). The previous
// "serialization" fix only chained the three cycles inside ONE worker tick — it
// did not cover the on-demand trigger.
//
// Every oracle send now goes through `sendFromOracle`, which serializes via an
// in-process promise chain AND waits for the seqno to actually increment before
// releasing — guaranteeing the next send reads a fresh seqno. (Cross-replica
// safety additionally requires a single worker replica or a distributed
// 'oracle-wallet' lock around this section.)
let oracleChain: Promise<unknown> = Promise.resolve();

export interface OracleMessage {
  to: Address;
  value: bigint;
  bounce: boolean;
  body: Cell;
}

/** Serialize an async oracle operation against all other oracle operations. */
export function runOracleExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = oracleChain.then(fn, fn);
  // Keep the chain alive regardless of this op's outcome.
  oracleChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function waitForSeqnoBump(
  wallet: OpenedContract<WalletContractV4>,
  prevSeqno: number,
  timeoutMs = 30_000,
  intervalMs = 1_500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const s = await wallet.getSeqno();
      if (s > prevSeqno) return;
    } catch {
      // transient RPC error — retry until deadline
    }
  }
  logger.warn(`[onchain.oracle] seqno did not bump from ${prevSeqno} within ${timeoutMs}ms`);
}

/**
 * Send one external message (carrying `messages` internal transfers) from the
 * oracle wallet, serialized so seqnos never collide. Returns the seqno used.
 */
export async function sendFromOracle(messages: OracleMessage[]): Promise<number> {
  return runOracleExclusive(async () => {
    const oracle = await getOracleWallet();
    const seqno = await oracle.wallet.getSeqno();
    await oracle.wallet.sendTransfer({
      seqno,
      secretKey: oracle.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      messages: messages.map((m) =>
        internal({ to: m.to, value: m.value, bounce: m.bounce, body: m.body }),
      ),
    });
    await waitForSeqnoBump(oracle.wallet, seqno);
    return seqno;
  });
}

export async function getOracleWallet(): Promise<OracleHandle> {
  if (cached) return cached;
  const cfg = loadOnchainConfig();
  if (!cfg.oracleMnemonic) {
    throw new Error('ORACLE_MNEMONIC env var is not set');
  }
  const words = cfg.oracleMnemonic.split(/\s+/).filter(Boolean);
  if (words.length !== 24) {
    throw new Error(`ORACLE_MNEMONIC must be 24 words, got ${words.length}`);
  }
  const keyPair = await mnemonicToWalletKey(words);
  const walletContract = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const wallet = getTonClient().open(walletContract);
  cached = { wallet, publicKey: keyPair.publicKey, secretKey: keyPair.secretKey };
  logger.info(`[onchain] Oracle wallet ready: ${walletContract.address.toString()}`);
  return cached;
}

export async function getOracleAddressString(): Promise<string> {
  const handle = await getOracleWallet();
  return handle.wallet.address.toString();
}

export function resetOracleCache(): void {
  cached = null;
}
