/**
 * Shared buyer-download resolver.
 *
 * The buyer path to a signed download URL — verified build → manifest →
 * antivirus verdict → entitlement → minted-license → daily rate limit → seller
 * resolution → TTL — is identical for the human storefront
 * (`commerce/distributionRoutes.ts`) and the buyer-agent surface
 * (`agent/buyerRoutes.ts`). Keeping two copies of security gates invites drift
 * (a threshold bumped in one but not the other). This is the single source.
 *
 * It returns a denial (status + code + message) or a grant carrying everything
 * a caller needs to SIGN and AUDIT — those last two steps differ per surface
 * (JSON vs 302; buyer-only audit), so they stay in the routes.
 *
 * The scan gate is applied here for the buyer case; the human route applies it
 * to everyone (incl. owner/staff) before branching, so it is also run there.
 */

import type { Databases } from 'node-appwrite';
import { Query } from './appwrite.js';
import {
  DATABASE_ID, COL_ENTITLEMENTS, COL_DOWNLOAD_AUDIT, COL_SELLER_PROFILES,
} from './constants.js';
import { decideScanGate, decideDownloadGate } from './handlers/downloadGate.js';
import { isVtConfigured } from '../scan/virustotal.js';
import { findLicenseByBuyerAndListing } from './licenseRepository.js';
import { storedToManifest, type DistributionManifest } from '../distribution/manifest.js';
import { logger } from '../logger.js';

/** Max signed URLs/day per entitlement — shared so the budget can't diverge. */
export const DOWNLOAD_RATE_LIMIT_PER_DAY = 20;
const TTL_MIN = 60;
const TTL_MAX = 21600;
const TTL_DEFAULT = 3600;

/** Listing fields the resolver reads (subset of the listing document). */
export interface DownloadListingDoc {
  $id: string;
  sellerWallet?: string;
  distribution_kind?: string;
  distribution_locator?: string;
  distribution_sha256?: string;
  distribution_filename?: string;
  distribution_state?: string;
  distribution_ttl_sec?: number;
  scan_status?: string;
}

export interface DownloadDenial {
  ok: false;
  status: number;
  code: string;
  message: string;
  /** Extra body fields (e.g. licenseId, state) the route should merge in. */
  extra?: Record<string, unknown>;
}

export interface DownloadGrant {
  ok: true;
  manifest: DistributionManifest;
  sellerId: string;
  ttlSec: number;
  entitlementId: string;
  sha256: string;
}

export type DownloadResolution = DownloadDenial | DownloadGrant;

/**
 * Run the full buyer-side download gauntlet for (listing, wallet). The listing
 * document is passed in (the caller already fetched it / did 404 handling).
 */
export async function resolveBuyerDownload(
  db: Databases,
  doc: DownloadListingDoc,
  wallet: string,
): Promise<DownloadResolution> {
  if (doc.distribution_state !== 'verified') {
    return { ok: false, status: 404, code: 'NO_BUILD', message: 'Build not available' };
  }
  const kind = doc.distribution_kind || '';
  const locatorRaw = doc.distribution_locator || '';
  if (!kind || kind === 'none' || !locatorRaw) {
    return { ok: false, status: 404, code: 'NO_MANIFEST', message: 'Manifest missing' };
  }

  // Antivirus gate — malicious/suspicious/unscanned (when VT configured) never served.
  const scanDenial = decideScanGate(doc.scan_status, isVtConfigured());
  if (scanDenial) {
    return { ok: false, status: scanDenial.status, code: scanDenial.code, message: scanDenial.message };
  }

  // Entitlement: the wallet must have a purchase record for this listing.
  const { documents: entDocs } = await db.listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
    Query.equal('buyerWallet', [wallet]),
    Query.equal('listingId', [doc.$id]),
    Query.limit(1),
  ]);
  if (entDocs.length === 0) {
    return { ok: false, status: 403, code: 'NO_ENTITLEMENT', message: 'No entitlement for this product' };
  }

  // License gate: record exists, state==minted, nftAddress set, clean scan.
  // Without a real NFT the buyer-burn refund guarantee does not apply.
  const license = await findLicenseByBuyerAndListing(wallet, doc.$id);
  const gate = decideDownloadGate(license, doc.scan_status, isVtConfigured());
  if (gate.kind === 'deny') {
    const extra: Record<string, unknown> = {};
    if (gate.licenseId) extra.licenseId = gate.licenseId;
    if (license) extra.state = license.state;
    return { ok: false, status: gate.status, code: gate.code, message: gate.message, extra };
  }

  // Rate limit: ≤ N signed URLs/day per entitlement (key shared across surfaces).
  const entitlementId = String(entDocs[0]!.$id);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const recent = await db.listDocuments(DATABASE_ID, COL_DOWNLOAD_AUDIT, [
    Query.equal('license_id', [entitlementId]),
    Query.greaterThan('issued_at', since),
    Query.limit(DOWNLOAD_RATE_LIMIT_PER_DAY + 1),
  ]);
  if (recent.documents.length >= DOWNLOAD_RATE_LIMIT_PER_DAY) {
    return {
      ok: false, status: 429, code: 'DOWNLOAD_RATE_LIMIT',
      message: `Download rate limit exceeded (${DOWNLOAD_RATE_LIMIT_PER_DAY}/day)`,
    };
  }

  let locator: Record<string, unknown>;
  try {
    locator = JSON.parse(locatorRaw) as Record<string, unknown>;
  } catch (err) {
    logger.warn(`[buyerDownload] bad locator for listing ${doc.$id}: ${(err as Error).message}`);
    return { ok: false, status: 404, code: 'NO_MANIFEST', message: 'Manifest missing' };
  }
  const sha256 = doc.distribution_sha256 || '';
  const manifest = storedToManifest({
    kind: kind as 'r2' | 'github',
    bucket: locator.bucket as string | undefined,
    key: locator.key as string | undefined,
    repo: locator.repo as string | undefined,
    tag: locator.tag as string | undefined,
    asset: locator.asset as string | undefined,
    sha256,
    filename: doc.distribution_filename,
  });

  const sellerWallet = doc.sellerWallet || '';
  const { documents: sellers } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
    Query.equal('wallet', [sellerWallet]),
    Query.limit(1),
  ]);
  const sellerId = sellers[0]?.$id || sellerWallet;

  const ttlSec = Math.min(TTL_MAX, Math.max(TTL_MIN, doc.distribution_ttl_sec || TTL_DEFAULT));

  return { ok: true, manifest, sellerId, ttlSec, entitlementId, sha256 };
}
