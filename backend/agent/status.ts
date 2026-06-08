/**
 * Agent self-status + onboarding checklist.
 *
 * Both are DERIVED from existing account state — no new persistence. The
 * onboarding checklist reads the seller profile (KYC + BYOS storage) and the
 * agent's listings; the full status additionally aggregates order states. All
 * reads are scoped to the wallet bound to the token, and the status payload
 * returns only counts (no buyer PII), which is why `/status` needs no read
 * scope and is readable before KYC.
 */

import { databases, Query } from '../commerce/appwrite.js';
import {
  DATABASE_ID,
  COL_SELLER_PROFILES,
  COL_LISTINGS,
  COL_ORDERS,
  COL_LICENSES,
} from '../commerce/constants.js';
import { findUserByTonAddress } from '../core/profileRepository.js';
import { listProductsByCreator } from '../core/productRepository.js';
import { logger } from '../logger.js';

/** First-page cap when sampling listings/orders for a status snapshot. */
const PAGE = 100;
const ORDERS_PAGE = 500;
const LICENSES_PAGE = 500;

export interface OnboardingChecklist {
  kyc: { status: string; ok: boolean };
  storage: { status: string; connected: boolean; provider: string | null };
  catalog: { listings: number; hasListings: boolean };
  distribution: { configured: boolean; verified: boolean };
  readyToSell: boolean;
  /** The single most useful next action, or null when fully onboarded. */
  nextStep: string | null;
}

export interface AgentStatus {
  wallet: string;
  onboarding: OnboardingChecklist;
  listings: { total: number; byStatus: Record<string, number> };
  orders: { total: number; byState: Record<string, number> };
  /** License NFTs minted for this seller's sales, by lifecycle state. */
  licenses: { total: number; byState: Record<string, number> };
  /** Catalog products this agent authored, by antivirus scan status. */
  products: { total: number; byScanStatus: Record<string, number> };
  distribution: { configured: number; verified: number; needsAttention: number };
}

interface SellerSnapshot {
  profile: Record<string, unknown> | null;
  listings: Array<Record<string, unknown>>;
  listingsTotal: number;
}

function countBy(docs: Array<Record<string, unknown>>, field: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of docs) {
    const key = String(d[field] ?? 'unknown');
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

async function loadSnapshot(wallet: string): Promise<SellerSnapshot> {
  const db = databases();
  let profile: Record<string, unknown> | null = null;
  try {
    const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
      Query.equal('wallet', wallet),
      Query.limit(1),
    ]);
    profile = (documents[0] as Record<string, unknown>) ?? null;
  } catch (err) {
    logger.debug('[agent-status] seller profile lookup failed:', err instanceof Error ? err.message : err);
  }

  const listingsRes = await db.listDocuments(DATABASE_ID, COL_LISTINGS, [
    Query.equal('sellerWallet', wallet),
    Query.limit(PAGE),
  ]);

  return {
    profile,
    listings: listingsRes.documents as Array<Record<string, unknown>>,
    listingsTotal: listingsRes.total,
  };
}

function deriveOnboarding(snap: SellerSnapshot): OnboardingChecklist {
  const kycStatus = (snap.profile?.['kyc_status'] as string) || 'none';
  const kycOk = kycStatus === 'approved';

  const storageStatus = (snap.profile?.['storage_status'] as string) || 'unconfigured';
  const storageProvider = (snap.profile?.['storage_provider'] as string) || null;
  const storageConnected = storageStatus === 'connected';

  const hasListings = snap.listingsTotal > 0;
  const configured = snap.listings.some(
    (l) => Boolean(l['distribution_kind']) && l['distribution_kind'] !== 'none',
  );
  const verified = snap.listings.some((l) => l['distribution_state'] === 'verified');

  // Distribution is satisfiable either via connected BYOS storage or a GitHub
  // release attached to a listing, so don't hard-require `storageConnected`.
  const readyToSell = kycOk && hasListings && verified;

  let nextStep: string | null = null;
  if (!kycOk) {
    nextStep = 'Complete identity verification (KYC) via your human owner before publishing.';
  } else if (!storageConnected && !configured) {
    nextStep = 'Connect distribution storage (R2/S3/B2) or attach a GitHub release.';
  } else if (!hasListings) {
    nextStep = 'Create your first product draft.';
  } else if (!verified) {
    nextStep = 'Attach and verify a distribution manifest on a listing.';
  }

  return {
    kyc: { status: kycStatus, ok: kycOk },
    storage: { status: storageStatus, connected: storageConnected, provider: storageProvider },
    catalog: { listings: snap.listingsTotal, hasListings },
    distribution: { configured, verified },
    readyToSell,
    nextStep,
  };
}

