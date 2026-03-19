import { Query } from 'appwrite';
import { appwriteDatabases } from '../../../lib/appwriteClient';
import type { CatalogListingProduct, HomeCategorySummary, ProductDetail, ProductReview } from '../types';
import {
  buildHomeSummaries,
  mapCategoryDocument,
  mapProductDetail,
  mapProductDocument,
  mapReviewDocument,
  type CategoryTableRow,
} from './mapDocuments';
import {
  COLLECTION_CATEGORIES_ID,
  COLLECTION_PRODUCTS_ID,
  COLLECTION_REVIEWS_ID,
  MARKETPLACE_DATABASE_ID,
} from './ids';

function asRecord(doc: unknown): Record<string, unknown> | null {
  if (!doc || typeof doc !== 'object') return null;
  return doc as Record<string, unknown>;
}

export async function fetchListingProducts(): Promise<CatalogListingProduct[]> {
  if (!appwriteDatabases) return [];
  const response = await appwriteDatabases.listDocuments(MARKETPLACE_DATABASE_ID, COLLECTION_PRODUCTS_ID, [
    Query.limit(5000),
    Query.orderAsc('name'),
  ]);
  const result: CatalogListingProduct[] = [];
  for (const doc of response.documents) {
    const row = asRecord(doc);
    const id = typeof row?.$id === 'string' ? row.$id : '';
    if (!row || !id) continue;
    const mapped = mapProductDocument(id, row);
    if (mapped) result.push(mapped);
  }
  return result;
}

export async function fetchProductDetailById(productId: string): Promise<ProductDetail | null> {
  if (!appwriteDatabases || !productId) return null;
  const doc = await appwriteDatabases.getDocument(
    MARKETPLACE_DATABASE_ID,
    COLLECTION_PRODUCTS_ID,
    productId
  );
  const row = asRecord(doc);
  const id = typeof row?.$id === 'string' ? row.$id : productId;
  if (!row) return null;
  return mapProductDetail(id, row);
}

export async function fetchReviewsForProduct(productId: string): Promise<ProductReview[]> {
  if (!appwriteDatabases || !productId) return [];
  const response = await appwriteDatabases.listDocuments(MARKETPLACE_DATABASE_ID, COLLECTION_REVIEWS_ID, [
    Query.equal('productId', productId),
    Query.orderDesc('reviewDate'),
    Query.limit(500),
  ]);
  const result: ProductReview[] = [];
  for (const doc of response.documents) {
    const row = asRecord(doc);
    const id = typeof row?.$id === 'string' ? row.$id : '';
    if (!row || !id) continue;
    const mapped = mapReviewDocument(id, row);
    if (mapped) result.push(mapped);
  }
  return result;
}

export async function fetchCategoryRowsForHome(): Promise<CategoryTableRow[]> {
  if (!appwriteDatabases) return [];
  const response = await appwriteDatabases.listDocuments(MARKETPLACE_DATABASE_ID, COLLECTION_CATEGORIES_ID, [
    Query.limit(100),
    Query.orderAsc('sortOrder'),
  ]);
  const result: CategoryTableRow[] = [];
  for (const doc of response.documents) {
    const row = asRecord(doc);
    if (!row) continue;
    const mapped = mapCategoryDocument(row);
    if (mapped) result.push(mapped);
  }
  return result;
}

export async function fetchHomeCategorySummaries(
  products: CatalogListingProduct[]
): Promise<HomeCategorySummary[]> {
  const rows = await fetchCategoryRowsForHome();
  return buildHomeSummaries(rows, products);
}
