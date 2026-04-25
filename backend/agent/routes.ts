/**
 * Public Agent API routes.
 *
 * Authenticated via Personal Access Tokens (`apiRequireAgentToken`). The
 * issuing wallet is read from the token, NEVER from the request body or
 * any header — anything else would let a token holder act on behalf of a
 * different seller by simply lying in the payload.
 *
 * These routes mirror a minimal subset of `commerce/*Routes.ts` but their
 * surface area is intentionally narrower — only the operations an AI agent
 * needs for product lifecycle automation.
 */

import express, { type Request, type Response } from 'express';
import { databases, ID, Query } from '../commerce/appwrite.js';
import {
  DATABASE_ID,
  COL_LISTINGS,
  COL_LISTING_SECRETS,
  COL_ORDERS,
  CURRENCY,
  DEFAULT_PLATFORM_FEE_BPS,
  LISTING_STATUS,
} from '../commerce/constants.js';
import { tonHumanToNanoRaw } from '../commerce/money.js';
import { getTonUsdPrice, usdToTonHuman } from '../commerce/tonPriceOracle.js';
import { mapListingPublic } from '../commerce/helpers.js';
import { asDoc } from '../domain/appwrite-helpers.js';
import { writeAudit } from '../commerce/audit.js';
import { logger } from '../logger.js';
import { str } from '../utils/params.js';
import { apiRequireAgentToken } from './agentAuth.js';
import { createListingSchema, patchListingSchema } from '../commerce/validation.js';
import { validateBody } from '../middleware/validate.js';

const router = express.Router();

router.get('/me', apiRequireAgentToken(), (req: Request, res: Response) => {
  const a = req.agent!;
  res.json({
    data: {
      wallet: a.wallet,
      scopes: a.scopes,
      tokenPrefix: a.tokenPrefix,
    },
  });
});

router.get('/listings', apiRequireAgentToken(['listings:read']), async (req: Request, res: Response) => {
  const wallet = req.agent!.wallet;
  try {
    const { documents } = await databases().listDocuments(DATABASE_ID, COL_LISTINGS, [
      Query.equal('sellerWallet', wallet),
      Query.limit(100),
    ]);
    res.json({ data: { listings: documents.map((d) => mapListingPublic(asDoc(d))) } });
  } catch (e) {
    logger.error('[agent] listings list:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to fetch listings', code: 'AGENT_LISTINGS' });
  }
});

router.post(
  '/listings',
  apiRequireAgentToken(['listings:write']),
  validateBody(createListingSchema),
  async (req: Request, res: Response) => {
    try {
      const wallet = req.agent!.wallet;
      const body = req.body as Record<string, string | number | undefined>;
      // Force the seller wallet to match the token. Even if the agent put a
      // different address in the body, only its own wallet may receive funds.
      const {
        catalogProductId, title, description = '',
        priceUsd,
        deliveryType, deliveryPayload,
        platformFeeBps = DEFAULT_PLATFORM_FEE_BPS,
        collectionAddress,
      } = body;

      if (!catalogProductId || !title || !deliveryType || !deliveryPayload) {
        res.status(400).json({ error: 'Missing required fields', code: 'VALIDATION' });
        return;
      }
      if (!collectionAddress || typeof collectionAddress !== 'string') {
        res.status(400).json({ error: 'collectionAddress is required', code: 'NO_COLLECTION' });
        return;
      }
      if (priceUsd === undefined) {
        res.status(400).json({ error: 'priceUsd is required', code: 'VALIDATION' });
        return;
      }

      const tonRate = await getTonUsdPrice();
      const tonHuman = usdToTonHuman(Number(priceUsd), tonRate);
      const priceAmountRaw = tonHumanToNanoRaw(tonHuman);
      const decimals = 9;

      const listing = await databases().createDocument(DATABASE_ID, COL_LISTINGS, ID.unique(), {
        sellerWallet: wallet,
        catalogProductId,
        title,
        description,
        currency: CURRENCY.TON,
        priceAmountRaw,
        priceUsd: String(priceUsd),
        decimals,
        platformFeeBps,
        status: LISTING_STATUS.ACTIVE,
        deliveryType,
        assetFileId: '',
        collection_address: collectionAddress,
      });
      await databases().createDocument(DATABASE_ID, COL_LISTING_SECRETS, ID.unique(), {
        listingId: listing.$id,
        deliveryPayload,
      });
      await writeAudit(wallet, 'agent_listing_create', 'listing', listing.$id, {
        token: req.agent!.tokenPrefix,
        catalogProductId,
      });
      res.json({ data: { listing: mapListingPublic(asDoc(listing)) } });
    } catch (e) {
      logger.error('[agent] listing create:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Listing creation failed', code: 'AGENT_LISTING_CREATE' });
    }
  },
);

