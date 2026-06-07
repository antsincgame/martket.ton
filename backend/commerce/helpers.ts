import type { Request, Response } from 'express';
import { nanoRawToTonHuman } from './money.js';
import { CURRENCY } from './constants.js';
import type { AppwriteDoc } from '../domain/appwrite-helpers.js';
import { str } from '../utils/params.js';
import { resolveProfile } from '../middleware/auth.js';
import { addressesEqual } from './tonVerify.js';
import type { Profile } from '../domain/types.js';

/** Staging Appwrite listings schemas may omit newer attrs (attribute cap). */
function listingOmitFields(): Set<string> {
  const raw = (process.env.LEGACY_LISTINGS_OMIT_FIELDS || '').trim();
  return new Set(raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []);
}

export function omitListingFields<T extends Record<string, unknown>>(payload: T): T {
  const omit = listingOmitFields();
  if (omit.size === 0) return payload;
  const out = { ...payload };
  for (const key of omit) {
    delete out[key];
  }
  return out;
}

export function commerceAdmin(req: Request, res: Response, next: () => void): void {
  const got = str(req.headers['x-commerce-admin-secret']);
  const need = process.env.COMMERCE_ADMIN_SECRET || '';
  if (!need || got !== need) {
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
  return {
    id: doc.$id,
    sellerWallet: doc['sellerWallet'] as string,
    catalogProductId: doc['catalogProductId'] as string,
    title: doc['title'] as string,
    description: doc['description'] as string,
    currency: doc['currency'] as string,
    priceAmountRaw: doc['priceAmountRaw'] as string,
    priceUsd: (doc['priceUsd'] as string) || null,
    decimals: doc['decimals'] as number,
    platformFeeBps: doc['platformFeeBps'] as number,
    status: doc['status'] as string,
    deliveryType: doc['deliveryType'] as string,
    assetFileId: (doc['assetFileId'] as string) || '',
    priceTonHuman:
      doc['currency'] === CURRENCY.TON
        ? nanoRawToTonHuman(doc['priceAmountRaw'] as string)
        : undefined,
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
