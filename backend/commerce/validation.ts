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
