import express from 'express';
import { logger } from '../logger.js';
import { resolveProfile, apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { str } from '../utils/params.js';
import { patchProfileSchema, kycLiteSchema } from './validation.js';
import * as repo from '../core/repository.js';
import { profileToSnakeCase } from '../core/repository.js';
import { isBlockedCountry } from '../commerce/handlers/blockedCountries.js';

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
    // resolveProfile auto-upserts on first authenticated hit using the
    // Appwrite user metadata, so no Clerk-style manual fallback is needed.
    const profile = await resolveProfile(req);
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

router.patch(
  '/session/profile/kyc-lite',
  apiRequireAuth(),
  validateBody(kycLiteSchema),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    if (profile.kycLiteCompletedAt) {
      res.json({ success: true, data: profileToSnakeCase(profile), alreadyCompleted: true });
      return;
    }
    const body = req.body as {
      legalFirstName: string;
      legalLastName: string;
      dateOfBirth: string;
      countryCode: string;
      city?: string;
    };

    if (isBlockedCountry(body.countryCode)) {
      res.status(451).json({
        success: false,
        message: 'Purchases are not available in your jurisdiction due to regulatory restrictions.',
        code: 'BLOCKED_COUNTRY',
      });
      return;
    }

    const dob = new Date(body.dateOfBirth);
    const ageDiff = Date.now() - dob.getTime();
    const ageYears = ageDiff / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 18) {
      res.status(403).json({
        success: false,
        message: 'You must be at least 18 years old.',
        code: 'AGE_RESTRICTED',
      });
      return;
    }

    const now = new Date().toISOString();
    await repo.updateProfile(profile.id, {
      kyc_lite_first_name: body.legalFirstName,
      kyc_lite_last_name: body.legalLastName,
      kyc_lite_date_of_birth: body.dateOfBirth,
      kyc_lite_country_code: body.countryCode.toUpperCase(),
      kyc_lite_city: body.city ?? '',
      kyc_lite_consent_at: now,
      kyc_lite_completed_at: now,
    });

    const updated = await repo.findUserById(profile.id);
    res.json({ success: true, data: updated ? profileToSnakeCase(updated) : null });
  }),
);

/**
 * Public-safe projection. `/profiles/by-ton` is reachable by ANY authenticated
 * user, so it must never leak email, KYC-lite PII (legal name / DOB / country /
 * city) or internal identifiers (appwrite/clerk user id, security level).
 */
function toPublicProfile(p: Record<string, unknown>): Record<string, unknown> {
  return {
    ton_address: p.ton_address,
    display_name: p.display_name,
    slug: p.slug,
    avatar: p.avatar,
    banner_url: p.banner_url,
    bio: p.bio,
    about_long: p.about_long,
    website: p.website,
    github: p.github,
    telegram: p.telegram,
    twitter: p.twitter,
    role: p.role,
    verified: p.verified,
    trust_score: p.trust_score,
    published_count: p.published_count,
    featured_product_ids: p.featured_product_ids,
    created_at: p.created_at,
  };
}

router.get(
  '/profiles/by-ton/:ton',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await repo.findUserByTonAddress(str(req.params.ton));
    if (!profile) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    // Public-safe subset only — no email / KYC PII / internal ids.
    res.json({ success: true, data: toPublicProfile(profileToSnakeCase(profile)) });
  }),
);

export default router;
