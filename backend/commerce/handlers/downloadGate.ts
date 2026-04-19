/**
 * Pure decision function for the download gate.
 *
 * Extracted from distributionRoutes.ts so we can unit-test the full gate
 * matrix (license missing / mint_pending / minted+nft / minted-without-nft /
 * mint_failed / refund_pending / burned / refunded) without spinning up
 * Appwrite or Express.
 *
 * The route handler still owns I/O (entitlement lookup, audit, redirect),
 * but the policy lives here.
 */

import { LICENSE_STATE, type LicenseStateValue } from '../constants.js';

export interface LicenseLike {
  $id: string;
  state: LicenseStateValue;
  nftAddress: string;
}

export type GateDecision =
  | { kind: 'allow' }
  | { kind: 'deny'; status: number; code: string; message: string; licenseId?: string };

export function decideDownloadGate(license: LicenseLike | null): GateDecision {
  if (!license) {
    return {
      kind: 'deny',
      status: 403,
      code: 'NO_LICENSE',
      message: 'License record missing for this purchase. Contact support.',
    };
  }
  if (license.state === LICENSE_STATE.MINT_PENDING) {
    return {
      kind: 'deny',
      status: 425,
      code: 'MINT_PENDING',
      message: 'License NFT mint in progress',
      licenseId: license.$id,
    };
  }
  if (license.state === LICENSE_STATE.MINTED && license.nftAddress) {
    return { kind: 'allow' };
  }
  // Everything else (mint_failed / refund_pending / burned / refunded /
  // minted-without-nftAddress) is a hard deny.
  const code =
    license.state === LICENSE_STATE.MINT_FAILED ? 'MINT_FAILED' :
    license.state === LICENSE_STATE.REFUND_PENDING ? 'REFUND_PENDING' :
    license.state === LICENSE_STATE.REFUNDED ? 'REFUNDED' :
    license.state === LICENSE_STATE.BURNED ? 'BURNED' :
    'LICENSE_INVALID';
  return {
    kind: 'deny',
    status: 403,
    code,
    message: 'License is no longer valid',
    licenseId: license.$id,
  };
}
