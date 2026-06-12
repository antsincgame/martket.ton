import express, { type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { InputFile } from 'node-appwrite/file';
import { Permission, Role } from 'node-appwrite';
import {
  DATABASE_ID,
  COL_LISTINGS,
  COL_LISTING_SECRETS,
  COL_SELLER_PROFILES,
  BUCKET_ASSETS,
  LISTING_STATUS,
  CURRENCY,
  DEFAULT_PLATFORM_FEE_BPS,
} from './constants.js';
import { databases, storageClient, ID, Query } from './appwrite.js';
import { tonHumanToNanoRaw } from './money.js';
import { getTonUsdPrice, usdToTonHuman } from './tonPriceOracle.js';
import { addressesEqual } from './tonVerify.js';
import { rejectMismatchedCollection } from './collectionBinding.js';
import { writeAudit } from './audit.js';
import { logger } from '../logger.js';
import { asDoc } from '../domain/appwrite-helpers.js';
import { apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { str } from '../utils/params.js';
import { sellerRegisterSchema, createListingSchema, patchListingSchema } from './validation.js';
import { mapListingPublic, appwriteCodeOrZero, requireWalletOwner } from './helpers.js';
import { loadBestsellers } from './bestsellers.js';
import { loadSellerAnalytics } from './sellerAnalytics.js';
import { setSellerWebhook, clearSellerWebhook, validateWebhookUrl } from './webhooks.js';
import { buildOnboardingChecklist } from '../agent/status.js';
import { getInstructionSections } from '../agent/instructions.js';
import { requireSellerKyc } from './handlers/requireSellerKyc.js';
import {
  createBallerineSession,
  verifyBallerineWebhookSignature,
  handleBallerineWebhook,
  isBallerineConfigured,
} from './handlers/ballerineIntegration.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 52_428_800 },
});

// C1, human↔machine parity: the SAME platform-authored operating manual a machine
// reads at GET /api/v1/agent/instructions, surfaced to humans in the Demiurge UI.
// Public + read-only — the channel is honest, not covert (no checklist/PII here,
// only the static sections).
router.get('/operating-manual', async (_req: Request, res: Response) => {
  try {
    const sections = await getInstructionSections();
    res.json({ data: { sections } });
  } catch (e: unknown) {
    logger.error('[commerce] operating-manual:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to load manual', code: 'OPERATING_MANUAL' });
  }
});

// Public bestseller / trending ranking by REAL sales (counts only, cached).
router.get('/bestsellers', async (req: Request, res: Response) => {
  try {
    const windowParam = str(req.query.window as string | undefined);
    const windowDays = windowParam === '30d' ? 30 : windowParam === '7d' ? 7 : 0;
    const limit = Math.min(parseInt(str(req.query.limit as string | undefined) || '20', 10) || 20, 100);
    const data = await loadBestsellers({ windowDays, limit });
    res.json({ data: { bestsellers: data, window: windowParam || 'all' } });
  } catch (e) {
    logger.error('[commerce] bestsellers:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to load bestsellers', code: 'BESTSELLERS' });
  }
});

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
    res.status(500).json({ error: 'Failed to fetch listings', code: 'LISTINGS_FETCH' });
  }
});

router.post('/sellers/register', apiRequireAuth(), validateBody(sellerRegisterSchema), async (req: Request, res: Response) => {
  try {
    const { wallet, displayName, bio } = req.body as {
      wallet: string;
      displayName: string;
      bio: string;
    };
    const owner = await requireWalletOwner(req, res, wallet);
    if (!owner) return;
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
    res.status(500).json({ error: 'Seller registration failed', code: 'SELLER_REGISTER' });
  }
});

