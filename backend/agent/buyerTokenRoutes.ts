/**
 * Buyer agent token management — the HUMAN accountability gate for agentic
 * purchasing. Mounted under `/api/v1/commerce` (session JWT auth, NOT agent
 * token auth), beside the seller token routes.
 *
 * A buyer token is a normal `tfa_` PAT whose only scope is `orders:buy`,
 * bound to the wallet the AGENT pays from (typically a TON Agentic Wallet,
 * https://agents.ton.org/ — a contract wallet whose operator key the agent
 * holds and whose owner key the human keeps).
 *
 * Issuance pre-conditions (KYA: the human stays accountable):
 *   1. caller has a session and a ton_proof-bound wallet (profile.tonAddress)
 *   2. caller's profile passed Lite KYC (same gate human purchases use)
 *   3. neither the owner wallet nor the agent wallet is sanctioned
 *   4. the caller PROVABLY owns the agent wallet:
 *        - agentWallet == their own bound wallet, or
 *        - on-chain: the agentic wallet is a TEP-85 SBT whose get_nft_data
 *          owner equals the caller's bound wallet (verifyLicenseOwner is the
 *          existing generic TEP-64 owner check, reused).
 *      Without this, anyone could bind a stranger's wallet to a token and
 *      download the goods that wallet bought.
 *
 * `BUYER_AGENT_OWNERSHIP_CHECK=off` skips check 4 — testnet experiments only,
 * never production.
 */

import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Address } from '@ton/core';
import { logger } from '../logger.js';
import { apiRequireAuth, resolveProfile } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { str } from '../utils/params.js';
import { writeAudit } from '../commerce/audit.js';
import { addressesEqual } from '../commerce/tonVerify.js';
import { screenWallet } from '../sanctions/screen.js';
import { requireBuyerKycLite } from '../commerce/handlers/requireBuyerKycLite.js';
import { verifyLicenseOwner } from '../tonforge/onchain/verifyOwnership.js';
import { getAgentTokenById, revokeAgentToken, listAgentTokensForWallet } from './tokenRepository.js';
import { issueToken } from './tokenIssuer.js';
import { parseScopes } from './scopes.js';

const router = express.Router();
const limitMutate = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const issueBuyerSchema = z.object({
  agentWallet: z.string().min(1, 'agentWallet is required'),
  name: z.string().min(2).max(80),
  ttlDays: z.number().int().min(1).max(365).optional(),
});

function ownershipCheckEnabled(): boolean {
  return (process.env.BUYER_AGENT_OWNERSHIP_CHECK || 'strict').trim().toLowerCase() !== 'off';
}

/**
 * Prove the caller (ownerWallet, ton_proof-bound) controls agentWallet.
 * Trivially true for their own wallet; for an agentic (contract) wallet the
 * proof is the on-chain TEP-85 owner.
 */
export async function proveAgentWalletOwnership(
  agentWallet: string,
  ownerWallet: string,
): Promise<{ ok: true } | { ok: false; code: string; detail?: string }> {
  if (addressesEqual(agentWallet, ownerWallet)) return { ok: true };
  if (!ownershipCheckEnabled()) return { ok: true };
  const result = await verifyLicenseOwner(agentWallet, ownerWallet);
  if (result.ok) return { ok: true };
  return { ok: false, code: 'AGENT_WALLET_NOT_OWNED', detail: result.reason };
}

