/**
 * Shared seller-storage (BYOS) service. Extracted so BOTH the human commerce
 * route (POST /api/v1/commerce/storage) and the agent route
 * (POST /api/v1/agent/storage) save credentials through ONE code path —
 * identical probing, SSRF guarding, AES-256-GCM encryption, and persistence.
 * The plaintext secret never leaves memory; only the encrypted record is stored.
 */
import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
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

/**
 * Приватный/зарезервированный ли IP (v4/v6). Используется для SSRF-защиты
 * (BYOS-эндпоинты И исходящие вебхуки — оба бьют по seller-контролируемым URL).
 */
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().trim();
  // ── IPv6 (anything with ':' that isn't the IPv4-mapped dotted form) ──
  if (v.includes(':') && !v.startsWith('::ffff:')) {
    if (v === '::1' || v === '::') return true;                 // loopback / unspecified
    if (v.startsWith('fc') || v.startsWith('fd')) return true;  // ULA fc00::/7
    if (/^fe[89ab]/.test(v)) return true;                       // link-local fe80::/10 (fe80–febf)
    if (v.startsWith('ff')) return true;                        // multicast ff00::/8
    return false;                                               // routable public IPv6
  }
  // ── IPv4 (incl. ::ffff:x.x.x.x mapped form) ──
  const mapped = v.startsWith('::ffff:') ? v.slice(7) : v;
  const m = mapped.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (octets.some((n) => n > 255)) return true;            // malformed → treat as unsafe
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;       // this-network / private / loopback
  if (a === 169 && b === 254) return true;                 // link-local / cloud metadata (169.254.169.254)
  if (a === 172 && b! >= 16 && b! <= 31) return true;      // private 172.16/12
  if (a === 192 && b === 168) return true;                 // private 192.168/16
  if (a === 100 && b! >= 64 && b! <= 127) return true;     // CGNAT 100.64/10
  if (a === 198 && (b === 18 || b === 19)) return true;    // benchmarking 198.18/15
  if (a! >= 224) return true;                              // multicast 224/4 + reserved 240/4 + broadcast
  return false;
}

/**
 * Резолвит custom-endpoint и проверяет КАЖДЫЙ адрес против приватных
 * диапазонов. Закрывает DNS-rebinding (evil.com → 169.254.169.254) и числовые/
 * hex-обходы (http://2130706433/), которые регекс-фильтр не ловит.
 */
async function assertEndpointNotPrivate(endpoint: string): Promise<string[]> {
  let host: string;
  try {
    host = new URL(endpoint).hostname;
  } catch {
    throw new Error('Malformed endpoint URL');
  }
  // Голый числовой/hex хост — не DNS-имя и не валидный dotted-IP: отклоняем.
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) {
    throw new Error('Numeric/non-DNS host is not allowed');
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Endpoint targets a private/reserved IP');
    return [host];
  }
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('Endpoint host does not resolve');
  }
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw new Error('Endpoint resolves to a private/reserved IP');
    }
  }
  // Return the validated addresses so the actual S3 connection can be PINNED to
  // them (M-3). Re-resolving inside the SDK would reopen a DNS-rebinding TOCTOU:
  // a host that answered public here could answer 169.254.169.254 at connect.
  return addrs.map((a) => a.address);
}

/**
 * Build an https/http Agent whose DNS `lookup` only ever returns one of the
 * already-validated public IPs (and re-checks privateness defensively). Passed
 * to the S3 client so it connects to the IP we vetted, not whatever DNS says at
 * connect time. TLS SNI/host stays the original hostname, so cert validation and
 * SigV4 signing are unaffected.
 */
function makePinnedHandler(allowedIps: string[]): NodeHttpHandler {
  const allow = new Set(allowedIps);
  const pinnedLookup = (
    _hostname: string,
    _options: unknown,
    callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
  ): void => {
    const ip = allowedIps[0]!;
    if (!allow.has(ip) || isPrivateIp(ip)) {
      callback(new Error('Pinned address rejected'), '', 0);
      return;
    }
    callback(null, ip, net.isIP(ip) === 6 ? 6 : 4);
  };
  // Node's Agent accepts a `lookup` option forwarded to net.connect.
  const httpsAgent = new https.Agent({ lookup: pinnedLookup as never });
  const httpAgent = new http.Agent({ lookup: pinnedLookup as never });
  return new NodeHttpHandler({ httpsAgent, httpAgent });
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
  /** Validated public IPs to pin the connection to (M-3, SSRF TOCTOU). */
  pinnedIps?: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = new S3Client({
      region: regionFor(opts.provider, opts.accountId),
      endpoint: opts.endpoint,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
      forcePathStyle: opts.provider !== 's3',
      ...(opts.pinnedIps && opts.pinnedIps.length > 0
        ? { requestHandler: makePinnedHandler(opts.pinnedIps) }
        : {}),
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
  // Для custom-endpoint — резолв + проверка приватных диапазонов (дефолтные
  // r2/s3/b2 эндпоинты строятся из accountId и безопасны по построению).
  let pinnedIps: string[] | undefined;
  if (input.endpoint) {
    try {
      pinnedIps = await assertEndpointNotPrivate(endpoint);
    } catch (err) {
      return { ok: false, status: 400, code: 'BAD_ENDPOINT', error: err instanceof Error ? err.message : 'bad endpoint' };
    }
  }
  const probe = await probeBucket({
    provider: input.provider,
    accountId: input.accountId,
    bucket: input.bucket,
    endpoint,
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
    // Pin the connection to the IP we just validated (custom endpoints only).
    pinnedIps,
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
