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

/**
 * @param license   запись лицензии для (buyer, listing)
 * @param scanStatus статус антивирус-проверки артефакта дистрибуции
 *   (listings.scan_status). Известно-плохой вердикт блокирует скачивание
 *   независимо от состояния лицензии.
 */
export function decideDownloadGate(
  license: LicenseLike | null,
  scanStatus?: string,
): GateDecision {
  if (!license) {
    return {
      kind: 'deny',
      status: 403,
      code: 'NO_LICENSE',
      message: 'License record missing for this purchase. Contact support.',
    };
  }
  // Антивирус-гейт: артефакт с вердиктом malicious/suspicious не отдаём,
  // даже если лицензия валидна. Статусы clean/idle/scanning/oversize_skip/error
  // не блокируют (скан мог быть не настроен или ещё идёт).
  if (scanStatus === 'malicious' || scanStatus === 'suspicious') {
    return {
      kind: 'deny',
      status: 403,
      code: 'SCAN_BLOCKED',
      message: 'Download blocked: artifact failed the antivirus check',
      licenseId: license.$id,
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
