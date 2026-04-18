import { z } from 'zod';

export const kycSchema = z.object({
  wallet: z.string().min(1),
  displayName: z.string().min(1).max(200),
  legalName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  country: z.string().min(2).max(3),
  bio: z.string().max(2000).default(''),
});

export const scanArtifactSchema = z.object({
  fileName: z.string().min(1),
  artifactUrl: z.string().url(),
  sha256: z.string().length(64),
});

export const publishAppSchema = z.object({
  sellerWallet: z.string().min(1),
  catalogProductId: z.string().min(1),
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  category: z.string().min(1),
  summary: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  priceTon: z.number().min(0),
  fileName: z.string().min(1),
  version: z.string().min(1),
  sizeLabel: z.string().min(1),
  artifactUrl: z.string().url(),
  sha256: z.string().length(64),
  developerSignature: z.string().min(1),
  malwareStatus: z.string(),
  platforms: z.array(z.string()).min(1),
  licenseType: z.string().min(1),
  transferLimit: z.number().int().min(0),
  activationPolicy: z.string().min(1),
});

export const purchaseSessionSchema = z.object({
  appId: z.string().min(1),
  buyerWallet: z.string().min(1),
});

export const confirmPurchaseSchema = z.object({
  purchaseSessionId: z.string().min(1),
  buyerWallet: z.string().min(1),
  txHash: z.string().optional(),
});

export const activateDeviceSchema = z.object({
  buyerWallet: z.string().min(1),
  deviceId: z.string().min(1).max(200),
});
