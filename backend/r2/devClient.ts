/**
 * S3Client factory per demiurge.
 *
 * Each demiurge has their own R2 (or S3-compatible) bucket. We never share
 * a global S3Client across demiurges — credentials and endpoint differ.
 * Clients are cached for 15 minutes to avoid recreating on every request.
 *
 * Lookup chain:
 *   1) Read seller_profiles document by sellerId
 *   2) Decrypt credentials via AES-256-GCM (storage_creds_*)
 *   3) Build S3Client with custom endpoint (R2 / S3 / B2)
 *   4) Cache by sellerId (TTL 15 min)
 */

import { S3Client } from '@aws-sdk/client-s3';
import { databases, Query } from '../commerce/appwrite.js';
import { DATABASE_ID, COL_SELLER_PROFILES } from '../commerce/constants.js';
import { decryptCreds, type EncryptedRecord } from './devCredentials.js';
import { logger } from '../logger.js';
import type { Models } from 'node-appwrite';

interface CachedClient {
  client: S3Client;
  bucket: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 15 * 60_000;
const cache = new Map<string, CachedClient>();

export interface DevStorageRecord {
  sellerId: string;
  provider: 'cloudflare-r2' | 's3' | 'b2' | 'none';
  accountId: string;
  bucket: string;
  endpoint: string;
  status: 'connected' | 'error' | 'revoked' | 'unconfigured';
  publicBaseUrl?: string;
}

export interface DevStorageFull extends DevStorageRecord {
  credentials: EncryptedRecord;
}

interface SellerProfileDoc extends Models.Document {
  storage_provider?: string;
  storage_account_id?: string;
  storage_bucket?: string;
  storage_endpoint?: string;
  storage_creds_iv?: string;
  storage_creds_tag?: string;
  storage_creds_ciphertext?: string;
  storage_status?: string;
  storage_public_base_url?: string;
}

async function findSellerProfile(sellerId: string): Promise<SellerProfileDoc | null> {
  const db = databases();
  try {
    const doc = await db.getDocument(DATABASE_ID, COL_SELLER_PROFILES, sellerId);
    return doc as SellerProfileDoc;
  } catch {
    const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
      Query.equal('wallet', sellerId),
      Query.limit(1),
    ]);
    return (documents[0] as SellerProfileDoc) || null;
  }
}

function endpointForProvider(provider: string, accountId: string, customEndpoint?: string): string {
  if (customEndpoint && customEndpoint.startsWith('https://')) return customEndpoint;
  if (provider === 'cloudflare-r2') return `https://${accountId}.r2.cloudflarestorage.com`;
  if (provider === 'b2') return 'https://s3.us-west-002.backblazeb2.com';
  if (provider === 's3') return `https://s3.${accountId || 'us-east-1'}.amazonaws.com`;
  throw new Error(`Unknown storage provider: ${provider}`);
}

function regionForProvider(provider: string, accountId: string): string {
  if (provider === 'cloudflare-r2') return 'auto';
  if (provider === 'b2') return 'us-west-002';
  if (provider === 's3') return accountId || 'us-east-1';
  return 'auto';
}

export async function loadDevStorage(sellerId: string): Promise<DevStorageFull | null> {
  const doc = await findSellerProfile(sellerId);
  if (!doc) return null;
  const provider = (doc.storage_provider || 'none') as DevStorageRecord['provider'];
  if (provider === 'none') return null;
  if (!doc.storage_creds_iv || !doc.storage_creds_tag || !doc.storage_creds_ciphertext) return null;
  if (!doc.storage_bucket || !doc.storage_account_id) return null;
  return {
    sellerId,
    provider,
    accountId: doc.storage_account_id,
    bucket: doc.storage_bucket,
    endpoint: doc.storage_endpoint || endpointForProvider(provider, doc.storage_account_id),
    status: (doc.storage_status as DevStorageRecord['status']) || 'connected',
    publicBaseUrl: doc.storage_public_base_url || undefined,
    credentials: {
      iv: doc.storage_creds_iv,
      tag: doc.storage_creds_tag,
      ciphertext: doc.storage_creds_ciphertext,
    },
  };
}

export async function getDevStorageRecord(sellerId: string): Promise<DevStorageRecord | null> {
  const full = await loadDevStorage(sellerId);
  if (!full) return null;
  // Strip credentials before returning
  const { credentials: _credentials, ...record } = full;
  void _credentials;
  return record;
}

export async function getDevS3Client(sellerId: string): Promise<{ client: S3Client; bucket: string; record: DevStorageRecord }> {
  const cached = cache.get(sellerId);
  if (cached && cached.expiresAt > Date.now()) {
    const record = await getDevStorageRecord(sellerId);
    if (!record) throw new Error(`No storage configured for seller ${sellerId}`);
    return { client: cached.client, bucket: cached.bucket, record };
  }

  const full = await loadDevStorage(sellerId);
  if (!full) {
    throw new Error(`No storage credentials for seller ${sellerId}`);
  }
  const creds = decryptCreds(full.credentials);
  const client = new S3Client({
    region: regionForProvider(full.provider, full.accountId),
    endpoint: full.endpoint,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
    forcePathStyle: full.provider !== 's3',
  });
  cache.set(sellerId, { client, bucket: full.bucket, expiresAt: Date.now() + CACHE_TTL_MS });
  logger.info(`[dev-r2] client cached for seller=${sellerId} provider=${full.provider} bucket=${full.bucket}`);
  const { credentials: _c, ...record } = full;
  void _c;
  return { client, bucket: full.bucket, record };
}

export function invalidateDevS3Cache(sellerId: string): void {
  cache.delete(sellerId);
}

export function invalidateAllDevS3Cache(): void {
  cache.clear();
}
