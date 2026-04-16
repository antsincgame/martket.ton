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
    priceTon: (doc['price_ton'] as number) ?? 0,
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

export async function listPurchasesByUser(userId: string): Promise<Purchase[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PURCHASES, [
    Query.equal('user_id', userId),
    Query.orderDesc('$createdAt'),
    Query.limit(5000),
  ]);
  return res.documents.map((d) => mapPurchase(asDoc(d)));
}

export async function insertPurchase(row: {
  id?: string;
  user_id: string;
  product_id: string;
  price_ton?: number;
  tx_hash?: string | null;
}): Promise<Purchase | null> {
  const id = row.id || generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_PURCHASES, id, {
    user_id: row.user_id,
    product_id: row.product_id,
    price_ton: row.price_ton ?? 0,
    tx_hash: row.tx_hash ?? null,
  });
  return findPurchase(row.user_id, row.product_id);
}