/** Lightweight onboarding checklist (used by `/instructions` and `/status`). */
export async function buildOnboardingChecklist(wallet: string): Promise<OnboardingChecklist> {
  return deriveOnboarding(await loadSnapshot(wallet));
}

/** Full self-status: onboarding + listing/order/distribution aggregates. */
export async function buildAgentStatus(wallet: string): Promise<AgentStatus> {
  const snap = await loadSnapshot(wallet);
  const onboarding = deriveOnboarding(snap);

  const byStatus = countBy(snap.listings, 'status');

  let orders = { total: 0, byState: {} as Record<string, number> };
  const listingIds = snap.listings.map((l) => String(l.$id));
  if (listingIds.length > 0) {
    try {
      const ordersRes = await databases().listDocuments(DATABASE_ID, COL_ORDERS, [
        Query.equal('listingId', listingIds),
        Query.limit(ORDERS_PAGE),
      ]);
      orders = {
        total: ordersRes.total,
        byState: countBy(ordersRes.documents as Array<Record<string, unknown>>, 'state'),
      };
    } catch (err) {
      logger.debug('[agent-status] orders aggregate failed:', err instanceof Error ? err.message : err);
    }
  }

  // Licenses minted for this seller's sales, by lifecycle state (mint_pending,
  // minted, mint_failed, refund_*, burned, refunded). `License.sellerWallet` is
  // the authoritative link from a license back to the seller.
  let licenses = { total: 0, byState: {} as Record<string, number> };
  try {
    const licRes = await databases().listDocuments(DATABASE_ID, COL_LICENSES, [
      Query.equal('sellerWallet', wallet),
      Query.limit(LICENSES_PAGE),
    ]);
    licenses = {
      total: licRes.total,
      byState: countBy(licRes.documents as Array<Record<string, unknown>>, 'state'),
    };
  } catch (err) {
    logger.debug('[agent-status] licenses aggregate failed:', err instanceof Error ? err.message : err);
  }

  // Catalog products this agent authored, by antivirus scan status. Products live
  // in the core DB keyed by the seller's catalog profile id (creator_id).
  let products = { total: 0, byScanStatus: {} as Record<string, number> };
  try {
    const creator = await findUserByTonAddress(wallet);
    if (creator) {
      const prods = await listProductsByCreator(creator.id);
      products = {
        total: prods.length,
        byScanStatus: countBy(prods as unknown as Array<Record<string, unknown>>, 'scanStatus'),
      };
    }
  } catch (err) {
    logger.debug('[agent-status] products aggregate failed:', err instanceof Error ? err.message : err);
  }

  const configured = snap.listings.filter(
    (l) => Boolean(l['distribution_kind']) && l['distribution_kind'] !== 'none',
  ).length;
  const verified = snap.listings.filter((l) => l['distribution_state'] === 'verified').length;
  const needsAttention = snap.listings.filter(
    (l) => l['distribution_state'] === 'manifest_drift' || l['distribution_state'] === 'source_unavailable',
  ).length;

  return {
    wallet,
    onboarding,
    listings: { total: snap.listingsTotal, byStatus },
    orders,
    licenses,
    products,
    distribution: { configured, verified, needsAttention },
  };
}
