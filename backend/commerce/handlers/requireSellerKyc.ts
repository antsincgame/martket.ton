/**
 * Seller-side KYC + sanctions guard.
 *
 * Sellers must be verified before they can:
 *   - publish a new listing (POST /listings)
 *   - flip a listing to status='active' (PATCH /listings/:id)
 *   - configure distribution (PUT /listings/:id/distribution)
 *
 * Buyers do NOT need KYC; they only get sanctions screening (see
 * `backend/sanctions/screen.ts`). This split lets us launch a low-friction
 * marketplace while staying compliant with US/EU rules: every party that
 * receives funds is identified, every party that sends funds is screened
 * against OFAC SDN / EU consolidated lists.
 *
 * The seller's KYC status lives in the legacy TonForge in-memory profile
 * (`developerProfiles[].kycStatus`). When that store is migrated to
 * Appwrite, this helper is the single switch point.
 */

import { getTonForgeService } from '../../tonforge/service.js';
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

export function requireSellerKyc(wallet: string): SellerGuardResult {
  if (!wallet) {
    return { ok: false, status: 400, code: 'KYC_REQUIRED', message: 'wallet is required' };
  }

  // Sanctions check first — a sanctioned wallet must not transact at all,
  // even if KYC was somehow approved earlier.
  const screen = screenWallet(wallet);
  if (!screen.ok) {
    return {
      ok: false,
      status: 451,
      code: 'SANCTIONED',
      message: `Wallet is on a sanctions list (${screen.reason}).`,
    };
  }

  let profile;
  try {
    const ws = getTonForgeService().getDeveloperWorkspace(wallet);
    profile = ws.developer;
  } catch (err) {
    logger.warn('[requireSellerKyc] developer lookup failed:', err);
    return {
      ok: false,
      status: 500,
      code: 'PROFILE_ERROR',
      message: 'Could not verify seller profile.',
    };
  }

  switch (profile.kycStatus) {
    case 'approved':
      return { ok: true };
    case 'under_review':
      return {
        ok: false,
        status: 403,
        code: 'KYC_PENDING',
        message: 'KYC is under review. Please wait for approval before publishing.',
      };
    case 'rejected':
      return {
        ok: false,
        status: 403,
        code: 'KYC_REJECTED',
        message: 'KYC was rejected. Contact support to appeal.',
      };
    case 'draft':
    default:
      return {
        ok: false,
        status: 403,
        code: 'KYC_REQUIRED',
        message: 'Complete KYC in the Publishing tab before publishing products.',
      };
  }
}
