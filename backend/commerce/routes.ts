import express, { type Request, type Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { InputFile } from 'node-appwrite/file';
import { Permission, Role } from 'node-appwrite';
import {
  DATABASE_ID,
  COL_LISTINGS,
  COL_LISTING_SECRETS,
  COL_ORDERS,
  COL_ENTITLEMENTS,
  COL_DISPUTES,
  COL_SELLER_PROFILES,
  COL_AUDIT,
  BUCKET_ASSETS,
  ORDER_STATE,
  LISTING_STATUS,
  DISPUTE_STATUS,
  CURRENCY,
  DEFAULT_PLATFORM_FEE_BPS,
} from './constants.js';
import { databases, storageClient, ID, Query } from './appwrite.js';
import { tonHumanToNanoRaw, applyFeeBps, nanoRawToTonHuman, jettonHumanToRaw } from './money.js';
import { verifyPaymentForOrder, addressesEqual } from './tonVerify.js';
import { writeAudit } from './audit.js';
import { logger } from '../logger.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';
import { apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  sellerRegisterSchema,
  createListingSchema,
  patchListingSchema,
  createOrderSchema,
  confirmOrderSchema,
  createDisputeSchema,
  resolveDisputeSchema,
  orderStateSchema,
} from './validation.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 52_428_800 },
});

const limitConfirm = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

const limitCreateOrder = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

function str(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

function commerceAdmin(req: Request, res: Response, next: () => void): void {
  const got = str(req.headers['x-commerce-admin-secret']);
  const need = process.env.COMMERCE_ADMIN_SECRET || '';
  if (!need || got !== need) {
    res.status(403).json({ error: 'Недостаточно прав', code: 'COMMERCE_ADMIN_FORBIDDEN' });
    return;
  }
  next();
}

function mapListingPublic(doc: AppwriteDoc) {
  return {
    id: doc.$id,
    sellerWallet: doc['sellerWallet'] as string,
    catalogProductId: doc['catalogProductId'] as string,
    title: doc['title'] as string,
    description: doc['description'] as string,
    currency: doc['currency'] as string,
    jettonMaster: (doc['jettonMaster'] as string) || '',
    priceAmountRaw: doc['priceAmountRaw'] as string,
    decimals: doc['decimals'] as number,
    platformFeeBps: doc['platformFeeBps'] as number,
    status: doc['status'] as string,
    deliveryType: doc['deliveryType'] as string,
    assetFileId: (doc['assetFileId'] as string) || '',
    priceTonHuman:
      doc['currency'] === CURRENCY.TON
        ? nanoRawToTonHuman(doc['priceAmountRaw'] as string)
        : undefined,
  };
}

// ─── Config ─────────────────────────────────────────────────────────

router.get('/config', (_req: Request, res: Response) => {
  const treasury = process.env.TREASURY_WALLET_ADDRESS || '';
  res.json({
    data: {
      treasuryAddress: treasury,
      platformFeeBpsDefault: DEFAULT_PLATFORM_FEE_BPS,
      currencyTon: CURRENCY.TON,
      currencyJetton: CURRENCY.JETTON,
      jettonMasterConfigured: Boolean((process.env.COMMERCE_JETTON_MASTER || '').trim()),
    },
  });
});

// ─── Listings ───────────────────────────────────────────────────────

router.get('/listings/catalog/:catalogProductId', async (req: Request, res: Response) => {
  try {
    const db = databases();
    const pid = str(req.params.catalogProductId);
    const { documents } = await db.listDocuments(DATABASE_ID, COL_LISTINGS, [
      Query.equal('catalogProductId', pid),
      Query.equal('status', LISTING_STATUS.ACTIVE),
      Query.limit(5),
    ]);
    const list = documents.map((d) => mapListingPublic(asDoc(d)));
    res.json({ data: { listings: list, primary: list[0] || null } });
  } catch (e: unknown) {
    logger.error('[commerce] listings fetch:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Не удалось загрузить листинги', code: 'LISTINGS_FETCH' });
  }
});

router.post('/sellers/register', apiRequireAuth(), validateBody(sellerRegisterSchema), async (req: Request, res: Response) => {
  try {
    const { wallet, displayName, bio } = req.body as {
      wallet: string;
      displayName: string;
      bio: string;
    };
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
      Query.equal('wallet', wallet),
      Query.limit(1),
    ]);
    if (documents.length > 0) {
      res.json({ data: { profile: documents[0], created: false } });
      return;
    }
    const doc = await db.createDocument(DATABASE_ID, COL_SELLER_PROFILES, ID.unique(), {
      wallet,
      displayName,
      bio,
    });
    await writeAudit(wallet, 'seller_register', 'seller', doc.$id, { displayName });
    res.json({ data: { profile: doc, created: true } });
  } catch (e: unknown) {
    logger.error('[commerce] seller register:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Регистрация продавца не удалась', code: 'SELLER_REGISTER' });
  }
});

