import express from 'express';
import listingRoutes from './listingRoutes.js';
import orderRoutes from './orderRoutes.js';
import adminRoutes from './adminRoutes.js';
import storageRoutes from './storageRoutes.js';
import distributionRoutes from './distributionRoutes.js';
import scanRoutes from './scanRoutes.js';

const router = express.Router();

router.use(adminRoutes);
router.use(listingRoutes);
router.use(orderRoutes);
router.use(storageRoutes);
router.use(distributionRoutes);
router.use(scanRoutes);

export default router;
