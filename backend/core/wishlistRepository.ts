/**
 * Buyer wishlist / favorites (store-class engagement). Per-user saved catalog
 * products, keyed by `profile.id` (same identity as `core.purchases`). The
 * collection is server-only: the backend reads/writes with the service key and
 * the frontend never touches Appwrite directly — it goes through Express routes
 * gated by `resolveProfile`.
 */
import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_WISHLISTS } from './constants.js';
import { generateId } from './generateId.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';

export interface WishlistItem {
  id: string;
  userId: string;
  catalogProductId: string;
  createdAt: string;
}

function mapItem(doc: AppwriteDoc): WishlistItem {
  return {
    id: doc.$id,
    userId: doc['user_id'] as string,
    catalogProductId: doc['catalog_product_id'] as string,
    createdAt: doc.$createdAt,
  };
}

export async function listWishlistByUser(userId: string): Promise<WishlistItem[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_WISHLISTS, [
    Query.equal('user_id', userId),
    Query.orderDesc('$createdAt'),
    Query.limit(5000),
  ]);
  return res.documents.map((d) => mapItem(asDoc(d)));
}

async function findItem(userId: string, catalogProductId: string): Promise<WishlistItem | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_WISHLISTS, [
    Query.equal('user_id', userId),
    Query.equal('catalog_product_id', catalogProductId),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapItem(asDoc(doc)) : null;
}

function isConflict(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 409;
}

/** Idempotent add — a unique (user_id, catalog_product_id) index dedups. */
export async function addWishlist(userId: string, catalogProductId: string): Promise<WishlistItem | null> {
  try {
    await databases().createDocument(CORE_DATABASE_ID, COL_WISHLISTS, generateId(), {
      user_id: userId,
      catalog_product_id: catalogProductId,
    });
  } catch (err) {
    if (!isConflict(err)) throw err;
  }
  return findItem(userId, catalogProductId);
}

export async function removeWishlist(userId: string, catalogProductId: string): Promise<void> {
  const existing = await findItem(userId, catalogProductId);
  if (existing) {
    await databases().deleteDocument(CORE_DATABASE_ID, COL_WISHLISTS, existing.id);
  }
}
