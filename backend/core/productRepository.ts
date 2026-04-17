import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_LEGACY_PRODUCTS } from './constants.js';
import { generateId } from './generateId.js';
import type { Product, ProductId, ProfileId, ProductStatus } from '../domain/types.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';

function mapProduct(doc: AppwriteDoc): Product {
  return {
    id: doc.$id as ProductId,
    creatorId: ((doc['creator_id'] as string) ?? (doc['developer_id'] as string) ?? null) as ProfileId,
    name: doc['name'] as string,
    description: (doc['description'] as string) ?? null,
    shortDescription: (doc['short_description'] as string) ?? null,
    priceTon: (doc['price_ton'] as number) ?? 0,
    category: (doc['category'] as string) ?? 'other',
    image: (doc['image'] as string) ?? null,
    rating: (doc['rating'] as number) ?? 0,
    reviewsCount: (doc['reviews_count'] as number) ?? 0,
    downloads: (doc['downloads'] as number) ?? 0,
    status: ((doc['status'] as string) ?? 'draft') as ProductStatus,
    version: (doc['version'] as string) ?? null,
    buildR2Key: (doc['build_r2_key'] as string) ?? null,
    buildSha256: (doc['build_sha256'] as string) ?? null,
    buildSizeBytes: (doc['build_size_bytes'] as number) ?? null,
    buildFilename: (doc['build_filename'] as string) ?? null,
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
  };
}

export function productToSnakeCase(p: Product): Record<string, unknown> {
  return {
    id: p.id,
    creator_id: p.creatorId,
    name: p.name,
    description: p.description,
    short_description: p.shortDescription,
    price_ton: p.priceTon,
    category: p.category,
    image: p.image,
    rating: p.rating,
    reviews_count: p.reviewsCount,
    downloads: p.downloads,
    status: p.status,
    version: p.version,
    build_r2_key: p.buildR2Key,
    build_sha256: p.buildSha256,
    build_size_bytes: p.buildSizeBytes,
    build_filename: p.buildFilename,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export async function listProductsByStatus(status: string): Promise<Product[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, [
    Query.equal('status', status),
    Query.orderDesc('$createdAt'),
    Query.limit(5000),
  ]);
  return res.documents.map((d) => mapProduct(asDoc(d)));
}

export async function listAllProducts(): Promise<Product[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, [
    Query.orderDesc('$createdAt'),
    Query.limit(5000),
  ]);
  return res.documents.map((d) => mapProduct(asDoc(d)));
}

export async function listProductsByCreator(creatorId: string): Promise<Product[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, [
    Query.equal('creator_id', creatorId),
    Query.orderDesc('$createdAt'),
    Query.limit(5000),
  ]);
  return res.documents.map((d) => mapProduct(asDoc(d)));
}

export async function findProductById(id: string): Promise<Product | null> {
  try {
    const doc = await databases().getDocument(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, id);
    return mapProduct(asDoc(doc));
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404) return null;
    throw e;
  }
}

export async function insertProduct(row: Record<string, unknown>): Promise<Product | null> {
  const id = (row.id as string) || generateId();
  const data: Record<string, unknown> = {
    creator_id: row.creator_id ?? null,
    name: row.name,
    description: row.description,
    short_description: row.short_description,
    price_ton: row.price_ton,
    category: row.category,
    image: row.image,
    rating: (row.rating as number) ?? 0,
    reviews_count: (row.reviews_count as number) ?? 0,
    downloads: (row.downloads as number) ?? 0,
    status: (row.status as string) ?? 'draft',
    version: row.version ?? null,
    build_r2_key: row.build_r2_key ?? null,
    build_sha256: row.build_sha256 ?? null,
    build_size_bytes: row.build_size_bytes ?? null,
    build_filename: row.build_filename ?? null,
  };
  if (row.developer_id && !data.creator_id) {
    data.developer_id = row.developer_id;
  }
  await databases().createDocument(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, id, data);
  return findProductById(id);
}

export async function searchProducts(query: string, limit = 50): Promise<Product[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, [
    Query.equal('status', 'published'),
    Query.search('name', query),
    Query.limit(Math.min(limit, 200)),
  ]);
  return res.documents.map((d) => mapProduct(asDoc(d)));
}

export async function updateProduct(
  productId: string,
  data: Record<string, unknown>,
): Promise<Product | null> {
  await databases().updateDocument(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, productId, data);
  return findProductById(productId);
}
