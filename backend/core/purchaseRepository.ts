import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_PURCHASES } from './constants.js';
import { generateId } from './generateId.js';
import type { Purchase, ProfileId, ProductId } from '../domain/types.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';

function mapPurchase(doc: AppwriteDoc): Purchase {
  return {
    id: doc.$id,
    userId: doc['user_id'] as ProfileId,
    productId: doc['product_id'] as ProductId,
    priceUsd: (doc['price_usd'] as number) ?? 0,
    txHash: (doc['tx_hash'] as string) ?? null,
    createdAt: doc.$createdAt,
  };
}

export async function findPurchase(userId: string, productId: string): Promise<Purchase | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PURCHASES, [
    Query.equal('user_id', userId),
    Query.equal('product_id', productId),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapPurchase(asDoc(doc)) : null;
}

/**
 * Anti-replay lookup: ensure the same on-chain tx_hash cannot be used twice.
 */
export async function findPurchaseByTxHash(txHash: string): Promise<Purchase | null> {
  if (!txHash) return null;
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PURCHASES, [
    Query.equal('tx_hash', txHash),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapPurchase(asDoc(doc)) : null;
}

export async function listPurchasesByUser(userId: string): Promise<Purchase[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PURCHASES, [
    Query.equal('user_id', userId),
    Query.orderDesc('$createdAt'),
    Query.limit(5000),
  ]);
  return res.documents.map((d) => mapPurchase(asDoc(d)));
}

function isConflict(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 409;
}

export async function insertPurchase(row: {
  id?: string;
  user_id: string;
  product_id: string;
  price_usd?: number;
  tx_hash?: string | null;
}): Promise<Purchase | null> {
  const id = row.id || generateId();
  try {
    await databases().createDocument(CORE_DATABASE_ID, COL_PURCHASES, id, {
      user_id: row.user_id,
      product_id: row.product_id,
      price_usd: row.price_usd ?? 0,
      tx_hash: row.tx_hash ?? null,
    });
  } catch (err) {
    // A unique index (uniq_tx_hash or idx_user_product) rejected a concurrent
    // or replayed insert. Treat as idempotent: return the row that won the race
    // instead of surfacing a 500 / creating a duplicate ownership record.
    if (isConflict(err)) {
      const byTx = row.tx_hash ? await findPurchaseByTxHash(row.tx_hash) : null;
      return byTx ?? (await findPurchase(row.user_id, row.product_id));
    }
    throw err;
  }
  return findPurchase(row.user_id, row.product_id);
}
