/**
 * Move an order to REFUNDED after a buyer's on-chain refund settles.
 *
 * The escrow self-destructs on RefundIfNotMinted (SendDestroyIfZero), so the
 * order-reconciler's `getEscrowState` reads it as gone (null) and cannot drive
 * the order to REFUNDED on its own. The refund settle-cycle calls this once it
 * confirms the escrow is destroyed for a license whose buyer claimed a refund.
 *
 * Idempotent: a no-op if the order is already terminal (REFUNDED / PAID /
 * FULFILLED / CANCELLED) or missing.
 */

import { databases } from '../appwrite.js';
import { DATABASE_ID, COL_ORDERS, ORDER_STATE } from '../constants.js';
import { logger } from '../../logger.js';

const TERMINAL = new Set<string>([
  ORDER_STATE.REFUNDED,
  ORDER_STATE.PAID,
  ORDER_STATE.FULFILLED,
  ORDER_STATE.CANCELLED,
]);

export async function finalizeOrderRefund(orderId: string): Promise<void> {
  if (!orderId) return;
  const db = databases();

  let order: Record<string, unknown> | null = null;
  try {
    order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
  } catch {
    return; // order missing — nothing to finalize
  }

  if (TERMINAL.has(String(order['state']))) return;

  await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, { state: ORDER_STATE.REFUNDED });
  logger.info(`[finalizeOrderRefund] order ${orderId} → refunded`);
}
