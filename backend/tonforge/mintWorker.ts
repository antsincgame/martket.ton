/**
 * Background worker that processes Commerce licenses in two cycles:
 *
 * Mint cycle (every TICK_INTERVAL_MS):
 *   1. Mint LicenseItem on-chain via the oracle wallet.
 *   2. Poll until the new contract is active.
 *   3. Подтверждаем саморегистрацию LicenseItem в Escrow через геттер
 *      license_address (раньше здесь oracle шлёт RegisterLicense — он
 *      баунсится, см. R1 в аудите).
 *
 * Refund cycle (every TICK_INTERVAL_MS):
 *   1. Find licenses stuck in `mint_failed` for > REFUND_AFTER_MS with no
 *      registered NFT and a valid escrow address.
 *   2. Mark them `refund_claimable` — the escrow's only pre-mint refund is the
 *      BUYER-initiated `RefundIfNotMinted` (the oracle cannot refund pre-mint,
 *      by contract design). The buyer claims it from their library; that POST
 *      records the claim and moves the license to `refund_pending`.
 *   3. Poll escrow contracts in `refund_pending` until they self-destruct →
 *      mark license `refunded` + set `refundedAt`, and finalize the order to
 *      REFUNDED. If the escrow is still funded after a dwell (the claim never
 *      landed), revert to `refund_claimable` so the buyer can retry.
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
import { licenseMetadataBaseUrl } from '../config/metadata.js';
import { withLock } from '../commerce/distributedLock.js';
import { loadOnchainConfig } from './onchain/config.js';
import { mintLicense, pollItemDeployed } from './onchain/mintLicense.js';
import { pollLicenseRegistered } from './onchain/escrowState.js';
import { pollEscrowSettled } from './onchain/oracleRefund.js';
import { timeoutRelease, checkEscrowAlive } from './onchain/timeoutRelease.js';
import { finalizeOrderRefund } from '../commerce/handlers/finalizeOrderRefund.js';
import { screenWallet } from '../sanctions/screen.js';
import { checkWalletAml } from '../aml/amlbot.js';

/**
 * Worker tunables.
 *
 * All values are overridable via env so ops can dial them without a deploy:
 *   MINT_TICK_MS          — period between cycles (default 30 s)
 *   MINT_STALE_MS         — debounce for re-attempting same record (default 2 m)
 *   MINT_MAX_ATTEMPTS     — retries before flipping to mint_failed (default 3)
 *   MINT_POLL_TIMEOUT_MS  — how long to wait for item deploy (default 60 s)
 *   MINT_REFUND_AFTER_MS  — dwell time in mint_failed before auto-refund (default 1 h)
 *   MINT_SETTLE_TIMEOUT_MS — how long to wait for escrow self-destruct (default 90 s)
 */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const TICK_INTERVAL_MS = envInt('MINT_TICK_MS', 30_000);
const STALE_AFTER_MS = envInt('MINT_STALE_MS', 2 * 60 * 1000);
const MAX_ATTEMPTS = envInt('MINT_MAX_ATTEMPTS', 3);
const POLL_TIMEOUT_MS = envInt('MINT_POLL_TIMEOUT_MS', 60_000);
const REFUND_AFTER_MS = envInt('MINT_REFUND_AFTER_MS', 60 * 60 * 1000);
const REFUND_SETTLE_TIMEOUT_MS = envInt('MINT_SETTLE_TIMEOUT_MS', 90_000);
// How long a license may sit in `refund_pending` with the escrow still funded
// (the buyer's claim never landed) before we revert it to `refund_claimable`
// so the buyer can retry. Guards against a bogus/abandoned claim confirm.
const REFUND_REVERT_AFTER_MS = envInt('MINT_REFUND_REVERT_MS', 15 * 60 * 1000);

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let cyclesRunning = false;
let startupSweepDone = false;

