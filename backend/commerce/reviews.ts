/**
 * Reviews & ratings (store-class trust). Buyers who hold a license for a catalog
 * product can leave one verified review; the product's aggregate rating is then
 * recomputed from the visible reviews — replacing the old static seed scalar.
 *
 * Reviews live in the `marketplace` DB (`DATABASE_ID`) collection `reviews`,
 * keyed by `productId` = the catalog product id (== licenses.catalogProductId
 * for real seller products). The aggregate is denormalised onto the catalog
 * product so storefront cards reflect it.
 */

import { databases, ID, Query } from './appwrite.js';
import { DATABASE_ID, COL_REVIEWS } from './constants.js';
import { findProductById, updateProduct } from '../core/productRepository.js';
import { logger } from '../logger.js';

export interface ReviewItem {
  id: string;
  productId: string;
  author: string;
  rating: number;
  comment: string;
  helpful: number;
  date: string;
  verified: boolean;
  status: string;
}

export interface ReviewAggregate {
  averageRating: number; // 1 decimal
  count: number;
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
}

// ─── Pure aggregator (unit-tested) ──────────────────────────────────

export function computeReviewAggregate(items: { rating: number }[]): ReviewAggregate {
  const histogram: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let count = 0;
  for (const it of items) {
    const r = Math.round(Number(it.rating));
    if (!Number.isFinite(r) || r < 1 || r > 5) continue;
    histogram[r as 1 | 2 | 3 | 4 | 5] += 1;
    sum += r;
    count += 1;
  }
  const averageRating = count === 0 ? 0 : Math.round((sum / count) * 10) / 10;
  return { averageRating, count, histogram };
}

// ─── Effectful repo ─────────────────────────────────────────────────

function fromDoc(doc: Record<string, unknown>): ReviewItem {
  return {
    id: String(doc.$id),
    productId: String(doc.productId || ''),
    author: String(doc.author || 'Anonymous'),
    rating: Number(doc.rating || 0),
    comment: String(doc.comment || ''),
    helpful: Number(doc.helpful || 0),
    date: String(doc.reviewDate || doc.$createdAt || ''),
    verified: doc.verified === true,
    status: String(doc.status || 'visible'),
  };
}

export async function listVisibleReviews(catalogProductId: string, limit = 200): Promise<ReviewItem[]> {
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_REVIEWS, [
    Query.equal('productId', [catalogProductId]),
    Query.orderDesc('reviewDate'),
    Query.limit(Math.min(limit, 500)),
  ]);
  return documents.map(fromDoc).filter((r) => r.status !== 'hidden');
}

export async function findBuyerReview(
  catalogProductId: string,
  buyerWallet: string,
): Promise<ReviewItem | null> {
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_REVIEWS, [
    Query.equal('productId', [catalogProductId]),
    Query.equal('buyerWallet', [buyerWallet]),
    Query.limit(1),
  ]);
  return documents[0] ? fromDoc(documents[0]) : null;
}

export async function createReview(input: {
  catalogProductId: string;
  buyerWallet: string;
  author: string;
  rating: number;
  comment: string;
}): Promise<ReviewItem> {
  const doc = await databases().createDocument(DATABASE_ID, COL_REVIEWS, ID.unique(), {
    productId: input.catalogProductId,
    buyerWallet: input.buyerWallet,
    author: input.author,
    rating: input.rating,
    comment: input.comment,
    helpful: 0,
    reviewDate: new Date().toISOString(),
    verified: true,
    status: 'visible',
  });
  return fromDoc(doc);
}

export async function setReviewStatus(
  id: string,
  status: 'visible' | 'hidden',
  moderatorId: string,
  reason: string,
): Promise<void> {
  await databases().updateDocument(DATABASE_ID, COL_REVIEWS, id, {
    status,
    moderator_id: moderatorId,
    moderation_reason: reason,
    moderated_at: new Date().toISOString(),
  });
}

export async function incrementHelpful(id: string): Promise<number> {
  const doc = await databases().getDocument(DATABASE_ID, COL_REVIEWS, id);
  const next = Number(doc.helpful || 0) + 1;
  await databases().updateDocument(DATABASE_ID, COL_REVIEWS, id, { helpful: next });
  return next;
}

/**
 * Recompute the aggregate from visible reviews and denormalise it onto the
 * catalog product (legacy_products.rating / reviews_count) so storefront cards
 * show the live average. Best-effort: a denorm failure never fails the review.
 */
export async function recomputeAndDenormalizeRating(catalogProductId: string): Promise<ReviewAggregate> {
  const reviews = await listVisibleReviews(catalogProductId, 500);
  const agg = computeReviewAggregate(reviews);
  try {
    const product = await findProductById(catalogProductId);
    if (product) {
      await updateProduct(catalogProductId, { rating: agg.averageRating, reviews_count: agg.count });
    }
  } catch (err) {
    logger.warn('[reviews] denormalize rating failed:', err instanceof Error ? err.message : err);
  }
  return agg;
}
