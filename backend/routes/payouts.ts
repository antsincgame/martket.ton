import express from 'express';
import { resolveProfile, apiRequireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { fetchPayouts, fetchTransactions } from '../core/payoutsRepository.js';

const router = express.Router();

router.get(
  '/session/payouts',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    const ledger = await fetchPayouts(profile.id);
    res.json({ success: true, data: ledger });
  }),
);

router.get(
  '/session/transactions',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '100';
    const limit = Math.min(parseInt(limitRaw, 10) || 100, 500);
    const txs = await fetchTransactions(profile.id, limit);
    res.json({ success: true, data: txs });
  }),
);

export default router;