router.post('/listings', apiRequireAuth(), validateBody(createListingSchema), async (req: Request, res: Response) => {
  try {
    const {
      sellerWallet, catalogProductId, title, description,
      priceUsd,
      salePriceUsd, saleEndsAt,
      deliveryType, deliveryPayload,
      platformFeeBps = DEFAULT_PLATFORM_FEE_BPS, assetFileId = '',
      collectionAddress,
    } = req.body as Record<string, string | number | undefined>;

    if (!sellerWallet || !catalogProductId || !title || !deliveryType || !deliveryPayload) {
      res.status(400).json({ error: 'Missing required fields', code: 'VALIDATION' });
      return;
    }
    if (!collectionAddress || typeof collectionAddress !== 'string') {
      res.status(400).json({ error: 'collectionAddress is required', code: 'NO_COLLECTION' });
      return;
    }
    const owner = await requireWalletOwner(req, res, String(sellerWallet));
    if (!owner) return;

    const kyc = await requireSellerKyc(String(sellerWallet));
    if (!kyc.ok) {
      res.status(kyc.status).json({ error: kyc.message, code: kyc.code });
      return;
    }
    if (await rejectMismatchedCollection(req, res, String(sellerWallet), collectionAddress)) return;

    // Platform fee is platform policy: never store below the configured minimum
    // (a seller could otherwise pass platformFeeBps:0 → zero commission).
    const feeBps = Math.max(Number(platformFeeBps) || DEFAULT_PLATFORM_FEE_BPS, DEFAULT_PLATFORM_FEE_BPS);

    const tonRate = await getTonUsdPrice();
    const tonHuman = usdToTonHuman(Number(priceUsd), tonRate);
    const priceAmountRaw = tonHumanToNanoRaw(tonHuman);
    const decimals = 9;

    // Optional launch discount: a USD sale price strictly below the list price,
    // converted via the SAME oracle so it flows safely through the money path.
    let saleStorage: Record<string, unknown> = {};
    if (typeof salePriceUsd === 'number' && salePriceUsd > 0) {
      if (salePriceUsd >= Number(priceUsd)) {
        res.status(400).json({ error: 'salePriceUsd must be less than priceUsd', code: 'BAD_SALE' });
        return;
      }
      saleStorage = {
        sale_price_usd: salePriceUsd,
        sale_price_amount_raw: tonHumanToNanoRaw(usdToTonHuman(salePriceUsd, tonRate)),
        sale_ends_at: (typeof saleEndsAt === 'string' && saleEndsAt) || null,
      };
    }

    const db = databases();
    const listing = await db.createDocument(DATABASE_ID, COL_LISTINGS, ID.unique(), {
      sellerWallet, catalogProductId, title, description,
      currency: CURRENCY.TON,
      priceAmountRaw, priceUsd: String(priceUsd), decimals, platformFeeBps: feeBps,
      status: LISTING_STATUS.ACTIVE, deliveryType, assetFileId,
      collection_address: collectionAddress,
      ...saleStorage,
    });
    await db.createDocument(DATABASE_ID, COL_LISTING_SECRETS, ID.unique(), {
      listingId: listing.$id, deliveryPayload,
    });
    await writeAudit(String(sellerWallet), 'listing_create', 'listing', listing.$id, { catalogProductId });
    res.json({ data: { listing: mapListingPublic(listing) } });
  } catch (e: unknown) {
    logger.error('[commerce] listing create:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Listing creation failed', code: 'LISTING_CREATE' });
  }
});

