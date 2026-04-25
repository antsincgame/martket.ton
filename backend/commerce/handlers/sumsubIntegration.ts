/**
 * Sumsub KYC integration for seller verification.
 *
 * - Token generation: Server-to-Server HMAC-signed request to Sumsub
 *   to create a short-lived access token for the WebSDK widget.
 * - Webhook handler: receives `applicantReviewed` events from Sumsub,
 *   verifies HMAC signature, and updates `seller_profiles.kyc_status`
 *   in Appwrite.
 *
 * Env vars required:
 *   SUMSUB_APP_TOKEN, SUMSUB_SECRET_KEY, SUMSUB_WEBHOOK_SECRET, SUMSUB_LEVEL_NAME
 */

import crypto from 'crypto';
import { databases, Query } from '../appwrite.js';
import { DATABASE_ID, COL_SELLER_PROFILES } from '../constants.js';
import { writeAudit } from '../audit.js';
import { logger } from '../../logger.js';

const SUMSUB_BASE_URL = 'https://api.sumsub.com';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function getSumsubConfig() {
  return {
    appToken: requireEnv('SUMSUB_APP_TOKEN'),
    secretKey: requireEnv('SUMSUB_SECRET_KEY'),
    webhookSecret: requireEnv('SUMSUB_WEBHOOK_SECRET'),
    levelName: process.env.SUMSUB_LEVEL_NAME || 'basic-kyc',
  };
}

/**
 * Creates HMAC signature for Sumsub Server-to-Server API requests.
 */
function signRequest(
  method: string,
  url: string,
  ts: number,
  body: string,
  secretKey: string,
): string {
  const data = `${ts}${method.toUpperCase()}${url}${body}`;
  return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
}

/**
 * Generate a short-lived Sumsub access token for the WebSDK widget.
 * The `externalUserId` is the seller's wallet address (unique per seller).
 */
export async function generateSumsubToken(
  externalUserId: string,
): Promise<{ token: string; userId: string }> {
  const cfg = getSumsubConfig();
  const ts = Math.floor(Date.now() / 1000);
  const path = `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}&levelName=${encodeURIComponent(cfg.levelName)}&ttlInSecs=1200`;
  const method = 'POST';
  const body = '';
  const sig = signRequest(method, path, ts, body, cfg.secretKey);

  const res = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App-Token': cfg.appToken,
      'X-App-Access-Sig': sig,
      'X-App-Access-Ts': String(ts),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('[sumsub] token generation failed:', res.status, text);
    throw new Error(`Sumsub token generation failed: ${res.status}`);
  }

  const data = (await res.json()) as { token: string; userId: string };

  const db = databases();
  const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
    Query.equal('wallet', externalUserId),
    Query.limit(1),
  ]);
  if (documents[0]) {
    const doc = documents[0];
    const currentStatus = (doc as Record<string, unknown>)['kyc_status'];
    if (!currentStatus || currentStatus === 'none') {
      await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
        kyc_status: 'pending',
        kyc_provider: 'sumsub',
        kyc_applicant_id: data.userId,
      });
    }
  }

  return data;
}

/**
 * Verify the HMAC-SHA256 signature on an incoming Sumsub webhook.
 */
export function verifySumsubWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string,
): boolean {
  const cfg = getSumsubConfig();
  const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
  const digest = crypto
    .createHmac('sha256', cfg.webhookSecret)
    .update(bodyStr)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(digest, 'hex'),
    Buffer.from(signatureHeader, 'hex'),
  );
}

interface SumsubWebhookPayload {
  type: string;
  applicantId: string;
  externalUserId: string;
  reviewResult?: {
    reviewAnswer: 'GREEN' | 'RED';
    rejectLabels?: string[];
    reviewRejectType?: string;
    clientComment?: string;
  };
  reviewStatus?: string;
}

/**
 * Process a Sumsub webhook event.
 * Updates seller_profiles.kyc_status based on the review result.
 */
export async function handleSumsubWebhook(
  payload: SumsubWebhookPayload,
): Promise<{ processed: boolean }> {
  if (payload.type !== 'applicantReviewed') {
    logger.info(`[sumsub] ignoring webhook type: ${payload.type}`);
    return { processed: false };
  }

  const wallet = payload.externalUserId;
  if (!wallet) {
    logger.warn('[sumsub] webhook missing externalUserId');
    return { processed: false };
  }

  const db = databases();
  const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
    Query.equal('wallet', wallet),
    Query.limit(1),
  ]);

  if (!documents[0]) {
    logger.warn(`[sumsub] no seller_profile for wallet: ${wallet}`);
    return { processed: false };
  }

  const doc = documents[0];
  const reviewAnswer = payload.reviewResult?.reviewAnswer;
  const now = new Date().toISOString();

  if (reviewAnswer === 'GREEN') {
    await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
      kyc_status: 'approved',
      kyc_applicant_id: payload.applicantId,
      kyc_completed_at: now,
      kyc_rejection_reason: '',
    });
    await writeAudit(wallet, 'seller_kyc_approved', 'seller', doc.$id, {
      applicantId: payload.applicantId,
    });
    logger.info(`[sumsub] seller KYC approved: ${wallet}`);
  } else if (reviewAnswer === 'RED') {
    const reason = [
      payload.reviewResult?.reviewRejectType,
      ...(payload.reviewResult?.rejectLabels ?? []),
      payload.reviewResult?.clientComment,
    ]
      .filter(Boolean)
      .join('; ')
      .slice(0, 500);

    await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
      kyc_status: 'rejected',
      kyc_applicant_id: payload.applicantId,
      kyc_rejection_reason: reason || 'Verification failed',
    });
    await writeAudit(wallet, 'seller_kyc_rejected', 'seller', doc.$id, {
      applicantId: payload.applicantId,
      reason,
    });
    logger.info(`[sumsub] seller KYC rejected: ${wallet} — ${reason}`);
  } else {
    logger.warn(`[sumsub] unknown reviewAnswer: ${reviewAnswer}`);
    return { processed: false };
  }

  return { processed: true };
}
