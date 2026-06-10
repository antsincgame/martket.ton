import { z } from 'zod';
import { Address } from '@ton/core';
import { CURRENCY } from './constants.js';

export const sellerRegisterSchema = z.object({
  wallet: z.string().min(1, 'wallet is required'),
  displayName: z.string().min(1, 'displayName is required').max(200),
  bio: z.string().max(2000).default(''),
});

/**
 * TON user-friendly address with CRC16-CCITT checksum validation.
 * Uses `@ton/core` `Address.parse` — rejects addresses with invalid checksums
 * that a simple regex would let through.
 */
export const tonAddressSchema = z
  .string()
  .min(48, 'TON address must be 48 characters')
  .max(48, 'TON address must be 48 characters')
  .refine(
    (val) => {
      try {
        Address.parse(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid TON address (bad checksum or format). Expected EQ/UQ/kQ/0Q prefix.' },
  );

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(5000),
});

export const moderateReviewSchema = z.object({
  status: z.enum(['visible', 'hidden']),
  reason: z.string().max(1000).optional(),
});

export const createListingSchema = z.object({
  sellerWallet: z.string().min(1),
  catalogProductId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).default(''),
  currency: z.literal(CURRENCY.TON).default(CURRENCY.TON),
  priceUsd: z.number().positive(),
  deliveryType: z.string().min(1),
  deliveryPayload: z.string().min(1),
  platformFeeBps: z.number().int().min(0).max(10000).optional(),
  assetFileId: z.string().default(''),
  /**
   * Pre-deployed AppCollection address. Mandatory after the NFT-mint bridge:
   * every Commerce purchase mints a LicenseItem in this collection, and download
   * is gated on the mint. Without a valid collection no download can ever open.
   */
  collectionAddress: tonAddressSchema,
});

/** Agent API: sellerWallet comes from the token, not the request body. */
export const agentCreateListingSchema = createListingSchema.omit({ sellerWallet: true });

export const patchListingSchema = z
  .object({
    sellerWallet: z.string().optional(),
    status: z.string().optional(),
    title: z.string().max(200).optional(),
    description: z.string().max(5000).optional(),
    priceUsd: z.number().positive().optional(),
    deliveryPayload: z.string().optional(),
    collectionAddress: tonAddressSchema.optional(),
  })
  .refine(
    (data) => {
      // Forbid clearing collectionAddress to empty string.
      if ('collectionAddress' in data && data.collectionAddress !== undefined && data.collectionAddress.trim() === '') {
        return false;
      }
      return true;
    },
    { message: 'collectionAddress cannot be empty', path: ['collectionAddress'] },
  );

export const createOrderSchema = z.object({
  listingId: z.string().min(1, 'listingId is required'),
  buyerWallet: z.string().min(1, 'buyerWallet is required'),
});

export const confirmOrderSchema = z.object({
  txHash: z.string().optional(),
  buyerWallet: z.string().min(1, 'buyerWallet is required'),
});

export const orderStateSchema = z.object({
  state: z.enum(['pending_payment', 'paid', 'fulfilled', 'refunded', 'cancelled']),
});

// ── Agent instructions channel (admin authoring) ───────────────────
export const agentInstructionSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  order: z.number().int().min(0).max(1000).optional(),
  active: z.boolean().optional(),
});

// ── Per-seller collection provisioning (admin trigger) ─────────────
export const provisionCollectionSchema = z.object({
  sellerWallet: tonAddressSchema,
  network: z.enum(['mainnet', 'testnet']),
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

// Agent self-service storage: identical to setStorageSchema but WITHOUT `wallet`
// — the agent's wallet comes from its token, never the request body.
export const agentSetStorageSchema = setStorageSchema.omit({ wallet: true });

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
