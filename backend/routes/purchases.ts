import express from 'express';
import rateLimit from 'express-rate-limit';
import { resolveProfile, apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { str } from '../utils/params.js';
import { createPurchaseSchema } from './validation.js';
import * as repo from '../core/repository.js';
import { productToSnakeCase } from '../core/repository.js';
import { generateId } from '../core/generateId.js';

const router = express.Router();

const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get(
  '/session/library',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const purchases = await repo.listPurchasesByUser(profile.id);
    const productIds = [...new Set(purchases.map((p) => p.productId).filter(Boolean))];
    const products = await Promise.all(productIds.map((id) => repo.findProductById(id)));
    const productMap = new Map(
      products.filter((p): p is NonNullable<typeof p> => p !== null).map((p) => [p.id, p]),
    );
    const enriched = purchases.map((p) => ({
      ...p,
      product: productMap.has(p.productId) ? productToSnakeCase(productMap.get(p.productId)!) : null,
    }));
    res.json({ success: true, data: enriched });
  }),
);

router.get(
  '/session/owns/:productId',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.json({ success: true, data: { owns: false } });
      return;
    }
    const purchase = await repo.findPurchase(profile.id, str(req.params.productId));
    res.json({ success: true, data: { owns: !!purchase } });
  }),
);

router.post(
  '/purchases',
  apiRequireAuth(),
  strictLimiter,
  validateBody(createPurchaseSchema),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const { product_id, tx_hash } = req.body as { product_id?: string; tx_hash?: string };
    if (!product_id) {
      res.status(400).json({ success: false, message: 'product_id is required' });
      return;
    }
    const product = await repo.findProductById(product_id);
    if (!product || product.status !== 'published') {
      res.status(404).json({ success: false, message: 'Product not found or not published' });
      return;
    }
    const existingPurchase = await repo.findPurchase(profile.id, product_id);
    if (existingPurchase) {
      res.status(409).json({ success: false, message: 'You already own this product' });
      return;
    }
    const purchase = await repo.insertPurchase({
      id: generateId(),
      user_id: profile.id,
      product_id,
      price_ton: product.priceTon,
      tx_hash: tx_hash || null,
    });
    await repo.insertAuditLog({
      id: generateId(),
      user_id: profile.id,
      action: 'purchase',
      resource: 'product',
      resource_id: product_id,
      result: 'success',
      metadata: JSON.stringify({ price_ton: product.priceTon, tx_hash }),
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });
    res.json({ success: true, data: purchase });
  }),
);

export default router;
