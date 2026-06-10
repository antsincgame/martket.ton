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
import rateLimit from 'express-rate-limit';
import { databases, ID, Query } from '../commerce/appwrite.js';
import {
  DATABASE_ID,
  COL_LISTINGS,
  COL_LISTING_SECRETS,
  COL_ORDERS,
  COL_SELLER_PROFILES,
  CURRENCY,
  DEFAULT_PLATFORM_FEE_BPS,
  LISTING_STATUS,
} from '../commerce/constants.js';
import { tonHumanToNanoRaw } from '../commerce/money.js';
import { getTonUsdPrice, usdToTonHuman } from '../commerce/tonPriceOracle.js';
import { mapListingPublic, omitListingFields } from '../commerce/helpers.js';
import { asDoc } from '../domain/appwrite-helpers.js';
import { writeAudit } from '../commerce/audit.js';
import { logger } from '../logger.js';
import { str } from '../utils/params.js';
import { apiRequireAgentToken } from './agentAuth.js';
import { agentCreateListingSchema, patchListingSchema, agentSetStorageSchema } from '../commerce/validation.js';
import { validateBody } from '../middleware/validate.js';
import { getInstructionSections } from './instructions.js';
import { buildAgentStatus, buildOnboardingChecklist } from './status.js';
import { buildAssistantReply } from './assistant.js';
import { createProductSchema } from '../routes/validation.js';
import { insertProduct, productToSnakeCase } from '../core/repository.js';
import { findUserByTonAddress } from '../core/profileRepository.js';
import { generateId } from '../core/generateId.js';
import { rejectMismatchedCollection } from '../commerce/collectionBinding.js';
import { saveSellerStorage } from '../commerce/storageService.js';

const router = express.Router();

/**
 * Coarse per-IP backstop applied to every agent route. The primary, fine-grained
 * limit is per-token (600/15min) inside `apiRequireAgentToken`; this outer limiter
 * bounds abuse from a single IP before the token is even verified. Kept generous
 * so legitimate multi-agent egress IPs are not throttled by the per-token logic.
 */
const agentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(agentLimiter);

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

/**
 * Agent onboarding / operating manual. Readable before KYC (`skipKyc`) so a
 * brand-new agent can learn how to get verified. Returns the platform-authored
 * instruction sections plus a personalised onboarding checklist.
 */
router.get(
  '/instructions',
  apiRequireAgentToken(['instructions:read'], { skipKyc: true }),
  async (req: Request, res: Response) => {
    try {
      const [sections, onboarding] = await Promise.all([
        getInstructionSections(),
        buildOnboardingChecklist(req.agent!.wallet),
      ]);
      res.json({ data: { sections, onboarding } });
    } catch (e) {
      logger.error('[agent] instructions:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Failed to load instructions', code: 'AGENT_INSTRUCTIONS' });
    }
  },
);

/**
 * Single self-status feed: onboarding progress + listing/order/distribution
 * aggregates (counts only, no buyer PII). No read scope required and readable
 * before KYC so an onboarding agent can poll its own progress.
 */
router.get(
  '/status',
  apiRequireAgentToken([], { skipKyc: true }),
  async (req: Request, res: Response) => {
    try {
      const status = await buildAgentStatus(req.agent!.wallet);
      res.json({ data: status });
    } catch (e) {
      logger.error('[agent] status:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Failed to load status', code: 'AGENT_STATUS' });
    }
  },
);

/**
 * Onboarding assistant — MVP MOCKUP (no LLM). Grounded + deterministic: returns
 * the agent's current next action and cites the instruction section explaining
 * it, honestly flagged `assistant: "mockup"`. Readable before KYC (`skipKyc`) so
 * an onboarding agent can ask for help. The real grounded copilot (local LLM via
 * LM Studio) is a post-MVP activation.
 */
router.post(
  '/help',
  apiRequireAgentToken(['instructions:read'], { skipKyc: true }),
  async (req: Request, res: Response) => {
    try {
      const raw = (req.body as { question?: unknown })?.question;
      const question = typeof raw === 'string' ? raw.slice(0, 2000) : '';
      const [sections, onboarding] = await Promise.all([
        getInstructionSections(),
        buildOnboardingChecklist(req.agent!.wallet),
      ]);
      res.json({ data: buildAssistantReply(question, sections, onboarding) });
    } catch (e) {
      logger.error('[agent] help:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Assistant failed', code: 'AGENT_HELP' });
    }
  },
);

/**
 * Agent self-registration (B1, machine self-sovereignty). Creates the seller
 * profile for the TOKEN's wallet so a machine Demiurge can onboard itself up to
 * the human KYC gate. Safe: the wallet is the token's bound wallet (never the
 * body), this creates only a profile shell (no KYC, no funds, no minting key),
 * and it's idempotent. Mirrors the human POST /sellers/register with token auth.
 *
 * KYA-aligned (the 2026 "Know Your Agent" standard): the agent's token + scopes
 * are its scoped mandate; the accountable HUMAN owner still completes KYC and
 * remains liable — see the `kyc` instruction section. Readable before KYC.
 */
