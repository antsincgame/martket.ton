import express from 'express';
import rateLimit from 'express-rate-limit';
import { resolveProfile, apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { str } from '../utils/params.js';
import { createPurchaseSchema } from './validation.js';
import * as repo from '../core/repository.js';
import { productToSnakeCase } from '../core/repository.js';
import { generateId } from '../core/generateId.js';
import { verifyNativeTonTransfer } from '../commerce/tonVerify.js';
import { getTonUsdPrice, usdToTonHuman } from '../commerce/tonPriceOracle.js';
import { tonHumanToNanoRaw } from '../commerce/money.js';
import { logger } from '../logger.js';
import { recordLedgerEntry } from '../core/ledgerService.js';

/**
 * Deterministic on-chain memo for a (buyer, product) pair.
 *
 * Exported for unit tests. The memo is the contract that proves the buyer
 * intended to pay specifically for this product — verifying it on-chain
 * prevents an attacker from reusing somebody else's transaction hash.
 */
export function buildPurchaseMemo(userId: string, productId: string): string {
  return `pur:${productId}:${userId}`.slice(0, 120);
}

/**
 * Converts TON (decimal) to nanoton (BigInt-as-string).
 *
 * Uses Math.round to absorb fp drift on inputs like 1.5 * 1e9. Throws on
 * non-finite or negative input — which would otherwise let a malicious
 * client trick the comparator into accepting any payment amount.
 */
export function tonToNanoRaw(amountTon: number): string {
  if (!Number.isFinite(amountTon) || amountTon < 0) {
    throw new Error(`tonToNanoRaw: invalid amount ${amountTon}`);
  }
  const rounded = Math.round(amountTon * 1e9);
  return BigInt(rounded).toString();
}

const router = express.Router();

const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get(
  '/session/library',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const purchases = await repo.listPurchasesByUser(profile.id);
    const productIds = [...new Set(purchases.map((p) => p.productId).filter(Boolean))];
    const products = await Promise.all(productIds.map((id) => repo.findProductById(id)));
    const productMap = new Map(
      products.filter((p): p is NonNullable<typeof p> => p !== null).map((p) => [p.id, p]),
    );
    const enriched = purchases.map((p) => ({
      ...p,
      product: productMap.has(p.productId) ? productToSnakeCase(productMap.get(p.productId)!) : null,
    }));
    res.json({ success: true, data: enriched });
  }),
);

router.get(
  '/session/owns/:productId',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.json({ success: true, data: { owns: false } });
      return;
    }
    const purchase = await repo.findPurchase(profile.id, str(req.params.productId));
    res.json({ success: true, data: { owns: !!purchase } });
  }),
);

router.post(
  '/purchases',
  apiRequireAuth(),
  strictLimiter,
  validateBody(createPurchaseSchema),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const { product_id, tx_hash } = req.body as { product_id?: string; tx_hash?: string };
    if (!product_id) {
      res.status(400).json({ success: false, message: 'product_id is required' });
      return;
    }
    const product = await repo.findProductById(product_id);
    if (!product || product.status !== 'published') {
      res.status(404).json({ success: false, message: 'Product not found or not published' });
      return;
    }
    // Idempotency by business key: if the (user, product) pair already owns
    // a purchase, return the existing record so naive client retries after
    // network timeouts don't have to special-case 409.
    const existingPurchase = await repo.findPurchase(profile.id, product_id);
    if (existingPurchase) {
      res.status(409).json({
        success: false,
        message: 'You already own this product',
        code: 'ALREADY_OWNS',
        data: existingPurchase,
      });
      return;
    }

    const priceUsd = Number(product.priceUsd || 0);
    const isPaid = priceUsd > 0;
    let cachedTonRate = 0;
    let cachedAmountTonRaw = '0';

    if (isPaid) {
      if (!tx_hash || tx_hash.trim().length < 8) {
        res.status(400).json({
          success: false,
          message: 'tx_hash is required for paid products',
          code: 'TX_HASH_REQUIRED',
        });
        return;
      }
      if (!profile.tonAddress) {
        res.status(400).json({
          success: false,
          message: 'Connect your TON wallet before purchasing',
          code: 'WALLET_REQUIRED',
        });
        return;
      }
      const treasury = (process.env.TREASURY_WALLET_ADDRESS || '').trim();
      if (!treasury) {
        logger.error('[purchases] TREASURY_WALLET_ADDRESS not configured');
        res.status(503).json({
          success: false,
          message: 'Treasury wallet not configured',
          code: 'CONFIG',
        });
        return;
      }

      const replay = await repo.findPurchaseByTxHash(tx_hash.trim());
      if (replay) {
        // If the same buyer is retrying with the same tx_hash and ends up
        // owning the same product — treat it as idempotent success from
        // the client's perspective (same bytes on the wire).
        if (replay.userId === profile.id && replay.productId === product_id) {
          res.status(409).json({
            success: false,
            message: 'Purchase already recorded for this transaction',
            code: 'ALREADY_OWNS',
            data: replay,
          });
          return;
        }
        res.status(409).json({
          success: false,
          message: 'This transaction has already been used',
          code: 'TX_REPLAY',
        });
        return;
      }

      try {
        cachedTonRate = await getTonUsdPrice();
        const tonHuman = usdToTonHuman(priceUsd, cachedTonRate);
        const expectedNano = tonHumanToNanoRaw(tonHuman);
        cachedAmountTonRaw = expectedNano;
        const verification = await verifyNativeTonTransfer({
          txHash: tx_hash.trim(),
          treasuryAddress: treasury,
          fromAddress: profile.tonAddress,
          expectedAmountRaw: expectedNano,
          expectedMemo: buildPurchaseMemo(profile.id, product_id),
        });
        if (!verification.ok) {
          await repo.insertAuditLog({
            id: generateId(),
            user_id: profile.id,
            action: 'purchase_verify_failed',
            resource: 'product',
            resource_id: product_id,
            result: 'fail',
            metadata: JSON.stringify({ tx_hash, reason: verification.reason }),
            ip_address: req.ip,
            user_agent: req.get('user-agent') || '',
          });
          res.status(402).json({
            success: false,
            message: `Payment verification failed: ${verification.reason}`,
            code: 'TX_VERIFICATION_FAILED',
          });
          return;
        }
      } catch (err: unknown) {
        logger.error('[purchases] verify error:', err instanceof Error ? err.message : err);
        res.status(502).json({
          success: false,
          message: 'Could not verify transaction with TON network',
          code: 'TX_VERIFY_NETWORK',
        });
        return;
      }
    }

    const purchase = await repo.insertPurchase({
      id: generateId(),
      user_id: profile.id,
      product_id,
      price_usd: priceUsd,
      tx_hash: tx_hash || null,
    });
    await repo.insertAuditLog({
      id: generateId(),
      user_id: profile.id,
      action: 'purchase',
      resource: 'product',
      resource_id: product_id,
      result: 'success',
      metadata: JSON.stringify({ price_usd: priceUsd, tx_hash, verified: isPaid }),
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });

    recordLedgerEntry({
      entryType: 'purchase',
      refType: 'purchase',
      refId: purchase.id,
      buyerWallet: profile.tonAddress ?? null,
      buyerProfileId: profile.id,
      amountUsd: priceUsd,
      amountTonRaw: cachedAmountTonRaw,
      txHash: tx_hash || null,
      productName: product.name,
      buyerIp: req.ip ?? null,
      buyerKycCountry: profile.kycLiteCountryCode ?? null,
    }).catch((err) => logger.warn('[purchases] ledger write failed:', err));

    res.json({ success: true, data: purchase });
  }),
);

export default router;
