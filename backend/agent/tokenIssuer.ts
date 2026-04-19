/**
 * Issue / hash / verify Agent API Personal Access Tokens.
 *
 * Token format: `tfa_<43 base64url chars of 32 random bytes>` (~47 chars total).
 * The `tfa_` prefix lets users (and our log filters) identify a TonForge agent
 * token at a glance without leaking which scopes or wallet it belongs to.
 *
 * Storage: only sha256(plaintext) lands in Appwrite. The plaintext is shown
 * to the user once on issue, never logged, never persisted. Verification is
 * a constant-time compare against the stored hash to thwart timing attacks.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  createAgentToken,
  findAgentTokenByHash,
  type AgentTokenRecord,
} from './tokenRepository.js';
import { serializeScopes, type AgentScope } from './scopes.js';

export const TOKEN_PREFIX = 'tfa_';
const RAW_LENGTH = 32;
const PREFIX_VISIBLE = 8; // chars of the random portion exposed in tokenPrefix

export interface IssueTokenInput {
  wallet: string;
  name: string;
  scopes: AgentScope[];
  /** Days until expiration. Default 90, max 365. `null` to disable expiry. */
  ttlDays?: number | null;
}

export interface IssuedToken {
  /** Returned to the user exactly once; never persisted, never logged. */
  plaintext: string;
  record: AgentTokenRecord;
}

export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

export function tokenPrefix(plaintext: string): string {
  // tfa_ABCD12... — keep the visible prefix short so it doesn't accidentally
  // become a brute-force surface (only 8 chars shown).
  return plaintext.slice(0, TOKEN_PREFIX.length + PREFIX_VISIBLE);
}

/** Constant-time equality of two hex digests. Returns false for length mismatch. */
export function constantTimeHashEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

export async function issueToken(input: IssueTokenInput): Promise<IssuedToken> {
  if (!input.wallet) throw new Error('WALLET_REQUIRED');
  if (!input.name || input.name.trim().length < 2) throw new Error('NAME_TOO_SHORT');
  if (!input.scopes || input.scopes.length === 0) throw new Error('SCOPES_REQUIRED');

  const ttlDays = input.ttlDays === null ? null : Math.min(365, Math.max(1, input.ttlDays ?? 90));
  const expiresAt =
    ttlDays === null ? null : new Date(Date.now() + ttlDays * 86_400_000).toISOString();

  const random = randomBytes(RAW_LENGTH).toString('base64url');
  const plaintext = `${TOKEN_PREFIX}${random}`;
  const record = await createAgentToken({
    wallet: input.wallet,
    tokenHash: hashToken(plaintext),
    tokenPrefix: tokenPrefix(plaintext),
    name: input.name.trim(),
    scopes: serializeScopes(input.scopes),
    expiresAt,
  });

  return { plaintext, record };
}

/**
 * Look up a token by its plaintext. Returns the record if it exists, is
 * not revoked, and is not past its expiry. The lookup itself is hash-based
 * (no plaintext indexing); the additional state checks happen in memory.
 */
export async function verifyToken(plaintext: string): Promise<AgentTokenRecord | null> {
  if (!plaintext || !plaintext.startsWith(TOKEN_PREFIX)) return null;
  const expectedHash = hashToken(plaintext);
  const record = await findAgentTokenByHash(expectedHash);
  if (!record) return null;
  // Defence in depth — Appwrite returned a record whose hash equals the one
  // we queried for, but we re-check via constant time to make any oracle
  // side-channel uniform.
  if (!constantTimeHashEqual(record.tokenHash, expectedHash)) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) return null;
  return record;
}