router.post('/listings', apiRequireAuth(), validateBody(createListingSchema), async (req: Request, res: Response) => {
  try {
    const {
      sellerWallet,
      catalogProductId,
      title,
      description,
      currency = CURRENCY.TON,
      jettonMaster = '',
      priceTon,
      priceHuman,
      decimals: decIn,
      deliveryType,
      deliveryPayload,
      platformFeeBps = DEFAULT_PLATFORM_FEE_BPS,
      assetFileId = '',
    } = req.body as Record<string, string | number | undefined>;

    if (!sellerWallet || !catalogProductId || !title || !deliveryType || !deliveryPayload) {
      res.status(400).json({ error: 'Не все поля заполнены', code: 'VALIDATION' });
      return;
    }
    const decimals =
      currency === CURRENCY.TON ? 9 : Math.min(18, Math.max(0, parseInt(String(decIn), 10) || 9));

    let priceAmountRaw: string;
    if (currency === CURRENCY.TON) {
      if (priceTon === undefined) {
        res.status(400).json({ error: 'Нужна цена priceTon', code: 'VALIDATION' });
        return;
      }
      priceAmountRaw = tonHumanToNanoRaw(priceTon);
    } else if (currency === CURRENCY.JETTON) {
      if (!jettonMaster) {
        res.status(400).json({ error: 'Для JETTON нужен jettonMaster', code: 'VALIDATION' });
        return;
      }
      if (priceHuman === undefined) {
        res.status(400).json({ error: 'Нужна цена priceHuman для jetton', code: 'VALIDATION' });
        return;
      }
      priceAmountRaw = jettonHumanToRaw(priceHuman, decimals);
    } else {
      res.status(400).json({ error: 'Неизвестная валюта', code: 'VALIDATION' });
      return;
    }

    const db = databases();
    const listing = await db.createDocument(DATABASE_ID, COL_LISTINGS, ID.unique(), {
      sellerWallet,
      catalogProductId,
      title,
      description,
      currency,
      jettonMaster: currency === CURRENCY.JETTON ? jettonMaster : '',
      priceAmountRaw,
      decimals,
      platformFeeBps,
      status: LISTING_STATUS.ACTIVE,
      deliveryType,
      assetFileId,
    });
    await db.createDocument(DATABASE_ID, COL_LISTING_SECRETS, ID.unique(), {
      listingId: listing.$id,
      deliveryPayload,
    });
    await writeAudit(String(sellerWallet), 'listing_create', 'listing', listing.$id, {
      catalogProductId,
    });
    res.json({ data: { listing: mapListingPublic(listing) } });
  } catch (e: unknown) {
    logger.error('[commerce] listing create:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Листинг не создан', code: 'LISTING_CREATE' });
  }
});

router.patch('/listings/:id', apiRequireAuth(), validateBody(patchListingSchema), async (req: Request, res: Response) => {
  try {
    const listingId = str(req.params.id);
    const rawHeader = req.headers['x-seller-wallet'];
    const sellerWallet =
      (req.body as Record<string, string>).sellerWallet ||
      str(rawHeader);
    if (!sellerWallet) {
      res.status(400).json({ error: 'Нужен sellerWallet', code: 'VALIDATION' });
      return;
    }
    const db = databases();
    const existingRaw = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
    const existing = asDoc(existingRaw);
    if (!addressesEqual(existing['sellerWallet'] as string, sellerWallet)) {
      res.status(403).json({ error: 'Не ваш листинг', code: 'FORBIDDEN' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.status) patch.status = body.status;
    if (body.title) patch.title = body.title;
    if (body.description) patch.description = body.description;
    if (body.priceTon !== undefined && existing['currency'] === CURRENCY.TON) {
      patch.priceAmountRaw = tonHumanToNanoRaw(body.priceTon as string | number);
    }
    const updated = await db.updateDocument(DATABASE_ID, COL_LISTINGS, listingId, patch);
    if (body.deliveryPayload) {
      const { documents } = await db.listDocuments(DATABASE_ID, COL_LISTING_SECRETS, [
        Query.equal('listingId', listingId),
        Query.limit(1),
      ]);
      if (documents[0]) {
        await db.updateDocument(DATABASE_ID, COL_LISTING_SECRETS, documents[0].$id, {
          deliveryPayload: body.deliveryPayload,
        });
      }
    }
    await writeAudit(sellerWallet, 'listing_update', 'listing', listingId, patch);
    res.json({ data: { listing: mapListingPublic(updated) } });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0;
    if (code === 404) { res.status(404).json({ error: 'Не найдено', code: 'NOT_FOUND' }); return; }
    logger.error('[commerce] listing update:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Обновление не удалось', code: 'LISTING_UPDATE' });
  }
});

const COMMERCE_ALLOWED_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.zip', '.pdf', '.mp4', '.webm',
]);

