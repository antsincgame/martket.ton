import { Databases, Query } from 'node-appwrite';
import { createServerClient } from './appwriteServer.js';
import {
  CORE_DATABASE_ID,
  COL_PROFILES,
  COL_LEGACY_PRODUCTS,
  COL_PURCHASES,
  COL_AUDIT_LOGS,
} from './constants.js';
import { generateId } from './generateId.js';
import type {
  Profile,
  ProfileId,
  Product,
  ProductId,
  Purchase,
  AuditLog,
  ProductStatus,
  TonAddress,
} from '../domain/types.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';

let _databases: Databases | null = null;

function databases(): Databases {
  if (!_databases) {
    _databases = new Databases(createServerClient());
  }
  return _databases;
}

// ─── Profile mapping ────────────────────────────────────────────────

function mapProfile(doc: AppwriteDoc): Profile {
  return {
    id: doc.$id as ProfileId,
    email: (doc['email'] as string) ?? null,
    tonAddress: ((doc['ton_address'] as string) ?? null) as TonAddress | null,
    name: (doc['name'] as string) ?? '',
    displayName: (doc['display_name'] as string) ?? (doc['name'] as string) ?? '',
    role: (doc['role'] as Profile['role']) ?? 'demiurge',
    avatar: (doc['avatar'] as string) ?? null,
    bio: (doc['bio'] as string) ?? null,
    securityLevel: (doc['security_level'] as Profile['securityLevel']) ?? 'low',
    isActive: doc['is_active'] !== false,
    appwriteUserId: (doc['appwrite_user_id'] as string) ?? null,
    clerkUserId: (doc['clerk_user_id'] as string) ?? null,
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
  };
}

/** Legacy snake_case output for API backward compatibility. */
export function profileToSnakeCase(p: Profile): Record<string, unknown> {
  return {
    id: p.id,
    email: p.email,
    ton_address: p.tonAddress,
    name: p.name,
    display_name: p.displayName,
    role: p.role,
    avatar: p.avatar,
    bio: p.bio,
    security_level: p.securityLevel,
    is_active: p.isActive,
    appwrite_user_id: p.appwriteUserId,
    clerk_user_id: p.clerkUserId,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

// ─── Profile queries ────────────────────────────────────────────────

export async function findUserByTonAddress(tonAddress: string): Promise<Profile | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('ton_address', tonAddress),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapProfile(asDoc(doc)) : null;
}

export async function findUserById(id: string): Promise<Profile | null> {
  try {
    const doc = await databases().getDocument(CORE_DATABASE_ID, COL_PROFILES, id);
    return mapProfile(asDoc(doc));
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404) return null;
    throw e;
  }
}

export async function findUserByAppwriteId(appwriteUserId: string): Promise<Profile | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('appwrite_user_id', appwriteUserId),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapProfile(asDoc(doc)) : null;
}

export async function findUserByEmail(email: string): Promise<Profile | null> {
  if (!email) return null;
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('email', email),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapProfile(asDoc(doc)) : null;
}

export async function findUserByClerkId(clerkUserId: string): Promise<Profile | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('clerk_user_id', clerkUserId),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapProfile(asDoc(doc)) : null;
}

export async function listUsers(): Promise<Profile[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [Query.limit(5000)]);
  return res.documents.map((d) => mapProfile(asDoc(d)));
}

export async function countUsers(): Promise<number> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [Query.limit(1)]);
  return res.total;
}

export async function updateProfile(
  profileId: string,
  data: Record<string, unknown>,
): Promise<Profile | null> {
  await databases().updateDocument(CORE_DATABASE_ID, COL_PROFILES, profileId, data);
  return findUserById(profileId);
}

interface UpsertPayload {
  email?: string | null;
  ton_address?: string | null;
  name?: string | null;
  display_name?: string | null;
  role?: string;
  avatar?: string | null;
  bio?: string | null;
  security_level?: string;
  is_active?: boolean;
}

