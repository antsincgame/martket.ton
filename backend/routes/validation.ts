import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  description: z.string().max(5000).nullable().optional(),
  short_description: z.string().max(500).nullable().optional(),
  price_ton: z.number().min(0).default(0),
  category: z.string().max(100).default('other'),
  image: z.string().max(2000).nullable().optional(),
  version: z.string().max(50).default('1.0.0'),
});

export const patchProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  short_description: z.string().max(500).nullable().optional(),
  price_ton: z.number().min(0).optional(),
  category: z.string().max(100).optional(),
  image: z.string().max(2000).nullable().optional(),
  version: z.string().max(50).optional(),
  status: z.enum(['draft', 'pending_review', 'published', 'suspended']).optional(),
});

export const createPurchaseSchema = z.object({
  product_id: z.string().min(1, 'product_id is required'),
  tx_hash: z.string().max(200).nullable().optional(),
});

export const patchProfileSchema = z.object({
  ton_address: z.string().max(100).nullable().optional(),
  display_name: z.string().min(1).max(200).optional(),
  bio: z.string().max(2000).nullable().optional(),
  avatar: z.string().max(2000).nullable().optional(),
});

export const createAuditLogSchema = z.object({
  action: z.string().min(1).max(200),
  resource: z.string().min(1).max(200),
  resource_id: z.string().max(200).nullable().optional(),
  result: z.string().max(50).default('success'),
  metadata: z.unknown().optional(),
});