router.post('/listings/:id/asset', apiRequireAuth(), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const listingId = str(req.params.id);
    const sellerWallet = (req.body as Record<string, string>).sellerWallet;
    if (!sellerWallet || !req.file) {
      res.status(400).json({ error: 'Нужны sellerWallet и файл', code: 'VALIDATION' });
      return;
    }
    const origName = (req.file.originalname || '').toLowerCase();
    const dotIdx = origName.lastIndexOf('.');
    const ext = dotIdx >= 0 ? origName.slice(dotIdx) : '';
    if (!COMMERCE_ALLOWED_EXT.has(ext)) {
      res.status(400).json({ error: `File type "${ext}" not allowed`, code: 'FILE_TYPE' });
      return;
    }
    const db = databases();
    const existing = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
    if (!addressesEqual(existing['sellerWallet'] as string, sellerWallet)) {
      res.status(403).json({ error: 'Не ваш листинг', code: 'FORBIDDEN' });
      return;
    }
    const storage = storageClient();
    const fileId = ID.unique();
    const inputFile = InputFile.fromBuffer(req.file.buffer, req.file.originalname || 'asset.bin');
    await storage.createFile(BUCKET_ASSETS, fileId, inputFile, [Permission.read(Role.any())]);
    await db.updateDocument(DATABASE_ID, COL_LISTINGS, listingId, { assetFileId: fileId });
    await writeAudit(sellerWallet, 'listing_asset_upload', 'listing', listingId, { fileId });
    res.json({ data: { fileId, bucketId: BUCKET_ASSETS } });
  } catch (e: unknown) {
    logger.error('[commerce] asset upload:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Загрузка файла не удалась', code: 'ASSET_UPLOAD' });
  }
});

router.get('/sellers/:wallet/listings', async (req: Request, res: Response) => {
  try {
    const wallet = str(req.params.wallet);
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_LISTINGS, [
      Query.equal('sellerWallet', wallet),
      Query.limit(100),
    ]);
    res.json({ data: { listings: documents.map((d) => mapListingPublic(asDoc(d))) } });
  } catch (e: unknown) {
    logger.error('[commerce] seller listings:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Список листингов недоступен', code: 'SELLER_LISTINGS' });
  }
});

// ─── Orders ─────────────────────────────────────────────────────────

