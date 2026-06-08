/**
 * Shared seller-storage (BYOS) service. Extracted so BOTH the human commerce
 * route (POST /api/v1/commerce/storage) and the agent route
 * (POST /api/v1/agent/storage) save credentials through ONE code path —
 * identical probing, SSRF guarding, AES-256-GCM encryption, and persistence.
 * The plaintext secret never leaves memory; only the encrypted record is stored.
 */
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { databases, ID, Query } from './appwrite.js';
import { DATABASE_ID, COL_SELLER_PROFILES } from './constants.js';
import { encryptCreds, isStorageEncryptionConfigured } from '../r2/devCredentials.js';
import { invalidateDevS3Cache } from '../r2/devClient.js';

const SSRF_BLOCKED_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/0\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/\[/,
];

export function endpointFor(provider: string, accountId: string, custom?: string): string {
  if (custom && custom.startsWith('https://')) {
    if (SSRF_BLOCKED_PATTERNS.some((p) => p.test(custom))) {
      throw new Error('Endpoint targets a private/reserved IP range');
    }
    return custom;
  }
  if (provider === 'cloudflare-r2') return `https://${accountId}.r2.cloudflarestorage.com`;
  if (provider === 'b2') return 'https://s3.us-west-002.backblazeb2.com';
  if (provider === 's3') return `https://s3.${accountId}.amazonaws.com`;
  throw new Error('Unknown provider');
}

function regionFor(provider: string, accountId: string): string {
  if (provider === 'cloudflare-r2') return 'auto';
  if (provider === 'b2') return 'us-west-002';
  if (provider === 's3') return accountId || 'us-east-1';
  return 'auto';
}

export async function findSellerByWallet(
  wallet: string,
): Promise<({ $id: string } & Record<string, unknown>) | null> {
  const db = databases();
  const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
    Query.equal('wallet', [wallet]),
    Query.limit(1),
  ]);
  return (documents[0] as ({ $id: string } & Record<string, unknown>) | undefined) || null;
}

export async function probeBucket(opts: {
  provider: string;
  accountId: string;
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = new S3Client({
      region: regionFor(opts.provider, opts.accountId),
      endpoint: opts.endpoint,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
      forcePathStyle: opts.provider !== 's3',
    });
    await client.send(new HeadBucketCommand({ Bucket: opts.bucket }));
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return { ok: false, error: msg.slice(0, 500) };
  }
}

export interface SaveStorageInput {
  provider: 'cloudflare-r2' | 's3' | 'b2';
  accountId: string;
  bucket: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
}

export type SaveStorageOutcome =
  | {
      ok: true;
      docId: string;
      data: {
        status: 'connected';
        provider: string;
        accountId: string;
        bucket: string;
        endpoint: string;
        publicBaseUrl: string;
      };
    }
  | { ok: false; status: number; code: string; error?: string };

/**
 * Validate (HeadBucket probe + SSRF guard), encrypt, and persist a seller's BYOS
 * storage credentials onto their seller profile. Creates the profile shell when
 * absent (using `fallbackDisplayName`). Wallet-scoped by the caller (human wallet
 * ownership or the agent token wallet) — this function never trusts a wallet from
 * a request body.
 */
export async function saveSellerStorage(
  wallet: string,
  input: SaveStorageInput,
  fallbackDisplayName: string,
): Promise<SaveStorageOutcome> {
  if (!isStorageEncryptionConfigured()) {
    return { ok: false, status: 503, code: 'NO_ENCRYPTION_KEY', error: 'STORAGE_ENCRYPTION_KEY is not configured' };
  }
  let endpoint: string;
  try {
    endpoint = endpointFor(input.provider, input.accountId, input.endpoint);
  } catch (err) {
    return { ok: false, status: 400, code: 'BAD_ENDPOINT', error: err instanceof Error ? err.message : 'bad endpoint' };
  }
  const probe = await probeBucket({
    provider: input.provider,
    accountId: input.accountId,
    bucket: input.bucket,
    endpoint,
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
  });
  if (!probe.ok) {
    return { ok: false, status: 400, code: 'BUCKET_PROBE_FAILED', error: probe.error };
  }

  const enc = encryptCreds({ accessKeyId: input.accessKeyId, secretAccessKey: input.secretAccessKey });
  const db = databases();
  const updates: Record<string, unknown> = {
    storage_provider: input.provider,
    storage_account_id: input.accountId,
    storage_bucket: input.bucket,
    storage_endpoint: endpoint,
    storage_creds_iv: enc.iv,
    storage_creds_tag: enc.tag,
    storage_creds_ciphertext: enc.ciphertext,
    storage_status: 'connected',
    storage_last_check_at: new Date().toISOString(),
    storage_last_error: '',
    storage_public_base_url: input.publicBaseUrl || '',
  };

  const existing = await findSellerByWallet(wallet);
  let docId: string;
  if (existing) {
    docId = existing.$id;
    await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, docId, updates);
  } else {
    const created = await db.createDocument(DATABASE_ID, COL_SELLER_PROFILES, ID.unique(), {
      wallet,
      displayName: fallbackDisplayName,
      bio: '',
      ...updates,
    });
    docId = created.$id;
  }
  invalidateDevS3Cache(docId);
  invalidateDevS3Cache(wallet);

  return {
    ok: true,
    docId,
    data: {
      status: 'connected',
      provider: input.provider,
      accountId: input.accountId,
      bucket: input.bucket,
      endpoint,
      publicBaseUrl: input.publicBaseUrl || '',
    },
  };
}
