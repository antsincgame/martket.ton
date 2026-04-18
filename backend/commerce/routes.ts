import express from 'express';
import listingRoutes from './listingRoutes.js';
import orderRoutes from './orderRoutes.js';
import adminRoutes from './adminRoutes.js';

const router = express.Router();

router.use(adminRoutes);
router.use(listingRoutes);
router.use(orderRoutes);

export default router;
