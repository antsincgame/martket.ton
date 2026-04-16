import express, { type Request, type Response } from 'express';
import { getAuth } from '@clerk/express';
import { logger } from '../logger.js';
import { resolveProfile, apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { patchProfileSchema } from './validation.js';
import * as repo from '../core/repository.js';
import { profileToSnakeCase } from '../core/repository.js';

const router = express.Router();

function str(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

let TonAddress: { parse(addr: string): unknown } | null = null;
try {
  TonAddress = require('@ton/core').Address;
} catch {
  logger.warn('@ton/core not available — TON address validation will use regex fallback');
}

function isValidTonAddress(addr: string): boolean {
  if (TonAddress) {
    try { TonAddress.parse(addr); return true; } catch { return false; }
  }
  return /^(EQ|UQ|0:|kQ)[A-Za-z0-9_-]{46,48}$/.test(addr);
}

const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

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
    const { ton_address, display_name, bio, avatar } = req.body as Record<string, string | undefined>;
    const updates: Record<string, unknown> = {};
    if (ton_address !== undefined) {
      if (ton_address) {
        if (!isValidTonAddress(ton_address)) {
          res.status(400).json({ success: false, message: 'Invalid TON address format' });
          return;
        }
        const existing = await repo.findUserByTonAddress(ton_address);
        if (existing && existing.id !== profile.id) {
          res.status(409).json({ success: false, message: 'This TON wallet is already linked to another account' });
          return;
        }
      }
      updates.ton_address = ton_address || null;
    }
    if (display_name !== undefined) updates.display_name = display_name;
    if (bio !== undefined) updates.bio = bio;
    if (avatar !== undefined) updates.avatar = avatar;
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