router.patch('/listings/:id', apiRequireAuth(), validateBody(patchListingSchema), async (req: Request, res: Response) => {
  try {
    const listingId = str(req.params.id);
    const rawHeader = req.headers['x-seller-wallet'];
    const sellerWallet = (req.body as Record<string, string>).sellerWallet || str(rawHeader);
    if (!sellerWallet) { res.status(400).json({ error: 'sellerWallet is required', code: 'VALIDATION' }); return; }
    const owner = await requireWalletOwner(req, res, sellerWallet);
    if (!owner) return;
    const db = databases();
    const existingRaw = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
    const existing = asDoc(existingRaw);
    if (!addressesEqual(existing['sellerWallet'] as string, sellerWallet)) {
      res.status(403).json({ error: 'Not your listing', code: 'FORBIDDEN' }); return;
    }
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.status) patch.status = body.status;
    if (body.title) patch.title = body.title;
    if (body.description) patch.description = body.description;
    if (body.priceUsd !== undefined) {
      const tonRate = await getTonUsdPrice();
      const tonHuman = usdToTonHuman(Number(body.priceUsd), tonRate);
      patch.priceAmountRaw = tonHumanToNanoRaw(tonHuman);
      patch.priceUsd = String(body.priceUsd);
    }
    // Sale: positive salePriceUsd (< list) starts/updates a discount; null/0 clears it.
    if (body.salePriceUsd !== undefined) {
      const listUsd = body.priceUsd !== undefined ? Number(body.priceUsd) : Number(existing['priceUsd']);
      const sale = body.salePriceUsd === null ? 0 : Number(body.salePriceUsd);
      if (!sale) {
        patch.sale_price_usd = null;
        patch.sale_price_amount_raw = null;
        patch.sale_ends_at = null;
      } else {
        if (sale >= listUsd) {
          res.status(400).json({ error: 'salePriceUsd must be less than priceUsd', code: 'BAD_SALE' });
          return;
        }
        const tonRate = await getTonUsdPrice();
        patch.sale_price_usd = sale;
        patch.sale_price_amount_raw = tonHumanToNanoRaw(usdToTonHuman(sale, tonRate));
        patch.sale_ends_at = (typeof body.saleEndsAt === 'string' && body.saleEndsAt) || null;
      }
    } else if (body.saleEndsAt !== undefined) {
      patch.sale_ends_at = (typeof body.saleEndsAt === 'string' && body.saleEndsAt) || null;
    }
    if (typeof body.collectionAddress === 'string' && body.collectionAddress.length > 0) {
      if (await rejectMismatchedCollection(req, res, sellerWallet, body.collectionAddress)) return;
      patch.collection_address = body.collectionAddress;
    }
    // Activating a listing requires a valid collection_address — otherwise
    // every purchase would create a license without an NFT mint, breaking
    // the buyer-burn refund guarantee. It also requires approved KYC.
    if (patch.status === LISTING_STATUS.ACTIVE) {
      const effectiveCollection =
        (patch.collection_address as string | undefined) ||
        (existing['collection_address'] as string | undefined) ||
        '';
      if (!effectiveCollection) {
        res.status(400).json({
          error: 'Cannot activate listing without collection_address. Deploy AppCollection first.',
          code: 'NO_COLLECTION',
        });
        return;
      }
      const kyc = await requireSellerKyc(sellerWallet);
      if (!kyc.ok) {
        res.status(kyc.status).json({ error: kyc.message, code: kyc.code });
        return;
      }
    }
    const updated = await db.updateDocument(DATABASE_ID, COL_LISTINGS, listingId, patch);
    if (body.deliveryPayload) {
      const { documents } = await db.listDocuments(DATABASE_ID, COL_LISTING_SECRETS, [
        Query.equal('listingId', listingId), Query.limit(1),
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
    const code = appwriteCodeOrZero(e);
    if (code === 404) { res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }); return; }
    logger.error('[commerce] listing update:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Listing update failed', code: 'LISTING_UPDATE' });
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
    if (!sellerWallet || !req.file) { res.status(400).json({ error: 'sellerWallet and file are required', code: 'VALIDATION' }); return; }
    const owner = await requireWalletOwner(req, res, sellerWallet);
    if (!owner) return;
    const origName = (req.file.originalname || '').toLowerCase();
    const dotIdx = origName.lastIndexOf('.');
    const ext = dotIdx >= 0 ? origName.slice(dotIdx) : '';
    if (!COMMERCE_ALLOWED_EXT.has(ext)) { res.status(400).json({ error: `File type "${ext}" not allowed`, code: 'FILE_TYPE' }); return; }
    const db = databases();
    const existing = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
    if (!addressesEqual(existing['sellerWallet'] as string, sellerWallet)) {
      res.status(403).json({ error: 'Not your listing', code: 'FORBIDDEN' }); return;
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
    res.status(500).json({ error: 'Asset upload failed', code: 'ASSET_UPLOAD' });
  }
});

