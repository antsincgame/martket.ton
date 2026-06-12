/**
 * Outbound event webhooks (Agent/Demiurge automation, Phase 2).
 *
 * A seller registers an HTTPS URL and receives a signing secret; the platform
 * then POSTs HMAC-signed events (`order.paid`, `payout.released`) so a machine
 * agent reacts to sales **event-driven** instead of polling `/orders`. This is
 * the Stripe/Shopify-style primitive that lets an autonomous storefront run
 * itself.
 *
 * Delivery is strictly fire-and-forget: a webhook failure must NEVER affect the
 * money path, so callers invoke `dispatchWebhook(...)` without awaiting (or with
 * a `.catch`). The signing function is pure and unit-tested.
 */

import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { Agent } from 'undici';
import { databases } from './appwrite.js';
import { DATABASE_ID, COL_SELLER_PROFILES } from './constants.js';
import { findSellerByWallet, isPrivateIp } from './storageService.js';
import { logger } from '../logger.js';

export type WebhookEvent = 'order.paid' | 'payout.released' | 'order.refunded';

/** HMAC-SHA256 over the exact body bytes, hex, `sha256=`-prefixed. Pure. */
export function signWebhookBody(body: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/** Verify a signature header against the body (mirror of signing). Pure. */
export function verifyWebhookSignature(body: string, secret: string, header: string): boolean {
  if (!secret || !header) return false;
  const expected = signWebhookBody(body, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(header, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Validate a seller-supplied webhook URL. HTTPS only, and the host must not
 * resolve to a private/reserved range (SSRF — the platform makes the request).
 */
export async function validateWebhookUrl(url: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'Malformed URL' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'HTTPS required' };
  const host = parsed.hostname;
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) return { ok: false, reason: 'Numeric host not allowed' };
  if (net.isIP(host)) {
    return isPrivateIp(host) ? { ok: false, reason: 'Private/reserved IP not allowed' } : { ok: true };
  }
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    return { ok: false, reason: 'Host does not resolve' };
  }
  if (addrs.some((a) => isPrivateIp(a.address))) {
    return { ok: false, reason: 'Host resolves to a private/reserved IP' };
  }
  return { ok: true };
}

export interface SellerWebhook {
  profileId: string;
  url: string;
  secret: string;
}

/** Read a seller's configured webhook, or null if unset. */
export async function getSellerWebhook(wallet: string): Promise<SellerWebhook | null> {
  const doc = await findSellerByWallet(wallet);
  if (!doc) return null;
  const url = (doc['webhook_url'] as string | undefined)?.trim() || '';
  const secret = (doc['webhook_secret'] as string | undefined)?.trim() || '';
  if (!url || !secret) return null;
  return { profileId: doc.$id, url, secret };
}

/**
 * Register/replace a seller's webhook. Generates a fresh signing secret and
 * returns it ONCE (it is stored but never read back by any endpoint). Throws
 * `SELLER_NOT_REGISTERED` if no profile, or surfaces a schema error as
 * `WEBHOOK_NOT_PROVISIONED` if the attributes aren't deployed yet.
 */
export async function setSellerWebhook(wallet: string, url: string): Promise<{ secret: string }> {
  const doc = await findSellerByWallet(wallet);
  if (!doc) throw new Error('SELLER_NOT_REGISTERED');
  const secret = 'whsec_' + crypto.randomBytes(24).toString('hex');
  try {
    await databases().updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
      webhook_url: url,
      webhook_secret: secret,
    });
  } catch (err) {
    // Unknown-attribute (collection not provisioned with webhook fields yet).
    const msg = err instanceof Error ? err.message : String(err);
    if (/attribute|unknown|schema/i.test(msg)) throw new Error('WEBHOOK_NOT_PROVISIONED');
    throw err;
  }
  return { secret };
}

/** Remove a seller's webhook. */
export async function clearSellerWebhook(wallet: string): Promise<void> {
  const doc = await findSellerByWallet(wallet);
  if (!doc) return;
  await databases()
    .updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, { webhook_url: '', webhook_secret: '' })
    .catch((err) => logger.warn('[webhooks] clear failed:', err instanceof Error ? err.message : err));
}

/**
 * Resolve a webhook host to a single VALIDATED public IP at SEND time. Throws if
 * the host is private/unresolvable. (SSRF — registration-time validation alone is
 * insufficient because DNS can be re-pointed afterwards.)
 */
async function resolveValidatedPublicIp(host: string): Promise<string> {
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) throw new Error('Numeric host not allowed');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Private/reserved IP');
    return host;
  }
  const addrs = await dns.lookup(host, { all: true });
  if (addrs.length === 0) throw new Error('Host does not resolve');
  for (const a of addrs) {
    if (isPrivateIp(a.address)) throw new Error('Host resolves to a private/reserved IP');
  }
  return addrs[0]!.address;
}

async function postOnce(url: string, body: string, headers: Record<string, string>, timeoutMs: number): Promise<number> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('HTTPS required');
  // C-SSRF fix: re-validate the host and PIN the TCP connection to the vetted
  // public IP, so a DNS-rebind between validation and connect can't redirect us
  // to 169.254.169.254 / localhost. TLS SNI stays the original hostname (cert
  // validation intact). Redirects are NOT followed — a 3xx counts as a failed
  // delivery rather than a chance to bounce to an internal address.
  const pinnedIp = await resolveValidatedPublicIp(parsed.hostname);
  const dispatcher = new Agent({
    connect: {
      lookup: (
        _hostname: string,
        _options: unknown,
        cb: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
      ) => {
        if (isPrivateIp(pinnedIp)) { cb(new Error('pinned ip rejected'), '', 0); return; }
        cb(null, pinnedIp, net.isIP(pinnedIp) === 6 ? 6 : 4);
      },
    },
  });
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
      redirect: 'manual',
      // node/undici-specific: route this request through the pinned-IP dispatcher.
      dispatcher,
    } as RequestInit & { dispatcher: Agent });
    return res.status;
  } finally {
    clearTimeout(t);
    dispatcher.close().catch(() => undefined);
  }
}

/**
 * Deliver an event to the seller's webhook, signed. STRICTLY fire-and-forget —
 * never throws to the caller (the money path must not depend on it). No-op when
 * the seller has no webhook configured. Retries a couple of times on failure.
 */
export async function dispatchWebhook(wallet: string, event: WebhookEvent, data: unknown): Promise<void> {
  try {
    const hook = await getSellerWebhook(wallet);
    if (!hook) return;
    const body = JSON.stringify({
      id: crypto.randomUUID(),
      event,
      createdAt: new Date().toISOString(),
      data,
    });
    const headers = {
      'Content-Type': 'application/json',
      'X-TonForge-Event': event,
      'X-TonForge-Signature': signWebhookBody(body, hook.secret),
    };
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const status = await postOnce(hook.url, body, headers, 5000);
        if (status >= 200 && status < 300) return;
        logger.warn(`[webhooks] ${event} → ${hook.url} HTTP ${status} (attempt ${attempt})`);
      } catch (err) {
        logger.warn(`[webhooks] ${event} → ${hook.url} failed (attempt ${attempt}):`, err instanceof Error ? err.message : err);
      }
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  } catch (err) {
    logger.warn('[webhooks] dispatch error (ignored):', err instanceof Error ? err.message : err);
  }
}
