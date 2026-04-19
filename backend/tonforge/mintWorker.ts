/**
 * Background worker that processes Commerce licenses in two cycles:
 *
 * Mint cycle (every TICK_INTERVAL_MS):
 *   1. Mint LicenseItem on-chain via the oracle wallet.
 *   2. Poll until the new contract is active.
 *   3. RegisterLicense on the Escrow so it knows which NFT can trigger refund.
 *
 * Refund cycle (every TICK_INTERVAL_MS):
 *   1. Find licenses stuck in `mint_failed` for > REFUND_AFTER_MS with no
 *      registered NFT and a valid escrow address.
 *   2. Send OracleRefund to escrow (treasury-only path inside the contract).
 *   3. Mark license `refund_pending`.
 *   4. Poll registered escrow contracts in `refund_pending` until they
 *      self-destruct → mark `refunded` + set `refundedAt`.
 *
 * Two activation modes:
 *   - Periodic tick (`startMintWorker()` on server boot).
 *   - On-demand (`triggerMintLoop()` after a fresh order confirm).
 *
 * The worker is idempotent: it only acts on records still in `mint_pending`,
 * skips if `nftAddress` is already set (re-runs only the register step), and
 * debounces concurrent ticks via `staleAfterMs`.
 */

import { logger } from '../logger.js';
import {
  listMintCandidates,
  listRefundCandidates,
  listRefundPending,
  listPayoutCandidates,
  updateLicense,
  type LicenseRecord,
} from '../commerce/licenseRepository.js';
import { LICENSE_STATE } from '../commerce/constants.js';
import { withLock } from '../commerce/distributedLock.js';
import { loadOnchainConfig } from './onchain/config.js';
import { mintLicense, pollItemDeployed } from './onchain/mintLicense.js';
import { registerLicense } from './onchain/registerLicense.js';
import { oracleRefund, pollEscrowSettled } from './onchain/oracleRefund.js';
import { timeoutRelease, checkEscrowAlive } from './onchain/timeoutRelease.js';

const TICK_INTERVAL_MS = 30_000;
const STALE_AFTER_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const POLL_TIMEOUT_MS = 60_000;
/**
 * How long a license must dwell in `mint_failed` before we initiate the
 * automatic refund. Gives manual ops a chance to intervene (e.g. fund the
 * oracle wallet) for transient failures.
 */
const REFUND_AFTER_MS = 60 * 60 * 1000;
const REFUND_SETTLE_TIMEOUT_MS = 90_000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

function buildMetadataUri(license: LicenseRecord, base?: string): string {
  const prefix =
    (base && base.trim()) ||
    `https://cdn.tonforge.org/license-metadata/${license.catalogProductId || license.listingId}/`;
  const sep = prefix.endsWith('/') ? '' : '/';
  return `${prefix}${sep}${license.collectionIndex}.json`;
}