router.post(
  '/sellers/register',
  apiRequireAgentToken([], { skipKyc: true }),
  async (req: Request, res: Response) => {
    try {
      const wallet = req.agent!.wallet;
      const body = req.body as { displayName?: string; bio?: string };
      const displayName =
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim().slice(0, 120)
          : 'Agent Demiurge';
      const bio = typeof body.bio === 'string' ? body.bio.slice(0, 2000) : '';
      const db = databases();
      const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
        Query.equal('wallet', wallet),
        Query.limit(1),
      ]);
      if (documents[0]) {
        res.json({ data: { profile: documents[0], created: false } });
        return;
      }
      const doc = await db.createDocument(DATABASE_ID, COL_SELLER_PROFILES, ID.unique(), {
        wallet,
        displayName,
        bio,
      });
      await writeAudit(wallet, 'agent_seller_register', 'seller', doc.$id, {
        token: req.agent!.tokenPrefix,
        displayName,
      });
      res.json({ data: { profile: doc, created: true } });
    } catch (e) {
      logger.error('[agent] seller register:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Registration failed', code: 'AGENT_SELLER_REGISTER' });
    }
  },
);

/**
 * Agent BYOS storage config (B2). Connects the agent's own R2/S3/B2 bucket for
 * private distribution — wallet from the TOKEN (never the body), credentials
 * validated (HeadBucket) and stored AES-256-GCM-encrypted via the SAME
 * `saveSellerStorage` path as the human surface (DRY). Scope: distribution:write.
 */
router.post(
  '/storage',
  apiRequireAgentToken(['distribution:write']),
  validateBody(agentSetStorageSchema),
  async (req: Request, res: Response) => {
    try {
      const wallet = req.agent!.wallet;
      const body = req.body as {
        provider: 'cloudflare-r2' | 's3' | 'b2';
        accountId: string;
        bucket: string;
        endpoint?: string;
        accessKeyId: string;
        secretAccessKey: string;
        publicBaseUrl?: string;
      };
      const result = await saveSellerStorage(wallet, body, 'Agent Demiurge');
      if (!result.ok) {
        res.status(result.status).json(
          result.code === 'BUCKET_PROBE_FAILED'
            ? { error: 'Bucket probe failed', code: result.code, details: result.error }
            : { error: result.error || 'Storage save failed', code: result.code },
        );
        return;
      }
      await writeAudit(wallet, 'agent_storage_set', 'seller', result.docId, {
        token: req.agent!.tokenPrefix,
        provider: body.provider,
        bucket: body.bucket,
      });
      res.json({ data: result.data });
    } catch (e) {
      logger.error('[agent] storage:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Storage save failed', code: 'AGENT_STORAGE' });
    }
  },
);

/**
 * Create a catalog product as a DRAFT. The draft enters the same moderation +
 * antivirus pipeline as a human-created product and stays unpublished until a
 * moderator approves it — this is the platform's verification of agent-originated
 * inventory. The product's creator is the catalog profile linked to the token's
 * wallet (resolved here, never trusted from the body). Requires KYC (middleware).
 */
router.post(
  '/products',
  apiRequireAgentToken(['products:write']),
  validateBody(createProductSchema),
  async (req: Request, res: Response) => {
    try {
      const wallet = req.agent!.wallet;
      const creator = await findUserByTonAddress(wallet);
      if (!creator) {
        res.status(409).json({
          error: 'No catalog profile is linked to this wallet. Register as a seller first.',
          code: 'NO_CREATOR_PROFILE',
        });
        return;
      }
      const body = req.body as {
        name: string;
        description?: string | null;
        short_description?: string | null;
        price_usd?: number;
        category?: string;
        image?: string | null;
        version?: string;
      };
      const id = generateId();
      const product = await insertProduct({
        id,
        creator_id: creator.id,
        name: body.name,
        description: body.description ?? null,
        short_description: body.short_description ?? null,
        price_usd: body.price_usd ?? 0,
        category: body.category ?? 'other',
        image: body.image ?? null,
        version: body.version ?? '1.0.0',
        status: 'draft',
      });
      await writeAudit(wallet, 'agent_product_create', 'product', id, {
        token: req.agent!.tokenPrefix,
        name: body.name,
      });
      res.json({ data: { product: product ? productToSnakeCase(product) : null } });
    } catch (e) {
      logger.error('[agent] product create:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Product creation failed', code: 'AGENT_PRODUCT_CREATE' });
    }
  },
);

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
  validateBody(agentCreateListingSchema),
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
      if (await rejectMismatchedCollection(req, res, wallet, collectionAddress)) return;

      // Platform fee is platform policy — clamp up to the configured minimum so
      // an agent can't set platformFeeBps:0 and pay zero commission.
      const feeBps = Math.max(Number(platformFeeBps) || DEFAULT_PLATFORM_FEE_BPS, DEFAULT_PLATFORM_FEE_BPS);

      const tonRate = await getTonUsdPrice();
      const tonHuman = usdToTonHuman(Number(priceUsd), tonRate);
      const priceAmountRaw = tonHumanToNanoRaw(tonHuman);
      const decimals = 9;

      const listing = await databases().createDocument(DATABASE_ID, COL_LISTINGS, ID.unique(), omitListingFields({
        sellerWallet: wallet,
        catalogProductId,
        title,
        description,
        currency: CURRENCY.TON,
        priceAmountRaw,
        priceUsd: String(priceUsd),
        decimals,
        platformFeeBps: feeBps,
        status: LISTING_STATUS.ACTIVE,
        deliveryType,
        assetFileId: '',
        collection_address: collectionAddress,
      }));
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
        if (await rejectMismatchedCollection(req, res, wallet, body.collectionAddress)) return;
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
