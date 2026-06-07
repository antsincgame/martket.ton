/**
 * Persistence for the per-seller AppCollection registry (Phase 1).
 *
 * One row per (sellerWallet, network). The on-chain owner is the platform
 * COLLECTION_OWNER key (so the existing mint worker can mint), while
 * `ownerWallet` records the seller's wallet for forward compatibility with a
 * future sovereign-collection model. Lives in Appwrite alongside the rest of
 * commerce — the legacy `app_collections` SQL table is not used by the backend.
 */

import { databases, ID, Query } from './appwrite.js';
import { DATABASE_ID, COL_SELLER_COLLECTIONS } from './constants.js';
import type { TonNetwork } from '../config/network.js';

export type SellerCollectionStatus = 'pending' | 'deployed' | 'failed';

export interface SellerCollectionRecord {
  $id: string;
  sellerWallet: string;
  network: TonNetwork;
  appId: string;
  collectionAddress: string | null;
  ownerWallet: string | null;
  metadataUri: string | null;
  itemBaseUri: string | null;
  deployTxHash: string | null;
  status: SellerCollectionStatus;
  lastError: string | null;
  deployedAt: string | null;
}

function fromDoc(doc: Record<string, unknown>): SellerCollectionRecord {
  return {
    $id: String(doc.$id),
    sellerWallet: String(doc.sellerWallet || ''),
    network: (String(doc.network || 'testnet') as TonNetwork),
    appId: String(doc.appId || ''),
    collectionAddress: (doc.collectionAddress as string | undefined) || null,
    ownerWallet: (doc.ownerWallet as string | undefined) || null,
    metadataUri: (doc.metadataUri as string | undefined) || null,
    itemBaseUri: (doc.itemBaseUri as string | undefined) || null,
    deployTxHash: (doc.deployTxHash as string | undefined) || null,
    status: (String(doc.status || 'pending') as SellerCollectionStatus),
    lastError: (doc.lastError as string | undefined) || null,
    deployedAt: (doc.deployedAt as string | undefined) || null,
  };
}

export async function findSellerCollection(
  sellerWallet: string,
  network: TonNetwork,
): Promise<SellerCollectionRecord | null> {
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_SELLER_COLLECTIONS, [
    Query.equal('sellerWallet', sellerWallet),
    Query.equal('network', network),
    Query.limit(1),
  ]);
  return documents[0] ? fromDoc(documents[0]) : null;
}

export interface UpsertPendingInput {
  sellerWallet: string;
  network: TonNetwork;
  appId: string;
  collectionAddress: string;
  ownerWallet: string;
  metadataUri: string;
  itemBaseUri: string;
}

/**
 * Record (or refresh) the intent to provision a collection. The deterministic
 * address is known before the on-chain deploy, so we persist it immediately and
 * flip `status` to `deployed` once the contract is active.
 */
export async function upsertPendingCollection(
  input: UpsertPendingInput,
): Promise<SellerCollectionRecord> {
  const existing = await findSellerCollection(input.sellerWallet, input.network);
  const data = {
    sellerWallet: input.sellerWallet,
    network: input.network,
    appId: input.appId,
    collectionAddress: input.collectionAddress,
    ownerWallet: input.ownerWallet,
    metadataUri: input.metadataUri,
    itemBaseUri: input.itemBaseUri,
    status: 'pending' as SellerCollectionStatus,
    lastError: '',
  };
  const saved = existing
    ? await databases().updateDocument(DATABASE_ID, COL_SELLER_COLLECTIONS, existing.$id, data)
    : await databases().createDocument(DATABASE_ID, COL_SELLER_COLLECTIONS, ID.unique(), data);
  return fromDoc(saved as Record<string, unknown>);
}

export async function markDeployed(
  id: string,
  patch: { collectionAddress: string; deployTxHash?: string },
): Promise<void> {
  await databases().updateDocument(DATABASE_ID, COL_SELLER_COLLECTIONS, id, {
    collectionAddress: patch.collectionAddress,
    deployTxHash: patch.deployTxHash || '',
    status: 'deployed',
    lastError: '',
    deployedAt: new Date().toISOString(),
  });
}

export async function markFailed(id: string, error: string): Promise<void> {
  await databases().updateDocument(DATABASE_ID, COL_SELLER_COLLECTIONS, id, {
    status: 'failed',
    lastError: error.slice(0, 1000),
  });
}
