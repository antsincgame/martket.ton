import express from 'express';
import { resolveProfile, apiRequireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { fetchSessionStats } from '../core/statsRepository.js';

const router = express.Router();

router.get(
  '/session/stats',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    const stats = await fetchSessionStats(profile.id);
    res.json({ success: true, data: stats });
  }),
);

export default router;