router.patch(
  '/listings/:id',
  apiRequireAgentToken(['listings:write']),
  validateBody(patchListingSchema),
  async (req: Request, res: Response) => {
    try {
      const wallet = req.agent!.wallet;
      const listingId = str(req.params.id);
      const db = databases();
      const existingRaw = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
      const existing = asDoc(existingRaw);
      if (existing['sellerWallet'] !== wallet) {
        res.status(403).json({ error: 'Not your listing', code: 'NOT_OWNER' });
        return;
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
        patch.collection_address = body.collectionAddress;
      }
      if (patch.status === LISTING_STATUS.ACTIVE) {
        const effective =
          (patch.collection_address as string | undefined) ||
          (existing['collection_address'] as string | undefined) ||
          '';
        if (!effective) {
          res.status(400).json({
            error: 'Cannot activate listing without collection_address',
            code: 'NO_COLLECTION',
          });
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
      await writeAudit(wallet, 'agent_listing_update', 'listing', listingId, {
        token: req.agent!.tokenPrefix,
        patch,
      });
      res.json({ data: { listing: mapListingPublic(updated) } });
    } catch (e) {
      logger.error('[agent] listing update:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Listing update failed', code: 'AGENT_LISTING_UPDATE' });
    }
  },
);

router.put(
  '/listings/:id/distribution',
  apiRequireAgentToken(['distribution:write']),
  async (req: Request, res: Response) => {
    try {
      const wallet = req.agent!.wallet;
      const listingId = str(req.params.id);
      const db = databases();
      const existing = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
      if ((existing['sellerWallet'] as string) !== wallet) {
        res.status(403).json({ error: 'Not your listing', code: 'NOT_OWNER' });
        return;
      }
      const body = req.body as { manifest: Record<string, unknown>; ttlSec?: number };
      if (!body.manifest) {
        res.status(400).json({ error: 'manifest is required', code: 'VALIDATION' });
        return;
      }
      const { ManifestSchema, manifestToStored } = await import('../distribution/manifest.js');
      const parsed = ManifestSchema.safeParse(body.manifest);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid manifest', code: 'INVALID_MANIFEST', details: parsed.error.issues });
        return;
      }
      const stored = manifestToStored(parsed.data);
      await db.updateDocument(DATABASE_ID, COL_LISTINGS, listingId, {
        distribution_kind: stored.kind,
        distribution_locator: JSON.stringify({
          bucket: stored.bucket, key: stored.key,
          repo: stored.repo, tag: stored.tag, asset: stored.asset,
        }),
        distribution_sha256: stored.sha256,
        distribution_filename: stored.filename || '',
        distribution_state: 'draft',
        distribution_ttl_sec: body.ttlSec || 3600,
        scan_status: 'idle',
        scan_sha256: '',
      });
      await writeAudit(wallet, 'agent_distribution_set', 'listing', listingId, {
        token: req.agent!.tokenPrefix, kind: stored.kind,
      });
      res.json({ data: { ok: true, state: 'draft' } });
    } catch (e) {
      logger.error('[agent] distribution set:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Distribution update failed', code: 'AGENT_DISTRIBUTION' });
    }
  },
);

router.post(
  '/listings/:id/distribution/verify',
  apiRequireAgentToken(['distribution:write']),
  async (req: Request, res: Response) => {
    try {
      const wallet = req.agent!.wallet;
      const listingId = str(req.params.id);
      const db = databases();
      const existing = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
      if ((existing['sellerWallet'] as string) !== wallet) {
        res.status(403).json({ error: 'Not your listing', code: 'NOT_OWNER' });
        return;
      }
      const kind = existing['distribution_kind'] as string;
      const locatorRaw = existing['distribution_locator'] as string;
      if (!kind || kind === 'none' || !locatorRaw) {
        res.status(400).json({ error: 'No manifest set', code: 'NO_MANIFEST' });
        return;
      }
      const { storedToManifest } = await import('../distribution/manifest.js');
      const { verifyManifest } = await import('../distribution/index.js');
      const locator = JSON.parse(locatorRaw) as Record<string, unknown>;
      const stored = {
        kind: kind as 'r2' | 'github',
        bucket: locator.bucket as string | undefined,
        key: locator.key as string | undefined,
        repo: locator.repo as string | undefined,
        tag: locator.tag as string | undefined,
        asset: locator.asset as string | undefined,
        sha256: (existing['distribution_sha256'] as string) || '',
        filename: existing['distribution_filename'] as string | undefined,
      };
      const manifest = storedToManifest(stored);
      const result = await verifyManifest(manifest, { sellerId: wallet });
      const newState = result.matches ? 'verified' : 'manifest_drift';
      await db.updateDocument(DATABASE_ID, COL_LISTINGS, listingId, {
        distribution_size: result.size,
        distribution_state: newState,
        distribution_verified_at: result.verifiedAt,
        distribution_health_status: 'ok',
        distribution_health_at: result.verifiedAt,
        ...(result.matches ? {} : { scan_status: 'idle', scan_sha256: '' }),
      });
      await writeAudit(wallet, 'agent_distribution_verify', 'listing', listingId, {
        token: req.agent!.tokenPrefix, matches: result.matches,
      });
      res.json({ data: { matches: result.matches, sha256: result.sha256, size: result.size, state: newState } });
    } catch (e) {
      logger.error('[agent] distribution verify:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Verification failed', code: 'AGENT_VERIFY' });
    }
  },
);

router.get('/orders', apiRequireAgentToken(['orders:read']), async (req: Request, res: Response) => {
  try {
    const wallet = req.agent!.wallet;
    const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500);
    const db = databases();
    const { documents: sellerListings } = await db.listDocuments(DATABASE_ID, COL_LISTINGS, [
      Query.equal('sellerWallet', wallet),
      Query.limit(500),
    ]);
    const listingIds = sellerListings.map((l) => l.$id);
    if (listingIds.length === 0) {
      res.json({ data: { orders: [] } });
      return;
    }
    const { documents: orders } = await db.listDocuments(DATABASE_ID, COL_ORDERS, [
      Query.equal('listingId', listingIds),
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
    ]);
    res.json({
      data: {
        orders: orders.map((o) => ({
          id: o.$id,
          listingId: o['listingId'],
          listingTitle: o['listingSnapshotTitle'] ?? null,
          buyerWallet: o['buyerWallet'],
          state: o['state'],
          amountRaw: o['amountRaw'],
          currency: o['currency'],
          memo: o['memo'],
          tonTxHash: o['tonTxHash'] || null,
          createdAt: o.$createdAt,
        })),
      },
    });
  } catch (e) {
    logger.error('[agent] orders list:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to fetch orders', code: 'AGENT_ORDERS' });
  }
});

export default router;
