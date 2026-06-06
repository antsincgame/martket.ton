/**
 * Didit KYC integration for seller verification.
 *
 * - Session creation: creates a verification session via Didit API,
 *   returning a hosted URL the seller opens in a new tab / iframe.
 * - Webhook handler: receives status-change events from Didit,
 *   verifies HMAC signature, and updates `seller_profiles.kyc_status`
 *   in Appwrite.
 *
 * Env vars required:
 *   DIDIT_API_KEY          — x-api-key from Didit Business Console
 *   DIDIT_WORKFLOW_ID      — UUID of the verification workflow
 *   DIDIT_WEBHOOK_SECRET   — secret for HMAC signature verification
 *
 * Free tier: 500 verifications/month (ID + Liveness + Face Match + IP Analysis).
 * Docs: https://docs.didit.me
 */

import crypto from 'crypto';
import { databases, Query } from '../appwrite.js';
import { DATABASE_ID, COL_SELLER_PROFILES } from '../constants.js';
import { writeAudit } from '../audit.js';
import { logger } from '../../logger.js';

const DIDIT_BASE_URL = 'https://verification.didit.me/v3';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function getDiditConfig() {
  return {
    apiKey: requireEnv('DIDIT_API_KEY'),
    workflowId: requireEnv('DIDIT_WORKFLOW_ID'),
    // NOTE: DIDIT_WEBHOOK_SECRET is read directly in verifyDiditWebhookSignature
    // (webhook verification must not depend on the API key / workflow id).
  };
}

interface DiditSessionResponse {
  session_id: string;
  session_token: string;
  session_number: number;
  url: string;
}

/**
 * Create a Didit verification session for the given seller wallet.
 * Returns the session URL where the seller completes KYC.
 */
export async function createDiditSession(
  sellerWallet: string,
  callbackUrl: string,
): Promise<{ sessionId: string; url: string }> {
  const cfg = getDiditConfig();

  const res = await fetch(`${DIDIT_BASE_URL}/sessions/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
    },
    body: JSON.stringify({
      workflow_id: cfg.workflowId,
      vendor_data: sellerWallet,
      callback: callbackUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('[didit] session creation failed:', res.status, text);
    throw new Error(`Didit session creation failed: ${res.status}`);
  }

  const data = (await res.json()) as DiditSessionResponse;

  const db = databases();
  const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
    Query.equal('wallet', sellerWallet),
    Query.limit(1),
  ]);
  if (documents[0]) {
    const doc = documents[0];
    const currentStatus = (doc as Record<string, unknown>)['kyc_status'];
    if (!currentStatus || currentStatus === 'none') {
      await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
        kyc_status: 'pending',
        kyc_provider: 'didit',
        kyc_applicant_id: data.session_id,
      });
    }
  }

  return { sessionId: data.session_id, url: data.url };
}

/**
 * Fetch verification session result from Didit.
 */
export async function fetchDiditSessionResult(
  sessionId: string,
): Promise<{ status: string; vendorData: string }> {
  const cfg = getDiditConfig();

  const res = await fetch(`${DIDIT_BASE_URL}/sessions/${sessionId}/`, {
    method: 'GET',
    headers: {
      'x-api-key': cfg.apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('[didit] session fetch failed:', res.status, text);
    throw new Error(`Didit session fetch failed: ${res.status}`);
  }

  const data = (await res.json()) as { status: string; vendor_data: string };
  return { status: data.status, vendorData: data.vendor_data };
}

/**
 * Verify the HMAC signature on an incoming Didit webhook.
 *
 * FAIL-CLOSED: a missing secret or a missing/invalid signature returns false so
 * the caller rejects the request. Reads DIDIT_WEBHOOK_SECRET directly (it does
 * NOT require the API key / workflow id, which are unrelated to verification).
 */
export function verifyDiditWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string,
): boolean {
  const secret = (process.env.DIDIT_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    logger.error('[didit] DIDIT_WEBHOOK_SECRET not set — rejecting webhook (fail-closed)');
    return false;
  }
  if (!signatureHeader) return false;
  const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
  const digest = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
  try {
    const expected = Buffer.from(digest, 'hex');
    const provided = Buffer.from(signatureHeader, 'hex');
    return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

type DiditStatus = 'Approved' | 'Declined' | 'In Review' | 'Pending' | 'In Progress' | 'Expired';

interface DiditWebhookPayload {
  session_id: string;
  status: DiditStatus;
  vendor_data: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Process a Didit webhook event.
 * Updates seller_profiles.kyc_status based on the session status.
 */
export async function handleDiditWebhook(
  payload: DiditWebhookPayload,
): Promise<{ processed: boolean }> {
  const wallet = payload.vendor_data;
  if (!wallet) {
    logger.warn('[didit] webhook missing vendor_data');
    return { processed: false };
  }

  const db = databases();
  const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
    Query.equal('wallet', wallet),
    Query.limit(1),
  ]);

  if (!documents[0]) {
    logger.warn(`[didit] no seller_profile for wallet: ${wallet}`);
    return { processed: false };
  }

  const doc = documents[0];
  const now = new Date().toISOString();

  if (payload.status === 'Approved') {
    await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
      kyc_status: 'approved',
      kyc_applicant_id: payload.session_id,
      kyc_completed_at: now,
      kyc_rejection_reason: '',
    });
    await writeAudit(wallet, 'seller_kyc_approved', 'seller', doc.$id, {
      sessionId: payload.session_id,
      provider: 'didit',
    });
    logger.info(`[didit] seller KYC approved: ${wallet}`);
  } else if (payload.status === 'Declined') {
    await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
      kyc_status: 'rejected',
      kyc_applicant_id: payload.session_id,
      kyc_rejection_reason: 'Verification declined',
    });
    await writeAudit(wallet, 'seller_kyc_rejected', 'seller', doc.$id, {
      sessionId: payload.session_id,
      provider: 'didit',
    });
    logger.info(`[didit] seller KYC rejected: ${wallet}`);
  } else if (payload.status === 'In Review' || payload.status === 'In Progress') {
    await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
      kyc_status: 'pending',
      kyc_applicant_id: payload.session_id,
    });
    logger.info(`[didit] seller KYC in review: ${wallet}`);
  } else if (payload.status === 'Expired') {
    await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
      kyc_status: 'none',
      kyc_applicant_id: payload.session_id,
      kyc_rejection_reason: 'Verification session expired. Please start again.',
    });
    logger.info(`[didit] seller KYC session expired: ${wallet}`);
  } else {
    logger.warn(`[didit] unknown status: ${payload.status}`);
    return { processed: false };
  }

  return { processed: true };
}
