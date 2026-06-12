import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  DATABASE_ID, COL_LISTINGS, COL_ORDERS, COL_ENTITLEMENTS,
  ORDER_STATE, LICENSE_STATE,
} from './constants.js';
import { databases, Query } from './appwrite.js';
import { addressesEqual } from './tonVerify.js';
import { buildRefundIfNotMintedPayload } from './escrow.js';
import { findLicenseByOrderId, updateLicense } from './licenseRepository.js';
import { decideRefundClaim, REFUND_CLAIM_GAS_NANO } from './refundClaim.js';
import { resolveNetworkConfig } from '../config/network.js';
import { writeAudit } from './audit.js';
import { logger } from '../logger.js';
import { apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { str } from '../utils/params.js';
import { createOrderSchema, confirmOrderSchema } from './validation.js';
import { appwriteCodeOrZero, requireWalletOwner } from './helpers.js';
import { resolveProfile } from '../middleware/auth.js';
import { insertPurchase } from '../core/purchaseRepository.js';
import { createOrderCore, confirmOrderCore } from './orderCore.js';


const router = express.Router();

const limitConfirm = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });
const limitCreateOrder = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

/**
 * v4 order creation flow:
 *
 * 1. listing.priceAmountRaw = seller's listed price (сколько seller хочет получить)
 * 2. Платформа добавляет fee поверх: fee = seller_price * feeBps / 10000
 * 3. Buyer платит total = seller_price + fee (с небольшим gas buffer)
 * 4. Escrow deployed с split: amountNano=total, sellerAmountNano=seller, feeNano=fee
 * 5. При ConfirmDelivery: escrow шлёт sellerAmountNano → seller, feeNano + gas change → treasury
 *
 * Все v4-специфичные поля (escrowAddress, sellerWallet, mintAttempts,
 * licenseAddress, licenseContentUri) сохраняются в order чтобы mint worker
 * мог автономно обработать платёж.
 */
router.post('/orders', apiRequireAuth(), limitCreateOrder, validateBody(createOrderSchema), async (req: Request, res: Response) => {
  const { listingId, buyerWallet } = req.body as { listingId: string; buyerWallet: string };
  const owner = await requireWalletOwner(req, res, buyerWallet);
  if (!owner) return;
  const result = await createOrderCore({
    listingId,
    buyerWallet,
    netCfg: resolveNetworkConfig(req),
    buyerIp: req.ip ?? null,
    kycLite: 'wallet',
  });
  if (!result.ok) {
    res.status(result.status).json(result.body);
    return;
  }
  res.json({ data: result.data });
});

/**
 * Confirm order payment.
 *
 * v4 preferred: если order.escrowAddress != '' — проверяем что buyer отправил
 *   total amount на escrow address. order остаётся PENDING_PAYMENT до mint worker
 *   (entitlement + PAID проставит worker).
 *
 * Legacy fallback: если escrowAddress == '' (ордер создан без escrow, либо
 *   COLLECTION_ADDRESS не был настроен) — проверяем payment на treasury по memo.
 *   В этом пути entitlement создаётся сразу (как в v3).
 *
 * В v4 пути entitlement создаётся mint worker'ом после успешного mint.
 */
router.post('/orders/:id/confirm', apiRequireAuth(), limitConfirm, validateBody(confirmOrderSchema), async (req: Request, res: Response) => {
  const orderId = str(req.params.id);
  const { buyerWallet } = req.body as { txHash: string; buyerWallet: string };
  const owner = await requireWalletOwner(req, res, buyerWallet);
  if (!owner) return;
  const result = await confirmOrderCore({
    orderId,
    buyerWallet,
    netCfg: resolveNetworkConfig(req),
    buyerIp: req.ip ?? null,
    // Legacy v3 fulfilment bridges the purchase into the session library —
    // needs the caller's session profile, so only this route supplies it.
    bridgePurchase: (listingRow, txHash) => bridgePurchaseToLibrary(req, listingRow, txHash),
  });
  if (!result.ok) {
    res.status(result.status).json(result.body);
    return;
  }
  res.json({ data: result.data });
});

