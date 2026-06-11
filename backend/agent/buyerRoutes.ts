/**
 * Buyer-side Agent API (B3, agentic purchasing) — mounted at
 * `/api/v1/agent/buyer`. Lets an AI agent BUY on the marketplace with its own
 * TON wallet (e.g. a TON Agentic Wallet, https://agents.ton.org/): create an
 * order, pay the returned escrow from its own wallet, confirm, poll, download.
 *
 * Auth: the same `tfa_` Personal Access Token mechanics as the seller surface,
 * but with the buyer scope `orders:buy`, issued via POST
 * /api/v1/commerce/buyer-agent-tokens by the accountable HUMAN owner (session
 * auth + Lite KYC + wallet-ownership proof — see buyerTokenRoutes.ts). The
 * acting wallet ALWAYS comes from the token, never the request body.
 *
 * `skipKyc: true` here disables the per-call *seller* KYC re-check — buyer
 * accountability is anchored at token issuance instead (the agent wallet has
 * no profile of its own). Sanctions are still screened on every call by the
 * middleware, and the order cores re-screen + AML-check the paying wallet.
 *
 * The money path is NOT reimplemented here: both surfaces call the same
 * `createOrderCore` / `confirmOrderCore` (backend/commerce/orderCore.ts).
 */

import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as crypto from 'node:crypto';
import { databases, ID, Query } from '../commerce/appwrite.js';
import {
  DATABASE_ID,
  COL_LISTINGS,
  COL_ORDERS,
  COL_ENTITLEMENTS,
  COL_SELLER_PROFILES,
  COL_DOWNLOAD_AUDIT,
  ORDER_STATE,
} from '../commerce/constants.js';
import { createOrderCore, confirmOrderCore } from '../commerce/orderCore.js';
import { addressesEqual } from '../commerce/tonVerify.js';
import { appwriteCodeOrZero } from '../commerce/helpers.js';
import { findLicenseByBuyerAndListing } from '../commerce/licenseRepository.js';
import { decideDownloadGate, decideScanGate } from '../commerce/handlers/downloadGate.js';
import { isVtConfigured } from '../scan/virustotal.js';
import { getAdapter } from '../distribution/index.js';
import { storedToManifest } from '../distribution/manifest.js';
import { resolveNetworkConfig } from '../config/network.js';
import { logger } from '../logger.js';
import { str } from '../utils/params.js';
import { validateBody } from '../middleware/validate.js';
import { z } from 'zod';
import { apiRequireAgentToken } from './agentAuth.js';

const router = express.Router();

const DOWNLOAD_RATE_LIMIT_PER_DAY = 20;

const requireBuyerScope = () => apiRequireAgentToken(['orders:buy'], { skipKyc: true });

// Same per-IP bounds the human money routes carry (defence in depth on top of
// the router-wide limiter and the 600/15min per-token limit in the middleware).
const limitCreateOrder = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const limitConfirm = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });

const buyerCreateOrderSchema = z.object({
  listingId: z.string().min(1, 'listingId is required'),
});

/**
 * Create an order for the TOKEN's wallet. The response includes everything the
 * agent's wallet tool needs to pay: the escrow address, the exact total in
 * nanoton, and the message stateInit + payload (base64 BOC) that MUST be
 * attached — a plain transfer without them leaves the escrow undeployed/INIT
 * and the payment unverifiable.
 */
router.post(
  '/orders',
  requireBuyerScope(),
  limitCreateOrder,
  validateBody(buyerCreateOrderSchema),
  async (req: Request, res: Response) => {
    const { listingId } = req.body as { listingId: string };
    const buyerWallet = req.agent!.wallet;
    const netCfg = resolveNetworkConfig(req);
    const result = await createOrderCore({
      listingId,
      buyerWallet,
      netCfg,
      buyerIp: req.ip ?? null,
      // The accountable human's Lite KYC + wallet-ownership proof were
      // verified when this buyer token was issued; the agent wallet itself
      // has no profile to look up.
      kycLite: 'verified-at-issuance',
    });
    if (!result.ok) {
      res.status(result.status).json(result.body);
      return;
    }
    const escrow = result.data.escrow as Record<string, unknown> | null;
    res.json({
      data: {
        ...result.data,
        // Machine-actionable payment instructions for the agent's TON wallet
        // (TON Agentic Wallet / @ton/mcp / any wallet able to send a message
        // with stateInit + payload).
        payment: escrow
          ? {
              network: netCfg.network,
              payFromWallet: buyerWallet,
              payToAddress: escrow.address,
              amountNanoton: escrow.totalAmountRaw,
              stateInitBase64: escrow.stateInit,
              payloadBase64: escrow.payload,
              note:
                'Send EXACTLY amountNanoton from payFromWallet to payToAddress with BOTH ' +
                'stateInitBase64 and payloadBase64 attached, then call POST ' +
                `/api/v1/agent/buyer/orders/${result.data.orderId}/confirm.`,
            }
          : null,
      },
    });
  },
);

