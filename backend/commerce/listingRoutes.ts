import express, { type Request, type Response } from 'express';
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
import { tonHumanToNanoRaw, jettonHumanToRaw } from './money.js';
import { addressesEqual } from './tonVerify.js';
import { writeAudit } from './audit.js';
import { logger } from '../logger.js';
import { asDoc } from '../domain/appwrite-helpers.js';
import { apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { str } from '../utils/params.js';
import { sellerRegisterSchema, createListingSchema, patchListingSchema } from './validation.js';
import { mapListingPublic, appwriteCodeOrZero, requireWalletOwner } from './helpers.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 52_428_800 },
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
      currency = CURRENCY.TON, jettonMaster = '',
      priceTon, priceHuman, decimals: decIn,
      deliveryType, deliveryPayload,
      platformFeeBps = DEFAULT_PLATFORM_FEE_BPS, assetFileId = '',
    } = req.body as Record<string, string | number | undefined>;

    if (!sellerWallet || !catalogProductId || !title || !deliveryType || !deliveryPayload) {
      res.status(400).json({ error: 'Missing required fields', code: 'VALIDATION' });
      return;
    }
    const owner = await requireWalletOwner(req, res, String(sellerWallet));
    if (!owner) return;
    const decimals =
      currency === CURRENCY.TON ? 9 : Math.min(18, Math.max(0, parseInt(String(decIn), 10) || 9));

    let priceAmountRaw: string;
    if (currency === CURRENCY.TON) {
      if (priceTon === undefined) { res.status(400).json({ error: 'priceTon is required', code: 'VALIDATION' }); return; }
      priceAmountRaw = tonHumanToNanoRaw(priceTon);
    } else if (currency === CURRENCY.JETTON) {
      if (!jettonMaster) { res.status(400).json({ error: 'jettonMaster is required for JETTON currency', code: 'VALIDATION' }); return; }
      if (priceHuman === undefined) { res.status(400).json({ error: 'priceHuman is required for jetton', code: 'VALIDATION' }); return; }
      priceAmountRaw = jettonHumanToRaw(priceHuman, decimals);
    } else {
      res.status(400).json({ error: 'Unknown currency', code: 'VALIDATION' }); return;
    }

    const db = databases();
    const listing = await db.createDocument(DATABASE_ID, COL_LISTINGS, ID.unique(), {
      sellerWallet, catalogProductId, title, description,
      currency, jettonMaster: currency === CURRENCY.JETTON ? jettonMaster : '',
      priceAmountRaw, decimals, platformFeeBps,
      status: LISTING_STATUS.ACTIVE, deliveryType, assetFileId,
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
    if (body.priceTon !== undefined && existing['currency'] === CURRENCY.TON) {
      patch.priceAmountRaw = tonHumanToNanoRaw(body.priceTon as string | number);
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
