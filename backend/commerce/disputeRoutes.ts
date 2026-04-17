import express, { type Request, type Response } from 'express';
import {
  DATABASE_ID, COL_ORDERS, COL_DISPUTES, COL_LISTINGS,
  ORDER_STATE, DISPUTE_STATUS,
} from './constants.js';
import { databases, ID, Query } from './appwrite.js';
import { addressesEqual } from './tonVerify.js';
import { writeAudit } from './audit.js';
import { logger } from '../logger.js';
import { apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { str } from '../utils/params.js';
import { createDisputeSchema, resolveDisputeSchema, orderStateSchema } from './validation.js';
import { commerceAdmin } from './helpers.js';

const router = express.Router();

router.post('/disputes', apiRequireAuth(), validateBody(createDisputeSchema), async (req: Request, res: Response) => {
  try {
    const { orderId, openedByWallet, reason } = req.body as {
      orderId: string; openedByWallet: string; reason: string;
    };
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
    if (!addressesEqual(order['buyerWallet'] as string, openedByWallet)) {
      res.status(403).json({ error: 'Только покупатель может открыть спор', code: 'FORBIDDEN' }); return;
    }
    if (order['state'] !== ORDER_STATE.PAID) {
      res.status(400).json({ error: 'Спор доступен для оплаченных заказов', code: 'INVALID_STATE' }); return;
    }
    const dispute = await db.createDocument(DATABASE_ID, COL_DISPUTES, ID.unique(), {
      orderId, openedByWallet, reason,
      status: DISPUTE_STATUS.OPEN, resolutionNote: '',
    });
    await writeAudit(openedByWallet, 'dispute_open', 'dispute', dispute.$id, { orderId });
    res.json({ data: { dispute } });
  } catch (e: unknown) {
    logger.error('[commerce] dispute create:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Спор не создан', code: 'DISPUTE_CREATE' });
  }
});

router.get('/sellers/:wallet/disputes', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const wallet = str(req.params.wallet);
    if (!wallet) { res.status(400).json({ error: 'wallet param required', code: 'VALIDATION' }); return; }
    const db = databases();

    const { documents: sellerListings } = await db.listDocuments(DATABASE_ID, COL_LISTINGS, [
      Query.equal('sellerWallet', wallet),
      Query.limit(500),
    ]);
    const listingIds = sellerListings.map((l) => l.$id);
    if (listingIds.length === 0) {
      res.json({ data: { disputes: [] } });
      return;
    }

    const { documents: orders } = await db.listDocuments(DATABASE_ID, COL_ORDERS, [
      Query.equal('listingId', listingIds),
      Query.limit(500),
    ]);
    const orderIds = orders.map((o) => o.$id);
    if (orderIds.length === 0) {
      res.json({ data: { disputes: [] } });
      return;
    }
    const orderById = new Map(orders.map((o) => [o.$id, o]));

    const { documents: disputes } = await db.listDocuments(DATABASE_ID, COL_DISPUTES, [
      Query.equal('orderId', orderIds),
      Query.orderDesc('$createdAt'),
      Query.limit(200),
    ]);

    res.json({
      data: {
        disputes: disputes.map((d) => {
          const o = orderById.get(d['orderId'] as string);
          return {
            id: d.$id,
            orderId: d['orderId'],
            buyerWallet: d['openedByWallet'],
            reason: d['reason'],
            status: d['status'],
            resolutionNote: d['resolutionNote'] || '',
            createdAt: d.$createdAt,
            order: o ? {
              listingTitle: o['listingSnapshotTitle'] ?? null,
              amountRaw: o['amountRaw'],
              currency: o['currency'],
              state: o['state'],
            } : null,
          };
        }),
      },
    });
  } catch (e: unknown) {
    logger.error('[commerce] seller disputes:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Не удалось получить споры продавца', code: 'SELLER_DISPUTES' });
  }
});

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
    const { resolution, resolutionNote } = req.body as { resolution: 'refund' | 'release'; resolutionNote: string };
    const db = databases();
    const dispute = await db.getDocument(DATABASE_ID, COL_DISPUTES, disputeId);
    const orderId = dispute['orderId'] as string;
    const newStatus = resolution === 'refund' ? DISPUTE_STATUS.RESOLVED_REFUND : DISPUTE_STATUS.RESOLVED_RELEASE;
    await db.updateDocument(DATABASE_ID, COL_DISPUTES, disputeId, { status: newStatus, resolutionNote });
    const orderPatch = resolution === 'refund' ? { state: ORDER_STATE.REFUNDED } : { state: ORDER_STATE.FULFILLED };
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

export default router;