export async function upsertProfileForClerkUser(
  clerkUserId: string,
  payload: UpsertPayload,
): Promise<Profile | null> {
  let existing = await findUserByClerkId(clerkUserId);
  if (!existing && payload.email) {
    const byEmail = await findUserByEmail(payload.email);
    if (byEmail && !byEmail.clerkUserId) {
      existing = byEmail;
    }
  }

  const data: Record<string, unknown> = {
    clerk_user_id: clerkUserId,
    email: payload.email ?? existing?.email ?? null,
    ton_address: payload.ton_address ?? existing?.tonAddress ?? null,
    name: payload.name ?? existing?.name ?? 'Demiurge',
    display_name:
      payload.display_name ??
      existing?.displayName ??
      payload.name ??
      existing?.name ??
      'Demiurge',
    role: payload.role ?? existing?.role ?? 'demiurge',
    avatar: payload.avatar ?? existing?.avatar ?? null,
    bio: payload.bio ?? existing?.bio ?? null,
    security_level: payload.security_level ?? existing?.securityLevel ?? 'low',
    is_active: payload.is_active !== false,
  };

  if (existing) {
    await databases().updateDocument(CORE_DATABASE_ID, COL_PROFILES, existing.id, data);
    return findUserById(existing.id);
  }
  const id = generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_PROFILES, id, data);
  return findUserById(id);
}

export async function upsertProfileForAppwriteUser(
  appwriteUserId: string,
  payload: UpsertPayload,
): Promise<Profile | null> {
  const byAccount = await findUserByAppwriteId(appwriteUserId);
  const byEmail = payload.email ? await findUserByEmail(payload.email) : null;
  let existing = byAccount;
  if (!existing && byEmail && !byEmail.appwriteUserId) {
    existing = byEmail;
  }
  if (!existing && byEmail && byEmail.appwriteUserId === appwriteUserId) {
    existing = byEmail;
  }

  const data: Record<string, unknown> = {
    appwrite_user_id: appwriteUserId,
    email: payload.email ?? existing?.email ?? null,
    ton_address: payload.ton_address ?? existing?.tonAddress ?? null,
    name: payload.name ?? existing?.name ?? 'Demiurge',
    display_name:
      payload.display_name ??
      existing?.displayName ??
      payload.name ??
      existing?.name ??
      'Demiurge',
    role: payload.role ?? existing?.role ?? 'demiurge',
    avatar: payload.avatar ?? existing?.avatar ?? null,
    bio: payload.bio ?? existing?.bio ?? null,
    security_level: payload.security_level ?? existing?.securityLevel ?? 'low',
    is_active: payload.is_active !== false,
  };

  if (existing) {
    await databases().updateDocument(CORE_DATABASE_ID, COL_PROFILES, existing.id, data);
    return findUserById(existing.id);
  }
  const id = generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_PROFILES, id, data);
  return findUserById(id);
}

// ─── Product mapping ────────────────────────────────────────────────

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

/** Legacy snake_case output for API backward compatibility. */
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

// ─── Product queries ────────────────────────────────────────────────

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

export async function updateProduct(
  productId: string,
  data: Record<string, unknown>,
): Promise<Product | null> {
  await databases().updateDocument(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, productId, data);
  return findProductById(productId);
}

// ─── Purchase mapping & queries ─────────────────────────────────────

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

// ─── Audit ──────────────────────────────────────────────────────────

function mapAudit(doc: AppwriteDoc): AuditLog {
  return {
    id: doc.$id,
    userId: (doc['user_id'] as string) ?? '',
    action: doc['action'] as string,
    resource: doc['resource'] as string,
    resourceId: (doc['resource_id'] as string) ?? null,
    result: (doc['result'] as string) ?? 'success',
    metadata: (doc['metadata'] as string) ?? null,
    ipAddress: (doc['ip_address'] as string) ?? null,
    userAgent: (doc['user_agent'] as string) ?? null,
    createdAt: doc.$createdAt,
  };
}

export async function insertAuditLog(row: {
  id?: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id?: string | null;
  result?: string;
  metadata?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}): Promise<void> {
  const id = row.id || generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_AUDIT_LOGS, id, {
    user_id: row.user_id,
    action: row.action,
    resource: row.resource,
    resource_id: row.resource_id,
    result: row.result,
    metadata: row.metadata,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
  });
}

export async function listAuditLogs(limit: number): Promise<AuditLog[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_AUDIT_LOGS, [
    Query.orderDesc('$createdAt'),
    Query.limit(limit),
  ]);
  return res.documents.map((d) => mapAudit(asDoc(d)));
}

export { generateId };