router.get('/sellers/:wallet/orders', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const wallet = str(req.params.wallet);
    if (!wallet) { res.status(400).json({ error: 'wallet param required', code: 'VALIDATION' }); return; }
    const owner = await requireWalletOwner(req, res, wallet);
    if (!owner) return;
    const db = databases();
    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '100';
    const limit = Math.min(parseInt(limitRaw, 10) || 100, 500);

    const { documents: sellerListings } = await db.listDocuments(DATABASE_ID, COL_LISTINGS, [
      Query.equal('sellerWallet', wallet),
      Query.limit(500),
    ]);
    const listingIds = sellerListings.map((l) => l.$id);
    if (listingIds.length === 0) {
      res.json({ data: { orders: [] } });
      return;
    }

    const { documents: orders } = await db.listDocuments(DATABASE_ID, COL_ORDERS, [
      Query.equal('listingId', listingIds),
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
    ]);

    res.json({
      data: {
        orders: orders.map((o) => ({
          id: o.$id,
          listingId: o['listingId'],
          listingTitle: o['listingSnapshotTitle'] ?? null,
          buyerWallet: o['buyerWallet'],
          state: o['state'],
          amountRaw: o['amountRaw'],
          sellerNetAmountRaw: o['sellerNetAmountRaw'],
          currency: o['currency'],
          memo: o['memo'],
          tonTxHash: o['tonTxHash'] || null,
          createdAt: o.$createdAt,
        })),
      },
    });
  } catch (e: unknown) {
    logger.error('[commerce] seller orders:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to fetch seller orders', code: 'SELLER_ORDERS' });
  }
});

router.get('/orders/:id', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const orderId = str(req.params.id);
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);

    const profile = await resolveProfile(req);
    const isOwner = profile && addressesEqual(profile.tonAddress ?? '', order['buyerWallet'] as string);
    if (!isOwner) {
      res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' }); return;
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
    const code = appwriteCodeOrZero(e);
    if (code === 404) { res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }); return; }
    logger.error('[commerce] order get:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Order retrieval failed', code: 'ORDER_GET' });
  }
});

// ─── Buyer-claim refund (Blocker #1) ───────────────────────────────
// When a mint never completes, the escrow's only pre-mint refund is the
// buyer's RefundIfNotMinted (the oracle cannot refund — by contract design).
// GET returns whether the order is refundable + the TonConnect message to sign;
// POST records the buyer's claim (license → refund_pending), after which the
// refund settle-cycle finalizes the order to REFUNDED once the escrow destructs.

router.get('/orders/:id/refund-claim', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const orderId = str(req.params.id);
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);

    const profile = await resolveProfile(req);
    const isOwner = profile && addressesEqual(profile.tonAddress ?? '', order['buyerWallet'] as string);
    if (!isOwner) { res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' }); return; }

    const license = await findLicenseByOrderId(orderId);
    if (!license) {
      res.json({
        data: {
          claimable: false, code: 'NO_LICENSE', reason: 'No license exists for this order yet.',
          availableAt: null, escrowAddress: null, message: null,
        },
      });
      return;
    }

    const decision = decideRefundClaim(license, Date.now());
    const canSign = decision.claimable && Boolean(license.escrowAddress);
    res.json({
      data: {
        claimable: decision.claimable,
        code: decision.code,
        reason: decision.reason,
        availableAt: decision.availableAt,
        escrowAddress: license.escrowAddress || null,
        message: canSign
          ? {
              address: license.escrowAddress,
              amount: REFUND_CLAIM_GAS_NANO,
              payload: buildRefundIfNotMintedPayload(),
            }
          : null,
      },
    });
  } catch (e: unknown) {
    const code = appwriteCodeOrZero(e);
    if (code === 404) { res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' }); return; }
    logger.error('[commerce] refund-claim get:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Refund claim lookup failed', code: 'REFUND_CLAIM_GET' });
  }
});

