import { z } from 'zod';
import { CURRENCY } from './constants.js';

export const sellerRegisterSchema = z.object({
  wallet: z.string().min(1, 'wallet is required'),
  displayName: z.string().min(1, 'displayName is required').max(200),
  bio: z.string().max(2000).default(''),
});

export const createListingSchema = z.object({
  sellerWallet: z.string().min(1),
  catalogProductId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).default(''),
  currency: z.enum([CURRENCY.TON, CURRENCY.JETTON]).default(CURRENCY.TON),
  jettonMaster: z.string().default(''),
  priceTon: z.union([z.string(), z.number()]).optional(),
  priceHuman: z.union([z.string(), z.number()]).optional(),
  decimals: z.number().int().min(0).max(18).optional(),
  deliveryType: z.string().min(1),
  deliveryPayload: z.string().min(1),
  platformFeeBps: z.number().int().min(0).max(10000).optional(),
  assetFileId: z.string().default(''),
});

export const patchListingSchema = z.object({
  sellerWallet: z.string().optional(),
  status: z.string().optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  priceTon: z.union([z.string(), z.number()]).optional(),
  deliveryPayload: z.string().optional(),
});

export const createOrderSchema = z.object({
  listingId: z.string().min(1, 'listingId is required'),
  buyerWallet: z.string().min(1, 'buyerWallet is required'),
});

export const confirmOrderSchema = z.object({
  txHash: z.string().min(1, 'txHash is required'),
  buyerWallet: z.string().min(1, 'buyerWallet is required'),
});

export const orderStateSchema = z.object({
  state: z.enum(['pending_payment', 'paid', 'fulfilled', 'refunded', 'cancelled']),
});

// ── BYOS Storage credentials ──────────────────────────────────────
export const setStorageSchema = z.object({
  wallet: z.string().min(1),
  provider: z.enum(['cloudflare-r2', 's3', 'b2']),
  accountId: z.string().min(1).max(128),
  bucket: z.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9.-]{1,62}$/i, 'Invalid bucket name'),
  endpoint: z.string().url().max(255).optional(),
  accessKeyId: z.string().min(1).max(255),
  secretAccessKey: z.string().min(1).max(255),
  publicBaseUrl: z.string().url().max(255).optional(),
});

// ── Distribution manifest ──────────────────────────────────────────
export const setDistributionSchema = z.object({
  wallet: z.string().min(1),
  manifest: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('r2'),
      bucket: z.string().min(1).max(128),
      key: z.string().min(1).max(1024),
      sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
      filename: z.string().max(255).optional(),
    }),
    z.object({
      kind: z.literal('github'),
      repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
      tag: z.string().min(1).max(128),
      asset: z.string().min(1).max(255),
      sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
      filename: z.string().max(255).optional(),
    }),
  ]),
  ttlSec: z.number().int().min(60).max(21600).optional(),
});
