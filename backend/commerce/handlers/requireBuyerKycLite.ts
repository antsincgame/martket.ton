/**
 * Guard: ensures the buyer has completed Lite KYC before creating an order.
 *
 * Queries `kyc_lite_completed_at` directly from Appwrite `core.profiles`
 * via the buyer's TON address. When missing, returns a structured error
 * `KYC_LITE_REQUIRED` so the frontend can show the KycLiteModal.
 */

import { Query } from 'node-appwrite';
import { databases as coreDatabases } from '../../core/db.js';
import { CORE_DATABASE_ID, COL_PROFILES } from '../../core/constants.js';
import { asDoc } from '../../domain/appwrite-helpers.js';
import { logger } from '../../logger.js';

export interface BuyerKycOk {
  ok: true;
}
export interface BuyerKycFail {
  ok: false;
  status: number;
  code: 'KYC_LITE_REQUIRED';
  message: string;
}
export type BuyerKycResult = BuyerKycOk | BuyerKycFail;

const FAIL_RESPONSE: BuyerKycFail = {
  ok: false,
  status: 403,
  code: 'KYC_LITE_REQUIRED',
  message: 'Complete identity verification before purchasing.',
};

export async function requireBuyerKycLite(buyerWallet: string): Promise<BuyerKycResult> {
  if (!buyerWallet) {
    return FAIL_RESPONSE;
  }

  try {
    const res = await coreDatabases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
      Query.equal('ton_address', buyerWallet),
      Query.limit(1),
    ]);
    const rawDoc = res.documents[0];
    if (!rawDoc) {
      return FAIL_RESPONSE;
    }

    const doc = asDoc(rawDoc);
    const completedAt = doc['kyc_lite_completed_at'];
    if (!completedAt) {
      return FAIL_RESPONSE;
    }

    return { ok: true };
  } catch (err) {
    logger.warn('[requireBuyerKycLite] lookup failed:', err);
    return FAIL_RESPONSE;
  }
}
