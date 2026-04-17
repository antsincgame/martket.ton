import { databases, Query } from './appwrite.js';
import { DATABASE_ID, COL_ORDERS, ORDER_STATE } from './constants.js';
import { logger } from '../logger.js';

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function expireStalePendingOrders(ttlMs = DEFAULT_TTL_MS): Promise<number> {
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  const db = databases();

  const { documents: stale } = await db.listDocuments(DATABASE_ID, COL_ORDERS, [
    Query.equal('state', ORDER_STATE.PENDING_PAYMENT),
    Query.lessThan('$createdAt', cutoff),
    Query.limit(200),
  ]);

  let cancelled = 0;
  for (const doc of stale) {
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
  return cancelled;
}
