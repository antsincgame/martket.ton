import { Query, type Models } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_LEGACY_PRODUCTS } from './constants.js';
import { generateId } from './generateId.js';
import { getTonUsdPrice, usdToTonHuman } from '../commerce/tonPriceOracle.js';
import type { Product, ProductId, ProfileId, ProductStatus, ScanStatus } from '../domain/types.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';

async function resolvePriceTon(row: Record<string, unknown>): Promise<number> {
  if (typeof row.price_ton === 'number' && Number.isFinite(row.price_ton)) {
    return row.price_ton;
  }
  const priceUsd = Number(row.price_usd ?? 0);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return 0;
  try {
    const rate = await getTonUsdPrice();
    return parseFloat(usdToTonHuman(priceUsd, rate)) || 0;
  } catch {
    return 0;
  }
}

/** Appwrite legacy_products schemas differ between envs (some have price_usd, some price_ton only). */
function legacyProductOmitFields(): Set<string> {
  const raw = (process.env.LEGACY_PRODUCTS_OMIT_FIELDS || '').trim();
  return new Set(raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []);
}

function mapProduct(doc: AppwriteDoc): Product {
  return {
    id: doc.$id as ProductId,
    creatorId: ((doc['creator_id'] as string) ?? (doc['developer_id'] as string) ?? null) as ProfileId,
    name: doc['name'] as string,
    description: (doc['description'] as string) ?? null,
    shortDescription: (doc['short_description'] as string) ?? null,
    priceUsd: (doc['price_usd'] as number) ?? 0,
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
    scanStatus: ((doc['scan_status'] as string) ?? 'pending') as ScanStatus,
    scanProvider: (doc['scan_provider'] as string) ?? null,
    scanReportId: (doc['scan_report_id'] as string) ?? null,
    scanMaliciousCount: (doc['scan_malicious_count'] as number) ?? 0,
    scanTotalEngines: (doc['scan_total_engines'] as number) ?? 0,
    scanCompletedAt: (doc['scan_completed_at'] as string) ?? null,
    quarantineKey: (doc['quarantine_key'] as string) ?? null,
    moderatorId: (doc['moderator_id'] as string) ?? null,
    moderationReason: (doc['moderation_reason'] as string) ?? null,
    moderatedAt: (doc['moderated_at'] as string) ?? null,
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
    price_usd: p.priceUsd,
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
    scan_status: p.scanStatus,
    scan_provider: p.scanProvider,
    scan_report_id: p.scanReportId,
    scan_malicious_count: p.scanMaliciousCount,
    scan_total_engines: p.scanTotalEngines,
    scan_completed_at: p.scanCompletedAt,
    quarantine_key: p.quarantineKey,
    moderator_id: p.moderatorId,
    moderation_reason: p.moderationReason,
    moderated_at: p.moderatedAt,
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

/**
 * Lists products owned by a given profile.
 *
 * Includes both `creator_id` (modern) and `developer_id` (legacy migration)
 * matches, deduplicated by id. Without the developer_id fallback, profiles
 * created before the rename would see an empty "my products" list.
 */
export async function listProductsByCreator(creatorId: string): Promise<Product[]> {
  const [byCreator, byDeveloper] = await Promise.all([
    databases().listDocuments(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, [
      Query.equal('creator_id', creatorId),
      Query.orderDesc('$createdAt'),
      Query.limit(5000),
    ]),
    databases().listDocuments(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, [
      Query.equal('developer_id', creatorId),
      Query.orderDesc('$createdAt'),
      Query.limit(5000),
    ]).catch(() => ({ documents: [] as Models.Document[] })),
  ]);
  const seen = new Set<string>();
  const merged: Product[] = [];
  for (const d of [...byCreator.documents, ...byDeveloper.documents]) {
    const product = mapProduct(asDoc(d));
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    merged.push(product);
  }
  return merged;
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
  const priceTon = await resolvePriceTon(row);
  const omit = legacyProductOmitFields();
  const data: Record<string, unknown> = {
    creator_id: row.creator_id ?? null,
    name: row.name,
    description: row.description,
    short_description: row.short_description,
    price_ton: priceTon,
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
  if (!omit.has('price_usd')) {
    data.price_usd = row.price_usd;
  }
  if (!omit.has('scan_status')) {
    data.scan_status = (row.scan_status as string) ?? 'pending';
  }
  if (row.developer_id && !data.creator_id) {
    data.developer_id = row.developer_id;
  }
  await databases().createDocument(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, id, data);
  return findProductById(id);
}

export async function listProductsByCategory(category: string): Promise<Product[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, [
    Query.equal('category', category),
    Query.limit(5000),
  ]);
  return res.documents.map((d) => mapProduct(asDoc(d)));
}

export async function renameCategory(oldSlug: string, newSlug: string): Promise<number> {
  const products = await listProductsByCategory(oldSlug);
  await Promise.all(
    products.map((p) =>
      databases().updateDocument(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, p.id, { category: newSlug }),
    ),
  );
  return products.length;
}

export async function searchProducts(query: string, limit = 50): Promise<Product[]> {
  const max = Math.min(limit, 200);
  try {
    const res = await databases().listDocuments(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, [
      Query.equal('status', 'published'),
      Query.search('name', query),
      Query.limit(max),
    ]);
    return res.documents.map((d) => mapProduct(asDoc(d)));
  } catch {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const products = await listProductsByStatus('published');
    return products
      .filter((p) =>
        [p.name, p.shortDescription, p.description, p.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)),
      )
      .slice(0, max);
  }
}

export async function updateProduct(
  productId: string,
  data: Record<string, unknown>,
): Promise<Product | null> {
  await databases().updateDocument(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, productId, data);
  return findProductById(productId);
}

export interface ScanResultUpdate {
  scanStatus: ScanStatus;
  scanProvider?: string | null;
  scanReportId?: string | null;
  scanMaliciousCount?: number;
  scanTotalEngines?: number;
  scanCompletedAt?: string | null;
}

/**
 * Atomic write of antivirus scan result. Used by scan worker only —
 * never touches build_*, status, or moderation fields.
 */
export async function updateScanResult(
  productId: string,
  result: ScanResultUpdate,
): Promise<Product | null> {
  const data: Record<string, unknown> = { scan_status: result.scanStatus };
  if (result.scanProvider !== undefined) data['scan_provider'] = result.scanProvider;
  if (result.scanReportId !== undefined) data['scan_report_id'] = result.scanReportId;
  if (result.scanMaliciousCount !== undefined) data['scan_malicious_count'] = result.scanMaliciousCount;
  if (result.scanTotalEngines !== undefined) data['scan_total_engines'] = result.scanTotalEngines;
  if (result.scanCompletedAt !== undefined) data['scan_completed_at'] = result.scanCompletedAt;
  return updateProduct(productId, data);
}
