'use strict';

const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { InputFile } = require('node-appwrite/file');
const { Permission, Role } = require('node-appwrite');
const {
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
} = require('./constants');
const { databases, storageClient, ID, Query } = require('./appwrite');
const { tonHumanToNanoRaw, applyFeeBps, nanoRawToTonHuman } = require('./money');
const { verifyPaymentForOrder, addressesEqual } = require('./tonVerify');
const { writeAudit } = require('./audit');

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

function commerceAdmin(req, res, next) {
  const got = req.headers['x-commerce-admin-secret'];
  const need = process.env.COMMERCE_ADMIN_SECRET || '';
  if (!need || got !== need) {
    return res.status(403).json({ error: 'Недостаточно прав', code: 'COMMERCE_ADMIN_FORBIDDEN' });
  }
  next();
}

function jettonHumanToRaw(human, decimals) {
  const d = Math.min(18, Math.max(0, parseInt(decimals, 10) || 0));
  const s = String(human).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('INVALID_JETTON_PRICE');
  const [w, frac = ''] = s.split('.');
  const fracPad = (frac + '0'.repeat(d)).slice(0, d);
  const whole = BigInt(w);
  const part = BigInt(fracPad || '0');
  const mult = BigInt(10) ** BigInt(d);
  return (whole * mult + part).toString();
}

function mapListingPublic(doc) {
  return {
    id: doc.$id,
    sellerWallet: doc.sellerWallet,
    catalogProductId: doc.catalogProductId,
    title: doc.title,
    description: doc.description,
    currency: doc.currency,
    jettonMaster: doc.jettonMaster || '',
    priceAmountRaw: doc.priceAmountRaw,
    decimals: doc.decimals,
    platformFeeBps: doc.platformFeeBps,
    status: doc.status,
    deliveryType: doc.deliveryType,
    assetFileId: doc.assetFileId || '',
    priceTonHuman:
      doc.currency === CURRENCY.TON ? nanoRawToTonHuman(doc.priceAmountRaw) : undefined,
  };
}

