/**
 * Persistence layer for License NFT records.
 *
 * Licenses live in Appwrite (`COL_LICENSES`) and are the single source
 * of truth for the on-chain license lifecycle:
 *   mint_pending → minted | mint_failed → burned | refunded
 *
 * Created by `orderRoutes.confirm` after the buyer's payment is verified.
 * Updated by `mintWorker` as the oracle progresses.
 */

import { databases, ID, Query } from './appwrite.js';
import { DATABASE_ID, COL_LICENSES, LICENSE_STATE, type LicenseStateValue } from './constants.js';

export interface LicenseRecord {
  $id: string;
  orderId: string;
  listingId: string;
  catalogProductId: string;
  buyerWallet: string;
  sellerWallet: string;
  escrowAddress: string;
  collectionAddress: string;
  nftAddress: string;
  mintTxHash: string;
  burnTxHash: string;
  refundTxHash: string;
  refundReason: string;
  mintQueryId: string;
  mintError: string;
  state: LicenseStateValue;
  mintAttempts: number;
  collectionIndex: number;
  trialEndsAt: string | null;
  mintedAt: string | null;
  lastMintAttemptAt: string | null;
  burnedAt: string | null;
  refundedAt: string | null;
  releasedAt: string | null;
  $createdAt: string;
  $updatedAt: string;
}

function fromDoc(doc: Record<string, unknown>): LicenseRecord {
  return {
    $id: String(doc.$id),
    orderId: String(doc.orderId || ''),
    listingId: String(doc.listingId || ''),
    catalogProductId: String(doc.catalogProductId || ''),
    buyerWallet: String(doc.buyerWallet || ''),
    sellerWallet: String(doc.sellerWallet || ''),
    escrowAddress: String(doc.escrowAddress || ''),
    collectionAddress: String(doc.collectionAddress || ''),
    nftAddress: String(doc.nftAddress || ''),
    mintTxHash: String(doc.mintTxHash || ''),
    burnTxHash: String(doc.burnTxHash || ''),
    refundTxHash: String(doc.refundTxHash || ''),
    refundReason: String(doc.refundReason || ''),
    mintQueryId: String(doc.mintQueryId || ''),
    mintError: String(doc.mintError || ''),
    state: (doc.state as LicenseStateValue) || LICENSE_STATE.MINT_PENDING,
    mintAttempts: Number(doc.mintAttempts || 0),
    collectionIndex: Number(doc.collectionIndex || 0),
    trialEndsAt: (doc.trialEndsAt as string | undefined) || null,
    mintedAt: (doc.mintedAt as string | undefined) || null,
    lastMintAttemptAt: (doc.lastMintAttemptAt as string | undefined) || null,
    burnedAt: (doc.burnedAt as string | undefined) || null,
    refundedAt: (doc.refundedAt as string | undefined) || null,
    releasedAt: (doc.releasedAt as string | undefined) || null,
    $createdAt: String(doc.$createdAt || ''),
    $updatedAt: String(doc.$updatedAt || ''),
  };
}

export interface CreateLicenseInput {
  orderId: string;
  listingId: string;
  catalogProductId?: string;
  buyerWallet: string;
  sellerWallet: string;
  escrowAddress?: string;
  collectionAddress?: string;
  trialEndsAt?: string | null;
  collectionIndex?: number;
  /** If `false`, license is created already in `minted` state (no NFT). */
  initialState?: LicenseStateValue;
}

export async function createLicense(input: CreateLicenseInput): Promise<LicenseRecord> {
  const doc = await databases().createDocument(DATABASE_ID, COL_LICENSES, ID.unique(), {
    orderId: input.orderId,
    listingId: input.listingId,
    catalogProductId: input.catalogProductId || '',
    buyerWallet: input.buyerWallet,
    sellerWallet: input.sellerWallet,
    escrowAddress: input.escrowAddress || '',
    collectionAddress: input.collectionAddress || '',
    nftAddress: '',
    mintTxHash: '',
    burnTxHash: '',
    mintError: '',
    state: input.initialState || LICENSE_STATE.MINT_PENDING,
    mintAttempts: 0,
    collectionIndex: input.collectionIndex || 0,
    trialEndsAt: input.trialEndsAt || null,
  });
  return fromDoc(doc);
}

export async function getLicenseById(id: string): Promise<LicenseRecord | null> {
  try {
    const doc = await databases().getDocument(DATABASE_ID, COL_LICENSES, id);
    return fromDoc(doc);
  } catch {
    return null;
  }
}

export async function findLicenseByOrderId(orderId: string): Promise<LicenseRecord | null> {
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_LICENSES, [
    Query.equal('orderId', [orderId]),
    Query.limit(1),
  ]);
  return documents[0] ? fromDoc(documents[0]) : null;
}