router.post('/orders', apiRequireAuth(), limitCreateOrder, validateBody(createOrderSchema), async (req: Request, res: Response) => {
  try {
    const { listingId, buyerWallet } = req.body as { listingId: string; buyerWallet: string };
    const treasury = (process.env.TREASURY_WALLET_ADDRESS || '').trim();
    if (!treasury) {
      res.status(503).json({ error: 'TREASURY_WALLET_ADDRESS не настроен', code: 'CONFIG' });
      return;
    }
    const db = databases();
    const listing = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
    if (listing['status'] !== LISTING_STATUS.ACTIVE) {
      res.status(400).json({ error: 'Листинг не активен', code: 'LISTING_INACTIVE' });
      return;
    }
    const memo = `cm_${crypto.randomBytes(12).toString('hex')}`;
    const amountRaw = listing['priceAmountRaw'] as string;
    const sellerNetAmountRaw = applyFeeBps(
      amountRaw,
      (listing['platformFeeBps'] as number) ?? DEFAULT_PLATFORM_FEE_BPS,
    );
    const order = await db.createDocument(DATABASE_ID, COL_ORDERS, ID.unique(), {
      listingId,
      buyerWallet,
      amountRaw,
      currency: listing['currency'],
      jettonMaster: (listing['jettonMaster'] as string) || '',
      memo,
      tonTxHash: '',
      state: ORDER_STATE.PENDING_PAYMENT,
      sellerNetAmountRaw,
      listingSnapshotTitle: listing['title'],
    });
    await writeAudit(buyerWallet, 'order_create', 'order', order.$id, { listingId, memo });
    res.json({
      data: {
        orderId: order.$id,
        memo,
        amountRaw,
        amountTonHuman:
          listing['currency'] === CURRENCY.TON ? nanoRawToTonHuman(amountRaw) : undefined,
        decimals: listing['decimals'],
        currency: listing['currency'],
        jettonMaster: (listing['jettonMaster'] as string) || '',
        treasuryAddress: treasury,
        state: order['state'],
      },
    });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0;
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
    if (!treasury) {
      res.status(503).json({ error: 'TREASURY не настроен', code: 'CONFIG' });
      return;
    }
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
    if (!addressesEqual(order['buyerWallet'] as string, buyerWallet)) {
      res.status(403).json({ error: 'Кошелёк не совпадает с заказом', code: 'WALLET_MISMATCH' });
      return;
    }
    if (order['state'] !== ORDER_STATE.PENDING_PAYMENT) {
      res.json({ data: { state: order['state'], message: 'Заказ уже обработан' } });
      return;
    }
    const check = await verifyPaymentForOrder(
      {
        currency: order['currency'] as string,
        buyerWallet: order['buyerWallet'] as string,
        amountRaw: order['amountRaw'] as string,
        memo: order['memo'] as string,
        jettonMaster: (order['jettonMaster'] as string) || '',
      },
      txHash,
      treasury,
    );
    if (!check.ok) {
      res.status(400).json({
        error: 'Платёж не подтверждён',
        code: 'PAYMENT_VERIFY_FAILED',
        reason: check.reason || 'UNKNOWN',
        details: check,
      });
      return;
    }
    const { documents: existingEnt } = await db.listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
      Query.equal('orderId', order.$id),
      Query.limit(1),
    ]);
    if (existingEnt.length > 0) {
      const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, {
        state: ORDER_STATE.PAID,
        tonTxHash: txHash,
      });
      res.json({
        data: {
          state: updated['state'],
          orderId: updated.$id,
          entitlement: { deliveryPayload: existingEnt[0]!['deliveryPayload'] },
        },
      });
      return;
    }
    const listingRow = await db.getDocument(DATABASE_ID, COL_LISTINGS, order['listingId'] as string);
    const { documents: secrets } = await db.listDocuments(DATABASE_ID, COL_LISTING_SECRETS, [
      Query.equal('listingId', order['listingId'] as string),
      Query.limit(1),
    ]);
    let payload =
      (secrets[0]?.['deliveryPayload'] as string) ||
      'Спасибо за покупку. Контакт продавца уточняйте в листинге.';
    if (listingRow['assetFileId']) {
      payload += `\n\n[Файл в Appwrite Storage: bucket ${BUCKET_ASSETS}, fileId ${listingRow['assetFileId']}]`;
    }
    await db.createDocument(DATABASE_ID, COL_ENTITLEMENTS, ID.unique(), {
      orderId: order.$id,
      buyerWallet: order['buyerWallet'],
      listingId: order['listingId'],
      deliveryPayload: payload,
    });
    const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, {
      state: ORDER_STATE.PAID,
      tonTxHash: txHash,
    });
    await writeAudit(buyerWallet, 'order_paid', 'order', orderId, { txHash });
    res.json({
      data: {
        state: updated['state'],
        orderId: updated.$id,
        entitlement: { deliveryPayload: payload },
      },
    });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0;
    if (code === 404) { res.status(404).json({ error: 'Заказ не найден', code: 'NOT_FOUND' }); return; }
    logger.error('[commerce] order confirm:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Подтверждение не удалось', code: 'ORDER_CONFIRM' });
  }
});

router.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const orderId = str(req.params.id);
    const buyerWallet = req.query.buyerWallet as string | undefined;
    if (!buyerWallet) {
      res.status(400).json({ error: 'buyerWallet query нужен', code: 'VALIDATION' });
      return;
    }
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
    if (!addressesEqual(order['buyerWallet'] as string, buyerWallet)) {
      res.status(403).json({ error: 'Нет доступа', code: 'FORBIDDEN' });
      return;
    }
    let delivery: string | null = null;
    if (order['state'] === ORDER_STATE.PAID || order['state'] === ORDER_STATE.FULFILLED) {
      const { documents } = await db.listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
        Query.equal('orderId', orderId),
        Query.limit(1),
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
          currency: order['currency'],
          memo: order['memo'],
          tonTxHash: (order['tonTxHash'] as string) || '',
        },
        deliveryPayload: delivery,
      },
    });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0;
    if (code === 404) { res.status(404).json({ error: 'Не найдено', code: 'NOT_FOUND' }); return; }
    logger.error('[commerce] order get:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Ошибка заказа', code: 'ORDER_GET' });
  }
});

