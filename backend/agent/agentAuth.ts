/**
 * Express middleware for the public Agent API (`/api/v1/agent/*`).
 *
 * Auth model: Personal Access Token (PAT) issued by a verified seller.
 *   - Header: `Authorization: Bearer tfa_...` or `X-Agent-Token: tfa_...`
 *   - Token verified against sha256 stored in Appwrite (`agent_tokens`)
 *   - Token wallet must pass sanctions screening (HTTP 451 otherwise)
 *   - Token wallet must hold approved KYC (HTTP 403 otherwise)
 *   - Token must hold every required scope (HTTP 403 otherwise)
 *   - Per-token rate limit: AGENT_RATE_LIMIT requests / 15 min (default 600)
 *
 * The middleware decorates `req` with `agent` so route handlers can read
 * the issuing wallet without trusting any header.
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';
import { extractBearerToken } from '../middleware/auth.js';
import { verifyToken, type IssuedToken } from './tokenIssuer.js';
import {
  hasAllScopes,
  parseScopes,
  type AgentScope,
} from './scopes.js';
import { touchLastUsedAt, type AgentTokenRecord } from './tokenRepository.js';
import { screenWallet } from '../sanctions/screen.js';
import { requireSellerKyc } from '../commerce/handlers/requireSellerKyc.js';
import { findUserByTonAddress } from '../core/profileRepository.js';

declare module 'express-serve-static-core' {
  interface Request {
    agent?: {
      tokenId: string;
      wallet: string;
      scopes: AgentScope[];
      tokenPrefix: string;
    };
  }
}

const RATE_LIMIT = parseInt(process.env.AGENT_RATE_LIMIT || '600', 10) || 600;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_FAIL_LIMIT = 20;
const AUTH_FAIL_WINDOW_MS = 5 * 60 * 1000;

interface RateBucket {
  count: number;
  resetAt: number;
}
const rateBuckets = new Map<string, RateBucket>();
const authFailBuckets = new Map<string, RateBucket>();

function checkRate(tokenId: string): { allowed: boolean; resetAt: number; remaining: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(tokenId);
  if (!bucket || bucket.resetAt <= now) {
    const next = { count: 1, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(tokenId, next);
    return { allowed: true, resetAt: next.resetAt, remaining: RATE_LIMIT - 1 };
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= RATE_LIMIT,
    resetAt: bucket.resetAt,
    remaining: Math.max(0, RATE_LIMIT - bucket.count),
  };
}

/**
 * Cheap IP-based rate limit for **auth failures** — prevents brute-forcing
 * random tokens against the Appwrite DB. Only failures increment the counter;
 * successful auth never touches this bucket.
 */
function isAuthFailRateExceeded(ip: string): boolean {
  const now = Date.now();
  const bucket = authFailBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) return false;
  return bucket.count >= AUTH_FAIL_LIMIT;
}

function recordAuthFailure(ip: string): void {
  const now = Date.now();
  const bucket = authFailBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    authFailBuckets.set(ip, { count: 1, resetAt: now + AUTH_FAIL_WINDOW_MS });
    return;
  }
  bucket.count += 1;
}

function readToken(req: Request): string | null {
  // Header `X-Agent-Token` is the preferred channel; we fall back to the
  // standard Authorization header so existing HTTP libraries keep working.
  const explicit = req.get('x-agent-token');
  if (typeof explicit === 'string' && explicit.length > 0) return explicit.trim();
  return extractBearerToken(req as unknown as { get(name: string): string | string[] | undefined | null });
}

/**
 * @param required scopes the token must hold (after implication expansion).
 * @param opts.skipKyc when true, a valid token whose wallet has NOT yet passed
 *   KYC is still allowed through. Used only for the onboarding-facing read
 *   endpoints (`/instructions`, `/status`) so an unverified agent can learn how
 *   to get verified and track its own progress. Sanctions screening still
 *   applies — a sanctioned wallet is rejected regardless.
 */
