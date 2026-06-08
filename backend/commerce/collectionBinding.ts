import type { Request, Response } from 'express';
import { findSellerCollection } from './sellerCollectionRepository.js';
import { addressesEqual } from './tonVerify.js';
import { resolveNetwork } from '../config/network.js';

/**
 * Soft-strict per-seller collection binding (P2). If the seller already has a
 * DEPLOYED collection in the `seller_collections` registry, a supplied
 * `collectionAddress` MUST equal it — otherwise a listing (agent- or
 * human-created) could route licenses into another seller's collection.
 *
 * Sellers WITHOUT a provisioned collection are not blocked: manual /
 * pre-registry deploys stay valid, and a non-deployed (pending/failed) row does
 * not block re-provisioning. Minting still requires the platform owner key, so
 * an arbitrary unregistered address is self-defeating, not an attack.
 *
 * Shared by the agent surface (`agent/routes`) and the human surface
 * (`commerce/listingRoutes`) so the policy has a single source of truth.
 * Returns `true` (and sends a 403) when the address is rejected; `false`
 * (no response written) when the listing may proceed.
 */
export async function rejectMismatchedCollection(
  req: Request,
  res: Response,
  wallet: string,
  collectionAddress: string,
): Promise<boolean> {
  const own = await findSellerCollection(wallet, resolveNetwork(req)).catch(() => null);
  if (
    own &&
    own.status === 'deployed' &&
    own.collectionAddress &&
    !addressesEqual(collectionAddress, own.collectionAddress)
  ) {
    res.status(403).json({
      error: 'collectionAddress does not match your provisioned collection',
      code: 'COLLECTION_MISMATCH',
    });
    return true;
  }
  return false;
}