export async function findLicenseByBuyerAndListing(
  buyerWallet: string,
  listingId: string,
): Promise<LicenseRecord | null> {
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_LICENSES, [
    Query.equal('buyerWallet', [buyerWallet]),
    Query.equal('listingId', [listingId]),
    Query.orderDesc('$createdAt'),
    Query.limit(1),
  ]);
  return documents[0] ? fromDoc(documents[0]) : null;
}

export async function listBuyerLicenses(buyerWallet: string, limit = 100): Promise<LicenseRecord[]> {
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_LICENSES, [
    Query.equal('buyerWallet', [buyerWallet]),
    Query.orderDesc('$createdAt'),
    Query.limit(Math.min(limit, 200)),
  ]);
  return documents.map(fromDoc);
}

/**
 * For mintWorker: claim pending licenses ready for a mint attempt.
 * `staleAfterMs` skips records we touched recently (debouncing parallel
 * worker ticks).
 */
export async function listMintCandidates(staleAfterMs: number, limit = 25): Promise<LicenseRecord[]> {
  const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_LICENSES, [
    Query.equal('state', [LICENSE_STATE.MINT_PENDING]),
    Query.orderAsc('$createdAt'),
    Query.limit(Math.min(limit, 100)),
  ]);
  return documents
    .map(fromDoc)
    .filter((lic) => !lic.lastMintAttemptAt || lic.lastMintAttemptAt < cutoff);
}

/**
 * For mintWorker refund cycle: licenses stuck in `mint_failed` for at least
 * `minAgeMs`. We exclude records that already have a registered NFT
 * (`nftAddress != ''`) — those must be refunded via the buyer's BuyerBurn
 * path, not OracleRefund (the contract rejects oracle refund once a license
 * is registered).
 */
export async function listRefundCandidates(minAgeMs: number, limit = 25): Promise<LicenseRecord[]> {
  const cutoff = new Date(Date.now() - minAgeMs).toISOString();
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_LICENSES, [
    Query.equal('state', [LICENSE_STATE.MINT_FAILED]),
    Query.orderAsc('$updatedAt'),
    Query.limit(Math.min(limit, 100)),
  ]);
  return documents
    .map(fromDoc)
    .filter((lic) => lic.escrowAddress && !lic.nftAddress && lic.$updatedAt < cutoff);
}

/**
 * For mintWorker refund-confirm cycle: licenses we already broadcast
 * OracleRefund for. We poll the escrow address: once it's destroyed
 * (off-chain code 0 / not deployed) we know the refund settled.
 */
export async function listRefundPending(limit = 25): Promise<LicenseRecord[]> {
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_LICENSES, [
    Query.equal('state', [LICENSE_STATE.REFUND_PENDING]),
    Query.orderAsc('$updatedAt'),
    Query.limit(Math.min(limit, 100)),
  ]);
  return documents.map(fromDoc);
}

/**
 * For mintWorker payout cycle: licenses where:
 *   - state == minted (NFT exists)
 *   - escrowAddress is set (on-chain commerce path)
 *   - trialEndsAt is in the past (trial window closed)
 *   - releasedAt is null (we haven't released yet — set after TimeoutRelease lands)
 *
 * Buyer didn't burn during trial → seller is owed funds. Oracle sends
 * TimeoutRelease which makes the escrow self-destruct, paying seller and
 * forwarding the platform fee to treasury.
 */
export async function listPayoutCandidates(limit = 25): Promise<LicenseRecord[]> {
  const nowIso = new Date().toISOString();
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_LICENSES, [
    Query.equal('state', [LICENSE_STATE.MINTED]),
    Query.lessThan('trialEndsAt', nowIso),
    Query.orderAsc('trialEndsAt'),
    Query.limit(Math.min(limit, 100)),
  ]);
  return documents
    .map(fromDoc)
    .filter((lic) => lic.escrowAddress && !lic.releasedAt);
}

export async function countLicensesForCollection(collectionAddress: string): Promise<number> {
  if (!collectionAddress) return 0;
  const { total } = await databases().listDocuments(DATABASE_ID, COL_LICENSES, [
    Query.equal('collectionAddress', [collectionAddress]),
    Query.limit(1),
  ]);
  return total;
}

export async function updateLicense(
  id: string,
  patch: Partial<Omit<LicenseRecord, '$id' | '$createdAt' | '$updatedAt'>>,
): Promise<LicenseRecord> {
  const doc = await databases().updateDocument(DATABASE_ID, COL_LICENSES, id, patch);
  return fromDoc(doc);
}
