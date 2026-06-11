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

// Bounds to keep the per-user collection from being abused as unbounded storage.
const MAX_PRODUCT_ID_LEN = 64; // Appwrite attribute size
const MAX_WISHLIST_ITEMS = 500;

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
    if (!productId || productId.length > MAX_PRODUCT_ID_LEN) {
      res.status(400).json({ success: false, message: 'Invalid productId' });
      return;
    }
    // Cap the wishlist size so a user can't script unbounded junk rows. Skip the
    // count when the item is already saved (idempotent re-add stays cheap).
    const existing = await listWishlistByUser(profile.id);
    if (!existing.some((i) => i.catalogProductId === productId) && existing.length >= MAX_WISHLIST_ITEMS) {
      res.status(400).json({ success: false, message: 'Wishlist is full', code: 'WISHLIST_FULL' });
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
