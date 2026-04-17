import express from 'express';
import { getAuth } from '@clerk/express';
import { logger } from '../logger.js';
import { resolveProfile, apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { str } from '../utils/params.js';
import { patchProfileSchema } from './validation.js';
import * as repo from '../core/repository.js';
import { profileToSnakeCase } from '../core/repository.js';

const router = express.Router();

let TonAddress: { parse(addr: string): unknown } | null = null;
import('@ton/core')
  .then((mod) => { TonAddress = mod.Address; })
  .catch(() => { logger.warn('@ton/core not available — TON address validation will use regex fallback'); });

function isValidTonAddress(addr: string): boolean {
  if (TonAddress) {
    try { TonAddress.parse(addr); return true; } catch { return false; }
  }
  return /^(EQ|UQ|0:|kQ)[A-Za-z0-9_-]{46,48}$/.test(addr);
}

router.get(
  '/session/profile',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    let profile = await resolveProfile(req);
    if (!profile) {
      const auth = getAuth(req);
      if (auth?.userId) {
        logger.info(`Auto-creating profile for Clerk user ${auth.userId}`);
        profile = await repo.upsertProfileForClerkUser(auth.userId, { role: 'demiurge' });
      }
    }
    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    res.json({ success: true, data: profileToSnakeCase(profile) });
  }),
);

router.patch(
  '/session/profile',
  apiRequireAuth(),
  validateBody(patchProfileSchema),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    const body = req.body as Record<string, string | undefined>;
    const updates: Record<string, unknown> = {};

    if (body.ton_address !== undefined) {
      if (body.ton_address) {
        if (!isValidTonAddress(body.ton_address)) {
          res.status(400).json({ success: false, message: 'Invalid TON address format' });
          return;
        }
        const existing = await repo.findUserByTonAddress(body.ton_address);
        if (existing && existing.id !== profile.id) {
          res.status(409).json({ success: false, message: 'This TON wallet is already linked to another account' });
          return;
        }
      }
      updates.ton_address = body.ton_address || null;
    }

    if (body.slug !== undefined && body.slug && body.slug !== profile.slug) {
      const existing = await repo.findProfileBySlug(body.slug);
      if (existing && existing.id !== profile.id) {
        res.status(409).json({ success: false, message: 'This slug is already taken' });
        return;
      }
    }

    const passthrough: readonly string[] = [
      'display_name', 'bio', 'slug', 'avatar', 'banner_url',
      'website', 'github', 'telegram', 'twitter',
      'about_long', 'featured_product_ids',
    ] as const;
    for (const key of passthrough) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    if (Object.keys(updates).length > 0) {
      await repo.updateProfile(profile.id, updates);
    }
    const updated = await repo.findUserById(profile.id);
    res.json({ success: true, data: updated ? profileToSnakeCase(updated) : null });
  }),
);

router.get(
  '/profiles/by-ton/:ton',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await repo.findUserByTonAddress(str(req.params.ton));
    if (!profile) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, data: profileToSnakeCase(profile) });
  }),
);

export default router;
