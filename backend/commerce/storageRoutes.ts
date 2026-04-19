/**
 * Per-developer storage credentials API.
 *
 * Endpoints (all require wallet ownership):
 *   POST   /api/v1/commerce/storage           save credentials (HeadBucket validation)
 *   GET    /api/v1/commerce/storage?wallet    public-safe view (no secrets)
 *   POST   /api/v1/commerce/storage/test      re-probe HeadBucket
 *   DELETE /api/v1/commerce/storage           revoke
 *
 * Credentials are encrypted with AES-256-GCM (STORAGE_ENCRYPTION_KEY) before
 * being persisted in the seller_profiles document. The plaintext never leaves
 * memory — even the GET endpoint returns only metadata (status, account, bucket).
 */

import express, { type Request, type Response } from 'express';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { databases, ID, Query } from './appwrite.js';
import { DATABASE_ID, COL_SELLER_PROFILES } from './constants.js';
import { apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { writeAudit } from './audit.js';
import { logger } from '../logger.js';
import { setStorageSchema } from './validation.js';
import { requireWalletOwner } from './helpers.js';
import { encryptCreds, isStorageEncryptionConfigured } from '../r2/devCredentials.js';
import { invalidateDevS3Cache } from '../r2/devClient.js';
import { str } from '../utils/params.js';

const router = express.Router();

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

function endpointFor(provider: string, accountId: string, custom?: string): string {
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

async function findSellerByWallet(wallet: string) {
  const db = databases();
  const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
    Query.equal('wallet', [wallet]),
    Query.limit(1),
  ]);
  return documents[0] || null;
}

async function probeBucket(opts: {
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
      credentials: {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      },
      forcePathStyle: opts.provider !== 's3',
    });
    await client.send(new HeadBucketCommand({ Bucket: opts.bucket }));
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return { ok: false, error: msg.slice(0, 500) };
  }
}

router.post(
  '/storage',
  apiRequireAuth(),
  validateBody(setStorageSchema),
  async (req: Request, res: Response) => {
    if (!isStorageEncryptionConfigured()) {
      res.status(503).json({ error: 'STORAGE_ENCRYPTION_KEY is not configured', code: 'NO_ENCRYPTION_KEY' });
      return;
    }
    const body = req.body as {
      wallet: string;
      provider: 'cloudflare-r2' | 's3' | 'b2';
      accountId: string;
      bucket: string;
      endpoint?: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBaseUrl?: string;
    };
    const owner = await requireWalletOwner(req, res, body.wallet);
    if (!owner) return;

    const endpoint = endpointFor(body.provider, body.accountId, body.endpoint);
    const probe = await probeBucket({
      provider: body.provider,
      accountId: body.accountId,
      bucket: body.bucket,
      endpoint,
      accessKeyId: body.accessKeyId,
      secretAccessKey: body.secretAccessKey,
    });
    if (!probe.ok) {
      res.status(400).json({
        error: 'Bucket probe failed',
        code: 'BUCKET_PROBE_FAILED',
        details: probe.error,
      });
      return;
    }

    const enc = encryptCreds({
      accessKeyId: body.accessKeyId,
      secretAccessKey: body.secretAccessKey,
    });

    const db = databases();
    const existing = await findSellerByWallet(body.wallet);
    const updates: Record<string, unknown> = {
      storage_provider: body.provider,
      storage_account_id: body.accountId,
      storage_bucket: body.bucket,
      storage_endpoint: endpoint,
      storage_creds_iv: enc.iv,
      storage_creds_tag: enc.tag,
      storage_creds_ciphertext: enc.ciphertext,
      storage_status: 'connected',
      storage_last_check_at: new Date().toISOString(),
      storage_last_error: '',
      storage_public_base_url: body.publicBaseUrl || '',
    };

    let docId: string;
    if (existing) {
      docId = existing.$id;
      await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, docId, updates);
    } else {
      const created = await db.createDocument(DATABASE_ID, COL_SELLER_PROFILES, ID.unique(), {
        wallet: body.wallet,
        displayName: owner.displayName || owner.name || 'Demiurge',
        bio: '',
        ...updates,
      });
      docId = created.$id;
    }
    invalidateDevS3Cache(docId);
    invalidateDevS3Cache(body.wallet);
    await writeAudit(body.wallet, 'storage_set', 'seller', docId, {
      provider: body.provider,
      bucket: body.bucket,
    });

    res.json({
      data: {
        status: 'connected',
        provider: body.provider,
        accountId: body.accountId,
        bucket: body.bucket,
        endpoint,
        publicBaseUrl: body.publicBaseUrl || '',
      },
    });
  },
);

