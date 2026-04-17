import { z } from 'zod';

// ── Лимиты для ЧПУ/UX (синхронизированы с src/domain/marketplace/limits.ts) ──
export const PRODUCT_NAME_MIN = 3;
export const PRODUCT_NAME_MAX = 60;
export const DEVELOPER_DISPLAY_NAME_MIN = 2;
export const DEVELOPER_DISPLAY_NAME_MAX = 40;
export const DEVELOPER_SLUG_MAX = 40;
export const BIO_MAX = 160;
export const ABOUT_LONG_MAX = 500;

const trimmed = () =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string());

const productName = () =>
  trimmed().pipe(
    z
      .string()
      .min(PRODUCT_NAME_MIN, `name must be at least ${PRODUCT_NAME_MIN} characters`)
      .max(PRODUCT_NAME_MAX, `name must be at most ${PRODUCT_NAME_MAX} characters`),
  );

const displayName = () =>
  trimmed().pipe(
    z
      .string()
      .min(DEVELOPER_DISPLAY_NAME_MIN, `display_name must be at least ${DEVELOPER_DISPLAY_NAME_MIN} characters`)
      .max(DEVELOPER_DISPLAY_NAME_MAX, `display_name must be at most ${DEVELOPER_DISPLAY_NAME_MAX} characters`),
  );

export const createProductSchema = z.object({
  name: productName(),
  description: z.string().max(5000).nullable().optional(),
  short_description: z.string().max(500).nullable().optional(),
  price_ton: z.number().min(0).default(0),
  category: z.string().max(100).default('other'),
  image: z.string().max(2000).nullable().optional(),
  version: z.string().max(50).default('1.0.0'),
});

export const patchProductSchema = z.object({
  name: productName().optional(),
  description: z.string().max(5000).nullable().optional(),
  short_description: z.string().max(500).nullable().optional(),
  price_ton: z.number().min(0).optional(),
  category: z.string().max(100).optional(),
  image: z.string().max(2000).nullable().optional(),
  version: z.string().max(50).optional(),
  status: z.enum(['draft', 'pending_review', 'published', 'suspended']).optional(),
  /** Optional moderator note for status_change audit log. */
  reason: z.string().max(500).optional(),
});

export const createPurchaseSchema = z.object({
  product_id: z.string().min(1, 'product_id is required'),
  tx_hash: z.string().max(200).nullable().optional(),
});

export const patchProfileSchema = z.object({
  ton_address: z.string().max(100).nullable().optional(),
  display_name: displayName().optional(),
  bio: z.string().max(BIO_MAX).nullable().optional(),
  slug: z.string().min(1).max(DEVELOPER_SLUG_MAX).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens').optional(),
  avatar: z.string().max(2000).nullable().optional(),
  banner_url: z.string().max(2000).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  github: z.string().max(100).nullable().optional(),
  telegram: z.string().max(100).nullable().optional(),
  twitter: z.string().max(100).nullable().optional(),
  about_long: z.string().max(ABOUT_LONG_MAX).nullable().optional(),
  featured_product_ids: z.string().max(500).nullable().optional(),
});

export const createAuditLogSchema = z.object({
  action: z.string().min(1).max(200),
  resource: z.string().min(1).max(200),
  resource_id: z.string().max(200).nullable().optional(),
  result: z.string().max(50).default('success'),
  metadata: z.unknown().optional(),
});
