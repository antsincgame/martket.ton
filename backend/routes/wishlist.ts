/**
 * Buyer wishlist / favorites (store-class engagement). Session-authenticated;
 * keyed by `profile.id`. Server-only collection — all access through here.
 */
import express from 'express';
import { resolveProfile, apiRequireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { str } from '../utils/params.js';
import { listWishlistByUser, addWishlist, removeWishlist } from '../core/wishlistRepository.js';

const router = express.Router();

router.get(
  '/session/wishlist',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.json({ success: true, data: { productIds: [] } });
      return;
    }
    const items = await listWishlistByUser(profile.id);
    res.json({ success: true, data: { productIds: items.map((i) => i.catalogProductId) } });
  }),
);

router.post(
  '/session/wishlist/:productId',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const productId = str(req.params.productId);
    if (!productId) {
      res.status(400).json({ success: false, message: 'productId required' });
      return;
    }
    await addWishlist(profile.id, productId);
    res.json({ success: true, data: { saved: true, productId } });
  }),
);

router.delete(
  '/session/wishlist/:productId',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    await removeWishlist(profile.id, str(req.params.productId));
    res.json({ success: true, data: { saved: false } });
  }),
);

export default router;
