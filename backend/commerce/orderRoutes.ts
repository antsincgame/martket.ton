import express, { type Request, type Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import {
  DATABASE_ID, COL_LISTINGS, COL_LISTING_SECRETS,
  COL_ORDERS, COL_ENTITLEMENTS, BUCKET_ASSETS,
  ORDER_STATE, LISTING_STATUS, CURRENCY, DEFAULT_PLATFORM_FEE_BPS,
} from './constants.js';
import { databases, ID, Query } from './appwrite.js';
import { computeOrderAmounts, nanoRawToTonHuman } from './money.js';
import { verifyPaymentByMemo, verifyPaymentToEscrow, addressesEqual } from './tonVerify.js';
import { computeEscrow, GAS_BREAKDOWN } from './escrow.js';
import { screenWallet } from '../sanctions/screen.js';
import { resolveNetworkConfig } from '../config/network.js';
import { writeAudit } from './audit.js';
import { logger } from '../logger.js';
import { recordLedgerEntry } from '../core/ledgerService.js';
import { apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { str } from '../utils/params.js';
import { createOrderSchema, confirmOrderSchema } from './validation.js';
import { appwriteCodeOrZero, requireWalletOwner } from './helpers.js';
import { resolveProfile } from '../middleware/auth.js';
import { insertPurchase } from '../core/purchaseRepository.js';
import { requireBuyerKycLite } from './handlers/requireBuyerKycLite.js';


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
  try {
    const { listingId, buyerWallet } = req.body as { listingId: string; buyerWallet: string };
    const owner = await requireWalletOwner(req, res, buyerWallet);
    if (!owner) return;
    const screen = screenWallet(buyerWallet);
    if (!screen.ok) {
      res.status(451).json({
        error: 'Wallet is on a sanctions list and cannot transact.',
        code: screen.reason || 'SANCTIONED',
      });
      return;
    }

    const kycCheck = await requireBuyerKycLite(buyerWallet);
    if (!kycCheck.ok) {
      res.status(kycCheck.status).json({ error: kycCheck.message, code: kycCheck.code });
      return;
    }

    const netCfg = resolveNetworkConfig(req);
    const treasury = netCfg.treasuryAddress;
    if (!treasury) {
      res.status(503).json({ error: 'TREASURY_WALLET_ADDRESS not configured', code: 'CONFIG' });
      return;
    }

    const db = databases();
    const listing = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
    if (listing['status'] !== LISTING_STATUS.ACTIVE) {
      res.status(400).json({ error: 'Listing is not active', code: 'LISTING_INACTIVE' });
      return;
    }

    const sellerPriceRaw = listing['priceAmountRaw'] as string;       // Seller's ask
    const feeBps = (listing['platformFeeBps'] as number) ?? DEFAULT_PLATFORM_FEE_BPS;
    const amounts = computeOrderAmounts(sellerPriceRaw, feeBps);       // { seller, fee, total }
    const sellerWallet = listing['sellerWallet'] as string;

    const memo = `cm_${crypto.randomBytes(12).toString('hex')}`;

    // Collection address берётся из config (resolveNetworkConfig) — это
    // адрес предеплоенной AppCollection для данной платформы.
    // licenseContentUri — TEP-64 metadata URI, либо из listing либо dynamic.
    const collectionAddress = netCfg.collectionAddress;
    // Temp placeholder orderId для licenseContentUri — дальше заменится на настоящий $id.
    // Но ID.unique() даёт нам id заранее, используем его сразу.
    const orderId = ID.unique();
    const licenseContentUri = (listing['licenseContentUri'] as string) ||
      `https://cdn.example.org/license/${orderId}.json`;

    let escrowData: Awaited<ReturnType<typeof computeEscrow>> | null = null;
    if (collectionAddress) {
      try {
        escrowData = await computeEscrow({
          orderId,
          buyer: buyerWallet,
          seller: sellerWallet,
          treasury,
          amountNano: amounts.totalAmountNano,
          sellerAmountNano: amounts.sellerAmountNano,
          feeNano: amounts.feeNano,
          trialWindowSec: netCfg.trialWindowSec,
          collectionAddress,
          transferLimit: 0,  // soulbound
          licenseContentUri,
        });
      } catch (err) {
        logger.warn('[commerce] escrow compute failed:', err instanceof Error ? err.message : err);
      }
    } else {
      logger.warn('[commerce] COLLECTION_ADDRESS not configured — escrow disabled');
    }

    const order = await db.createDocument(DATABASE_ID, COL_ORDERS, orderId, {
      listingId,
      buyerWallet,
      sellerWallet,                                 // v4: нужен worker'у для MintLicense
      amountRaw: amounts.totalAmountNano,           // Что buyer платит (seller + fee)
      sellerNetAmountRaw: amounts.sellerAmountNano, // Что получит seller
      currency: listing['currency'],
      memo,
      tonTxHash: '',
      state: ORDER_STATE.PENDING_PAYMENT,
      listingSnapshotTitle: listing['title'],
      // v4 escrow tracking поля (нужны mint worker'у)
      escrowAddress: escrowData?.escrowAddress || '',
      licenseContentUri,
      mintAttempts: 0,
      licenseAddress: '',
    });

    await writeAudit(buyerWallet, 'order_create', 'order', order.$id, { listingId, memo });
    res.json({
      data: {
        orderId: order.$id,
        memo,
        amountRaw: amounts.totalAmountNano,
        amountTonHuman: listing['currency'] === CURRENCY.TON
          ? nanoRawToTonHuman(amounts.totalAmountNano)
          : undefined,
        sellerAmountRaw: amounts.sellerAmountNano,
        sellerAmountTonHuman: listing['currency'] === CURRENCY.TON
          ? nanoRawToTonHuman(amounts.sellerAmountNano)
          : undefined,
        feeAmountRaw: amounts.feeNano,
        feeAmountTonHuman: listing['currency'] === CURRENCY.TON
          ? nanoRawToTonHuman(amounts.feeNano)
          : undefined,
        feeBps: amounts.feeBpsApplied,
        decimals: listing['decimals'],
        currency: listing['currency'],
        treasuryAddress: treasury,
        state: order['state'],
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

    const payScreen = screenWallet(buyerWallet);
    if (!payScreen.ok) {
      res.status(451).json({
        error: 'Wallet is on a sanctions list and cannot transact.',
        code: payScreen.reason || 'SANCTIONED',
      });
      return;
    }

    const escrowAddress = (order['escrowAddress'] as string) || '';
    const apiOverrides = { base: netCfg.tonapiBase, key: netCfg.tonapiKey };

    // v4 path: verify payment to escrow address
    if (escrowAddress) {
      const check = await verifyPaymentToEscrow(
        escrowAddress,
        order['buyerWallet'] as string,
        order['amountRaw'] as string,
        apiOverrides,
      );
      if (!check.ok) {
        res.status(400).json({
          error: 'Escrow payment not verified',
          code: 'PAYMENT_VERIFY_FAILED',
          reason: check.reason || 'UNKNOWN',
          details: check,
        });
        return;
      }
      const realTxHash = check.txHash || '';

      // НЕ переводим state в PAID здесь! Mint worker фильтрует по
      // state == PENDING_PAYMENT для автоматической обработки. После успешного
      // mint worker сам выставит state=PAID и создаст entitlement.
      // Здесь только записываем tonTxHash (для аудита и отображения в UI).
      const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, {
        tonTxHash: realTxHash,
      });
      await writeAudit(buyerWallet, 'order_payment_verified', 'order', orderId, {
        txHash: realTxHash,
        flow: 'v4_escrow',
        escrowAddress,
      });

      recordLedgerEntry({
        entryType: 'escrow_fund',
        refType: 'order',
        refId: orderId,
        buyerWallet,
        sellerWallet: (order['sellerWallet'] as string) ?? null,
        amountUsd: 0,
        amountTonRaw: (order['amountRaw'] as string) ?? '0',
        platformFeeTonRaw: String(BigInt(order['amountRaw'] as string || '0') - BigInt(order['sellerNetAmountRaw'] as string || '0')),
        txHash: realTxHash,
        escrowAddress,
        productName: (order['listingSnapshotTitle'] as string) ?? '',
        listingId: (order['listingId'] as string) ?? null,
        buyerIp: req.ip ?? null,
      }).catch((err) => logger.warn('[commerce] ledger escrow_fund:', err));

      res.json({
        data: {
          state: updated['state'],         // Останется PENDING_PAYMENT
          orderId: updated.$id,
          escrowAddress,
          tonTxHash: realTxHash,
          mintPending: true,                // UI: "Payment received, minting in progress…"
          // Entitlement.deliveryPayload появится после mint (worker создаст его и переведёт в PAID).
        },
      });
      return;
    }

    // Legacy v3 path: verify payment to treasury by memo
    const check = await verifyPaymentByMemo(treasury, {
      buyerWallet: order['buyerWallet'] as string,
      amountRaw: order['amountRaw'] as string,
      memo: order['memo'] as string,
    }, apiOverrides);
    if (!check.ok) {
      res.status(400).json({ error: 'Payment not verified', code: 'PAYMENT_VERIFY_FAILED', reason: check.reason || 'UNKNOWN', details: check });
      return;
    }
    const realTxHash = check.txHash || '';

    const { documents: existingEnt } = await db.listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
      Query.equal('orderId', order.$id), Query.limit(1),
    ]);
    if (existingEnt.length > 0) {
      const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, { state: ORDER_STATE.PAID, tonTxHash: realTxHash });
      res.json({ data: { state: updated['state'], orderId: updated.$id, entitlement: { deliveryPayload: existingEnt[0]!['deliveryPayload'] } } });
      return;
    }
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
    const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, { state: ORDER_STATE.PAID, tonTxHash: realTxHash });
    await writeAudit(buyerWallet, 'order_paid', 'order', orderId, { txHash: realTxHash, flow: 'v3_legacy' });

    bridgePurchaseToLibrary(req, listingRow, realTxHash).catch((err) =>
      logger.warn('[commerce] bridge purchase:', err instanceof Error ? err.message : err),
    );

    res.json({ data: { state: updated['state'], orderId: updated.$id, entitlement: { deliveryPayload: payload } } });
  } catch (e: unknown) {
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