function buildMetadataUri(license: LicenseRecord, base?: string): string {
  const prefix =
    (base && base.trim()) ||
    `${licenseMetadataBaseUrl()}/${license.catalogProductId || license.listingId}/`;
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

  let nftAddress = license.nftAddress;
  let mintTxHash = license.mintTxHash;

  if (!nftAddress) {
    // Считаем попытку ТОЛЬКО при реальном минте, а не на тиках ожидания
    // саморегистрации — иначе register-poll инфлейтит mintAttempts до MAX
    // и живая лицензия с уже заминченным NFT упадёт в mint_failed.
    await updateLicense(license.$id, {
      mintAttempts: license.mintAttempts + 1,
      lastMintAttemptAt: new Date().toISOString(),
    });
    // Persist a queryId BEFORE broadcast so we have an audit trail even
    // when the process dies between the broadcast and the success update.
    // (Strict de-dup is left to the deterministic on-chain deploy: a
    // duplicate MintLicense bounces at the destination because the item
    // contract is already active. Oracle gas cost of a bounce ≈ 0.05 TON,
    // which we accept in exchange for simpler resume semantics.)
    if (!license.mintQueryId) {
      try {
        await updateLicense(license.$id, { mintQueryId: String(Date.now()) });
      } catch (err) {
        logger.warn('[mintWorker] mintQueryId persist failed (continuing):', err);
      }
    }
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
    // LicenseItem саморегистрируется в эскроу при минте (контракт требует
    // sender()==licenseAddress, поэтому oracle зарегистрировать НЕ может — см.
    // R1 в аудите). Здесь лишь ПОДТВЕРЖДАЕМ саморегистрацию через геттер
    // license_address. Пока не зарегистрировано — остаёмся mint_pending и повторим
    // на следующем тике (NFT уже у покупателя; refund-петля BuyerBurn→
    // RefundOnBurn замкнётся только после регистрации).
    const registered = await pollLicenseRegistered({
      escrowAddress: license.escrowAddress,
      licenseAddress: nftAddress,
      timeoutMs: POLL_TIMEOUT_MS,
    });
    if (!registered) {
      await updateLicense(license.$id, { mintError: 'AWAITING_SELF_REGISTER' });
      logger.warn(
        `[mintWorker] license ${license.$id} ждёт саморегистрации в эскроу ${license.escrowAddress}`,
      );
      return;
    }
  }

  await updateLicense(license.$id, {
    state: LICENSE_STATE.MINTED,
    mintError: '',
    mintedAt: new Date().toISOString(),
  });
  logger.info(`[mintWorker] license ${license.$id} minted+registered`);

  try {
    const { reconcileOrderAfterMint } = await import('../commerce/handlers/reconcileOrderAfterMint.js');
    await reconcileOrderAfterMint({
      orderId: license.orderId,
      listingId: license.listingId,
      buyerWallet: license.buyerWallet,
      nftAddress,
      escrowAddress: license.escrowAddress,
    });
  } catch (err) {
    logger.warn(`[mintWorker] order reconcile failed license=${license.$id}:`, err);
  }
}

async function processRefund(license: LicenseRecord): Promise<void> {
  if (!license.escrowAddress) {
    logger.warn(`[mintWorker.refund] license ${license.$id} has no escrow, skipping`);
    return;
  }
  if (license.nftAddress) {
    // Once a license is registered the contract rejects RefundIfNotMinted; the
    // buyer must instead burn the NFT (BuyerBurn → RefundOnBurn). Note it so we
    // stop reconsidering this record in the failed-mint sweep.
    await updateLicense(license.$id, {
      mintError: 'NFT_REGISTERED_USE_BURN',
    });
    logger.warn(`[mintWorker.refund] license ${license.$id} has NFT, buyer must BuyerBurn`);
    return;
  }

  // The escrow's only pre-mint refund is the buyer's RefundIfNotMinted (the
  // oracle cannot trigger it). Surface the claim to the buyer rather than
  // broadcasting an impossible oracle refund: mark the license claimable so the
  // buyer's library shows a "Claim refund" action.
  await updateLicense(license.$id, {
    state: LICENSE_STATE.REFUND_CLAIMABLE,
    refundReason: license.mintError
      ? `mint_failed:${license.mintError.slice(0, 200)}`
      : 'mint_failed_timeout',
  });
  logger.info(
    `[mintWorker.refund] license ${license.$id} → refund_claimable (buyer can reclaim escrow ${license.escrowAddress})`,
  );
}

async function processRefundConfirm(license: LicenseRecord): Promise<void> {
  if (!license.escrowAddress) return;

  const alive = await checkEscrowAlive({ escrowAddress: license.escrowAddress });
  if (alive === 'unknown') {
    logger.warn(`[mintWorker.refund] settle state query failed for license ${license.$id}, will retry`);
    return;
  }

  if (alive === 'destroyed') {
    // The buyer's RefundIfNotMinted landed: escrow returned its balance and
    // self-destructed. Settle the license and finalize the order (the
    // order-reconciler can't, since the escrow is now unreadable).
    await updateLicense(license.$id, {
      state: LICENSE_STATE.REFUNDED,
      refundedAt: new Date().toISOString(),
    });
    await finalizeOrderRefund(license.orderId).catch((err) =>
      logger.warn(`[mintWorker.refund] order finalize failed license=${license.$id}:`, err),
    );
    logger.info(`[mintWorker.refund] license ${license.$id} fully refunded on-chain`);
    return;
  }

  // Escrow still funded — the claim hasn't landed. If it's been pending too
  // long (bogus/abandoned confirm), revert to claimable so the buyer can retry.
  const pendingSinceMs = Date.parse(license.$updatedAt);
  if (Number.isFinite(pendingSinceMs) && Date.now() - pendingSinceMs > REFUND_REVERT_AFTER_MS) {
    await updateLicense(license.$id, { state: LICENSE_STATE.REFUND_CLAIMABLE });
    logger.warn(
      `[mintWorker.refund] license ${license.$id} claim did not land in ${REFUND_REVERT_AFTER_MS}ms → reverted to refund_claimable`,
    );
  }
}

