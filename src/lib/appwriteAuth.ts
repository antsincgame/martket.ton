/**
 * Appwrite Account auth helpers.
 *
 * Wraps the browser Appwrite SDK so the rest of the app sees a small,
 * stable surface: send OTP code to email, verify OTP, start GitHub OAuth,
 * read current user, mint short-lived JWT for backend calls, log out.
 *
 * JWT is cached in module scope to avoid hammering Appwrite on every
 * `getJwt()` call. Appwrite JWTs live ~15 minutes; we refresh after 12.
 */

import { OAuthProvider, type Models } from 'appwrite';
import { appwriteAccount, isAppwriteConfigured } from './appwriteClient';
import { logger } from './logger';

export type AppwriteUser = Models.User<Models.Preferences>;

const JWT_TTL_MS = 12 * 60 * 1000;

let cachedJwt: { token: string; expiresAt: number } | null = null;

function ensureClient(): NonNullable<typeof appwriteAccount> {
  if (!isAppwriteConfigured || !appwriteAccount) {
    throw new Error('Appwrite is not configured (VITE_APPWRITE_ENDPOINT / VITE_APPWRITE_PROJECT_ID missing)');
  }
  return appwriteAccount;
}

function buildCallbackUrl(): string {
  const origin =
    (typeof window !== 'undefined' && window.location && window.location.origin) ||
    import.meta.env.VITE_APP_ORIGIN ||
    '';
  return `${origin.replace(/\/+$/, '')}/auth/callback`;
}

/**
 * Sends a one-time password (6-digit code) to the user's email via
 * Appwrite's `createEmailToken`. Returns the userId needed for the
 * subsequent `verifyEmailOtp` call.
 */
export async function sendEmailOtp(email: string): Promise<{ userId: string }> {
  const account = ensureClient();
  const trimmed = email.trim();
  if (!trimmed) throw new Error('email is required');
  const token = await account.createEmailToken('unique()', trimmed);
  return { userId: token.userId };
}

/**
 * Verifies the OTP code the user received by email.
 * Exchanges userId + secret (the 6-digit code) for an Appwrite session.
 */
export async function verifyEmailOtp(userId: string, otp: string): Promise<void> {
  const account = ensureClient();
  if (!userId || !otp) throw new Error('userId and otp are required');
  await account.createSession(userId, otp);
  cachedJwt = null;
}

/**
 * Completes an OAuth callback by exchanging userId+secret for a session.
 */
export async function completeOAuthCallback(userId: string, secret: string): Promise<void> {
  const account = ensureClient();
  if (!userId || !secret) throw new Error('userId and secret are required');
  await account.createSession(userId, secret);
  cachedJwt = null;
}

/**
 * Kicks off GitHub OAuth. Appwrite redirects the browser to GitHub; on
 * success the user lands back at `/auth/callback?userId=&secret=`.
 *
 * Drops any existing session first — Appwrite throws
 * "Creation of a session is prohibited when a session is active"
 * if we try to create a new OAuth token over an active session.
 */
export async function startGithubOAuth(): Promise<void> {
  const account = ensureClient();
  try {
    await account.deleteSession('current');
    cachedJwt = null;
  } catch {
    // No active session — that's fine, proceed.
  }
  const callback = buildCallbackUrl();
  account.createOAuth2Token(OAuthProvider.Github, callback, callback);
}

/**
 * Returns the currently authenticated Appwrite user, or null if no session.
 */
export async function getCurrentUser(): Promise<AppwriteUser | null> {
  if (!isAppwriteConfigured || !appwriteAccount) return null;
  try {
    return await appwriteAccount.get();
  } catch {
    return null;
  }
}

/**
 * Returns a short-lived JWT for the current session. Cached for ~12 minutes.
 * Returns null if the user is signed out or Appwrite isn't configured.
 */
export async function getJwt(): Promise<string | null> {
  if (!isAppwriteConfigured || !appwriteAccount) return null;
  const now = Date.now();
  if (cachedJwt && cachedJwt.expiresAt > now) return cachedJwt.token;
  try {
    const { jwt } = await appwriteAccount.createJWT();
    cachedJwt = { token: jwt, expiresAt: now + JWT_TTL_MS };
    return jwt;
  } catch (err: unknown) {
    logger.warn('[appwriteAuth] createJWT failed:', err instanceof Error ? err.message : err);
    cachedJwt = null;
    return null;
  }
}

/**
 * Drops the current Appwrite session and clears the JWT cache.
 */
export async function logout(): Promise<void> {
  cachedJwt = null;
  if (!isAppwriteConfigured || !appwriteAccount) return;
  try {
    await appwriteAccount.deleteSession('current');
  } catch (err: unknown) {
    logger.warn('[appwriteAuth] deleteSession failed:', err instanceof Error ? err.message : err);
  }
}

/** Test-only helper: clears the in-memory JWT cache between specs. */
export function __resetJwtCacheForTesting(): void {
  cachedJwt = null;
}
