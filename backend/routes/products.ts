import express from 'express';
import rateLimit from 'express-rate-limit';
import { resolveProfile, apiRequireAuth, isAdminRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { str } from '../utils/params.js';
import { createProductSchema, patchProductSchema } from './validation.js';
import * as repo from '../core/repository.js';
import { productToSnakeCase } from '../core/repository.js';
import { generateId } from '../core/generateId.js';

const router = express.Router();

const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const products = await repo.listProductsByStatus('published');
    res.json({ success: true, data: products.map(productToSnakeCase) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await repo.findProductById(str(req.params.id));
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    res.json({ success: true, data: productToSnakeCase(product) });
  }),
);

router.get(
  '/session/products',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const products = await repo.listProductsByCreator(profile.id);
    res.json({ success: true, data: products.map(productToSnakeCase) });
  }),
);

router.post(
  '/',
  apiRequireAuth(),
  strictLimiter,
  validateBody(createProductSchema),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const { name, description, short_description, price_ton, category, image, version } =
      req.body as Record<string, unknown>;
    if (!name) {
      res.status(400).json({ success: false, message: 'name is required' });
      return;
    }
    const newId = generateId();
    const product = await repo.insertProduct({
      id: newId,
      creator_id: profile.id,
      name,
      description: description || null,
      short_description: short_description || null,
      price_ton: price_ton || 0,
      category: category || 'other',
      image: image || null,
      version: version || '1.0.0',
      status: 'draft',
    });
    await repo.insertAuditLog({
      id: generateId(),
      user_id: profile.id,
      action: 'create',
      resource: 'product',
      resource_id: newId,
      result: 'success',
      metadata: JSON.stringify({ name }),
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });
    res.json({ success: true, data: product ? productToSnakeCase(product) : null });
  }),
);

router.patch(
  '/:id',
  apiRequireAuth(),
  validateBody(patchProductSchema),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const product = await repo.findProductById(str(req.params.id));
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    const isAdmin = isAdminRole(profile.role);
    const isOwner = product.creatorId === profile.id;
    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: 'Only the creator or admin can edit this product' });
      return;
    }
    const allowedFields = ['name', 'description', 'short_description', 'price_ton', 'category', 'image', 'version'];
    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    // Status workflow: owners may move draft↔pending_review and published→draft (unpublish).
    // Only admins can publish or suspend.
    if (body.status !== undefined) {
      const target = String(body.status);
      const current = product.status;
      const ownerAllowed: Record<string, string[]> = {
        draft: ['pending_review'],
        pending_review: ['draft'],
        published: ['draft'],
        suspended: [],
      };
      const adminAllowed: Record<string, string[]> = {
        draft: ['pending_review', 'published', 'suspended'],
        pending_review: ['published', 'suspended', 'draft'],
        published: ['draft', 'suspended'],
        suspended: ['draft', 'published'],
      };
      const allowed = isAdmin ? adminAllowed[current] : ownerAllowed[current];
      if (!allowed || !allowed.includes(target)) {
        res.status(403).json({
          success: false,
          message: `Status transition ${current} → ${target} is not permitted for your role`,
        });
        return;
      }
      updates.status = target;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: 'No valid fields to update' });
      return;
    }
    const updated = await repo.updateProduct(str(req.params.id), updates);

    if (updates.status) {
      await repo.insertAuditLog({
        id: generateId(),
        user_id: profile.id,
        action: 'status_change',
        resource: 'product',
        resource_id: product.id,
        result: 'success',
        metadata: JSON.stringify({
          from: product.status,
          to: updates.status,
          reason: typeof body.reason === 'string' ? body.reason : null,
          by_role: profile.role,
        }),
        ip_address: req.ip,
        user_agent: req.get('user-agent') || '',
      });
    }

    res.json({ success: true, data: updated ? productToSnakeCase(updated) : null });
  }),
);

export default router;
