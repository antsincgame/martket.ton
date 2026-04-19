import express, { type Request, type Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import {
  DATABASE_ID, COL_LISTINGS, COL_LISTING_SECRETS,
  COL_ORDERS, COL_ENTITLEMENTS, BUCKET_ASSETS,
  ORDER_STATE, LISTING_STATUS, CURRENCY, DEFAULT_PLATFORM_FEE_BPS,
} from './constants.js';
import { databases, ID, Query } from './appwrite.js';
import { applyFeeBps, nanoRawToTonHuman } from './money.js';
import { addressesEqual } from './tonVerify.js';
import { computeEscrow, GAS_BREAKDOWN } from './escrow.js';
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
import { verifyOrderPayment } from './handlers/verifyOrderPayment.js';
import { ensureLicenseForOrder, ListingNoCollectionError } from './handlers/ensureLicenseForOrder.js';
import { screenWallet } from '../sanctions/screen.js';


const router = express.Router();

const limitConfirm = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });
const limitCreateOrder = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

router.post('/orders', apiRequireAuth(), limitCreateOrder, validateBody(createOrderSchema), async (req: Request, res: Response) => {
  try {
    const { listingId, buyerWallet } = req.body as { listingId: string; buyerWallet: string };
    const owner = await requireWalletOwner(req, res, buyerWallet);
    if (!owner) return;

    // Sanctions screening (US OFAC SDN + EU consolidated). HTTP 451 = legally
    // unavailable. Buyer KYC is NOT required — only their wallet's standing.
    const screen = screenWallet(buyerWallet);
    if (!screen.ok) {
      res.status(451).json({
        error: 'Wallet is on a sanctions list and cannot transact.',
        code: screen.reason || 'SANCTIONED',
      });
      return;
    }

    const netCfg = resolveNetworkConfig(req);
    const treasury = netCfg.treasuryAddress;
    if (!treasury) { res.status(503).json({ error: 'TREASURY_WALLET_ADDRESS not configured', code: 'CONFIG' }); return; }
    const db = databases();
    const listing = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
    if (listing['status'] !== LISTING_STATUS.ACTIVE) {
      res.status(400).json({ error: 'Listing is not active', code: 'LISTING_INACTIVE' }); return;
    }
    const memo = `cm_${crypto.randomBytes(12).toString('hex')}`;
    const amountRaw = listing['priceAmountRaw'] as string;
    const feeBps = (listing['platformFeeBps'] as number) ?? DEFAULT_PLATFORM_FEE_BPS;
    const sellerNetAmountRaw = applyFeeBps(amountRaw, feeBps);
    const sellerWallet = listing['sellerWallet'] as string;

    const orderId = ID.unique();
    const order = await db.createDocument(DATABASE_ID, COL_ORDERS, orderId, {
      listingId, buyerWallet, amountRaw,
      currency: listing['currency'],
      jettonMaster: (listing['jettonMaster'] as string) || '',
      memo, tonTxHash: '', state: ORDER_STATE.PENDING_PAYMENT,
      sellerNetAmountRaw, listingSnapshotTitle: listing['title'],
    });

    let escrowData: { escrowAddress: string; stateInitBase64: string; payloadBase64: string; totalAmountRaw: string } | null = null;
    try {
      escrowData = await computeEscrow({
        orderId: order.$id,
        buyer: buyerWallet,
        seller: sellerWallet,
        treasury,
        amountNano: amountRaw,
        feeBps,
        trialWindowSec: netCfg.trialWindowSec,
      });
      if (escrowData?.escrowAddress) {
        await db.updateDocument(DATABASE_ID, COL_ORDERS, order.$id, {
          escrowAddress: escrowData.escrowAddress,
        }).catch((err) =>
          logger.warn('[commerce] escrow persist:', err instanceof Error ? err.message : err),
        );
      }
    } catch (err) {
      logger.warn('[commerce] escrow compute fallback to treasury:', err instanceof Error ? err.message : err);
    }

    await writeAudit(buyerWallet, 'order_create', 'order', order.$id, { listingId, memo });
    const collectionAddress = (listing['collection_address'] as string) || '';
    res.json({
      data: {
        orderId: order.$id, memo, amountRaw,
        amountTonHuman: listing['currency'] === CURRENCY.TON ? nanoRawToTonHuman(amountRaw) : undefined,
        decimals: listing['decimals'], currency: listing['currency'],
        jettonMaster: (listing['jettonMaster'] as string) || '',
        treasuryAddress: treasury, state: order['state'],
        escrow: escrowData ? {
          address: escrowData.escrowAddress,
          stateInit: escrowData.stateInitBase64,
          payload: escrowData.payloadBase64,
          totalAmountRaw: escrowData.totalAmountRaw,
          trialWindowSec: netCfg.trialWindowSec,
        } : null,
        gasBreakdown: GAS_BREAKDOWN,
        nft: { willMint: Boolean(collectionAddress), collectionAddress: collectionAddress || null },
      },
    });
  } catch (e: unknown) {
    const code = appwriteCodeOrZero(e);
    if (code === 404) { res.status(404).json({ error: 'Listing not found', code: 'NOT_FOUND' }); return; }
    logger.error('[commerce] order create:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Order creation failed', code: 'ORDER_CREATE' });
  }
});

