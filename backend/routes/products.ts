import express from 'express';
import rateLimit from 'express-rate-limit';
import { resolveProfile, apiRequireAuth, isAdminRole, isModeratorRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { str } from '../utils/params.js';
import { createProductSchema, patchProductSchema } from './validation.js';
import * as repo from '../core/repository.js';
import { productToSnakeCase } from '../core/repository.js';
import { generateId } from '../core/generateId.js';
import { logger } from '../logger.js';
import type { Product, Profile } from '../domain/types.js';
import { getTonUsdPrice, usdToTonHuman } from '../commerce/tonPriceOracle.js';
import { tonHumanToNanoRaw } from '../commerce/money.js';

const router = express.Router();

const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
// Public search is unauthenticated and can hit an expensive full-scan fallback;
// bound per-IP so it can't be hammered. Generous enough for a type-ahead UI.
const searchLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const products = await repo.listProductsByStatus('published');
    // H-9: the public storefront merges these published products into its
    // catalog, and its mapper needs a human `developer` name (not a creator_id).
    // Resolve unique creators once and attach `creator_name` so seller products
    // actually surface on the storefront instead of living only in the API.
    const uniqueCreatorIds = [...new Set(products.map((p) => p.creatorId).filter(Boolean))];
    const nameById = new Map<string, string>();
    await Promise.all(
      uniqueCreatorIds.map(async (cid) => {
        try {
          const u = await repo.findUserById(cid);
          if (u) nameById.set(cid, u.displayName || u.name || '');
        } catch {
          /* best-effort: a missing profile just falls back to a generic name */
        }
      }),
    );
    const data = products.map((p) => ({
      ...productToSnakeCase(p),
      creator_name: nameById.get(p.creatorId) || '',
    }));
    res.json({ success: true, data });
  }),
);

router.get(
  '/search',
  searchLimiter,
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length < 2) {
      res.json({ success: true, data: [] });
      return;
    }
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const products = await repo.searchProducts(q, limit);
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
    if (product.status !== 'published') {
      const profile = await resolveProfile(req);
      const isOwner = profile && product.creatorId === profile.id;
      const isStaff = profile && isAdminRole(profile.role);
      if (!isOwner && !isStaff) {
        res.status(404).json({ success: false, message: 'Product not found' });
        return;
      }
    }
    res.json({ success: true, data: productToSnakeCase(product) });
  }),
);

router.get(
  '/:id/scan-status',
  apiRequireAuth(),
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
    const isOwner = product.creatorId === profile.id;
    const isStaff = isAdminRole(profile.role) || isModeratorRole(profile.role);
    if (!isOwner && !isStaff) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    res.json({
      success: true,
      data: {
        product_id: product.id,
        status: product.status,
        scan_status: product.scanStatus,
        scan_provider: product.scanProvider,
        scan_report_id: product.scanReportId,
        scan_malicious_count: product.scanMaliciousCount,
        scan_total_engines: product.scanTotalEngines,
        scan_completed_at: product.scanCompletedAt,
        has_clean_build: !!product.buildR2Key,
        has_quarantine: !!product.quarantineKey,
      },
    });
  }),
);

/**
 * Session "my products" handler.
 *
 * Exported separately because it is mounted at `/api/session/products` (not
 * `/api/products/...`). Avoids the previous bug where mounting the whole
 * router on `/api/session/products` matched `router.get('/')` (public list)
 * instead of the authenticated owner-scoped list.
 */
