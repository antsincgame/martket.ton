import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { DATABASE_ID, COL_ORDERS, COL_AUDIT } from './constants.js';
import { databases, Query } from './appwrite.js';
import { writeAudit } from './audit.js';
import { logger } from '../logger.js';
import { CURRENCY } from './constants.js';
import { DEFAULT_PLATFORM_FEE_BPS } from './constants.js';
import { commerceAdmin } from './helpers.js';
import { resolveNetwork } from '../config/network.js';
import { validateBody } from '../middleware/validate.js';
import { orderStateSchema, agentInstructionSchema, provisionCollectionSchema } from './validation.js';
import { str } from '../utils/params.js';
import { listInstructionsForAdmin, upsertInstruction } from '../agent/instructions.js';
import { provisionSellerCollection, ProvisionConfigError } from './collectionProvisioner.js';
import { findSellerCollection } from './sellerCollectionRepository.js';
import { amlStatus } from '../aml/amlbot.js';
import type { TonNetwork } from '../config/network.js';

/**
 * AML / sanctions provider registry. Only AMLBot is wired today; the rest are a
 * MOCKUP for the admin console — the provider is not finalised, so the panel
 * surfaces the candidate set and the live config without committing to one.
 */
const AML_PROVIDERS = [
  { id: 'amlbot', name: 'AMLBot', wired: true, note: 'TON wallet risk scoring (active)' },
  { id: 'chainalysis', name: 'Chainalysis', wired: false, note: 'Under evaluation' },
  { id: 'elliptic', name: 'Elliptic', wired: false, note: 'Under evaluation' },
  { id: 'trm', name: 'TRM Labs', wired: false, note: 'Under evaluation' },
] as const;

const router = express.Router();

// Bound abuse of the secret-gated admin surface — also slows any attempt to
// brute-force COMMERCE_ADMIN_SECRET (which the constant-time compare in
// commerceAdmin further hardens). Scoped to /admin so the public /config below
// is unaffected.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use('/admin', adminLimiter);

router.get('/config', (_req: Request, res: Response) => {
  const treasury = process.env.TREASURY_WALLET_ADDRESS || '';
  res.json({
    data: {
      treasuryAddress: treasury,
      platformFeeBpsDefault: DEFAULT_PLATFORM_FEE_BPS,
      currencyTon: CURRENCY.TON,
      // M-14: expose the server's pinned TON network so the frontend can match
      // it instead of defaulting to mainnet — otherwise the UI renders mainnet
      // explorer links / address forms for testnet escrows (and vice versa).
      network: resolveNetwork(),
    },
  });
});

// AML / compliance config for the admin console (mockup-aware). Read-only:
// reflects the live env-driven AML status plus the candidate provider registry.
router.get('/admin/aml-config', commerceAdmin, (_req: Request, res: Response) => {
  const status = amlStatus();
  res.json({
    data: {
      status,
      activeProvider: status.enabled ? 'amlbot' : 'none',
      providers: AML_PROVIDERS,
      gate: {
        failOpen: true,
        blocksAtOrAbove: status.threshold,
        note: 'Fail-open: provider/network errors never block a trade; only a confirmed high-risk verdict (score ≥ threshold) does. Sanctions screening is separate and always enforced.',
      },
    },
  });
});

router.get('/admin/orders', commerceAdmin, async (_req: Request, res: Response) => {
  try {
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_ORDERS, [
      Query.orderDesc('$createdAt'), Query.limit(200),
    ]);
    res.json({ data: { orders: documents } });
  } catch (e: unknown) {
    logger.error('[commerce] admin orders:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to fetch orders', code: 'ADMIN_ORDERS' });
  }
});

