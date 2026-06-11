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

// Last seqno we submitted an external message with. Used to confirm prior sends
// landed BEFORE issuing the next one (B-1) — see sendFromOracle.
let lastSubmittedSeqno: number | null = null;

/** Test seam: reset the in-process seqno tracking. */
export function __resetOracleSeqnoTracking(): void {
  lastSubmittedSeqno = null;
}

/** Minimal wallet surface the seqno logic needs (testable). */
export interface SeqnoSource {
  getSeqno(): Promise<number>;
}

async function waitForSeqnoAtLeast(
  wallet: SeqnoSource,
  target: number,
  timeoutMs = 60_000,
  intervalMs = 1_500,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const s = await wallet.getSeqno();
      if (s >= target) return true;
    } catch {
      // transient RPC error — retry until deadline
    }
    if (Date.now() >= deadline) break;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Decide the seqno for the next send: first confirm the PREVIOUS send landed
 * (chain seqno advanced past `lastSubmitted`), then read the fresh seqno. Throws
 * if the prior send is stuck. Pure of wallet internals — unit-tested. (B-1)
 */
export async function resolveNextSeqno(
  wallet: SeqnoSource,
  lastSubmitted: number | null,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<number> {
  let onchain = await wallet.getSeqno();
  if (lastSubmitted !== null && onchain <= lastSubmitted) {
    const confirmed = await waitForSeqnoAtLeast(wallet, lastSubmitted + 1, opts.timeoutMs, opts.intervalMs);
    if (!confirmed) {
      throw new Error(
        `oracle: previous send (seqno ${lastSubmitted}) not confirmed on-chain; refusing to send and risk a seqno collision`,
      );
    }
    onchain = await wallet.getSeqno();
  }
  return onchain;
}

/**
 * Send one external message (carrying `messages` internal transfers) from the
 * oracle wallet, serialized so seqnos never collide (B-1). Returns the seqno used.
 *
 * The collision bug this prevents: right after a send, `getSeqno()` still
 * reports the OLD seqno until the tx is included on-chain. If the next serialized
 * send read that stale value it would reuse the seqno; the wallet accepts one
 * external message and silently drops the other → a lost mint or payout.
 *
 * Fix: before reading a seqno for a NEW send, wait for the chain to confirm our
 * PREVIOUS send (seqno advanced to lastSubmittedSeqno+1). We do NOT wait on the
 * current send's own confirmation — the business layer verifies that
 * (pollItemDeployed for mints, escrow state for releases), so a slow-to-land
 * send is never mis-counted as a failure. We only throw if a prior send is
 * genuinely stuck, which correctly blocks (and retries) rather than colliding.
 */
export async function sendFromOracle(messages: OracleMessage[]): Promise<number> {
  return runOracleExclusive(async () => {
    const oracle = await getOracleWallet();
    const seqno = await resolveNextSeqno(oracle.wallet, lastSubmittedSeqno);
    await oracle.wallet.sendTransfer({
      seqno,
      secretKey: oracle.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      messages: messages.map((m) =>
        internal({ to: m.to, value: m.value, bounce: m.bounce, body: m.body }),
      ),
    });
    lastSubmittedSeqno = seqno;
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
