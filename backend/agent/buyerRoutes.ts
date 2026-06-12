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
  COL_DOWNLOAD_AUDIT,
  ORDER_STATE,
} from '../commerce/constants.js';
import { createOrderCore, confirmOrderCore } from '../commerce/orderCore.js';
import { addressesEqual } from '../commerce/tonVerify.js';
import { appwriteCodeOrZero } from '../commerce/helpers.js';
import { resolveBuyerDownload, type DownloadListingDoc } from '../commerce/buyerDownload.js';
import { getAdapter } from '../distribution/index.js';
import { resolveNetworkConfig } from '../config/network.js';
import { logger } from '../logger.js';
import { str } from '../utils/params.js';
import { validateBody } from '../middleware/validate.js';
import { z } from 'zod';
import { apiRequireAgentToken } from './agentAuth.js';

const router = express.Router();

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

    let doc: DownloadListingDoc;
    try {
      doc = (await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId)) as unknown as DownloadListingDoc;
    } catch (e) {
      if (appwriteCodeOrZero(e) === 404) {
        res.status(404).json({ error: 'Listing not found', code: 'NO_LISTING' });
        return;
      }
      throw e;
    }

    // Shared buyer-download gauntlet (same gates + rate limit as the human path).
    const resolved = await resolveBuyerDownload(db, doc, wallet);
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.message, code: resolved.code, ...resolved.extra });
      return;
    }

    const url = await getAdapter(resolved.manifest.kind).getDownloadUrl(
      resolved.manifest, { sellerId: resolved.sellerId }, resolved.ttlSec,
    );

    // Audit (best-effort, never blocks). Key must match the rate-limit query.
    const ipHash = crypto
      .createHash('sha256')
      .update((req.ip || '') + (process.env.STORAGE_ENCRYPTION_KEY || ''))
      .digest('hex')
      .slice(0, 32);
    db.createDocument(DATABASE_ID, COL_DOWNLOAD_AUDIT, ID.unique(), {
      license_id: resolved.entitlementId,
      buyer_wallet: wallet,
      ip_hash: ipHash,
      ttl_sec: resolved.ttlSec,
      source_kind: resolved.manifest.kind,
      issued_at: new Date().toISOString(),
    }).catch((err: unknown) => {
      logger.warn(
        `[agent.buyer] download_audit insert failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    });

    res.json({ data: { url, expiresInSec: resolved.ttlSec, sha256: resolved.sha256 } });
  } catch (e: unknown) {
    logger.error('[agent.buyer] download:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Download failed', code: 'BUYER_DOWNLOAD' });
  }
});

export default router;