router.get('/storage', apiRequireAuth(), async (req: Request, res: Response) => {
  const rawWallet = req.query.wallet;
  const wallet = typeof rawWallet === 'string' ? rawWallet : Array.isArray(rawWallet) ? String(rawWallet[0] || '') : '';
  if (!wallet) {
    res.status(400).json({ error: 'wallet query parameter is required', code: 'NO_WALLET' });
    return;
  }
  const owner = await requireWalletOwner(req, res, wallet);
  if (!owner) return;
  const doc = await findSellerByWallet(wallet);
  if (!doc) {
    res.json({ data: { status: 'unconfigured' } });
    return;
  }
  const status = (doc as { storage_status?: string }).storage_status || 'unconfigured';
  res.json({
    data: {
      status,
      provider: (doc as { storage_provider?: string }).storage_provider || null,
      accountId: (doc as { storage_account_id?: string }).storage_account_id || null,
      bucket: (doc as { storage_bucket?: string }).storage_bucket || null,
      endpoint: (doc as { storage_endpoint?: string }).storage_endpoint || null,
      publicBaseUrl: (doc as { storage_public_base_url?: string }).storage_public_base_url || null,
      lastCheckAt: (doc as { storage_last_check_at?: string }).storage_last_check_at || null,
      lastError: (doc as { storage_last_error?: string }).storage_last_error || null,
    },
  });
});

router.post('/storage/test', apiRequireAuth(), async (req: Request, res: Response) => {
  const wallet = str((req.body as { wallet?: string }).wallet);
  if (!wallet) {
    res.status(400).json({ error: 'wallet is required', code: 'NO_WALLET' });
    return;
  }
  const owner = await requireWalletOwner(req, res, wallet);
  if (!owner) return;
  const doc = await findSellerByWallet(wallet);
  if (!doc) {
    res.status(404).json({ error: 'Storage not configured', code: 'NO_STORAGE' });
    return;
  }
  const d = doc as Record<string, string | undefined>;
  if (!d.storage_creds_iv || !d.storage_creds_tag || !d.storage_creds_ciphertext) {
    res.status(404).json({ error: 'Credentials missing', code: 'NO_CREDS' });
    return;
  }
  // Re-probe via HeadBucket using cached client
  let status: 'connected' | 'error' = 'connected';
  let lastError = '';
  try {
    const { getDevS3Client } = await import('../r2/devClient.js');
    const { client, bucket } = await getDevS3Client(doc.$id);
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err: unknown) {
    status = 'error';
    lastError = err instanceof Error ? err.message.slice(0, 500) : 'unknown';
  }
  await databases().updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
    storage_status: status,
    storage_last_check_at: new Date().toISOString(),
    storage_last_error: lastError,
  });
  invalidateDevS3Cache(doc.$id);
  res.json({ data: { status, lastError, lastCheckAt: new Date().toISOString() } });
});

router.delete('/storage', apiRequireAuth(), async (req: Request, res: Response) => {
  const bodyWallet = (req.body as { wallet?: string })?.wallet;
  const queryWallet = req.query.wallet;
  const queryStr = typeof queryWallet === 'string' ? queryWallet : Array.isArray(queryWallet) ? String(queryWallet[0] || '') : '';
  const wallet = bodyWallet || queryStr;
  if (!wallet) {
    res.status(400).json({ error: 'wallet is required', code: 'NO_WALLET' });
    return;
  }
  const owner = await requireWalletOwner(req, res, wallet);
  if (!owner) return;
  const doc = await findSellerByWallet(wallet);
  if (!doc) {
    res.json({ data: { status: 'unconfigured' } });
    return;
  }
  await databases().updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
    storage_provider: 'none',
    storage_creds_iv: '',
    storage_creds_tag: '',
    storage_creds_ciphertext: '',
    storage_status: 'revoked',
    storage_last_check_at: new Date().toISOString(),
    storage_last_error: '',
  });
  invalidateDevS3Cache(doc.$id);
  await writeAudit(wallet, 'storage_revoke', 'seller', doc.$id, {});
  logger.info(`[storage] credentials revoked for seller=${doc.$id} wallet=${wallet}`);
  res.json({ data: { status: 'revoked' } });
});

export default router;