// ── Ballerine KYC: create verification session ────────────────────
router.post('/sellers/kyc/session', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const { wallet } = req.body as { wallet?: string };
    if (!wallet) {
      res.status(400).json({ error: 'wallet is required', code: 'VALIDATION' });
      return;
    }
    const owner = await requireWalletOwner(req, res, wallet);
    if (!owner) return;

    if (!isBallerineConfigured()) {
      res.status(503).json({
        error: 'Automated KYC is not configured; use the manual verification form.',
        code: 'KYC_PROVIDER_DISABLED',
      });
      return;
    }

    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
      Query.equal('wallet', wallet),
      Query.limit(1),
    ]);
    if (documents.length === 0) {
      res.status(404).json({ error: 'Register as a seller first', code: 'NOT_REGISTERED' });
      return;
    }

    const existing = documents[0] as Record<string, unknown>;
    if (existing['kyc_status'] === 'approved') {
      res.json({ data: { alreadyApproved: true } });
      return;
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost';
    const callbackUrl = `${protocol}://${host}/api/v1/commerce/sellers/kyc/webhook`;

    const result = await createBallerineSession(wallet, callbackUrl);
    res.json({ data: { sessionId: result.sessionId, url: result.url } });
  } catch (e: unknown) {
    logger.error('[commerce] ballerine session:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to create KYC session', code: 'KYC_SESSION' });
  }
});

// ── Ballerine KYC: webhook receiver ───────────────────────────────

/**
 * Express middleware that authenticates an incoming Ballerine webhook via its
 * HMAC signature BEFORE the handler runs. Fail-closed: a missing/invalid
 * signature (or an unconfigured BALLERINE_WEBHOOK_SECRET) is rejected with 401.
 *
 * The HMAC is computed over the RAW body bytes. server.ts exempts this exact
 * path from the global express.json() parser, so `express.raw` below receives
 * the unconsumed stream — previously (Didit) the global parser ran first and the
 * signature was verified against a stringified object (always failing / forgeable).
 */
function requireValidBallerineSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = (req.headers['x-ballerine-signature'] as string | undefined)
    || (req.headers['x-webhook-signature'] as string | undefined)
    || (req.headers['x-hmac-signature'] as string | undefined);
  const rawBody = req.body as Buffer;
  if (!signature || !verifyBallerineWebhookSignature(rawBody, signature)) {
    logger.warn('[ballerine] webhook rejected: missing or invalid signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }
  next();
}

// Per-IP cap on the public webhook endpoint. Generous enough for legitimate
// Ballerine delivery (low-frequency, retried) while bounding floods of forged
// requests before they reach body-parsing / signature verification.
const limitWebhook = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });

router.post(
  '/sellers/kyc/webhook',
  limitWebhook,
  express.raw({ type: '*/*' }),
  requireValidBallerineSignature,
  async (req: Request, res: Response) => {
    try {
      const payload = JSON.parse((req.body as Buffer).toString('utf-8'));
      const result = await handleBallerineWebhook(payload);
      res.json({ ok: true, processed: result.processed });
    } catch (e: unknown) {
      logger.error('[ballerine] webhook error:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  },
);

// ── Seller KYC status (for frontend polling) ──────────────────────
router.get('/sellers/:wallet/kyc-status', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const wallet = str(req.params.wallet);
    const owner = await requireWalletOwner(req, res, wallet);
    if (!owner) return;

    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
      Query.equal('wallet', wallet),
      Query.limit(1),
    ]);
    if (documents.length === 0) {
      res.json({ data: { kycStatus: 'none' } });
      return;
    }

    const doc = documents[0] as Record<string, unknown>;
    res.json({
      data: {
        kycStatus: doc['kyc_status'] || 'none',
        kycProvider: doc['kyc_provider'] || null,
        kycCompletedAt: doc['kyc_completed_at'] || null,
        kycRejectionReason: doc['kyc_rejection_reason'] || null,
      },
    });
  } catch (e: unknown) {
    logger.error('[commerce] kyc status:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to fetch KYC status', code: 'KYC_STATUS' });
  }
});