router.get('/admin/audit', commerceAdmin, async (_req: Request, res: Response) => {
  try {
    const db = databases();
    const { documents } = await db.listDocuments(DATABASE_ID, COL_AUDIT, [
      Query.orderDesc('$createdAt'), Query.limit(200),
    ]);
    res.json({ data: { logs: documents } });
  } catch (e: unknown) {
    logger.error('[commerce] admin audit:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to fetch audit log', code: 'ADMIN_AUDIT' });
  }
});

router.post('/admin/orders/:id/state', commerceAdmin, validateBody(orderStateSchema), async (req: Request, res: Response) => {
  try {
    const orderId = str(req.params.id);
    const { state } = req.body as { state: string };
    const db = databases();
    await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, { state });
    await writeAudit('admin', 'order_state', 'order', orderId, { state });
    res.json({ data: { ok: true, orderId, state } });
  } catch (e: unknown) {
    logger.error('[commerce] admin order state:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Order state update failed', code: 'ORDER_STATE' });
  }
});

// ── Agent instructions channel ─────────────────────────────────────
// The machine-facing onboarding/operating manual served to agents at
// GET /api/v1/agent/instructions. Defaults live in code; these endpoints let an
// admin override or extend any section (stored in Appwrite `agent_instructions`).

router.get('/admin/agent-instructions', commerceAdmin, async (_req: Request, res: Response) => {
  try {
    const sections = await listInstructionsForAdmin();
    res.json({ data: { sections } });
  } catch (e: unknown) {
    logger.error('[commerce] admin agent-instructions list:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to load instructions', code: 'AGENT_INSTRUCTIONS_LIST' });
  }
});

router.put(
  '/admin/agent-instructions/:section',
  commerceAdmin,
  validateBody(agentInstructionSchema),
  async (req: Request, res: Response) => {
    try {
      const section = str(req.params.section);
      if (!/^[a-z0-9_]{2,64}$/.test(section)) {
        res.status(400).json({ error: 'Invalid section key', code: 'BAD_SECTION' });
        return;
      }
      const body = req.body as { title: string; body: string; order?: number; active?: boolean };
      const saved = await upsertInstruction(section, body);
      await writeAudit('admin', 'agent_instruction_upsert', 'agent_instruction', section, {
        order: saved.order,
        active: saved.active,
      });
      res.json({ data: { section: saved } });
    } catch (e: unknown) {
      logger.error('[commerce] admin agent-instructions upsert:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Failed to save instruction', code: 'AGENT_INSTRUCTION_SAVE' });
    }
  },
);

// ── Per-seller collection provisioning (Phase 1) ───────────────────
// Deploys a platform-owned AppCollection for a seller (idempotent). The seller
// then attaches the returned address to their listings via the existing flow.

router.get('/admin/seller-collections/:wallet/:network', commerceAdmin, async (req: Request, res: Response) => {
  try {
    const wallet = str(req.params.wallet);
    const network = str(req.params.network) as TonNetwork;
    const record = await findSellerCollection(wallet, network);
    res.json({ data: { collection: record } });
  } catch (e: unknown) {
    logger.error('[commerce] admin seller-collection get:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Lookup failed', code: 'SELLER_COLLECTION_GET' });
  }
});

router.post(
  '/admin/seller-collections/provision',
  commerceAdmin,
  validateBody(provisionCollectionSchema),
  async (req: Request, res: Response) => {
    const { sellerWallet, network } = req.body as { sellerWallet: string; network: TonNetwork };
    try {
      const result = await provisionSellerCollection(sellerWallet, network);
      await writeAudit('admin', 'seller_collection_provision', 'seller_collection', sellerWallet, {
        network,
        collectionAddress: result.collectionAddress,
        alreadyDeployed: result.alreadyDeployed,
      });
      res.json({ data: result });
    } catch (e: unknown) {
      if (e instanceof ProvisionConfigError) {
        res.status(503).json({ error: e.message, code: e.code });
        return;
      }
      logger.error('[commerce] admin seller-collection provision:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Provisioning failed', code: 'SELLER_COLLECTION_PROVISION' });
    }
  },
);

export default router;