export function apiRequireAgentToken(
  required: AgentScope[] = [],
  opts: { skipKyc?: boolean } = {},
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const clientIp = req.ip || 'unknown';
    if (isAuthFailRateExceeded(clientIp)) {
      res.status(429).json({
        success: false,
        message: 'Too many failed authentication attempts',
        code: 'AUTH_RATE_LIMITED',
      });
      return;
    }

    const token = readToken(req);
    if (!token) {
      recordAuthFailure(clientIp);
      res.status(401).json({ success: false, message: 'Agent token required', code: 'NO_AGENT_TOKEN' });
      return;
    }

    let record: AgentTokenRecord | null;
    try {
      record = await verifyToken(token);
    } catch (err) {
      logger.error('[agentAuth] verify failed:', err);
      recordAuthFailure(clientIp);
      res.status(500).json({ success: false, message: 'Token verification failed' });
      return;
    }
    if (!record) {
      recordAuthFailure(clientIp);
      res.status(401).json({ success: false, message: 'Invalid or expired token', code: 'BAD_AGENT_TOKEN' });
      return;
    }

    const granted = parseScopes(record.scopes);
    if (required.length > 0 && !hasAllScopes(granted, required)) {
      res.status(403).json({
        success: false,
        message: `Missing required scope: ${required.join(', ')}`,
        code: 'SCOPE_FORBIDDEN',
      });
      return;
    }

    // Defence in depth: a token issued before sanctions designation, or for
    // a wallet whose KYC was later revoked, must stop working immediately.
    const screen = screenWallet(record.wallet);
    if (!screen.ok) {
      res.status(451).json({
        success: false,
        message: 'Wallet is on a sanctions list and cannot transact.',
        code: screen.reason || 'SANCTIONED',
      });
      return;
    }

    // M-4: banning a user (is_active=false) is the documented single choke-point
    // for JWT requests, but agent tokens bypassed it entirely — a banned seller
    // kept full Agent API access until each token was individually revoked.
    // Resolve the token's wallet to its profile and reject deactivated accounts.
    // F3 fix: FAIL CLOSED. A lookup error must not grant access (a transient
    // Appwrite error previously let a banned wallet through). record.wallet is
    // now stored canonically (F2), so a found profile is authoritative.
    try {
      const profile = await findUserByTonAddress(record.wallet);
      if (profile && profile.isActive === false) {
        res.status(403).json({
          success: false,
          message: 'Account is deactivated.',
          code: 'ACCOUNT_DEACTIVATED',
        });
        return;
      }
    } catch (err) {
      logger.error('[agentAuth] is_active lookup failed — denying (fail-closed):', err instanceof Error ? err.message : err);
      res.status(503).json({
        success: false,
        message: 'Account status check unavailable, try again',
        code: 'STATUS_CHECK_FAILED',
      });
      return;
    }

    if (!opts.skipKyc) {
      const kyc = await requireSellerKyc(record.wallet);
      if (!kyc.ok) {
        res.status(kyc.status).json({ success: false, message: kyc.message, code: kyc.code });
        return;
      }
    }

    const rate = checkRate(record.$id);
    res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT));
    res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(rate.resetAt / 1000)));
    if (!rate.allowed) {
      res.status(429).json({
        success: false,
        message: `Rate limit exceeded (${RATE_LIMIT}/15min)`,
        code: 'RATE_LIMITED',
      });
      return;
    }

    req.agent = {
      tokenId: record.$id,
      wallet: record.wallet,
      scopes: granted,
      tokenPrefix: record.tokenPrefix,
    };

    // Best-effort lastUsedAt update; never block request on it.
    touchLastUsedAt(record.$id).catch((err) =>
      logger.debug('[agentAuth] touchLastUsedAt failed:', err),
    );

    next();
  };
}

/** Test seam: clear the in-memory rate-limit buckets between specs. */
export function __resetAgentRateLimitForTesting(): void {
  rateBuckets.clear();
  authFailBuckets.clear();
}

// Re-export so route modules can use the same scope identifiers.
export type { IssuedToken };