router.post(
  '/buyer-agent-tokens',
  apiRequireAuth(),
  limitMutate,
  validateBody(issueBuyerSchema),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as z.infer<typeof issueBuyerSchema>;
      const profile = await resolveProfile(req);
      if (!profile || !profile.tonAddress) {
        res.status(403).json({ error: 'Link and verify your wallet first', code: 'NO_WALLET' });
        return;
      }
      const ownerWallet = profile.tonAddress;

      // The accountable human must be purchase-eligible themselves.
      const kyc = await requireBuyerKycLite(ownerWallet);
      if (!kyc.ok) {
        res.status(kyc.status).json({ error: kyc.message, code: kyc.code });
        return;
      }

      let agentWallet: string;
      try {
        // Canonical form — agentAuth looks profiles up by EXACT string.
        agentWallet = Address.parse(body.agentWallet).toString({ bounceable: false });
      } catch {
        res.status(400).json({ error: 'agentWallet is not a valid TON address', code: 'BAD_ADDRESS' });
        return;
      }

      for (const wallet of [ownerWallet, agentWallet]) {
        const screen = screenWallet(wallet);
        if (!screen.ok) {
          res.status(451).json({
            error: 'Wallet is on a sanctions list and cannot transact.',
            code: screen.reason || 'SANCTIONED',
          });
          return;
        }
      }

      const owned = await proveAgentWalletOwnership(agentWallet, ownerWallet);
      if (!owned.ok) {
        res.status(403).json({
          error:
            'Could not verify you own this agent wallet. For a TON Agentic Wallet the ' +
            'on-chain owner must be your verified wallet; for a plain wallet, link it ' +
            'to your profile first.',
          code: owned.code,
          detail: owned.detail,
        });
        return;
      }

      const issued = await issueToken({
        wallet: agentWallet,
        name: body.name,
        scopes: ['orders:buy'],
        ttlDays: body.ttlDays ?? 90,
      });
      await writeAudit(ownerWallet, 'buyer_agent_token_issue', 'agent_token', issued.record.$id, {
        agentWallet,
        prefix: issued.record.tokenPrefix,
      });
      res.json({
        data: {
          token: issued.plaintext, // shown exactly once
          record: {
            id: issued.record.$id,
            agentWallet: issued.record.wallet,
            ownerWallet,
            name: issued.record.name,
            scopes: issued.record.scopes,
            tokenPrefix: issued.record.tokenPrefix,
            expiresAt: issued.record.expiresAt,
            createdAt: issued.record.$createdAt,
          },
        },
      });
    } catch (e) {
      logger.error('[buyer-agent-tokens] issue:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Token issue failed', code: 'BUYER_TOKEN_ISSUE' });
    }
  },
);

/**
 * List buyer tokens for an agent wallet. Buyer-token records are keyed by the
 * AGENT wallet (not the caller's), so a plain "my wallet" listing can't see
 * them — the caller names the agent wallet and re-proves ownership the same
 * way issuance did. Only `orders:buy` tokens are returned (when the agent
 * wallet IS the caller's own wallet, their seller tokens must not leak here).
 */
router.get('/buyer-agent-tokens', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const profile = await resolveProfile(req);
    if (!profile || !profile.tonAddress) {
      res.status(403).json({ error: 'Wallet not linked', code: 'NO_WALLET' });
      return;
    }
    const queryWallet = typeof req.query.agentWallet === 'string' ? req.query.agentWallet.trim() : '';
    const rawAgentWallet = queryWallet || profile.tonAddress;
    let agentWallet: string;
    try {
      agentWallet = Address.parse(rawAgentWallet).toString({ bounceable: false });
    } catch {
      res.status(400).json({ error: 'agentWallet is not a valid TON address', code: 'BAD_ADDRESS' });
      return;
    }
    const owned = await proveAgentWalletOwnership(agentWallet, profile.tonAddress);
    if (!owned.ok) {
      res.status(403).json({ error: 'Not your agent wallet', code: owned.code, detail: owned.detail });
      return;
    }
    const list = await listAgentTokensForWallet(agentWallet);
    const buyerTokens = list.filter((t) => parseScopes(t.scopes).includes('orders:buy'));
    res.json({
      data: {
        agentWallet,
        tokens: buyerTokens.map((t) => ({
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
    logger.error('[buyer-agent-tokens] list:', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'Failed to list tokens', code: 'BUYER_TOKEN_LIST' });
  }
});

/**
 * Revoke a buyer token. The record's wallet is the AGENT wallet (not the
 * caller's), so ownership is re-proved the same way it was at issuance.
 */
router.delete(
  '/buyer-agent-tokens/:id',
  apiRequireAuth(),
  limitMutate,
  async (req: Request, res: Response) => {
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
      const owned = await proveAgentWalletOwnership(record.wallet, profile.tonAddress);
      if (!owned.ok) {
        res.status(403).json({ error: 'Not your token', code: 'FORBIDDEN' });
        return;
      }
      if (record.revokedAt) {
        res.json({ data: { ok: true, alreadyRevoked: true } });
        return;
      }
      await revokeAgentToken(id);
      await writeAudit(profile.tonAddress, 'buyer_agent_token_revoke', 'agent_token', id, {});
      res.json({ data: { ok: true } });
    } catch (e) {
      logger.error('[buyer-agent-tokens] revoke:', e instanceof Error ? e.message : e);
      res.status(500).json({ error: 'Revoke failed', code: 'BUYER_TOKEN_REVOKE' });
    }
  },
);

export default router;
