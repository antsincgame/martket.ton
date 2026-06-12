/**
 * Token management routes for sellers — issue / list / revoke their own
 * Personal Access Tokens. Mounted under `/api/v1/commerce/agent-tokens`,
 * authenticated by the standard user session JWT (NOT the agent token).
 *
 * Pre-conditions for issuing a token:
 *   - the caller's profile owns the wallet
 *   - the wallet is not on a sanctions list
 *   - the wallet has approved KYC
 *
 * The plaintext value of a freshly issued token is returned exactly once.
 */

import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { logger } from '../logger.js';
import { apiRequireAuth, resolveProfile } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { str } from '../utils/params.js';
import { writeAudit } from '../commerce/audit.js';
import { requireWalletOwner } from '../commerce/helpers.js';
import { requireSellerKyc } from '../commerce/handlers/requireSellerKyc.js';
import {
  getAgentTokenById,
  listAgentTokensForWallet,
  revokeAgentToken,
} from './tokenRepository.js';
import { issueToken } from './tokenIssuer.js';
import { SELLER_GRANTABLE_SCOPES, type AgentScope } from './scopes.js';

const router = express.Router();
const limitMutate = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const issueSchema = z.object({
  wallet: z.string().min(1),
  name: z.string().min(2).max(80),
  // Sellers cannot grant the buyer capability here — that goes through the
  // buyer-token route with its own KYC + wallet-ownership gates.
  scopes: z
    .array(z.enum(SELLER_GRANTABLE_SCOPES as unknown as [AgentScope, ...AgentScope[]]))
    .min(1, 'At least one scope is required'),
  ttlDays: z.number().int().min(1).max(365).optional(),
});

router.post(
  '/agent-tokens',
  apiRequireAuth(),
  limitMutate,
  validateBody(issueSchema),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as z.infer<typeof issueSchema>;
      const owner = await requireWalletOwner(req, res, body.wallet);
      if (!owner) return;
      const kyc = await requireSellerKyc(body.wallet);
      if (!kyc.ok) {
        res.status(kyc.status).json({ error: kyc.message, code: kyc.code });
        return;
      }
      // F2 fix: store the wallet in the SAME canonical form the profile uses
      // (owner.tonAddress), not the client-supplied string. TON addresses have
      // several valid encodings; requireWalletOwner accepts any via normalized
      // comparison, but the agentAuth ban-check (M-4) does an EXACT-string
      // findUserByTonAddress(record.wallet) — a non-canonical encoding would
      // miss the profile and silently skip the deactivation check.
      const canonicalWallet = owner.tonAddress ?? body.wallet;
      const issued = await issueToken({
        wallet: canonicalWallet,
        name: body.name,
        scopes: body.scopes as AgentScope[],
        ttlDays: body.ttlDays ?? 90,
      });
      await writeAudit(body.wallet, 'agent_token_issue', 'agent_token', issued.record.$id, {
        scopes: issued.record.scopes,
        prefix: issued.record.tokenPrefix,
      });
      res.json({
        data: {
          token: issued.plaintext, // shown to the user exactly once
          record: {
            id: issued.record.$id,
            wallet: issued.record.wallet,
            name: issued.record.name,
            scopes: issued.record.scopes,
            tokenPrefix: issued.record.tokenPrefix,
            expiresAt: issued.record.expiresAt,
            createdAt: issued.record.$createdAt,
          },
        },
      });
    } catch (e) {
      logger.error('[agent-tokens] issue:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Token issue failed', code: 'AGENT_TOKEN_ISSUE' });
    }
  },
);

router.get('/agent-tokens', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const profile = await resolveProfile(req);
    if (!profile || !profile.tonAddress) {
      res.status(403).json({ error: 'Wallet not linked', code: 'NO_WALLET' });
      return;
    }
    const list = await listAgentTokensForWallet(profile.tonAddress);
    res.json({
      data: {
        tokens: list.map((t) => ({
          id: t.$id,
          name: t.name,
          scopes: t.scopes,
          tokenPrefix: t.tokenPrefix,
          createdAt: t.$createdAt,
          lastUsedAt: t.lastUsedAt,
          expiresAt: t.expiresAt,
          revokedAt: t.revokedAt,
        })),
      },
    });
  } catch (e) {
    logger.error('[agent-tokens] list:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to list tokens', code: 'AGENT_TOKEN_LIST' });
  }
});

router.delete('/agent-tokens/:id', apiRequireAuth(), limitMutate, async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id);
    const profile = await resolveProfile(req);
    if (!profile || !profile.tonAddress) {
      res.status(403).json({ error: 'Wallet not linked', code: 'NO_WALLET' });
      return;
    }
    const record = await getAgentTokenById(id);
    if (!record) {
      res.status(404).json({ error: 'Token not found', code: 'NOT_FOUND' });
      return;
    }
    const { addressesEqual } = await import('../commerce/tonVerify.js');
    if (!addressesEqual(record.wallet, profile.tonAddress)) {
      res.status(403).json({ error: 'Not your token', code: 'FORBIDDEN' });
      return;
    }
    if (record.revokedAt) {
      res.json({ data: { ok: true, alreadyRevoked: true } });
      return;
    }
    await revokeAgentToken(id);
    await writeAudit(profile.tonAddress, 'agent_token_revoke', 'agent_token', id, {});
    res.json({ data: { ok: true } });
  } catch (e) {
    logger.error('[agent-tokens] revoke:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Revoke failed', code: 'AGENT_TOKEN_REVOKE' });
  }
});

export default router;
