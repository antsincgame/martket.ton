import type { Request, Response } from 'express';
import { nanoRawToTonHuman } from './money.js';
import { CURRENCY } from './constants.js';
import type { AppwriteDoc } from '../domain/appwrite-helpers.js';
import { str } from '../utils/params.js';

export function commerceAdmin(req: Request, res: Response, next: () => void): void {
  const got = str(req.headers['x-commerce-admin-secret']);
  const need = process.env.COMMERCE_ADMIN_SECRET || '';
  if (!need || got !== need) {
    res.status(403).json({ error: 'Insufficient privileges', code: 'COMMERCE_ADMIN_FORBIDDEN' });
    return;
  }
  next();
}

export function mapListingPublic(doc: AppwriteDoc) {
  return {
    id: doc.$id,
    sellerWallet: doc['sellerWallet'] as string,
    catalogProductId: doc['catalogProductId'] as string,
    title: doc['title'] as string,
    description: doc['description'] as string,
    currency: doc['currency'] as string,
    jettonMaster: (doc['jettonMaster'] as string) || '',
    priceAmountRaw: doc['priceAmountRaw'] as string,
    decimals: doc['decimals'] as number,
    platformFeeBps: doc['platformFeeBps'] as number,
    status: doc['status'] as string,
    deliveryType: doc['deliveryType'] as string,
    assetFileId: (doc['assetFileId'] as string) || '',
    priceTonHuman:
      doc['currency'] === CURRENCY.TON
        ? nanoRawToTonHuman(doc['priceAmountRaw'] as string)
        : undefined,
  };
}

export function appwriteCodeOrZero(e: unknown): number {
  return typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0;
}
