/**
 * License NFT API.
 *
 *   GET /api/v1/commerce/licenses/:id        — current state of a license
 *   GET /api/v1/commerce/buyers/me/licenses  — buyer's full library
 *
 * The buyer-facing UI polls these to drive the post-checkout
 * MintProgress screen and the My Licenses panel.
 */

import express, { type Request, type Response } from 'express';
import { apiRequireAuth, resolveProfile } from '../middleware/auth.js';
import { addressesEqual } from './tonVerify.js';
import { logger } from '../logger.js';
import { str } from '../utils/params.js';
import {
  getLicenseById,
  listBuyerLicenses,
  type LicenseRecord,
} from './licenseRepository.js';

const router = express.Router();

function publicView(license: LicenseRecord) {
  return {
    id: license.$id,
    orderId: license.orderId,
    listingId: license.listingId,
    catalogProductId: license.catalogProductId || null,
    buyerWallet: license.buyerWallet,
    sellerWallet: license.sellerWallet,
    state: license.state,
    nftAddress: license.nftAddress || null,
    collectionAddress: license.collectionAddress || null,
    escrowAddress: license.escrowAddress || null,
    mintTxHash: license.mintTxHash || null,
    burnTxHash: license.burnTxHash || null,
    mintError: license.mintError || null,
    mintAttempts: license.mintAttempts,
    trialEndsAt: license.trialEndsAt,
    mintedAt: license.mintedAt,
    burnedAt: license.burnedAt,
    refundedAt: license.refundedAt,
    createdAt: license.$createdAt,
    updatedAt: license.$updatedAt,
  };
}

router.get('/licenses/:id', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id);
    const license = await getLicenseById(id);
    if (!license) {
      res.status(404).json({ error: 'License not found', code: 'NOT_FOUND' });
      return;
    }
    const profile = await resolveProfile(req);
    const isOwner =
      profile && profile.tonAddress && addressesEqual(profile.tonAddress, license.buyerWallet);
    const isStaff =
      profile && (profile.role === 'admin' || profile.role === 'super_admin' || profile.role === 'moderator');
    if (!isOwner && !isStaff) {
      res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
      return;
    }
    res.json({ data: { license: publicView(license) } });
  } catch (e: unknown) {
    logger.error('[commerce] license get:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'License retrieval failed', code: 'LICENSE_GET' });
  }
});

router.get('/buyers/me/licenses', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const profile = await resolveProfile(req);
    if (!profile || !profile.tonAddress) {
      res.status(403).json({ error: 'Wallet not linked', code: 'NO_WALLET' });
      return;
    }
    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '100';
    const limit = Math.min(parseInt(limitRaw, 10) || 100, 200);
    const licenses = await listBuyerLicenses(profile.tonAddress, limit);
    res.json({ data: { licenses: licenses.map(publicView) } });
  } catch (e: unknown) {
    logger.error('[commerce] buyer licenses:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to fetch licenses', code: 'BUYER_LICENSES' });
  }
});

export default router;
