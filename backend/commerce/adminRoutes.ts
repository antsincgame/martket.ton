import express, { type Request, type Response } from 'express';
import { DATABASE_ID, COL_ORDERS, COL_AUDIT } from './constants.js';
import { databases, Query } from './appwrite.js';
import { writeAudit } from './audit.js';
import { logger } from '../logger.js';
import { CURRENCY } from './constants.js';
import { DEFAULT_PLATFORM_FEE_BPS } from './constants.js';
import { commerceAdmin } from './helpers.js';
import { validateBody } from '../middleware/validate.js';
import { orderStateSchema } from './validation.js';
import { str } from '../utils/params.js';

const router = express.Router();

router.get('/config', (_req: Request, res: Response) => {
  const treasury = process.env.TREASURY_WALLET_ADDRESS || '';
  res.json({
    data: {
      treasuryAddress: treasury,
      platformFeeBpsDefault: DEFAULT_PLATFORM_FEE_BPS,
      currencyTon: CURRENCY.TON,
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
    res.status(500).json({ error: 'Failed to fetch orders', code: 'ADMIN_ORDERS' });
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
    res.status(500).json({ error: 'Failed to fetch audit log', code: 'ADMIN_AUDIT' });
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
    res.status(500).json({ error: 'Order state update failed', code: 'ORDER_STATE' });
  }
});

export default router;
