/**
 * Idempotent helper to make sure every paid order has a corresponding
 * License NFT record (Appwrite COL_LICENSES). Used by both branches of
 * `POST /orders/:id/confirm` (fresh entitlement and recovery for an order
 * that was already partially processed in a prior call).
 *
 * Behaviour:
 *  - If a license already exists for `order.$id` → returns it as-is.
 *  - Else → reads `listing.collection_address`, picks the next collection
 *    index, and creates a license. If a collection address is configured,
 *    the license starts in `mint_pending` and the mintWorker is nudged.
 *    If no collection (NFT-less listing) it starts in `minted`.
 *
 * Returns the license record. Never throws on the trigger step.
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

export async function ensureLicenseForOrder(
  order: OrderLike,
  listing: ListingLike,
  trialEndsAt: string,
): Promise<LicenseRecord> {
  const existing = await findLicenseByOrderId(order.$id);
  if (existing) return existing;

  const collectionAddress = listing.collection_address || '';
  const collectionIndex = collectionAddress
    ? await countLicensesForCollection(collectionAddress).catch(() => 0)
    : 0;

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
    initialState: collectionAddress ? LICENSE_STATE.MINT_PENDING : LICENSE_STATE.MINTED,
  });

  if (collectionAddress) {
    triggerMintLoop().catch((err) =>
      logger.warn('[ensureLicense] mint trigger:', err instanceof Error ? err.message : err),
    );
  }

  return license;
}
