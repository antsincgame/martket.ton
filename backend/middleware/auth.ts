import type { Request, Response, NextFunction } from 'express';
import { Account, type Models } from 'node-appwrite';
import { logger } from '../logger.js';
import * as repo from '../core/repository.js';
import { createUserContextClient } from '../core/appwriteServer.js';
import type { Profile } from '../domain/types.js';

declare module 'express-serve-static-core' {
  interface Request {
    profile?: Profile;
  }
}

/**
 * Per-process cache of validated Appwrite JWTs.
 *
 * Appwrite JWTs are short-lived (~15 minutes). We avoid hitting the Appwrite
 * Account API on every backend request by caching the resolved user for a
 * short window. The cache key is the raw token, which is unique per session.
 *
 * Soft TTL: cache entries expire faster than the JWT itself so a deactivated
 * user is locked out within 30 seconds at the latest.
 */
const TOKEN_CACHE_TTL_MS = 30_000;
const TOKEN_CACHE_MAX = 1000;
type CachedUser = Models.User<Models.Preferences>;
const tokenCache = new Map<string, { user: CachedUser; expiresAt: number }>();

function pruneTokenCache(now: number): void {
  for (const [token, entry] of tokenCache) {
    if (entry.expiresAt <= now) tokenCache.delete(token);
  }
  if (tokenCache.size > TOKEN_CACHE_MAX) {
    // Drop oldest by deletion order (Map preserves insertion order).
    const overflow = tokenCache.size - TOKEN_CACHE_MAX;
    let i = 0;
    for (const key of tokenCache.keys()) {
      if (i++ >= overflow) break;
      tokenCache.delete(key);
    }
  }
}

/**
 * Minimal request shape needed to read the Authorization header.
 * Defining a local interface lets unit tests pass plain objects without
 * fighting Express's overloaded Request.get() return types.
 */
export interface HasGet {
  get(name: string): string | string[] | undefined | null;
}

/**
 * Extracts the raw Appwrite JWT from a Bearer Authorization header.
 *
 * Returns null when the header is missing, blank, doesn't follow the
 * `Bearer <token>` shape, or wraps an empty token string.
 *
 * Exported for unit tests; production callers go through resolveProfile().
 */
export function extractBearerToken(req: HasGet): string | null {
  const raw = req.get('authorization') ?? req.get('Authorization');
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m && m[1] ? m[1].trim() : null;
}

/**
 * Validates an Appwrite session JWT and returns the underlying account.
 *
 * Returns null on any failure (missing/invalid/expired token, network error).
 * Auth-failure and audit logs are kept at debug level and never include the
 * user's email or any fragment of the token (PII / token material must not
 * leak into server logs).
 */
async function resolveAppwriteUser(token: string): Promise<CachedUser | null> {
  const now = Date.now();
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > now) {
    logger.debug(`[auth] resolveAppwriteUser — cache hit user=${cached.user.$id}`);
    return cached.user;
  }
  try {
    logger.debug('[auth] resolveAppwriteUser — verifying JWT with Appwrite');
    const client = createUserContextClient(token);
    const user = await new Account(client).get();
    logger.debug(`[auth] resolveAppwriteUser — JWT valid user=${user.$id}`);
    tokenCache.set(token, { user, expiresAt: now + TOKEN_CACHE_TTL_MS });
    pruneTokenCache(now);
    return user;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[auth] resolveAppwriteUser — JWT rejected: ${msg.slice(0, 200)}`);
    return null;
  }
}

/**
 * Resolves the backend profile for the currently authenticated Appwrite user.
 *
 * Returns null if:
 *   - the request has no Bearer token
 *   - the token is invalid / expired
 *   - no profile exists for that Appwrite user id (auto-creates on first hit
 *     using upsertProfileForAppwriteUser with role=demiurge)
 *   - the profile has been deactivated (`is_active = false`)
 *
 * Deactivation check is the single choke-point for banning a user: setting
 * `is_active = false` in Appwrite makes every authenticated endpoint see
 * the caller as anonymous.
 */
export async function resolveProfile(req: Request): Promise<Profile | null> {
  const token = extractBearerToken(req);
  if (!token) return null;
  const user = await resolveAppwriteUser(token);
  if (!user) return null;

  let profile = await repo.findUserByAppwriteId(user.$id);
  if (!profile) {
    // Lazy upsert on first authenticated request — mirrors what a webhook
    // would have done. New profiles get the default `demiurge` role.
    profile = await repo.upsertProfileForAppwriteUser(user.$id, {
      email: user.email || null,
      emailVerified: user.emailVerification === true,
      name: user.name || (user.email ? user.email.split('@')[0] : 'Demiurge'),
      role: 'demiurge',
    });
    if (!profile) {
      logger.error(`[appwrite-auth] failed to upsert profile for ${user.$id}`);
      return null;
    }
  }
  if (profile.isActive === false) {
    logger.warn(`[appwrite-auth] blocked deactivated profile ${profile.id} (appwrite=${user.$id})`);
    return null;
  }
  return profile;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  resolveProfile(req)
    .then((profile) => {
      if (!profile || !isAdminRole(profile.role)) {
        res.status(403).json({ success: false, message: 'Admin access required' });
        return;
      }
      req.profile = profile;
      next();
    })
    .catch((err: Error) => {
      logger.error('requireAdmin error:', err.message);
      res.status(500).json({ success: false, message: 'Internal error' });
    });
}

export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function isModeratorRole(role: string): boolean {
  return role === 'moderator' || role === 'admin' || role === 'super_admin';
}

export function requireModerator(req: Request, res: Response, next: NextFunction): void {
  resolveProfile(req)
    .then((profile) => {
      if (!profile || !isModeratorRole(profile.role)) {
        res.status(403).json({ success: false, message: 'Moderator access required' });
        return;
      }
      req.profile = profile;
      next();
    })
    .catch((err: Error) => {
      logger.error('requireModerator error:', err.message);
      res.status(500).json({ success: false, message: 'Internal error' });
    });
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  resolveProfile(req)
    .then((profile) => {
      if (!profile || profile.role !== 'super_admin') {
        res.status(403).json({ success: false, message: 'Super admin access required' });
        return;
      }
      req.profile = profile;
      next();
    })
    .catch((err: Error) => {
      logger.error('requireSuperAdmin error:', err.message);
      res.status(500).json({ success: false, message: 'Internal error' });
    });
}

/**
 * Lightweight gate that only verifies the presence + validity of an Appwrite
 * session JWT. Use it for routes that don't need the full Profile lookup.
 */
export function apiRequireAuth() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = extractBearerToken(req);
    if (!token) {
      logger.debug(`[auth] apiRequireAuth — no Bearer token on ${req.method} ${req.path}`);
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    logger.debug(`[auth] apiRequireAuth — validating token for ${req.method} ${req.path}`);
    resolveAppwriteUser(token)
      .then((user) => {
        if (!user) {
          logger.debug(`[auth] apiRequireAuth — 401 on ${req.method} ${req.path} (token invalid)`);
          res.status(401).json({ success: false, message: 'Authentication failed' });
          return;
        }
        logger.debug(`[auth] apiRequireAuth — OK user=${user.$id} for ${req.method} ${req.path}`);
        next();
      })
      .catch((err: Error) => {
        logger.error(`[auth] apiRequireAuth error on ${req.method} ${req.path}:`, err.message);
        res.status(401).json({ success: false, message: 'Authentication failed' });
      });
  };
}

/** Test-only helper: clears the in-memory JWT cache between specs. */
export function __resetAuthCacheForTesting(): void {
  tokenCache.clear();
}
