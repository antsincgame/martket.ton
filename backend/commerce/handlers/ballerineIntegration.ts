/**
 * Ballerine KYC/KYB integration for seller verification.
 *
 * Replaces the previous Didit integration. Ballerine is self-hosted (see the
 * "KYS" Coolify stack): a workflows-service API, a kyb-app collection flow the
 * seller completes, a back-office for reviewers, and a workflows dashboard.
 *
 *   workflows-service (API)   → BALLERINE_API_URL   (e.g. https://kyc-api.vibecoding.by)
 *   kyb-app (collection flow) → BALLERINE_FLOW_URL  (e.g. https://kyc-flow.vibecoding.by)
 *
 * Flow:
 *   1. createBallerineSession() asks the workflows-service to start a workflow
 *      run for the seller (correlated by wallet via `vendorData`), and returns
 *      the kyb-app collection-flow URL the seller opens to complete KYC.
 *   2. Ballerine POSTs status-change webhooks to our /sellers/kyc/webhook;
 *      verifyBallerineWebhookSignature() checks the HMAC over the RAW body and
 *      handleBallerineWebhook() maps the decision to seller_profiles.kyc_status.
 *
 * Env vars:
 *   BALLERINE_API_URL                — workflows-service base URL
 *   BALLERINE_API_KEY                — workflows-service API key (authorization)
 *   BALLERINE_FLOW_URL               — kyb-app collection-flow base URL
 *   BALLERINE_WORKFLOW_DEFINITION_ID — workflow definition id (default matches
 *                                      the kyb-app's VITE_KYB_DEFINITION_ID)
 *   BALLERINE_WEBHOOK_SECRET         — HMAC secret for webhook verification
 *
 * NOTE: the exact request/response field names and the webhook signature header
 * are Ballerine-version specific. The shapes below follow Ballerine's documented
 * `/api/v1/external/workflows/run` contract; confirm them against the deployed
 * "KYS" instance before relying on auto-approval in production. The integration
 * is disabled-safe: if BALLERINE_API_URL/KEY are unset, isBallerineConfigured()
 * is false and the seller falls back to the manual KYC card.
 */

import crypto from 'crypto';
import { databases, Query } from '../appwrite.js';
import { DATABASE_ID, COL_SELLER_PROFILES } from '../constants.js';
import { writeAudit } from '../audit.js';
import { logger } from '../../logger.js';

const DEFAULT_WORKFLOW_DEFINITION_ID = 'kyb_parent_kyc_session_example';
const PROVIDER = 'ballerine';

interface BallerineConfig {
  apiUrl: string;
  apiKey: string;
  flowUrl: string;
  workflowDefinitionId: string;
}