// Троттлинг warn-логов по задержанным выплатам: payout-цикл тикает каждые
// ~30 с, без троттлинга один «грязный» кошелёк зальёт лог одинаковыми строками.
const HOLD_LOG_THROTTLE_MS = 60 * 60 * 1000;
const holdLoggedAt = new Map<string, number>();

function logPayoutHold(licenseId: string, message: string): void {
  const last = holdLoggedAt.get(licenseId) || 0;
  if (Date.now() - last < HOLD_LOG_THROTTLE_MS) return;
  holdLoggedAt.set(licenseId, Date.now());
  logger.warn(message);
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

  // Комплаенс-гейт перед выплатой: санкции (O(1), локальный список) +
  // AML-скоринг (кэшируется в aml_checks). Продавца проверяли при публикации
  // листинга, но между публикацией и выплатой кошелёк мог попасть в списки.
  // ВАЖНО: контракт позволяет ЛЮБОМУ вызвать TimeoutRelease после окна —
  // гейт останавливает только НАШУ автоматическую выплату и оставляет след
  // для ops-разбора. license остаётся в minted без releasedAt → ретрай после
  // истечения TTL кэша (если кошелёк «очистился» — выплата пройдёт сама).
  const sellerScreen = screenWallet(license.sellerWallet);
  if (!sellerScreen.ok) {
    logPayoutHold(
      license.$id,
      `[mintWorker.payout] HOLD license=${license.$id} seller=${license.sellerWallet} sanctioned (${sellerScreen.reason})`,
    );
    return;
  }
  const sellerAml = await checkWalletAml(license.sellerWallet);
  if (!sellerAml.ok) {
    logPayoutHold(
      license.$id,
      `[mintWorker.payout] HOLD license=${license.$id} seller=${license.sellerWallet} AML risk=${sellerAml.riskScore}`,
    );
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
      let minted = 0;
      let failed = 0;
      logger.info(`[mintWorker] processing ${candidates.length} pending license(s)`);
      for (const lic of candidates) {
        try {
          await processOne(lic);
          // Re-read state to count outcomes — processOne mutates via updateLicense.
          // We fetch a stable snapshot from the in-memory record post-update is
          // not available here, so we trust the log line emitted inside.
          minted += 1;
        } catch (err) {
          failed += 1;
          logger.error(`[mintWorker] processOne crashed for ${lic.$id}:`, err);
        }
      }
      logger.info(
        `[mintWorker] cycle stats: candidates=${candidates.length} processed=${minted} crashed=${failed}`,
      );
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
    // Phase A: failed mints older than REFUND_AFTER_MS → mark buyer-claimable.
    const candidates = await listRefundCandidates(REFUND_AFTER_MS, 25);
    if (candidates.length > 0) {
      logger.info(`[mintWorker.refund] marking ${candidates.length} license(s) refund_claimable`);
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

/**
 * Сериализованный запуск всех трёх циклов.
 *
 * Все три цикла шлют транзакции с ОДНОГО oracle-кошелька. Параллельный
 * запуск (mint + payout в одном окне) вызывал гонку seqno — getSeqno()
 * возвращал один и тот же номер для двух транзакций. Сериализация устраняет.
 */
async function runAllCyclesSequential(): Promise<void> {
  if (cyclesRunning) return;
  cyclesRunning = true;
  try {
    await triggerMintLoop();
    await triggerRefundLoop();
    await triggerPayoutLoop();
  } catch (err) {
    logger.error('[mintWorker] cycle runner failed:', err);
  } finally {
    cyclesRunning = false;
  }
}

export function startMintWorker(): void {
  if (timer) return;
  const cfg = loadOnchainConfig();
  if (!cfg.enabled) {
    logger.warn('[mintWorker] on-chain disabled, worker not started');
    return;
  }
  timer = setInterval(() => {
    void runAllCyclesSequential();
  }, TICK_INTERVAL_MS);
  logger.info(
    `[mintWorker] started tick=${TICK_INTERVAL_MS}ms maxAttempts=${MAX_ATTEMPTS} ` +
      `pollTimeout=${POLL_TIMEOUT_MS}ms refundAfter=${REFUND_AFTER_MS}ms ` +
      `settleTimeout=${REFUND_SETTLE_TIMEOUT_MS}ms staleAfter=${STALE_AFTER_MS}ms`,
  );

  // Startup sweep — run all three cycles immediately (сериализованно), without
  // waiting the first TICK_INTERVAL_MS. This recovers in-flight licenses
  // quickly after a deploy or process restart.
  if (!startupSweepDone) {
    startupSweepDone = true;
    void runAllCyclesSequential()
      .then(() => logger.info('[mintWorker] startup sweep complete'))
      .catch((err) => logger.error('[mintWorker] startup sweep failed:', err));
  }
}

export function stopMintWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
