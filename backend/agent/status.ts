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

/**
 * Copilot-Lite (deterministic, no LLM): the single next step toward autonomy,
 * tied to the instruction section that explains it and a concrete affordance —
 * the exact agent-API call for a machine, and the UI action for a human. One
 * structure, two equal faces (Agent API + Demiurge UI): a human and a machine
 * Demiurge get identical guidance.
 */
export interface NextAction {
  step: 'kyc' | 'storage' | 'create_product' | 'verify_distribution' | 'done';
  message: string;
  /** Instruction section (GET /api/v1/agent/instructions) that explains this step. */
  section: string;
  /** Machine affordance: the agent-API call to make next (`:id` = your listing id). */
  api: { method: string; path: string } | null;
  /** Human affordance: a label + where to act in the Demiurge UI. */
  ui: { label: string; hint: string };
  /** Off-platform prerequisite the platform cannot do for you, or null. */
  external: string | null;
}

export interface OnboardingChecklist {
  kyc: { status: string; ok: boolean };
  storage: { status: string; connected: boolean; provider: string | null };
  catalog: { listings: number; hasListings: boolean };
  distribution: { configured: boolean; verified: boolean };
  readyToSell: boolean;
  /** The single most useful next step as a sentence, or null when fully onboarded. */
  nextStep: string | null;
  /** Structured, actionable form of the next step (Copilot-Lite). */
  nextAction: NextAction;
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

/**
 * Map the onboarding checklist to the single structured next action. Pure +
 * exported for tests. Mirrors the `nextStep` ladder but adds the instruction
 * section, the machine API affordance, and the human UI affordance — so the
 * Demiurge (human or machine) is guided to autonomy through one shared brain.
 */
export function deriveNextAction(
  o: Pick<OnboardingChecklist, 'kyc' | 'storage' | 'catalog' | 'distribution'>,
): NextAction {
  if (!o.kyc.ok) {
    return {
      step: 'kyc',
      message: 'Complete identity verification (KYC) via your human owner before publishing.',
      section: 'kyc',
      api: null,
      ui: { label: 'Verify identity', hint: 'Demiurge → verification' },
      external: 'A real human owner/operator completes KYC.',
    };
  }
  if (!o.storage.connected && !o.distribution.configured) {
    return {
      step: 'storage',
      message: 'Connect distribution storage (R2/S3/B2) or attach a GitHub release.',
      section: 'prerequisites',
      api: { method: 'PUT', path: '/api/v1/agent/listings/:id/distribution' },
      ui: { label: 'Connect distribution', hint: 'Demiurge → distribution' },
      external: 'Provision Cloudflare R2 / S3 / B2, or prepare a GitHub release.',
    };
  }
  if (!o.catalog.hasListings) {
    return {
      step: 'create_product',
      message: 'Create your first product draft.',
      section: 'onboarding',
      api: { method: 'POST', path: '/api/v1/agent/products' },
      ui: { label: 'Create a draft product', hint: 'Demiurge → new product' },
      external: null,
    };
  }
  if (!o.distribution.verified) {
    return {
      step: 'verify_distribution',
      message: 'Attach and verify a distribution manifest on a listing.',
      section: 'onboarding',
      api: { method: 'PUT', path: '/api/v1/agent/listings/:id/distribution' },
      ui: { label: 'Attach & verify distribution', hint: 'Demiurge → listing → distribution' },
      external: null,
    };
  }
  return {
    step: 'done',
    message: 'You are onboarded. Sell honestly, keep your source healthy, and invite buyers to review after delivery.',
    section: 'behavior',
    api: null,
    ui: { label: 'Start selling', hint: 'Demiurge → listings' },
    external: null,
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

  const checklist: Omit<OnboardingChecklist, 'nextAction'> = {
    kyc: { status: kycStatus, ok: kycOk },
    storage: { status: storageStatus, connected: storageConnected, provider: storageProvider },
    catalog: { listings: snap.listingsTotal, hasListings },
    distribution: { configured, verified },
    readyToSell,
    nextStep,
  };
  return { ...checklist, nextAction: deriveNextAction(checklist) };
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
