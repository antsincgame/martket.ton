import express, { type Request, type Response } from 'express';
import { DATABASE_ID, COL_ORDERS, COL_AUDIT } from './constants.js';
import { databases, Query } from './appwrite.js';
import { logger } from '../logger.js';
import { CURRENCY } from './constants.js';
import { DEFAULT_PLATFORM_FEE_BPS } from './constants.js';
import { commerceAdmin } from './helpers.js';

const router = express.Router();

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

router.get('/admin/orders', commerceAdmin, async (_req: Request, res: Response) => {
  try {
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_ORDERS, [
      Query.orderDesc('$createdAt'), Query.limit(200),
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
      Query.orderDesc('$createdAt'), Query.limit(200),
    ]);
    res.json({ data: { logs: documents } });
  } catch (e: unknown) {
    logger.error('[commerce] admin audit:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Аудит', code: 'ADMIN_AUDIT' });
  }
});

export default router;