router.post(
  '/orders/:id/refund-claim',
  apiRequireAuth(),
  limitConfirm,
  validateBody(confirmOrderSchema),
  async (req: Request, res: Response) => {
    try {
      const orderId = str(req.params.id);
      const { buyerWallet, txHash } = req.body as { buyerWallet: string; txHash?: string };
      const owner = await requireWalletOwner(req, res, buyerWallet);
      if (!owner) return;

      const db = databases();
      const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
      if (!addressesEqual(order['buyerWallet'] as string, buyerWallet)) {
        res.status(403).json({ error: 'Wallet does not match the order', code: 'WALLET_MISMATCH' });
        return;
      }

      const license = await findLicenseByOrderId(orderId);
      if (!license) { res.status(404).json({ error: 'No license for this order', code: 'NO_LICENSE' }); return; }

      const decision = decideRefundClaim(license, Date.now());
      if (!decision.claimable) {
        res.status(409).json({ error: decision.reason, code: decision.code, availableAt: decision.availableAt });
        return;
      }

      // Record the buyer's claim. The settle-cycle confirms the escrow has
      // self-destructed on-chain and then marks the license refunded + order
      // refunded; if the claim never lands it reverts to refund_claimable.
      await updateLicense(license.$id, {
        state: LICENSE_STATE.REFUND_PENDING,
        refundTxHash: (txHash || '').slice(0, 128),
        refundReason: `buyer_claim:${decision.reason}`.slice(0, 200),
      });
      await writeAudit(buyerWallet, 'refund_claim', 'order', orderId, {
        licenseId: license.$id,
        escrowAddress: license.escrowAddress,
        txHash: txHash || '',
      });

      res.json({ data: { ok: true, state: LICENSE_STATE.REFUND_PENDING, escrowAddress: license.escrowAddress } });
    } catch (e: unknown) {
      const code = appwriteCodeOrZero(e);
      if (code === 404) { res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' }); return; }
      logger.error('[commerce] refund-claim post:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Refund claim failed', code: 'REFUND_CLAIM_POST' });
    }
  },
);

router.get('/buyers/me/orders', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const profile = await resolveProfile(req);
    if (!profile || !profile.tonAddress) {
      res.status(403).json({ error: 'Wallet not linked', code: 'NO_WALLET' }); return;
    }
    const db = databases();
    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '50';
    const limit = Math.min(parseInt(limitRaw, 10) || 50, 200);

    const { documents: orders } = await db.listDocuments(DATABASE_ID, COL_ORDERS, [
      Query.equal('buyerWallet', profile.tonAddress),
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
    ]);

    res.json({
      data: {
        orders: orders.map((o) => ({
          id: o.$id,
          listingId: o['listingId'],
          listingTitle: o['listingSnapshotTitle'] ?? null,
          state: o['state'],
          amountRaw: o['amountRaw'],
          sellerNetAmountRaw: o['sellerNetAmountRaw'],
          currency: o['currency'],
          memo: o['memo'],
          tonTxHash: o['tonTxHash'] || null,
          createdAt: o.$createdAt,
        })),
      },
    });
  } catch (e: unknown) {
    logger.error('[commerce] buyer orders:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to fetch orders', code: 'BUYER_ORDERS' });
  }
});

async function bridgePurchaseToLibrary(
  req: Request,
  listing: Record<string, unknown>,
  txHash: string,
): Promise<void> {
  const catalogProductId = (listing['catalogProductId'] as string) || '';
  if (!catalogProductId) return;
  const profile = await resolveProfile(req);
  if (!profile) return;
  const priceUsd = parseFloat((listing['priceUsd'] as string) || '0') || 0;
  await insertPurchase({
    user_id: profile.id,
    product_id: catalogProductId,
    price_usd: priceUsd,
    tx_hash: txHash,
  });
}

export default router;
