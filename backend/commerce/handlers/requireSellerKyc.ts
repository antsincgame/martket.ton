/**
 * Seller-side KYC + sanctions guard.
 *
 * Sellers must be verified before they can:
 *   - publish a new listing (POST /listings)
 *   - flip a listing to status='active' (PATCH /listings/:id)
 *   - configure distribution (PUT /listings/:id/distribution)
 *
 * Buyers do NOT need KYC; they only get sanctions screening (see
 * `backend/sanctions/screen.ts`) + Lite KYC.
 *
 * The seller's KYC status now lives in Appwrite `marketplace.seller_profiles`
 * in the `kyc_status` field. This replaces the legacy TonForge in-memory
 * profile store.
 */

import { Query } from 'node-appwrite';
import { databases } from '../appwrite.js';
import { DATABASE_ID, COL_SELLER_PROFILES } from '../constants.js';
import { screenWallet } from '../../sanctions/screen.js';
import { logger } from '../../logger.js';

export type SellerGuardOk = { ok: true };
export type SellerGuardFail = {
  ok: false;
  status: number;
  code: 'KYC_REQUIRED' | 'KYC_PENDING' | 'KYC_REJECTED' | 'SANCTIONED' | 'PROFILE_ERROR';
  message: string;
};
export type SellerGuardResult = SellerGuardOk | SellerGuardFail;

export async function requireSellerKyc(wallet: string): Promise<SellerGuardResult> {
  if (!wallet) {
    return { ok: false, status: 400, code: 'KYC_REQUIRED', message: 'wallet is required' };
  }

  const screen = screenWallet(wallet);
  if (!screen.ok) {
    return {
      ok: false,
      status: 451,
      code: 'SANCTIONED',
      message: `Wallet is on a sanctions list (${screen.reason}).`,
    };
  }

  try {
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
      Query.equal('wallet', wallet),
      Query.limit(1),
    ]);

    if (documents.length === 0) {
      return {
        ok: false,
        status: 403,
        code: 'KYC_REQUIRED',
        message: 'Register as a seller and complete identity verification before publishing.',
      };
    }

    const doc = documents[0] as Record<string, unknown>;
    const kycStatus = (doc['kyc_status'] as string) || 'none';

    switch (kycStatus) {
      case 'approved':
        return { ok: true };
      case 'pending':
        return {
          ok: false,
          status: 403,
          code: 'KYC_PENDING',
          message: 'Identity verification is in progress. Please wait for approval before publishing.',
        };
      case 'rejected':
        return {
          ok: false,
          status: 403,
          code: 'KYC_REJECTED',
          message: 'Identity verification was rejected. Contact support to appeal.',
        };
      case 'none':
      default:
        return {
          ok: false,
          status: 403,
          code: 'KYC_REQUIRED',
          message: 'Complete identity verification in the Publishing tab before publishing products.',
        };
    }
  } catch (err) {
    logger.warn('[requireSellerKyc] Appwrite lookup failed:', err);
    return {
      ok: false,
      status: 500,
      code: 'PROFILE_ERROR',
      message: 'Could not verify seller profile.',
    };
  }
}