function readConfig(): BallerineConfig | null {
  const apiUrl = (process.env.BALLERINE_API_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (process.env.BALLERINE_API_KEY || '').trim();
  const flowUrl = (process.env.BALLERINE_FLOW_URL || '').trim().replace(/\/+$/, '');
  if (!apiUrl || !apiKey || !flowUrl) return null;
  return {
    apiUrl,
    apiKey,
    flowUrl,
    workflowDefinitionId:
      (process.env.BALLERINE_WORKFLOW_DEFINITION_ID || '').trim() || DEFAULT_WORKFLOW_DEFINITION_ID,
  };
}

export function isBallerineConfigured(): boolean {
  return readConfig() !== null;
}

interface WorkflowRunResponse {
  // Ballerine returns the created runtime; field naming varies by version, so we
  // read defensively below.
  workflowRuntimeId?: string;
  id?: string;
  ballerineEntityId?: string;
  collectionFlowUrl?: string;
}

/**
 * Start a Ballerine workflow run for the seller and return the collection-flow
 * URL the seller opens to complete KYC. The wallet is carried as vendor data so
 * the webhook can correlate the result back to the seller_profile.
 */
export async function createBallerineSession(
  sellerWallet: string,
  callbackUrl: string,
): Promise<{ sessionId: string; url: string }> {
  const cfg = readConfig();
  if (!cfg) throw new Error('Ballerine is not configured');

  const res = await fetch(`${cfg.apiUrl}/api/v1/external/workflows/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Ballerine workflows-service authenticates external calls with the API
      // key in the `authorization` header (no "Bearer" prefix).
      authorization: cfg.apiKey,
    },
    body: JSON.stringify({
      workflowId: cfg.workflowDefinitionId,
      // Correlate the run to the seller wallet so the webhook can map back.
      vendorData: sellerWallet,
      context: {
        entity: {
          type: 'individual',
          data: { correlationId: sellerWallet },
        },
        documents: [],
      },
      config: { callbackUrl },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error('[ballerine] workflow run failed:', res.status, text.slice(0, 300));
    throw new Error(`Ballerine workflow run failed: ${res.status}`);
  }

  const data = (await res.json().catch(() => ({}))) as WorkflowRunResponse;
  const runtimeId = data.workflowRuntimeId || data.id || '';
  if (!runtimeId) {
    logger.error('[ballerine] workflow run returned no runtime id');
    throw new Error('Ballerine workflow run returned no runtime id');
  }

  // The kyb-app reads the workflow it should resume from the query string. If
  // the API already returned a fully-formed collection-flow URL, prefer it.
  const url =
    data.collectionFlowUrl ||
    `${cfg.flowUrl}/?workflowId=${encodeURIComponent(cfg.workflowDefinitionId)}` +
      `&workflowRuntimeId=${encodeURIComponent(runtimeId)}`;

  // Mark the seller as pending (only if not already in a terminal state).
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
        kyc_provider: PROVIDER,
        kyc_applicant_id: runtimeId,
      });
    }
  }

  return { sessionId: runtimeId, url };
}

/**
 * Verify the HMAC signature on an incoming Ballerine webhook.
 *
 * FAIL-CLOSED: a missing secret or a missing/invalid signature returns false so
 * the caller rejects the request. The HMAC MUST be computed over the RAW request
 * body bytes — the route exempts this path from the global JSON body parser so
 * `rawBody` is the exact bytes Ballerine signed.
 */
export function verifyBallerineWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string,
): boolean {
  const secret = (process.env.BALLERINE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    logger.error('[ballerine] BALLERINE_WEBHOOK_SECRET not set — rejecting webhook (fail-closed)');
    return false;
  }
  if (!signatureHeader) return false;
  const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
  const digestHex = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
  // Ballerine may send the signature as bare hex or prefixed (e.g. "sha256=…").
  const provided = signatureHeader.includes('=')
    ? signatureHeader.split('=').pop()!.trim()
    : signatureHeader.trim();
  try {
    const expected = Buffer.from(digestHex, 'hex');
    const got = Buffer.from(provided, 'hex');
    return expected.length === got.length && crypto.timingSafeEqual(expected, got);
  } catch {
    return false;
  }
}

interface BallerineWebhookPayload {
  // Ballerine workflow event. We read the decision and the correlation (wallet)
  // defensively across the shapes seen in self-hosted workflows-service.
  eventName?: string;
  data?: {
    vendorData?: string;
    workflowRuntimeId?: string;
    status?: string;
    state?: string;
    context?: {
      entity?: { data?: { correlationId?: string } };
    };
  };
  // Some deployments flatten these to the top level.
  vendorData?: string;
  workflowRuntimeId?: string;
  status?: string;
  state?: string;
}

function extractWallet(p: BallerineWebhookPayload): string {
  return (
    p.data?.vendorData ||
    p.vendorData ||
    p.data?.context?.entity?.data?.correlationId ||
    ''
  );
}

/** Map a Ballerine workflow status/state to our kyc_status, or null if N/A. */
function mapDecision(p: BallerineWebhookPayload): 'approved' | 'rejected' | 'pending' | null {
  const raw = (p.data?.status || p.status || p.data?.state || p.state || p.eventName || '')
    .toString()
    .toLowerCase();
  if (raw.includes('approv') || raw.includes('complet')) return 'approved';
  if (raw.includes('reject') || raw.includes('declin') || raw.includes('fail')) return 'rejected';
  if (raw.includes('review') || raw.includes('progress') || raw.includes('pending')) return 'pending';
  return null;
}

/**
 * Process a Ballerine webhook event. Updates seller_profiles.kyc_status based on
 * the workflow decision, correlated by wallet (vendorData / correlationId).
 */
export async function handleBallerineWebhook(
  payload: BallerineWebhookPayload,
): Promise<{ processed: boolean }> {
  const wallet = extractWallet(payload);
  if (!wallet) {
    logger.warn('[ballerine] webhook missing vendorData / correlationId');
    return { processed: false };
  }

  const decision = mapDecision(payload);
  if (!decision) {
    logger.warn('[ballerine] webhook with no actionable decision');
    return { processed: false };
  }

  const db = databases();
  const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
    Query.equal('wallet', wallet),
    Query.limit(1),
  ]);
  if (!documents[0]) {
    logger.warn(`[ballerine] no seller_profile for wallet: ${wallet}`);
    return { processed: false };
  }

  const doc = documents[0];
  const runtimeId = payload.data?.workflowRuntimeId || payload.workflowRuntimeId || '';
  const now = new Date().toISOString();

  if (decision === 'approved') {
    await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
      kyc_status: 'approved',
      kyc_provider: PROVIDER,
      kyc_applicant_id: runtimeId,
      kyc_completed_at: now,
      kyc_rejection_reason: '',
    });
    await writeAudit(wallet, 'seller_kyc_approved', 'seller', doc.$id, {
      runtimeId,
      provider: PROVIDER,
    });
    logger.info(`[ballerine] seller KYC approved: ${wallet}`);
  } else if (decision === 'rejected') {
    await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
      kyc_status: 'rejected',
      kyc_provider: PROVIDER,
      kyc_applicant_id: runtimeId,
      kyc_rejection_reason: 'Verification declined',
    });
    await writeAudit(wallet, 'seller_kyc_rejected', 'seller', doc.$id, {
      runtimeId,
      provider: PROVIDER,
    });
    logger.info(`[ballerine] seller KYC rejected: ${wallet}`);
  } else {
    await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, {
      kyc_status: 'pending',
      kyc_provider: PROVIDER,
      kyc_applicant_id: runtimeId,
    });
    logger.info(`[ballerine] seller KYC in review: ${wallet}`);
  }

  return { processed: true };
}