// Copilot-Lite, human face: the seller's own onboarding checklist + next action,
// computed from the SAME derive logic the agent's GET /api/v1/agent/status uses.
// A human Demiurge gets identical guidance to a machine one — one shared brain.
router.get('/sellers/:wallet/onboarding', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const wallet = str(req.params.wallet);
    const owner = await requireWalletOwner(req, res, wallet);
    if (!owner) return;
    const onboarding = await buildOnboardingChecklist(wallet);
    res.json({ data: { onboarding } });
  } catch (e: unknown) {
    logger.error('[commerce] seller onboarding:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to load onboarding', code: 'SELLER_ONBOARDING' });
  }
});

// Seller analytics for the human Demiurge UI — same aggregator as the agent
// endpoint (`GET /api/v1/agent/analytics`), so machine and human see identical
// store performance. Owner-only.
router.get('/sellers/:wallet/analytics', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const wallet = str(req.params.wallet);
    const owner = await requireWalletOwner(req, res, wallet);
    if (!owner) return;
    const analytics = await loadSellerAnalytics(wallet);
    res.json({ data: analytics });
  } catch (e: unknown) {
    logger.error('[commerce] seller analytics:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to compute analytics', code: 'SELLER_ANALYTICS' });
  }
});

// Seller event webhook (human Demiurge parity with the agent surface). Owner-only.
router.post('/sellers/:wallet/webhook', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const wallet = str(req.params.wallet);
    const owner = await requireWalletOwner(req, res, wallet);
    if (!owner) return;
    const url = typeof (req.body as { url?: unknown })?.url === 'string' ? (req.body as { url: string }).url.trim() : '';
    if (!url) {
      res.status(400).json({ error: 'url is required', code: 'VALIDATION' });
      return;
    }
    const valid = await validateWebhookUrl(url);
    if (!valid.ok) {
      res.status(400).json({ error: `Invalid webhook URL: ${valid.reason}`, code: 'BAD_WEBHOOK_URL' });
      return;
    }
    const { secret } = await setSellerWebhook(wallet, url);
    res.json({ data: { url, secret, events: ['order.paid', 'payout.released'] } });
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : '';
    if (code === 'SELLER_NOT_REGISTERED') { res.status(404).json({ error: 'Register as a seller first', code: 'NOT_REGISTERED' }); return; }
    if (code === 'WEBHOOK_NOT_PROVISIONED') { res.status(503).json({ error: 'Webhooks not provisioned', code: 'WEBHOOK_NOT_PROVISIONED' }); return; }
    logger.error('[commerce] set webhook:', code);
    res.status(500).json({ error: 'Failed to set webhook', code: 'SELLER_WEBHOOK' });
  }
});

router.delete('/sellers/:wallet/webhook', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const wallet = str(req.params.wallet);
    const owner = await requireWalletOwner(req, res, wallet);
    if (!owner) return;
    await clearSellerWebhook(wallet);
    res.json({ data: { cleared: true } });
  } catch (e: unknown) {
    logger.error('[commerce] clear webhook:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to clear webhook', code: 'SELLER_WEBHOOK' });
  }
});

router.get('/sellers/:wallet/listings', async (req: Request, res: Response) => {
  try {
    const wallet = str(req.params.wallet);
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_LISTINGS, [
      Query.equal('sellerWallet', wallet), Query.limit(100),
    ]);
    res.json({ data: { listings: documents.map((d) => mapListingPublic(asDoc(d))) } });
  } catch (e: unknown) {
    logger.error('[commerce] seller listings:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to fetch seller listings', code: 'SELLER_LISTINGS' });
  }
});

export default router;