router.post('/orders/:id/confirm', apiRequireAuth(), limitConfirm, validateBody(confirmOrderSchema), async (req: Request, res: Response) => {
  try {
    const orderId = str(req.params.id);
    const { buyerWallet } = req.body as { txHash: string; buyerWallet: string };
    const owner = await requireWalletOwner(req, res, buyerWallet);
    if (!owner) return;
    const netCfg = resolveNetworkConfig(req);
    const treasury = netCfg.treasuryAddress;
    if (!treasury) { res.status(503).json({ error: 'Treasury not configured', code: 'CONFIG' }); return; }
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
    if (!addressesEqual(order['buyerWallet'] as string, buyerWallet)) {
      res.status(403).json({ error: 'Wallet does not match the order', code: 'WALLET_MISMATCH' }); return;
    }
    if (order['state'] !== ORDER_STATE.PENDING_PAYMENT) {
      res.json({ data: { state: order['state'], message: 'Order already processed' } }); return;
    }

    const screen = screenWallet(buyerWallet);
    if (!screen.ok) {
      res.status(451).json({
        error: 'Wallet is on a sanctions list and cannot transact.',
        code: screen.reason || 'SANCTIONED',
      });
      return;
    }

    // Step 1: verify the buyer actually paid (escrow path or treasury+memo).
    const payment = await verifyOrderPayment(req, treasury, {
      escrowAddress: (order['escrowAddress'] as string) || '',
      buyerWallet: order['buyerWallet'] as string,
      amountRaw: order['amountRaw'] as string,
      memo: order['memo'] as string,
    });
    if (!payment.ok) {
      res.status(400).json({
        error: 'Payment not verified',
        code: 'PAYMENT_VERIFY_FAILED',
        reason: payment.reason,
        details: payment.details,
      });
      return;
    }
    const realTxHash = payment.txHash;

    const trialEndsAt = new Date(Date.now() + netCfg.trialWindowSec * 1000).toISOString();
    const orderForLicense = {
      $id: order.$id,
      listingId: order['listingId'] as string,
      buyerWallet: order['buyerWallet'] as string,
      escrowAddress: (order['escrowAddress'] as string) || '',
    };

    // Step 2: idempotent path. If we already created an entitlement before
    // (e.g. previous request crashed after entitlement but before license),
    // recover license + return existing payload.
    const { documents: existingEnt } = await db.listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
      Query.equal('orderId', order.$id), Query.limit(1),
    ]);
    if (existingEnt.length > 0) {
      const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, {
        state: ORDER_STATE.PAID,
        tonTxHash: realTxHash,
      });
      const listingForEnt = await db.getDocument(DATABASE_ID, COL_LISTINGS, order['listingId'] as string);
      const license = await ensureLicenseForOrder(orderForLicense, listingForEnt as never, trialEndsAt);
      res.json({
        data: {
          state: updated['state'],
          orderId: updated.$id,
          licenseId: license.$id,
          entitlement: { deliveryPayload: existingEnt[0]!['deliveryPayload'] },
        },
      });
      return;
    }

    // Step 3: fresh confirmation. Create entitlement, mark order paid,
    // create license (with mintWorker trigger if NFT mode is on).
    const listingRow = await db.getDocument(DATABASE_ID, COL_LISTINGS, order['listingId'] as string);
    const { documents: secrets } = await db.listDocuments(DATABASE_ID, COL_LISTING_SECRETS, [
      Query.equal('listingId', order['listingId'] as string), Query.limit(1),
    ]);
    let payload = (secrets[0]?.['deliveryPayload'] as string) || 'Thank you for your purchase. Contact the seller via the listing page.';
    if (listingRow['assetFileId']) {
      payload += `\n\n[File in Appwrite Storage: bucket ${BUCKET_ASSETS}, fileId ${listingRow['assetFileId']}]`;
    }
    await db.createDocument(DATABASE_ID, COL_ENTITLEMENTS, ID.unique(), {
      orderId: order.$id, buyerWallet: order['buyerWallet'],
      listingId: order['listingId'], deliveryPayload: payload,
    });
    const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, {
      state: ORDER_STATE.PAID,
      tonTxHash: realTxHash,
    });
    await writeAudit(buyerWallet, 'order_paid', 'order', orderId, { txHash: realTxHash });

    const license = await ensureLicenseForOrder(orderForLicense, listingRow as never, trialEndsAt);

    bridgePurchaseToLibrary(req, listingRow, order, realTxHash).catch((err) =>
      logger.warn('[commerce] bridge purchase:', err instanceof Error ? err.message : err),
    );

    res.json({
      data: {
        state: updated['state'],
        orderId: updated.$id,
        entitlement: { deliveryPayload: payload },
        license: { id: license.$id, state: license.state },
      },
    });
  } catch (e: unknown) {
    if (e instanceof ListingNoCollectionError) {
      // Listing slipped through validation without a collection_address — payment
      // already landed, so frontend must trigger the manual refund flow.
      logger.error('[commerce] order confirm: listing has no collection_address', e.listingId);
      res.status(503).json({
        error: 'Listing has no NFT collection. Contact support for refund.',
        code: 'LISTING_NO_COLLECTION',
        listingId: e.listingId,
      });
      return;
    }
    const code = appwriteCodeOrZero(e);
    if (code === 404) { res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' }); return; }
    logger.error('[commerce] order confirm:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Order confirmation failed', code: 'ORDER_CONFIRM' });
  }
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
          id: order.$id, listingId: order['listingId'], state: order['state'],
          amountRaw: order['amountRaw'], currency: order['currency'],
          memo: order['memo'], tonTxHash: (order['tonTxHash'] as string) || '',
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
  order: Record<string, unknown>,
  txHash: string,
): Promise<void> {
  const catalogProductId = (listing['catalogProductId'] as string) || '';
  if (!catalogProductId) return;
  const profile = await resolveProfile(req);
  if (!profile) return;
  const priceTon = nanoRawToTonHuman(order['amountRaw'] as string);
  await insertPurchase({
    user_id: profile.id,
    product_id: catalogProductId,
    price_ton: parseFloat(priceTon) || 0,
    tx_hash: txHash,
  });
}

export default router;
