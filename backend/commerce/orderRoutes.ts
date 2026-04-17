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
import { verifyPaymentForOrder, addressesEqual } from './tonVerify.js';
import { writeAudit } from './audit.js';
import { logger } from '../logger.js';
import { apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { str } from '../utils/params.js';
import { createOrderSchema, confirmOrderSchema } from './validation.js';
import { appwriteCodeOrZero } from './helpers.js';

const router = express.Router();

const limitConfirm = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });
const limitCreateOrder = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

router.post('/orders', apiRequireAuth(), limitCreateOrder, validateBody(createOrderSchema), async (req: Request, res: Response) => {
  try {
    const { listingId, buyerWallet } = req.body as { listingId: string; buyerWallet: string };
    const treasury = (process.env.TREASURY_WALLET_ADDRESS || '').trim();
    if (!treasury) { res.status(503).json({ error: 'TREASURY_WALLET_ADDRESS не настроен', code: 'CONFIG' }); return; }
    const db = databases();
    const listing = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
    if (listing['status'] !== LISTING_STATUS.ACTIVE) {
      res.status(400).json({ error: 'Листинг не активен', code: 'LISTING_INACTIVE' }); return;
    }
    const memo = `cm_${crypto.randomBytes(12).toString('hex')}`;
    const amountRaw = listing['priceAmountRaw'] as string;
    const sellerNetAmountRaw = applyFeeBps(amountRaw, (listing['platformFeeBps'] as number) ?? DEFAULT_PLATFORM_FEE_BPS);
    const order = await db.createDocument(DATABASE_ID, COL_ORDERS, ID.unique(), {
      listingId, buyerWallet, amountRaw,
      currency: listing['currency'],
      jettonMaster: (listing['jettonMaster'] as string) || '',
      memo, tonTxHash: '', state: ORDER_STATE.PENDING_PAYMENT,
      sellerNetAmountRaw, listingSnapshotTitle: listing['title'],
    });
    await writeAudit(buyerWallet, 'order_create', 'order', order.$id, { listingId, memo });
    res.json({
      data: {
        orderId: order.$id, memo, amountRaw,
        amountTonHuman: listing['currency'] === CURRENCY.TON ? nanoRawToTonHuman(amountRaw) : undefined,
        decimals: listing['decimals'], currency: listing['currency'],
        jettonMaster: (listing['jettonMaster'] as string) || '',
        treasuryAddress: treasury, state: order['state'],
      },
    });
  } catch (e: unknown) {
    const code = appwriteCodeOrZero(e);
    if (code === 404) { res.status(404).json({ error: 'Листинг не найден', code: 'NOT_FOUND' }); return; }
    logger.error('[commerce] order create:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Заказ не создан', code: 'ORDER_CREATE' });
  }
});

router.post('/orders/:id/confirm', apiRequireAuth(), limitConfirm, validateBody(confirmOrderSchema), async (req: Request, res: Response) => {
  try {
    const orderId = str(req.params.id);
    const { txHash, buyerWallet } = req.body as { txHash: string; buyerWallet: string };
    const treasury = (process.env.TREASURY_WALLET_ADDRESS || '').trim();
    if (!treasury) { res.status(503).json({ error: 'TREASURY не настроен', code: 'CONFIG' }); return; }
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
    if (!addressesEqual(order['buyerWallet'] as string, buyerWallet)) {
      res.status(403).json({ error: 'Кошелёк не совпадает с заказом', code: 'WALLET_MISMATCH' }); return;
    }
    if (order['state'] !== ORDER_STATE.PENDING_PAYMENT) {
      res.json({ data: { state: order['state'], message: 'Заказ уже обработан' } }); return;
    }
    const check = await verifyPaymentForOrder(
      {
        currency: order['currency'] as string,
        buyerWallet: order['buyerWallet'] as string,
        amountRaw: order['amountRaw'] as string,
        memo: order['memo'] as string,
        jettonMaster: (order['jettonMaster'] as string) || '',
      },
      txHash, treasury,
    );
    if (!check.ok) {
      res.status(400).json({ error: 'Платёж не подтверждён', code: 'PAYMENT_VERIFY_FAILED', reason: check.reason || 'UNKNOWN', details: check });
      return;
    }
    const { documents: existingEnt } = await db.listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
      Query.equal('orderId', order.$id), Query.limit(1),
    ]);
    if (existingEnt.length > 0) {
      const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, { state: ORDER_STATE.PAID, tonTxHash: txHash });
      res.json({ data: { state: updated['state'], orderId: updated.$id, entitlement: { deliveryPayload: existingEnt[0]!['deliveryPayload'] } } });
      return;
    }
    const listingRow = await db.getDocument(DATABASE_ID, COL_LISTINGS, order['listingId'] as string);
    const { documents: secrets } = await db.listDocuments(DATABASE_ID, COL_LISTING_SECRETS, [
      Query.equal('listingId', order['listingId'] as string), Query.limit(1),
    ]);
    let payload = (secrets[0]?.['deliveryPayload'] as string) || 'Спасибо за покупку. Контакт продавца уточняйте в листинге.';
    if (listingRow['assetFileId']) {
      payload += `\n\n[Файл в Appwrite Storage: bucket ${BUCKET_ASSETS}, fileId ${listingRow['assetFileId']}]`;
    }
    await db.createDocument(DATABASE_ID, COL_ENTITLEMENTS, ID.unique(), {
      orderId: order.$id, buyerWallet: order['buyerWallet'],
      listingId: order['listingId'], deliveryPayload: payload,
    });
    const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, { state: ORDER_STATE.PAID, tonTxHash: txHash });
    await writeAudit(buyerWallet, 'order_paid', 'order', orderId, { txHash });
    res.json({ data: { state: updated['state'], orderId: updated.$id, entitlement: { deliveryPayload: payload } } });
  } catch (e: unknown) {
    const code = appwriteCodeOrZero(e);
    if (code === 404) { res.status(404).json({ error: 'Заказ не найден', code: 'NOT_FOUND' }); return; }
    logger.error('[commerce] order confirm:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Подтверждение не удалось', code: 'ORDER_CONFIRM' });
  }
});

router.get('/sellers/:wallet/orders', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const wallet = str(req.params.wallet);
    if (!wallet) { res.status(400).json({ error: 'wallet param required', code: 'VALIDATION' }); return; }
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
    res.status(500).json({ error: 'Не удалось получить заказы продавца', code: 'SELLER_ORDERS' });
  }
});

router.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const orderId = str(req.params.id);
    const buyerWallet = req.query.buyerWallet as string | undefined;
    if (!buyerWallet) { res.status(400).json({ error: 'buyerWallet query нужен', code: 'VALIDATION' }); return; }
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
    if (!addressesEqual(order['buyerWallet'] as string, buyerWallet)) {
      res.status(403).json({ error: 'Нет доступа', code: 'FORBIDDEN' }); return;
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
    if (code === 404) { res.status(404).json({ error: 'Не найдено', code: 'NOT_FOUND' }); return; }
    logger.error('[commerce] order get:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Ошибка заказа', code: 'ORDER_GET' });
  }
});

export default router;