router.get('/config', (req, res) => {
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

router.get('/listings/catalog/:catalogProductId', async (req, res) => {
  try {
    const db = databases();
    const pid = req.params.catalogProductId;
    const { documents } = await db.listDocuments(DATABASE_ID, COL_LISTINGS, [
      Query.equal('catalogProductId', pid),
      Query.equal('status', LISTING_STATUS.ACTIVE),
      Query.limit(5),
    ]);
    const list = documents.map(mapListingPublic);
    res.json({ data: { listings: list, primary: list[0] || null } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось загрузить листинги', code: 'LISTINGS_FETCH' });
  }
});

router.post('/sellers/register', async (req, res) => {
  try {
    const { wallet, displayName, bio = '' } = req.body;
    if (!wallet || !displayName) {
      return res.status(400).json({ error: 'wallet и displayName обязательны', code: 'VALIDATION' });
    }
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
      Query.equal('wallet', wallet),
      Query.limit(1),
    ]);
    if (documents.length > 0) {
      return res.json({ data: { profile: documents[0], created: false } });
    }
    const doc = await db.createDocument(DATABASE_ID, COL_SELLER_PROFILES, ID.unique(), {
      wallet,
      displayName,
      bio,
    });
    await writeAudit(wallet, 'seller_register', 'seller', doc.$id, { displayName });
    res.json({ data: { profile: doc, created: true } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Регистрация продавца не удалась', code: 'SELLER_REGISTER' });
  }
});

router.post('/listings', async (req, res) => {
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
    } = req.body;

    if (!sellerWallet || !catalogProductId || !title || !deliveryType || !deliveryPayload) {
      return res.status(400).json({ error: 'Не все поля заполнены', code: 'VALIDATION' });
    }
    const decimals =
      currency === CURRENCY.TON ? 9 : Math.min(18, Math.max(0, parseInt(decIn, 10) || 9));

    let priceAmountRaw;
    if (currency === CURRENCY.TON) {
      if (priceTon === undefined) {
        return res.status(400).json({ error: 'Нужна цена priceTon', code: 'VALIDATION' });
      }
      priceAmountRaw = tonHumanToNanoRaw(priceTon);
    } else if (currency === CURRENCY.JETTON) {
      if (!jettonMaster) {
        return res.status(400).json({ error: 'Для JETTON нужен jettonMaster', code: 'VALIDATION' });
      }
      if (priceHuman === undefined) {
        return res.status(400).json({ error: 'Нужна цена priceHuman для jetton', code: 'VALIDATION' });
      }
      priceAmountRaw = jettonHumanToRaw(priceHuman, decimals);
    } else {
      return res.status(400).json({ error: 'Неизвестная валюта', code: 'VALIDATION' });
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
    await writeAudit(sellerWallet, 'listing_create', 'listing', listing.$id, { catalogProductId });
    res.json({ data: { listing: mapListingPublic(listing) } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Листинг не создан', code: 'LISTING_CREATE' });
  }
});

router.patch('/listings/:id', async (req, res) => {
  try {
    const listingId = req.params.id;
    const sellerWallet = req.body.sellerWallet || req.headers['x-seller-wallet'];
    if (!sellerWallet) {
      return res.status(400).json({ error: 'Нужен sellerWallet', code: 'VALIDATION' });
    }
    const db = databases();
    const existing = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
    if (!addressesEqual(existing.sellerWallet, sellerWallet)) {
      return res.status(403).json({ error: 'Не ваш листинг', code: 'FORBIDDEN' });
    }
    const patch = {};
    if (req.body.status) patch.status = req.body.status;
    if (req.body.title) patch.title = req.body.title;
    if (req.body.description) patch.description = req.body.description;
    if (req.body.priceTon !== undefined && existing.currency === CURRENCY.TON) {
      patch.priceAmountRaw = tonHumanToNanoRaw(req.body.priceTon);
    }
    const updated = await db.updateDocument(DATABASE_ID, COL_LISTINGS, listingId, patch);
    if (req.body.deliveryPayload) {
      const { documents } = await db.listDocuments(DATABASE_ID, COL_LISTING_SECRETS, [
        Query.equal('listingId', listingId),
        Query.limit(1),
      ]);
      if (documents.length > 0) {
        await db.updateDocument(DATABASE_ID, COL_LISTING_SECRETS, documents[0].$id, {
          deliveryPayload: req.body.deliveryPayload,
        });
      }
    }
    await writeAudit(sellerWallet, 'listing_update', 'listing', listingId, patch);
    res.json({ data: { listing: mapListingPublic(updated) } });
  } catch (e) {
    if (e.code === 404) return res.status(404).json({ error: 'Не найдено', code: 'NOT_FOUND' });
    console.error(e);
    res.status(500).json({ error: 'Обновление не удалось', code: 'LISTING_UPDATE' });
  }
});

router.post('/listings/:id/asset', upload.single('file'), async (req, res) => {
  try {
    const listingId = req.params.id;
    const sellerWallet = req.body.sellerWallet;
    if (!sellerWallet || !req.file) {
      return res.status(400).json({ error: 'Нужны sellerWallet и файл', code: 'VALIDATION' });
    }
    const db = databases();
    const existing = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
    if (!addressesEqual(existing.sellerWallet, sellerWallet)) {
      return res.status(403).json({ error: 'Не ваш листинг', code: 'FORBIDDEN' });
    }
    const storage = storageClient();
    const fileId = ID.unique();
    const inputFile = InputFile.fromBuffer(req.file.buffer, req.file.originalname || 'asset.bin');
    await storage.createFile(BUCKET_ASSETS, fileId, inputFile, [Permission.read(Role.any())]);
    await db.updateDocument(DATABASE_ID, COL_LISTINGS, listingId, { assetFileId: fileId });
    await writeAudit(sellerWallet, 'listing_asset_upload', 'listing', listingId, { fileId });
    res.json({ data: { fileId, bucketId: BUCKET_ASSETS } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Загрузка файла не удалась', code: 'ASSET_UPLOAD' });
  }
});

router.get('/sellers/:wallet/listings', async (req, res) => {
  try {
    const wallet = req.params.wallet;
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_LISTINGS, [
      Query.equal('sellerWallet', wallet),
      Query.limit(100),
    ]);
    res.json({ data: { listings: documents.map(mapListingPublic) } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Список листингов недоступен', code: 'SELLER_LISTINGS' });
  }
});

router.post('/orders', limitCreateOrder, async (req, res) => {
  try {
    const { listingId, buyerWallet } = req.body;
    if (!listingId || !buyerWallet) {
      return res.status(400).json({ error: 'listingId и buyerWallet обязательны', code: 'VALIDATION' });
    }
    const treasury = (process.env.TREASURY_WALLET_ADDRESS || '').trim();
    if (!treasury) {
      return res.status(503).json({ error: 'TREASURY_WALLET_ADDRESS не настроен', code: 'CONFIG' });
    }

    const db = databases();
    const listing = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
    if (listing.status !== LISTING_STATUS.ACTIVE) {
      return res.status(400).json({ error: 'Листинг не активен', code: 'LISTING_INACTIVE' });
    }

    const memo = `cm_${crypto.randomBytes(12).toString('hex')}`;
    const amountRaw = listing.priceAmountRaw;
    const sellerNetAmountRaw = applyFeeBps(amountRaw, listing.platformFeeBps ?? DEFAULT_PLATFORM_FEE_BPS);

    const order = await db.createDocument(DATABASE_ID, COL_ORDERS, ID.unique(), {
      listingId,
      buyerWallet,
      amountRaw,
      currency: listing.currency,
      jettonMaster: listing.jettonMaster || '',
      memo,
      tonTxHash: '',
      state: ORDER_STATE.PENDING_PAYMENT,
      sellerNetAmountRaw,
      listingSnapshotTitle: listing.title,
    });
    await writeAudit(buyerWallet, 'order_create', 'order', order.$id, { listingId, memo });
    res.json({
      data: {
        orderId: order.$id,
        memo,
        amountRaw,
        amountTonHuman:
          listing.currency === CURRENCY.TON ? nanoRawToTonHuman(amountRaw) : undefined,
        decimals: listing.decimals,
        currency: listing.currency,
        jettonMaster: listing.jettonMaster || '',
        treasuryAddress: treasury,
        state: order.state,
      },
    });
  } catch (e) {
    if (e.code === 404) return res.status(404).json({ error: 'Листинг не найден', code: 'NOT_FOUND' });
    console.error(e);
    res.status(500).json({ error: 'Заказ не создан', code: 'ORDER_CREATE' });
  }
});

router.post('/orders/:id/confirm', limitConfirm, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { txHash, buyerWallet } = req.body;
    if (!txHash || !buyerWallet) {
      return res.status(400).json({ error: 'txHash и buyerWallet обязательны', code: 'VALIDATION' });
    }
    const treasury = (process.env.TREASURY_WALLET_ADDRESS || '').trim();
    if (!treasury) {
      return res.status(503).json({ error: 'TREASURY не настроен', code: 'CONFIG' });
    }

    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
    if (!addressesEqual(order.buyerWallet, buyerWallet)) {
      return res.status(403).json({ error: 'Кошелёк не совпадает с заказом', code: 'WALLET_MISMATCH' });
    }
    if (order.state !== ORDER_STATE.PENDING_PAYMENT) {
      return res.json({
        data: {
          state: order.state,
          message: 'Заказ уже обработан',
        },
      });
    }

    const check = await verifyPaymentForOrder(order, txHash, treasury);
    if (!check.ok) {
      return res.status(400).json({
        error: 'Платёж не подтверждён',
        code: 'PAYMENT_VERIFY_FAILED',
        reason: check.reason || 'UNKNOWN',
        details: check,
      });
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
      return res.json({
        data: {
          state: updated.state,
          orderId: updated.$id,
          entitlement: { deliveryPayload: existingEnt[0].deliveryPayload },
        },
      });
    }

    const listingRow = await db.getDocument(DATABASE_ID, COL_LISTINGS, order.listingId);
    const { documents: secrets } = await db.listDocuments(DATABASE_ID, COL_LISTING_SECRETS, [
      Query.equal('listingId', order.listingId),
      Query.limit(1),
    ]);
    let payload = secrets[0]?.deliveryPayload || 'Спасибо за покупку. Контакт продавца уточняйте в листинге.';
    if (listingRow.assetFileId) {
      payload += `\n\n[Файл в Appwrite Storage: bucket ${BUCKET_ASSETS}, fileId ${listingRow.assetFileId}]`;
    }

    await db.createDocument(DATABASE_ID, COL_ENTITLEMENTS, ID.unique(), {
      orderId: order.$id,
      buyerWallet: order.buyerWallet,
      listingId: order.listingId,
      deliveryPayload: payload,
    });
    const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, {
      state: ORDER_STATE.PAID,
      tonTxHash: txHash,
    });
    await writeAudit(buyerWallet, 'order_paid', 'order', orderId, { txHash });
    res.json({
      data: {
        state: updated.state,
        orderId: updated.$id,
        entitlement: { deliveryPayload: payload },
      },
    });
  } catch (e) {
    if (e.code === 404) return res.status(404).json({ error: 'Заказ не найден', code: 'NOT_FOUND' });
    console.error(e);
    res.status(500).json({ error: 'Подтверждение не удалось', code: 'ORDER_CONFIRM' });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    const buyerWallet = req.query.buyerWallet;
    if (!buyerWallet) {
      return res.status(400).json({ error: 'buyerWallet query нужен', code: 'VALIDATION' });
    }
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
    if (!addressesEqual(order.buyerWallet, buyerWallet)) {
      return res.status(403).json({ error: 'Нет доступа', code: 'FORBIDDEN' });
    }
    let delivery = null;
    if (order.state === ORDER_STATE.PAID || order.state === ORDER_STATE.FULFILLED) {
      const { documents } = await db.listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
        Query.equal('orderId', orderId),
        Query.limit(1),
      ]);
      if (documents[0]) delivery = documents[0].deliveryPayload;
    }
    res.json({
      data: {
        order: {
          id: order.$id,
          listingId: order.listingId,
          state: order.state,
          amountRaw: order.amountRaw,
          currency: order.currency,
          memo: order.memo,
          tonTxHash: order.tonTxHash || '',
        },
        deliveryPayload: delivery,
      },
    });
  } catch (e) {
    if (e.code === 404) return res.status(404).json({ error: 'Не найдено', code: 'NOT_FOUND' });
    console.error(e);
    res.status(500).json({ error: 'Ошибка заказа', code: 'ORDER_GET' });
  }
});

router.post('/disputes', async (req, res) => {
  try {
    const { orderId, openedByWallet, reason } = req.body;
    if (!orderId || !openedByWallet || !reason) {
      return res.status(400).json({ error: 'Все поля обязательны', code: 'VALIDATION' });
    }
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
    if (!addressesEqual(order.buyerWallet, openedByWallet)) {
      return res.status(403).json({ error: 'Только покупатель может открыть спор', code: 'FORBIDDEN' });
    }
    if (order.state !== ORDER_STATE.PAID) {
      return res.status(400).json({ error: 'Спор доступен для оплаченных заказов', code: 'INVALID_STATE' });
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
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Спор не создан', code: 'DISPUTE_CREATE' });
  }
});

router.get('/admin/disputes', commerceAdmin, async (req, res) => {
  try {
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_DISPUTES, [Query.limit(200)]);
    res.json({ data: { disputes: documents } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Список споров', code: 'ADMIN_DISPUTES' });
  }
});

router.post('/admin/disputes/:id/resolve', commerceAdmin, async (req, res) => {
  try {
    const disputeId = req.params.id;
    const { resolution, resolutionNote = '' } = req.body;
    if (resolution !== 'refund' && resolution !== 'release') {
      return res.status(400).json({ error: 'resolution: refund | release', code: 'VALIDATION' });
    }
    const db = databases();
    const dispute = await db.getDocument(DATABASE_ID, COL_DISPUTES, disputeId);
    const orderId = dispute.orderId;
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
    await writeAudit('admin', 'dispute_resolve', 'dispute', disputeId, {
      resolution,
      orderId,
    });
    res.json({ data: { ok: true, disputeId, orderId, orderState: orderPatch.state } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Решение не записано', code: 'DISPUTE_RESOLVE' });
  }
});

router.post('/admin/orders/:id/state', commerceAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { state } = req.body;
    const allowed = new Set([
      ORDER_STATE.PENDING_PAYMENT,
      ORDER_STATE.PAID,
      ORDER_STATE.FULFILLED,
      ORDER_STATE.REFUNDED,
      ORDER_STATE.CANCELLED,
    ]);
    if (!allowed.has(state)) {
      return res.status(400).json({ error: 'Недопустимый state', code: 'VALIDATION' });
    }
    const db = databases();
    await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, { state });
    await writeAudit('admin', 'order_state', 'order', orderId, { state });
    res.json({ data: { ok: true, orderId, state } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Статус не обновлён', code: 'ORDER_STATE' });
  }
});

router.get('/admin/orders', commerceAdmin, async (req, res) => {
  try {
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_ORDERS, [
      Query.orderDesc('$createdAt'),
      Query.limit(200),
    ]);
    res.json({ data: { orders: documents } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Список заказов', code: 'ADMIN_ORDERS' });
  }
});

router.get('/admin/audit', commerceAdmin, async (req, res) => {
  try {
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_AUDIT, [
      Query.orderDesc('$createdAt'),
      Query.limit(200),
    ]);
    res.json({ data: { logs: documents } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Аудит', code: 'ADMIN_AUDIT' });
  }
});

const DEMO_LISTINGS = [
  { catalogProductId: '1', title: 'Cosmic Code Editor Pro', description: 'Листинг по умолчанию', priceTon: '15.5' },
  { catalogProductId: '2', title: 'Meditation Game: Inner Peace', description: '...', priceTon: '8.2' },
  { catalogProductId: '3', title: 'AI Wisdom Oracle', description: '...', priceTon: '22' },
  { catalogProductId: '4', title: 'Sacred Terminal', description: '...', priceTon: '5.9' },
  { catalogProductId: '5', title: 'Chakra Game Adventure', description: '...', priceTon: '12' },
  { catalogProductId: '6', title: 'Karma Tracker', description: '...', priceTon: '3.5' },
];

router.post('/admin/bootstrap-demo', commerceAdmin, async (req, res) => {
  try {
    const seller = (req.body.sellerWallet || process.env.BOOTSTRAP_SELLER_WALLET || '').trim();
    if (!seller) {
      return res.status(400).json({ error: 'Нужен sellerWallet или BOOTSTRAP_SELLER_WALLET', code: 'VALIDATION' });
    }
    const db = databases();
    const created = [];
    for (const row of DEMO_LISTINGS) {
      const { documents } = await db.listDocuments(DATABASE_ID, COL_LISTINGS, [
        Query.equal('catalogProductId', row.catalogProductId),
        Query.limit(1),
      ]);
      if (documents.length > 0) continue;
      const priceAmountRaw = tonHumanToNanoRaw(row.priceTon);
      const listing = await db.createDocument(DATABASE_ID, COL_LISTINGS, ID.unique(), {
        sellerWallet: seller,
        catalogProductId: row.catalogProductId,
        title: row.title,
        description: row.description,
        currency: CURRENCY.TON,
        jettonMaster: '',
        priceAmountRaw,
        decimals: 9,
        platformFeeBps: DEFAULT_PLATFORM_FEE_BPS,
        status: LISTING_STATUS.ACTIVE,
        deliveryType: 'link',
        assetFileId: '',
      });
      await db.createDocument(DATABASE_ID, COL_LISTING_SECRETS, ID.unique(), {
        listingId: listing.$id,
        deliveryPayload: `https://example.invalid/download/${row.catalogProductId}?demo=1`,
      });
      created.push(listing.$id);
    }
    await writeAudit('admin', 'bootstrap_demo', 'commerce', 'bulk', { count: created.length });
    res.json({ data: { createdIds: created } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Bootstrap не выполнен', code: 'BOOTSTRAP' });
  }
});

module.exports = router;