/** Verify the on-chain payment for the token wallet's own order. */
router.post(
  '/orders/:id/confirm',
  requireBuyerScope(),
  limitConfirm,
  async (req: Request, res: Response) => {
    const result = await confirmOrderCore({
      orderId: str(req.params.id),
      buyerWallet: req.agent!.wallet,
      netCfg: resolveNetworkConfig(req),
      buyerIp: req.ip ?? null,
      // No session library bridge for agents: agent purchases are v4 escrow
      // orders whose record of ownership is the on-chain license itself.
    });
    if (!result.ok) {
      res.status(result.status).json(result.body);
      return;
    }
    res.json({ data: result.data });
  },
);

/** Poll the token wallet's own order: state, escrow, license, delivery. */
router.get('/orders/:id', requireBuyerScope(), async (req: Request, res: Response) => {
  try {
    const orderId = str(req.params.id);
    const wallet = req.agent!.wallet;
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
    if (!addressesEqual((order['buyerWallet'] as string) || '', wallet)) {
      res.status(403).json({ error: 'Not your order', code: 'FORBIDDEN' });
      return;
    }
    let delivery: string | null = null;
    if (order['state'] === ORDER_STATE.PAID || order['state'] === ORDER_STATE.FULFILLED) {
      const { documents } = await db.listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
        Query.equal('orderId', orderId), Query.limit(1),
      ]);
      if (documents[0]) delivery = documents[0]['deliveryPayload'] as string;
    }
    res.json({
      data: {
        order: {
          id: order.$id,
          listingId: order['listingId'],
          state: order['state'],
          amountRaw: order['amountRaw'],
          sellerNetAmountRaw: order['sellerNetAmountRaw'],
          currency: order['currency'],
          memo: order['memo'],
          tonTxHash: (order['tonTxHash'] as string) || '',
          escrowAddress: (order['escrowAddress'] as string) || '',
          licenseAddress: (order['licenseAddress'] as string) || '',
        },
        deliveryPayload: delivery,
      },
    });
  } catch (e: unknown) {
    if (appwriteCodeOrZero(e) === 404) {
      res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' });
      return;
    }
    logger.error('[agent.buyer] order get:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Order retrieval failed', code: 'BUYER_ORDER_GET' });
  }
});

/**
 * License-gated signed download URL for a purchased listing — the agent
 * counterpart of GET /api/v1/commerce/listings/:id/download, JSON-only.
 * Same gates as the human path, same order: verified build → antivirus
 * verdict → entitlement → minted-license → 20/day rate limit → audit row.
 */
