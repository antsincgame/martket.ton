/**
 * Reconcile order → PAID + entitlement after TonForge license reaches minted.
 */
import { databases, ID, Query } from '../appwrite.js';
import {
  BUCKET_ASSETS,
  COL_ENTITLEMENTS,
  COL_LISTING_SECRETS,
  COL_LISTINGS,
  COL_ORDERS,
  DATABASE_ID,
  ORDER_STATE,
} from '../constants.js';
import type { LicenseRecord } from '../licenseRepository.js';
import { writeAudit } from '../audit.js';
import { omitEntitlementFields, omitOrderFields } from '../helpers.js';
import { recordLedgerEntry } from '../../core/ledgerService.js';
import { isUniqueViolation } from '../../domain/appwrite-helpers.js';
import { logger } from '../../logger.js';

// Terminal order states this reconciler must never overwrite. PAID/FULFILLED
// are the happy ends; REFUNDED/CANCELLED guard against a late/replayed mint
// confirmation flipping a refunded or cancelled order back to PAID.
const TERMINAL_ORDER_STATES = new Set<string>([
  ORDER_STATE.PAID,
  ORDER_STATE.FULFILLED,
  ORDER_STATE.REFUNDED,
  ORDER_STATE.CANCELLED,
]);

export async function reconcileOrderAfterMint(
  license: Pick<
    LicenseRecord,
    'orderId' | 'listingId' | 'buyerWallet' | 'nftAddress' | 'escrowAddress'
  >,
): Promise<{ reconciled: boolean; orderState: string | null }> {
  if (!license.orderId || !license.nftAddress) {
    return { reconciled: false, orderState: null };
  }

  const db = databases();
  let order: Record<string, unknown>;
  try {
    order = await db.getDocument(DATABASE_ID, COL_ORDERS, license.orderId);
  } catch {
    logger.warn(`[orderReconciler] order ${license.orderId} not found`);
    return { reconciled: false, orderState: null };
  }

  const currentState = String(order['state'] || '');
  if (TERMINAL_ORDER_STATES.has(currentState)) {
    return { reconciled: true, orderState: currentState };
  }

  const licenseAddress = license.nftAddress;
  const { documents: existingEnt } = await db.listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
    Query.equal('orderId', license.orderId),
    Query.limit(1),
  ]);

  if (existingEnt.length === 0) {
    const listing = await db.getDocument(DATABASE_ID, COL_LISTINGS, license.listingId);
    const { documents: secrets } = await db.listDocuments(DATABASE_ID, COL_LISTING_SECRETS, [
      Query.equal('listingId', license.listingId),
      Query.limit(1),
    ]);
    let payload =
      (secrets[0]?.['deliveryPayload'] as string) ||
      'Thank you for your purchase. License NFT minted to your wallet.';
    if (listing['assetFileId']) {
      payload += `\n\n[File in Appwrite Storage: bucket ${BUCKET_ASSETS}, fileId ${listing['assetFileId']}]`;
    }

    try {
      await db.createDocument(
        DATABASE_ID,
        COL_ENTITLEMENTS,
        ID.unique(),
        omitEntitlementFields({
          orderId: license.orderId,
          buyerWallet: license.buyerWallet,
          listingId: license.listingId,
          deliveryPayload: payload,
          licenseAddress,
        }),
      );
    } catch (err) {
      // A concurrent finalizer (the immediate tonforge path racing the polling
      // commerce reconciler) may have created the entitlement between our check
      // and this insert. The unique `orderId` index makes that a no-op, not an
      // error — only re-throw genuine failures.
      if (!isUniqueViolation(err)) throw err;
    }
  }

  await db.updateDocument(
    DATABASE_ID,
    COL_ORDERS,
    license.orderId,
    omitOrderFields({
      state: ORDER_STATE.PAID,
      licenseAddress,
    }),
  );

  await writeAudit(license.buyerWallet, 'mint_confirmed', 'order', license.orderId, {
    licenseAddress,
    flow: 'tonforge_reconciler',
  });

  recordLedgerEntry({
    entryType: 'mint_license',
    refType: 'order',
    refId: license.orderId,
    buyerWallet: license.buyerWallet,
    amountTonRaw: (order['amountRaw'] as string) ?? '0',
    licenseAddress,
    listingId: license.listingId,
    productName: (order['listingSnapshotTitle'] as string) ?? '',
    escrowAddress: license.escrowAddress || null,
  }).catch((err) =>
    logger.warn('[orderReconciler] ledger mint_license:', err instanceof Error ? err.message : err),
  );

  logger.info(
    `[orderReconciler] order ${license.orderId} → PAID (license=${licenseAddress})`,
  );
  return { reconciled: true, orderState: ORDER_STATE.PAID };
}