async function processOne(license: LicenseRecord): Promise<void> {
  if (!license.collectionAddress) {
    await updateLicense(license.$id, {
      state: LICENSE_STATE.MINT_FAILED,
      mintError: 'NO_COLLECTION_ADDRESS',
    });
    logger.warn(`[mintWorker] license ${license.$id} has no collectionAddress, marking failed`);
    return;
  }

  await updateLicense(license.$id, {
    mintAttempts: license.mintAttempts + 1,
    lastMintAttemptAt: new Date().toISOString(),
  });

  let nftAddress = license.nftAddress;
  let mintTxHash = license.mintTxHash;

  if (!nftAddress) {
    try {
      const result = await mintLicense({
        collectionAddress: license.collectionAddress,
        buyerWallet: license.buyerWallet,
        escrowAddress: license.escrowAddress,
        index: BigInt(license.collectionIndex),
        metadataUri: buildMetadataUri(license),
        transferLimit: 0,
        burnDeadline: license.trialEndsAt
          ? Math.floor(new Date(license.trialEndsAt).getTime() / 1000)
          : Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      });
      nftAddress = result.itemAddress;
      mintTxHash = String(result.txQueryId);
      await updateLicense(license.$id, { nftAddress, mintTxHash });
      logger.info(
        `[mintWorker] minted license=${license.$id} item=${nftAddress} queryId=${result.txQueryId}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const finalFailure = license.mintAttempts + 1 >= MAX_ATTEMPTS;
      await updateLicense(license.$id, {
        state: finalFailure ? LICENSE_STATE.MINT_FAILED : LICENSE_STATE.MINT_PENDING,
        mintError: msg.slice(0, 1000),
      });
      logger.error(
        `[mintWorker] mint failed license=${license.$id} attempt=${license.mintAttempts + 1}: ${msg}`,
      );
      return;
    }
  }

  const ok = await pollItemDeployed({ itemAddress: nftAddress, timeoutMs: POLL_TIMEOUT_MS });
  if (!ok) {
    const finalFailure = license.mintAttempts + 1 >= MAX_ATTEMPTS;
    await updateLicense(license.$id, {
      state: finalFailure ? LICENSE_STATE.MINT_FAILED : LICENSE_STATE.MINT_PENDING,
      mintError: 'POLL_TIMEOUT',
    });
    logger.warn(`[mintWorker] poll timeout license=${license.$id}`);
    return;
  }

  if (license.escrowAddress) {
    try {
      await registerLicense({
        escrowAddress: license.escrowAddress,
        licenseAddress: nftAddress,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // The NFT exists; we just couldn't bind it to escrow yet. Stay in
      // mint_pending so the next tick retries register, but the buyer
      // already has the NFT in their wallet.
      await updateLicense(license.$id, { mintError: `REGISTER_FAILED: ${msg.slice(0, 800)}` });
      logger.error(`[mintWorker] register failed license=${license.$id}: ${msg}`);
      return;
    }
  }

  await updateLicense(license.$id, {
    state: LICENSE_STATE.MINTED,
    mintError: '',
    mintedAt: new Date().toISOString(),
  });
  logger.info(`[mintWorker] license ${license.$id} minted+registered`);
}

async function processRefund(license: LicenseRecord): Promise<void> {
  if (!license.escrowAddress) {
    logger.warn(`[mintWorker.refund] license ${license.$id} has no escrow, skipping`);
    return;
  }
  if (license.nftAddress) {
    // OracleRefund is rejected once a license is registered. The buyer must
    // initiate BuyerBurn on the NFT itself. Mark the license accordingly so
    // we stop trying.
    await updateLicense(license.$id, {
      mintError: 'NFT_REGISTERED_USE_BURN',
    });
    logger.warn(`[mintWorker.refund] license ${license.$id} has NFT, cannot oracle-refund`);
    return;
  }

  try {
    const result = await oracleRefund({ escrowAddress: license.escrowAddress });
    await updateLicense(license.$id, {
      state: LICENSE_STATE.REFUND_PENDING,
      refundTxHash: String(result.txSeqno),
      refundReason: license.mintError
        ? `auto:${license.mintError.slice(0, 200)}`
        : 'auto:mint-failed-timeout',
      mintError: '',
    });
    logger.info(
      `[mintWorker.refund] OracleRefund broadcast license=${license.$id} escrow=${license.escrowAddress} seqno=${result.txSeqno}`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateLicense(license.$id, { mintError: `REFUND_BROADCAST_FAILED: ${msg.slice(0, 800)}` });
    logger.error(`[mintWorker.refund] oracleRefund failed license=${license.$id}: ${msg}`);
  }
}

async function processRefundConfirm(license: LicenseRecord): Promise<void> {
  if (!license.escrowAddress) return;
  const settled = await pollEscrowSettled({
    escrowAddress: license.escrowAddress,
    timeoutMs: REFUND_SETTLE_TIMEOUT_MS,
  });
  if (!settled) {
    logger.warn(`[mintWorker.refund] escrow not yet settled for license ${license.$id}`);
    return;
  }
  await updateLicense(license.$id, {
    state: LICENSE_STATE.REFUNDED,
    refundedAt: new Date().toISOString(),
  });
  logger.info(`[mintWorker.refund] license ${license.$id} fully refunded on-chain`);
}

/**
 * Periodic payout: trial window expired and buyer didn't burn → release
 * funds from escrow to seller via TimeoutRelease.
 *
 * Two outcomes:
 *   1. Escrow already destroyed (buyer ran ConfirmDelivery early, or oracle
 *      already released): just stamp releasedAt so we don't keep retrying.
 *   2. Escrow still active: send TimeoutRelease. Mark releasedAt only after
 *      escrow self-destructs.
 */
async function processPayout(license: LicenseRecord): Promise<void> {
  if (!license.escrowAddress) return;

  const alive = await checkEscrowAlive({ escrowAddress: license.escrowAddress });
  if (alive === 'destroyed') {
    await updateLicense(license.$id, { releasedAt: new Date().toISOString() });
    logger.info(`[mintWorker.payout] escrow already settled for license ${license.$id}`);
    return;
  }
  if (alive === 'unknown') {
    logger.warn(`[mintWorker.payout] state query failed for license ${license.$id}, will retry`);
    return;
  }

  try {
    const result = await timeoutRelease({ escrowAddress: license.escrowAddress });
    logger.info(
      `[mintWorker.payout] TimeoutRelease broadcast license=${license.$id} escrow=${license.escrowAddress} seqno=${result.txSeqno}`,
    );
    // Wait briefly for self-destruct; if not visible yet, next tick will
    // re-check via checkEscrowAlive and stamp releasedAt then.
    const settled = await pollEscrowSettled({
      escrowAddress: license.escrowAddress,
      timeoutMs: REFUND_SETTLE_TIMEOUT_MS,
    });
    if (settled) {
      await updateLicense(license.$id, { releasedAt: new Date().toISOString() });
      logger.info(`[mintWorker.payout] license ${license.$id} payout settled`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[mintWorker.payout] release failed license=${license.$id}: ${msg}`);
  }
}

export async function triggerMintLoop(): Promise<void> {
  if (running) return;
  const cfg = loadOnchainConfig();
  if (!cfg.enabled) return;
  running = true;
  try {
    // Cluster-wide lock — only one replica processes mints at a time.
    // TTL covers worst case: 25 candidates × (mint + poll) ≈ 25 × 70s = ~30 min.
    await withLock('mint-cycle', 30 * 60 * 1000, async () => {
      const candidates = await listMintCandidates(STALE_AFTER_MS, 25);
      if (candidates.length === 0) return;
      logger.info(`[mintWorker] processing ${candidates.length} pending license(s)`);
      for (const lic of candidates) {
        try {
          await processOne(lic);
        } catch (err) {
          logger.error(`[mintWorker] processOne crashed for ${lic.$id}:`, err);
        }
      }
    });
  } finally {
    running = false;
  }
}

export async function triggerRefundLoop(): Promise<void> {
  const cfg = loadOnchainConfig();
  if (!cfg.enabled) return;

  // Single lock for both phases — they share the same per-license state.
  await withLock('refund-cycle', 10 * 60 * 1000, async () => {
    // Phase A: failed mints older than REFUND_AFTER_MS → broadcast OracleRefund.
    const candidates = await listRefundCandidates(REFUND_AFTER_MS, 25);
    if (candidates.length > 0) {
      logger.info(`[mintWorker.refund] broadcasting refund for ${candidates.length} license(s)`);
      for (const lic of candidates) {
        try {
          await processRefund(lic);
        } catch (err) {
          logger.error(`[mintWorker.refund] processRefund crashed for ${lic.$id}:`, err);
        }
      }
    }

    // Phase B: confirm escrow self-destruction for already-broadcast refunds.
    const pending = await listRefundPending(25);
    if (pending.length > 0) {
      for (const lic of pending) {
        try {
          await processRefundConfirm(lic);
        } catch (err) {
          logger.error(`[mintWorker.refund] confirm crashed for ${lic.$id}:`, err);
        }
      }
    }
  });
}

/**
 * Periodic payout cycle: pay out sellers whose buyers didn't burn during
 * the trial window. Triggered by the same setInterval as mint and refund.
 */
export async function triggerPayoutLoop(): Promise<void> {
  const cfg = loadOnchainConfig();
  if (!cfg.enabled) return;
  await withLock('payout-cycle', 10 * 60 * 1000, async () => {
    const candidates = await listPayoutCandidates(25);
    if (candidates.length === 0) return;
    logger.info(`[mintWorker.payout] releasing ${candidates.length} escrow(s) to seller(s)`);
    for (const lic of candidates) {
      try {
        await processPayout(lic);
      } catch (err) {
        logger.error(`[mintWorker.payout] processPayout crashed for ${lic.$id}:`, err);
      }
    }
  });
}

export function startMintWorker(): void {
  if (timer) return;
  const cfg = loadOnchainConfig();
  if (!cfg.enabled) {
    logger.warn('[mintWorker] on-chain disabled, worker not started');
    return;
  }
  timer = setInterval(() => {
    triggerMintLoop().catch((err) => logger.error('[mintWorker] tick failed:', err));
    triggerRefundLoop().catch((err) => logger.error('[mintWorker.refund] tick failed:', err));
    triggerPayoutLoop().catch((err) => logger.error('[mintWorker.payout] tick failed:', err));
  }, TICK_INTERVAL_MS);
  logger.info(`[mintWorker] started (tick every ${TICK_INTERVAL_MS}ms, refund after ${REFUND_AFTER_MS}ms, payout after trial expiry)`);
}

export function stopMintWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
