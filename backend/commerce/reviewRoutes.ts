/**
 * Reviews & ratings HTTP surface (store-class trust).
 *
 * A buyer who holds a license for a catalog product may post ONE verified
 * review; the product's aggregate rating is recomputed and denormalised. Read
 * is public (visible reviews + aggregate). Moderators can hide a review.
 */
import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { apiRequireAuth, resolveProfile, requireModerator } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { str } from '../utils/params.js';
import { logger } from '../logger.js';
import { writeAudit } from './audit.js';
import { findLicenseByBuyerAndCatalogProduct } from './licenseRepository.js';
import { createReviewSchema, moderateReviewSchema } from './validation.js';
import { isUniqueViolation } from '../domain/appwrite-helpers.js';
import {
  listVisibleReviews,
  findBuyerReview,
  createReview,
  setReviewStatus,
  incrementHelpful,
  recomputeAndDenormalizeRating,
  computeReviewAggregate,
} from './reviews.js';

const router = express.Router();

const limitWrite = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

// ── Public read: visible reviews + aggregate ──────────────────────
router.get('/products/:catalogProductId/reviews', async (req: Request, res: Response) => {
  try {
    const cpid = str(req.params.catalogProductId);
    const reviews = await listVisibleReviews(cpid);
    const aggregate = computeReviewAggregate(reviews);
    res.json({ data: { reviews, aggregate } });
  } catch (e) {
    logger.error('[reviews] list:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to load reviews', code: 'REVIEWS_LIST' });
  }
});

// ── Can the caller review this product? (UI gate) ─────────────────
router.get('/products/:catalogProductId/can-review', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const cpid = str(req.params.catalogProductId);
    const profile = await resolveProfile(req);
    if (!profile?.tonAddress) {
      res.json({ data: { canReview: false, alreadyReviewed: false, reason: 'NO_WALLET' } });
      return;
    }
    const license = await findLicenseByBuyerAndCatalogProduct(profile.tonAddress, cpid);
    const existing = license ? await findBuyerReview(cpid, profile.tonAddress) : null;
    res.json({
      data: {
        canReview: Boolean(license) && !existing,
        alreadyReviewed: Boolean(existing),
        reason: license ? undefined : 'NO_PURCHASE',
      },
    });
  } catch (e) {
    logger.error('[reviews] can-review:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed', code: 'REVIEWS_CAN' });
  }
});

// ── Write a verified review ───────────────────────────────────────
router.post(
  '/products/:catalogProductId/reviews',
  apiRequireAuth(),
  limitWrite,
  validateBody(createReviewSchema),
  async (req: Request, res: Response) => {
    try {
      const cpid = str(req.params.catalogProductId);
      const profile = await resolveProfile(req);
      if (!profile) {
        res.status(403).json({ error: 'Profile not found', code: 'NO_PROFILE' });
        return;
      }
      const wallet = profile.tonAddress;
      if (!wallet) {
        res.status(403).json({ error: 'Link a TON wallet to review', code: 'NO_WALLET' });
        return;
      }
      // Verified-purchase gate: must hold a license for this catalog product.
      const license = await findLicenseByBuyerAndCatalogProduct(wallet, cpid);
      if (!license) {
        res.status(403).json({ error: 'Only buyers can review this product', code: 'NO_PURCHASE' });
        return;
      }
      const { rating, comment } = req.body as { rating: number; comment: string };
      const author = profile.displayName || profile.name || 'Demiurge';
      let review;
      try {
        review = await createReview({ catalogProductId: cpid, buyerWallet: wallet, author, rating, comment });
      } catch (err) {
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: 'You already reviewed this product', code: 'ALREADY_REVIEWED' });
          return;
        }
        throw err;
      }
      const aggregate = await recomputeAndDenormalizeRating(cpid);
      await writeAudit(wallet, 'review_create', 'product', cpid, { rating }).catch(() => {});
      res.json({ data: { review, aggregate } });
    } catch (e) {
      logger.error('[reviews] create:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Failed to submit review', code: 'REVIEW_CREATE' });
    }
  },
);

// ── Mark a review helpful ─────────────────────────────────────────
router.post('/reviews/:id/helpful', apiRequireAuth(), limitWrite, async (req: Request, res: Response) => {
  try {
    const helpful = await incrementHelpful(str(req.params.id));
    res.json({ data: { helpful } });
  } catch (e) {
    logger.error('[reviews] helpful:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed', code: 'REVIEW_HELPFUL' });
  }
});

// ── Moderator: hide/restore a review ──────────────────────────────
router.patch(
  '/admin/reviews/:id',
  apiRequireAuth(),
  requireModerator,
  validateBody(moderateReviewSchema),
  async (req: Request, res: Response) => {
    try {
      const id = str(req.params.id);
      const { status, reason } = req.body as { status: 'visible' | 'hidden'; reason?: string };
      const profile = await resolveProfile(req);
      const productId = await setReviewStatus(id, status, profile?.id || 'moderator', reason || '');
      // Hiding/restoring a review changes the visible set → recompute the
      // denormalised product rating so the storefront card reflects it.
      if (productId) await recomputeAndDenormalizeRating(productId).catch(() => {});
      await writeAudit(profile?.id || 'moderator', 'review_moderate', 'review', id, { status }).catch(() => {});
      res.json({ data: { id, status } });
    } catch (e) {
      logger.error('[reviews] moderate:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Failed', code: 'REVIEW_MODERATE' });
    }
  },
);

export default router;