// ─── Disputes ───────────────────────────────────────────────────────

router.post('/disputes', apiRequireAuth(), validateBody(createDisputeSchema), async (req: Request, res: Response) => {
  try {
    const { orderId, openedByWallet, reason } = req.body as {
      orderId: string;
      openedByWallet: string;
      reason: string;
    };
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
    if (!addressesEqual(order['buyerWallet'] as string, openedByWallet)) {
      res.status(403).json({ error: 'Только покупатель может открыть спор', code: 'FORBIDDEN' });
      return;
    }
    if (order['state'] !== ORDER_STATE.PAID) {
      res
        .status(400)
        .json({ error: 'Спор доступен для оплаченных заказов', code: 'INVALID_STATE' });
      return;
    }
    const dispute = await db.createDocument(DATABASE_ID, COL_DISPUTES, ID.unique(), {
      orderId,
      openedByWallet,
      reason,
      status: DISPUTE_STATUS.OPEN,
      resolutionNote: '',
    });
    await writeAudit(openedByWallet, 'dispute_open', 'dispute', dispute.$id, { orderId });
    res.json({ data: { dispute } });
  } catch (e: unknown) {
    logger.error('[commerce] dispute create:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Спор не создан', code: 'DISPUTE_CREATE' });
  }
});

// ─── Admin ──────────────────────────────────────────────────────────

router.get('/admin/disputes', commerceAdmin, async (_req: Request, res: Response) => {
  try {
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_DISPUTES, [Query.limit(200)]);
    res.json({ data: { disputes: documents } });
  } catch (e: unknown) {
    logger.error('[commerce] admin disputes:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Список споров', code: 'ADMIN_DISPUTES' });
  }
});

router.post('/admin/disputes/:id/resolve', commerceAdmin, validateBody(resolveDisputeSchema), async (req: Request, res: Response) => {
  try {
    const disputeId = str(req.params.id);
    const { resolution, resolutionNote } = req.body as {
      resolution: 'refund' | 'release';
      resolutionNote: string;
    };
    const db = databases();
    const dispute = await db.getDocument(DATABASE_ID, COL_DISPUTES, disputeId);
    const orderId = dispute['orderId'] as string;
    const newStatus =
      resolution === 'refund' ? DISPUTE_STATUS.RESOLVED_REFUND : DISPUTE_STATUS.RESOLVED_RELEASE;
    await db.updateDocument(DATABASE_ID, COL_DISPUTES, disputeId, {
      status: newStatus,
      resolutionNote,
    });
    const orderPatch =
      resolution === 'refund'
        ? { state: ORDER_STATE.REFUNDED }
        : { state: ORDER_STATE.FULFILLED };
    await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, orderPatch);
    await writeAudit('admin', 'dispute_resolve', 'dispute', disputeId, { resolution, orderId });
    res.json({ data: { ok: true, disputeId, orderId, orderState: orderPatch.state } });
  } catch (e: unknown) {
    logger.error('[commerce] dispute resolve:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Решение не записано', code: 'DISPUTE_RESOLVE' });
  }
});

router.post('/admin/orders/:id/state', commerceAdmin, validateBody(orderStateSchema), async (req: Request, res: Response) => {
  try {
    const orderId = str(req.params.id);
    const { state } = req.body as { state: string };
    const db = databases();
    await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, { state });
    await writeAudit('admin', 'order_state', 'order', orderId, { state });
    res.json({ data: { ok: true, orderId, state } });
  } catch (e: unknown) {
    logger.error('[commerce] admin order state:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Статус не обновлён', code: 'ORDER_STATE' });
  }
});

router.get('/admin/orders', commerceAdmin, async (_req: Request, res: Response) => {
  try {
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_ORDERS, [
      Query.orderDesc('$createdAt'),
      Query.limit(200),
    ]);
    res.json({ data: { orders: documents } });
  } catch (e: unknown) {
    logger.error('[commerce] admin orders:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Список заказов', code: 'ADMIN_ORDERS' });
  }
});

router.get('/admin/audit', commerceAdmin, async (_req: Request, res: Response) => {
  try {
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_AUDIT, [
      Query.orderDesc('$createdAt'),
      Query.limit(200),
    ]);
    res.json({ data: { logs: documents } });
  } catch (e: unknown) {
    logger.error('[commerce] admin audit:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Аудит', code: 'ADMIN_AUDIT' });
  }
});

export default router;