router.get('/listings/:id/download', requireBuyerScope(), async (req: Request, res: Response) => {
  try {
    const listingId = str(req.params.id);
    const wallet = req.agent!.wallet;
    const db = databases();

    let doc: Record<string, unknown>;
    try {
      doc = (await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId)) as unknown as Record<string, unknown>;
    } catch (e) {
      if (appwriteCodeOrZero(e) === 404) {
        res.status(404).json({ error: 'Listing not found', code: 'NO_LISTING' });
        return;
      }
      throw e;
    }
    if (doc['distribution_state'] !== 'verified') {
      res.status(404).json({ error: 'Build not available', code: 'NO_BUILD' });
      return;
    }
    const kind = (doc['distribution_kind'] as string) || '';
    const locatorRaw = (doc['distribution_locator'] as string) || '';
    if (!kind || kind === 'none' || !locatorRaw) {
      res.status(404).json({ error: 'Manifest missing', code: 'NO_MANIFEST' });
      return;
    }

    const scanStatus = doc['scan_status'] as string | undefined;
    const scanDenial = decideScanGate(scanStatus, isVtConfigured());
    if (scanDenial) {
      res.status(scanDenial.status).json({ error: scanDenial.message, code: scanDenial.code });
      return;
    }

    const { documents: entDocs } = await db.listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
      Query.equal('buyerWallet', [wallet]),
      Query.equal('listingId', [listingId]),
      Query.limit(1),
    ]);
    if (entDocs.length === 0) {
      res.status(403).json({ error: 'No entitlement for this product', code: 'NO_ENTITLEMENT' });
      return;
    }

    // License gate: identical policy to the human path — record exists,
    // state == minted, nftAddress set, clean scan verdict. Hard deny otherwise:
    // without a real NFT the buyer-burn refund guarantee does not apply.
    const license = await findLicenseByBuyerAndListing(wallet, listingId);
    const gate = decideDownloadGate(license, scanStatus, isVtConfigured());
    if (gate.kind === 'deny') {
      const body: Record<string, unknown> = { error: gate.message, code: gate.code };
      if (gate.licenseId) body.licenseId = gate.licenseId;
      if (license) body.state = license.state;
      res.status(gate.status).json(body);
      return;
    }

    // Rate limit: ≤ 20 signed URLs/day per entitlement — same key the human
    // download route uses, so the budget is shared across surfaces.
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const entitlementId = String(entDocs[0]!.$id);
    const recent = await db.listDocuments(DATABASE_ID, COL_DOWNLOAD_AUDIT, [
      Query.equal('license_id', [entitlementId]),
      Query.greaterThan('issued_at', since),
      Query.limit(DOWNLOAD_RATE_LIMIT_PER_DAY + 1),
    ]);
    if (recent.documents.length >= DOWNLOAD_RATE_LIMIT_PER_DAY) {
      res.status(429).json({ error: 'Download rate limit exceeded (20/day)', code: 'DOWNLOAD_RATE_LIMIT' });
      return;
    }

    const locator = JSON.parse(locatorRaw) as Record<string, unknown>;
    const manifest = storedToManifest({
      kind: kind as 'r2' | 'github',
      bucket: locator.bucket as string | undefined,
      key: locator.key as string | undefined,
      repo: locator.repo as string | undefined,
      tag: locator.tag as string | undefined,
      asset: locator.asset as string | undefined,
      sha256: (doc['distribution_sha256'] as string) || '',
      filename: doc['distribution_filename'] as string | undefined,
    });
    const sellerWallet = (doc['sellerWallet'] as string) || '';
    const { documents: sellers } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
      Query.equal('wallet', sellerWallet), Query.limit(1),
    ]);
    const sellerId = sellers[0]?.$id || sellerWallet;

    const ttlSec = Math.min(21600, Math.max(60, (doc['distribution_ttl_sec'] as number) || 3600));
    const url = await getAdapter(manifest.kind).getDownloadUrl(manifest, { sellerId }, ttlSec);

    // Audit (best-effort, never blocks). Key must match the rate-limit query.
    const ipHash = crypto
      .createHash('sha256')
      .update((req.ip || '') + (process.env.STORAGE_ENCRYPTION_KEY || ''))
      .digest('hex')
      .slice(0, 32);
    db.createDocument(DATABASE_ID, COL_DOWNLOAD_AUDIT, ID.unique(), {
      license_id: entitlementId,
      buyer_wallet: wallet,
      ip_hash: ipHash,
      ttl_sec: ttlSec,
      source_kind: manifest.kind,
      issued_at: new Date().toISOString(),
    }).catch((err: unknown) => {
      logger.warn(
        `[agent.buyer] download_audit insert failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    });

    res.json({ data: { url, expiresInSec: ttlSec, sha256: (doc['distribution_sha256'] as string) || '' } });
  } catch (e: unknown) {
    logger.error('[agent.buyer] download:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Download failed', code: 'BUYER_DOWNLOAD' });
  }
});

export default router;
