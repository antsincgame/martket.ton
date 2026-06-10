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
import { buildOnboardingChecklist } from '../agent/status.js';
import { getInstructionSections } from '../agent/instructions.js';
import { requireSellerKyc } from './handlers/requireSellerKyc.js';
import {
  createDiditSession,
  verifyDiditWebhookSignature,
  handleDiditWebhook,
} from './handlers/diditIntegration.js';

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

    const db = databases();
    const listing = await db.createDocument(DATABASE_ID, COL_LISTINGS, ID.unique(), {
      sellerWallet, catalogProductId, title, description,
      currency: CURRENCY.TON,
      priceAmountRaw, priceUsd: String(priceUsd), decimals, platformFeeBps: feeBps,
      status: LISTING_STATUS.ACTIVE, deliveryType, assetFileId,
      collection_address: collectionAddress,
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

// ── Didit KYC: create verification session ────────────────────────
router.post('/sellers/kyc/session', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const { wallet } = req.body as { wallet?: string };
    if (!wallet) {
      res.status(400).json({ error: 'wallet is required', code: 'VALIDATION' });
      return;
    }
    const owner = await requireWalletOwner(req, res, wallet);
    if (!owner) return;

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

    const result = await createDiditSession(wallet, callbackUrl);
    res.json({ data: { sessionId: result.sessionId, url: result.url } });
  } catch (e: unknown) {
    logger.error('[commerce] didit session:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to create KYC session', code: 'DIDIT_SESSION' });
  }
});

// ── Didit KYC: webhook receiver ───────────────────────────────────

/**
 * Express middleware that authenticates an incoming Didit webhook via its HMAC
 * signature BEFORE the handler runs. Fail-closed: a missing/invalid signature
 * (or an unconfigured DIDIT_WEBHOOK_SECRET) is rejected with 401 and the handler
 * never executes. Verification lives here, in a dedicated guard, so the route
 * body carries no request-controlled security branch.
 */
function requireValidDiditSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = (req.headers['x-webhook-signature'] as string | undefined)
    || (req.headers['x-payload-digest'] as string | undefined);
  const rawBody = req.body as Buffer;
  if (!signature || !verifyDiditWebhookSignature(rawBody, signature)) {
    logger.warn('[didit] webhook rejected: missing or invalid signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }
  next();
}

// Per-IP cap on the public webhook endpoint. Generous enough for legitimate
// Didit delivery (low-frequency, retried on 429) while bounding floods of
// forged requests before they reach body-parsing / signature verification.
const limitWebhook = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });

router.post(
  '/sellers/kyc/webhook',
  limitWebhook,
  express.raw({ type: '*/*' }),
  requireValidDiditSignature,
  async (req: Request, res: Response) => {
    try {
      const payload = JSON.parse((req.body as Buffer).toString('utf-8'));
      const result = await handleDiditWebhook(payload);
      res.json({ ok: true, processed: result.processed });
    } catch (e: unknown) {
      logger.error('[didit] webhook error:', e instanceof Error ? e.message : e);
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
