import type { Request, Response } from 'express';
import { nanoRawToTonHuman, computeOrderAmounts, effectiveSellerPriceRaw, isSaleActive } from './money.js';
import { CURRENCY, DEFAULT_PLATFORM_FEE_BPS } from './constants.js';
import type { AppwriteDoc } from '../domain/appwrite-helpers.js';
import { str } from '../utils/params.js';
import { resolveProfile } from '../middleware/auth.js';
import { addressesEqual } from './tonVerify.js';
import { constantTimeHashEqual, hashToken } from '../agent/tokenIssuer.js';
import type { Profile } from '../domain/types.js';

function fieldsToOmit(envKey: string): Set<string> {
  const raw = (process.env[envKey] || '').trim();
  return new Set(raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []);
}

function omitFields<T extends Record<string, unknown>>(payload: T, envKey: string): T {
  const omit = fieldsToOmit(envKey);
  if (omit.size === 0) return payload;
  const out = { ...payload };
  for (const key of omit) {
    delete out[key];
  }
  return out;
}

export function omitListingFields<T extends Record<string, unknown>>(payload: T): T {
  return omitFields(payload, 'LEGACY_LISTINGS_OMIT_FIELDS');
}

export function omitOrderFields<T extends Record<string, unknown>>(payload: T): T {
  return omitFields(payload, 'LEGACY_ORDERS_OMIT_FIELDS');
}

export function omitEntitlementFields<T extends Record<string, unknown>>(payload: T): T {
  return omitFields(payload, 'LEGACY_ENTITLEMENTS_OMIT_FIELDS');
}

export function commerceAdmin(req: Request, res: Response, next: () => void): void {
  const got = str(req.headers['x-commerce-admin-secret']);
  const need = process.env.COMMERCE_ADMIN_SECRET || '';
  // Constant-time compare over sha256 digests (so neither value nor its length
  // leaks via a timing side-channel). An unset server secret always denies.
  if (!need || !constantTimeHashEqual(hashToken(got), hashToken(need))) {
    res.status(403).json({ error: 'Insufficient privileges', code: 'COMMERCE_ADMIN_FORBIDDEN' });
    return;
  }
  next();
}

/**
 * Resolves the caller's profile and verifies that the given wallet belongs
 * to them. Returns the profile on success or sends a 403 and returns null.
 */
export async function requireWalletOwner(
  req: Request,
  res: Response,
  wallet: string,
): Promise<Profile | null> {
  const profile = await resolveProfile(req);
  if (!profile || !profile.tonAddress) {
    res.status(403).json({ error: 'Wallet not linked to your profile', code: 'NO_WALLET' });
    return null;
  }
  if (!addressesEqual(profile.tonAddress, wallet)) {
    res.status(403).json({ error: 'Wallet does not belong to your account', code: 'WALLET_MISMATCH' });
    return null;
  }
  return profile;
}

export function mapListingPublic(doc: AppwriteDoc) {
  const priceRaw = doc['priceAmountRaw'] as string;
  const isTon = doc['currency'] === CURRENCY.TON;
  // The price the buyer is actually charged — sale price when a discount is
  // active, else list price. The SAME effective price drives order creation
  // (orderRoutes), so the quoted total matches the charged total.
  const saleFields = {
    priceAmountRaw: priceRaw,
    sale_price_amount_raw: (doc['sale_price_amount_raw'] as string) || null,
    sale_ends_at: (doc['sale_ends_at'] as string) || null,
  };
  const saleActive = isTon && Boolean(priceRaw) && isSaleActive(saleFields);
  const effectivePriceRaw = isTon && priceRaw ? effectiveSellerPriceRaw(saleFields) : priceRaw;
  // Authoritative buyer-facing total = effective seller price + platform fee,
  // with the fee clamped to the platform minimum exactly as order creation does
  // (K-2). The discount lowers the seller price only, never the fee floor.
  const effectiveFeeBps = Math.max(
    Number(doc['platformFeeBps'] ?? DEFAULT_PLATFORM_FEE_BPS),
    DEFAULT_PLATFORM_FEE_BPS,
  );
  const amounts = isTon && priceRaw ? computeOrderAmounts(effectivePriceRaw, effectiveFeeBps) : null;
  const discountPercent =
    saleActive && priceRaw
      ? Math.round((1 - Number(BigInt(effectivePriceRaw) * 1000n / BigInt(priceRaw)) / 1000) * 100)
      : 0;
  return {
    id: doc.$id,
    sellerWallet: doc['sellerWallet'] as string,
    catalogProductId: doc['catalogProductId'] as string,
    title: doc['title'] as string,
    description: doc['description'] as string,
    currency: doc['currency'] as string,
    priceAmountRaw: priceRaw,
    priceUsd: (doc['priceUsd'] as string) || null,
    decimals: doc['decimals'] as number,
    platformFeeBps: doc['platformFeeBps'] as number,
    // Effective (clamped) fee + the buyer's total-to-pay (TON only).
    effectivePlatformFeeBps: effectiveFeeBps,
    platformFeeRaw: amounts ? amounts.feeNano : null,
    platformFeeTonHuman: amounts ? nanoRawToTonHuman(amounts.feeNano) : null,
    buyerTotalRaw: amounts ? amounts.totalAmountNano : null,
    buyerTotalTonHuman: amounts ? nanoRawToTonHuman(amounts.totalAmountNano) : null,
    // Sale / discount surface (struck-through original + sale price).
    saleActive,
    salePriceUsd: (doc['sale_price_usd'] as number) ?? null,
    salePriceTonHuman: saleActive ? nanoRawToTonHuman(effectivePriceRaw) : null,
    saleEndsAt: (doc['sale_ends_at'] as string) || null,
    discountPercent,
    status: doc['status'] as string,
    deliveryType: doc['deliveryType'] as string,
    assetFileId: (doc['assetFileId'] as string) || '',
    // Original (list) seller price, always shown.
    priceTonHuman: isTon ? nanoRawToTonHuman(priceRaw) : undefined,
    distributionKind: (doc['distribution_kind'] as string) || 'none',
    distributionState: (doc['distribution_state'] as string) || null,
    distributionSha256: (doc['distribution_sha256'] as string) || null,
    distributionSize: (doc['distribution_size'] as number) || null,
    scanStatus: (doc['scan_status'] as string) || 'idle',
    nftEnabled: Boolean((doc['collection_address'] as string) || ''),
    collectionAddress: (doc['collection_address'] as string) || '',
  };
}

export function appwriteCodeOrZero(e: unknown): number {
  return typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0;
}