export const sessionProductsRouter = express.Router();
sessionProductsRouter.get(
  '/',
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
    const { name, description, short_description, price_usd, category, image, version } =
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
      price_usd: price_usd || 0,
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
    const isMod = isModeratorRole(profile.role);
    const isOwner = product.creatorId === profile.id;
    if (!isOwner && !isAdmin && !isMod) {
      res.status(403).json({ success: false, message: 'Only the creator, moderator, or admin can edit this product' });
      return;
    }
    const allowedFields = ['name', 'description', 'short_description', 'price_usd', 'category', 'image', 'version'];
    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (body.status !== undefined) {
      const target = String(body.status);
      const current = product.status;
      const ownerAllowed: Record<string, string[]> = {
        draft: ['pending_review'],
        pending_review: ['draft'],
        published: ['draft'],
        suspended: [],
        rejected: ['draft'],
      };
      const modAllowed: Record<string, string[]> = {
        draft: ['pending_review', 'published', 'suspended'],
        pending_review: ['published', 'rejected', 'suspended', 'draft'],
        published: ['draft', 'suspended'],
        suspended: ['draft', 'published'],
        rejected: ['draft', 'published'],
      };
      const allowed = (isAdmin || isMod) ? modAllowed[current] : ownerAllowed[current];
      if (!allowed || !allowed.includes(target)) {
        res.status(403).json({
          success: false,
          message: `Status transition ${current} → ${target} is not permitted for your role`,
        });
        return;
      }
      const requiresCleanScan = target === 'published' || target === 'pending_review';
      const hasNoBuild = !product.buildR2Key && !product.quarantineKey;
      const staffOverride = isAdmin || isMod;
      const scanExempt = hasNoBuild || staffOverride;
      if (requiresCleanScan && product.scanStatus !== 'clean' && !scanExempt) {
        res.status(409).json({
          success: false,
          message: `Cannot move to "${target}" until the build passes virus scan (current scan_status=${product.scanStatus})`,
          code: 'SCAN_NOT_CLEAN',
        });
        return;
      }
      updates.status = target;
      if (target === 'published' || target === 'rejected') {
        updates.moderator_id = profile.id;
        updates.moderation_reason = typeof body.reason === 'string' ? body.reason : null;
        updates.moderated_at = new Date().toISOString();
      }
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

      if ((isAdmin || isMod) && product.creatorId !== profile.id) {
        const creator = await repo.findUserById(product.creatorId);
        if (creator) {
          if (updates.status === 'published' && product.status !== 'published') {
            await repo.updateProfile(creator.id, {
              published_count: (creator.publishedCount ?? 0) + 1,
              trust_score: (creator.trustScore ?? 0) + 1,
            });
          } else if (updates.status === 'rejected') {
            await repo.updateProfile(creator.id, {
              rejection_count: (creator.rejectionCount ?? 0) + 1,
              trust_score: Math.max(-100, (creator.trustScore ?? 0) - 5),
            });
          }
        }
      }

      if (updates.status === 'published' && profile.tonAddress) {
        autoCreateListing(updated ?? product, profile).catch((err) =>
          logger.warn('[products] auto-listing:', err instanceof Error ? err.message : err),
        );
      }
    }

    res.json({ success: true, data: updated ? productToSnakeCase(updated) : null });
  }),
);

async function autoCreateListing(product: Product, profile: Profile): Promise<void> {
  if (!profile.tonAddress) return;
  const tonRate = await getTonUsdPrice();
  const tonHuman = usdToTonHuman(product.priceUsd ?? 0, tonRate);
  const priceNano = tonHumanToNanoRaw(tonHuman);
  if (priceNano === '0') return;

  try {
    const { databases: getDb, ID, Query } = await import('../commerce/appwrite.js');
    const { DATABASE_ID, COL_LISTINGS, LISTING_STATUS, CURRENCY } = await import('../commerce/constants.js');
    const db = getDb();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_LISTINGS, [
      Query.equal('catalogProductId', product.id),
      Query.equal('sellerWallet', profile.tonAddress),
      Query.limit(1),
    ]);
    if (documents.length > 0) return;

    await db.createDocument(DATABASE_ID, COL_LISTINGS, ID.unique(), {
      sellerWallet: profile.tonAddress,
      catalogProductId: product.id,
      title: product.name,
      description: product.shortDescription || product.description || '',
      currency: CURRENCY.TON,
      priceAmountRaw: priceNano,
      decimals: 9,
      platformFeeBps: 500,
      status: LISTING_STATUS.ACTIVE,
      deliveryType: 'digital',
      assetFileId: '',
    });
    logger.info(`Auto-listing created for product ${product.id} by ${profile.tonAddress}`);
  } catch (err) {
    logger.warn('[auto-listing] commerce DB not available:', err instanceof Error ? err.message : err);
  }
}

export default router;
