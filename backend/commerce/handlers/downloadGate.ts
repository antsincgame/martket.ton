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

export interface ScanDenial {
  status: number;
  code: string;
  message: string;
}

/**
 * Antivirus decision for a distribution artifact, independent of any license.
 * Returns a denial or null (artifact may be served). This is the part of the
 * gate that must apply to EVERYONE who downloads — buyers, the seller, AND
 * reviewing staff — since reviewers are exactly the population most likely to be
 * handed a malicious build. `scanRequired` (antivirus configured) makes it
 * fail-closed: only a `clean` verdict passes.
 */
export function decideScanGate(scanStatus: string | undefined, scanRequired: boolean): ScanDenial | null {
  if (scanStatus === 'malicious' || scanStatus === 'suspicious') {
    return { status: 403, code: 'SCAN_BLOCKED', message: 'Download blocked: artifact failed the antivirus check' };
  }
  if (scanRequired && scanStatus !== 'clean') {
    return scanStatus === 'scanning'
      ? { status: 425, code: 'SCAN_IN_PROGRESS', message: 'Antivirus scan in progress; try again shortly' }
      : { status: 403, code: 'SCAN_REQUIRED', message: 'Download blocked: artifact has not passed an antivirus scan' };
  }
  return null;
}

/**
 * @param license   запись лицензии для (buyer, listing)
 * @param scanStatus статус антивирус-проверки артефакта дистрибуции
 *   (listings.scan_status).
 * @param scanRequired когда true (антивирус сконфигурирован), гейт работает
 *   FAIL-CLOSED: отдаём только при вердикте `clean`. Это закрывает M-8 —
 *   продавец, сменивший manifest после одобрения, сбрасывает scan_status в
 *   `idle`, и без fail-closed незсканированный (возможно вредоносный) билд
 *   утекал бы покупателям. Когда антивирус НЕ настроен (scanRequired=false),
 *   блокируем лишь известно-плохие вердикты, чтобы не убить дистрибуцию там,
 *   где сканирование вообще не включено.
 */
export function decideDownloadGate(
  license: LicenseLike | null,
  scanStatus?: string,
  scanRequired = false,
): GateDecision {
  if (!license) {
    return {
      kind: 'deny',
      status: 403,
      code: 'NO_LICENSE',
      message: 'License record missing for this purchase. Contact support.',
    };
  }
  // Антивирус-гейт (общий с decideScanGate): malicious/suspicious не отдаём, а
  // при включённом антивирусе — только `clean` (fail-closed).
  const scanDenial = decideScanGate(scanStatus, scanRequired);
  if (scanDenial) {
    return { kind: 'deny', ...scanDenial, licenseId: license.$id };
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
