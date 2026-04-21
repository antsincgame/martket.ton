import { databases, Query } from './appwrite.js';
import { DATABASE_ID, COL_ORDERS, ORDER_STATE } from './constants.js';
import { logger } from '../logger.js';

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Отменяет просроченные order'ы в state=PENDING_PAYMENT старше ttlMs.
 *
 * v4 SAFETY: НЕ отменяет orders у которых уже записан tonTxHash.
 *   В v4 flow backend записывает tonTxHash при успешной верификации платежа
 *   на escrow, но оставляет state=PENDING_PAYMENT чтобы mint worker мог
 *   подхватить (worker фильтрует по state=PENDING_PAYMENT). Если mint worker
 *   задержится (network issue, TonAPI rate limit, retry backoff) дольше 2
 *   часов — такой order нельзя отменять: деньги buyer'а уже в escrow и на
 *   пути к LicenseItem mint. Cancellation в этом случае привёл бы к рассинхрону:
 *   Appwrite говорит cancelled, но on-chain escrow в FUNDED state.
 *
 *   Для таких orders возможен только один терминальный исход: worker дойдёт
 *   до mint'а (успешно → PAID, или после MAX_MINT_ATTEMPTS worker остановится
 *   и buyer сможет инициировать RefundIfNotMinted on-chain → state=REFUNDED).
 */
export async function expireStalePendingOrders(ttlMs = DEFAULT_TTL_MS): Promise<number> {
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  const db = databases();

  const { documents: stale } = await db.listDocuments(DATABASE_ID, COL_ORDERS, [
    Query.equal('state', ORDER_STATE.PENDING_PAYMENT),
    Query.lessThan('$createdAt', cutoff),
    Query.limit(200),
  ]);

  let cancelled = 0;
  let skippedPaid = 0;
  for (const doc of stale) {
    // v4: защита orders у которых платёж уже верифицирован (tonTxHash записан)
    const tonTxHash = typeof doc['tonTxHash'] === 'string' ? doc['tonTxHash'].trim() : '';
    if (tonTxHash.length > 0) {
      skippedPaid++;
      continue;
    }

    try {
      await db.updateDocument(DATABASE_ID, COL_ORDERS, doc.$id, {
        state: ORDER_STATE.CANCELLED,
      });
      cancelled++;
    } catch (err) {
      logger.warn('[ttlOrders] cancel failed:', doc.$id, err instanceof Error ? err.message : err);
    }
  }

  if (cancelled > 0) {
    logger.info(`[ttlOrders] cancelled ${cancelled} stale pending orders (cutoff: ${cutoff})`);
  }
  if (skippedPaid > 0) {
    logger.info(
      `[ttlOrders] skipped ${skippedPaid} stale orders with tonTxHash set (v4 awaiting mint worker)`,
    );
  }
  return cancelled;
}
