/**
 * Idempotent helper to make sure every paid order has a corresponding
 * License NFT record (Appwrite COL_LICENSES). Used by both branches of
 * `POST /orders/:id/confirm` (fresh entitlement and recovery for an order
 * that was already partially processed in a prior call).
 *
 * Behaviour:
 *  - If a license already exists for `order.$id` → returns it as-is.
 *  - Else → reads `listing.collection_address`, picks the next collection
 *    index, and creates a license in `mint_pending`, then nudges the
 *    mintWorker so the on-chain mint starts immediately.
 *
 * Throws `LISTING_NO_COLLECTION` when `listing.collection_address` is
 * empty. After the NFT-mint bridge every active listing must have a
 * pre-deployed AppCollection — otherwise we cannot mint a License NFT,
 * and without the NFT the buyer-burn refund guarantee does not apply.
 * Caller (orderRoutes.confirm) is expected to surface this as a 5xx so
 * payment is retried/refunded rather than silently producing a dead
 * "minted" record without an NFT.
 */

import {
  createLicense,
  countLicensesForCollection,
  findLicenseByOrderId,
  type LicenseRecord,
} from '../licenseRepository.js';
import { LICENSE_STATE } from '../constants.js';
import { triggerMintLoop } from '../../tonforge/mintWorker.js';
import { logger } from '../../logger.js';

export interface OrderLike {
  $id: string;
  listingId: string;
  buyerWallet: string;
  escrowAddress?: string;
}

export interface ListingLike {
  collection_address?: string;
  catalogProductId?: string;
  sellerWallet?: string;
}

export class ListingNoCollectionError extends Error {
  code = 'LISTING_NO_COLLECTION' as const;
  constructor(public listingId: string) {
    super(`Listing ${listingId} has no collection_address; cannot mint License NFT.`);
  }
}

export async function ensureLicenseForOrder(
  order: OrderLike,
  listing: ListingLike,
  trialEndsAt: string,
): Promise<LicenseRecord> {
  const existing = await findLicenseByOrderId(order.$id);
  if (existing) return existing;

  const collectionAddress = (listing.collection_address || '').trim();
  if (!collectionAddress) {
    // Defence in depth: createListingSchema requires it, but a legacy
    // listing or a manual DB edit could slip through. Refuse to forge
    // a fake "minted" license that bypasses the NFT mint gate.
    throw new ListingNoCollectionError(order.listingId);
  }

  const collectionIndex = await countLicensesForCollection(collectionAddress).catch(() => 0);

  const license = await createLicense({
    orderId: order.$id,
    listingId: order.listingId,
    catalogProductId: listing.catalogProductId || '',
    buyerWallet: order.buyerWallet,
    sellerWallet: listing.sellerWallet || '',
    escrowAddress: order.escrowAddress || '',
    collectionAddress,
    trialEndsAt,
    collectionIndex,
    initialState: LICENSE_STATE.MINT_PENDING,
  });

  triggerMintLoop().catch((err) =>
    logger.warn('[ensureLicense] mint trigger:', err instanceof Error ? err.message : err),
  );

  return license;
}
