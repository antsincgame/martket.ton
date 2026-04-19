/**
 * Distributed advisory lock backed by Appwrite documents.
 *
 * Uses the `worker_locks` collection (unique index on `lockKey`) as a
 * cluster-wide mutex. Pattern:
 *
 *   const release = await acquireLock('mint-cycle', 60_000);
 *   if (!release) return;          // someone else holds it
 *   try { await work(); }
 *   finally { await release(); }   // always release
 *
 * Why this matters: the mint/refund/payout worker is run from `startMintWorker`
 * inside the API process. If the API is scaled horizontally (Render free tier
 * may already restart you across regions), every replica would tick at once and
 * race on the same license — broadcasting duplicate OracleRefund or
 * TimeoutRelease transactions and burning oracle gas.
 *
 * Failure mode: any error in acquire/release MUST be non-fatal — the worker
 * gracefully skips the cycle and the next tick re-tries. We never hold a
 * lock forever: every lock has a TTL (`expiresAt`) so a crashed worker can
 * be recovered after the TTL elapses.
 */

import { databases, ID, Query } from './appwrite.js';
import { DATABASE_ID, COL_WORKER_LOCKS } from './constants.js';
import { logger } from '../logger.js';
import { randomUUID } from 'node:crypto';

const OWNER_ID = `${process.pid}-${randomUUID().slice(0, 8)}`;

export type LockReleaser = () => Promise<void>;

/**
 * Try to acquire a named lock. Returns a releaser function on success,
 * `null` if the lock is already held by another live owner.
 *
 * `ttlMs` should be a generous upper bound for the work. If the worker
 * crashes mid-work, the lock auto-expires after `ttlMs` and the next
 * acquirer reclaims it (it sees `expiresAt` in the past and overwrites).
 */
export async function acquireLock(
  key: string,
  ttlMs: number,
): Promise<LockReleaser | null> {
  const db = databases();
  const now = Date.now();
  const expiresAt = new Date(now + ttlMs).toISOString();

  // Step 1: see if a current lock exists.
  let existingId: string | null = null;
  try {
    const { documents } = await db.listDocuments(DATABASE_ID, COL_WORKER_LOCKS, [
      Query.equal('lockKey', [key]),
      Query.limit(1),
    ]);
    const existing = documents[0];
    if (existing) {
      const exp = new Date(String(existing.expiresAt || 0)).getTime();
      if (exp > now) {
        // Another live worker holds the lock.
        return null;
      }
      // Expired → reclaim.
      existingId = String(existing.$id);
    }
  } catch (err) {
    logger.warn('[distributedLock] list failed, refusing lock', err);
    return null;
  }

  // Step 2: create or steal.
  try {
    if (existingId) {
      await db.updateDocument(DATABASE_ID, COL_WORKER_LOCKS, existingId, {
        owner: OWNER_ID,
        expiresAt,
      });
      return makeReleaser(existingId);
    }
    const doc = await db.createDocument(DATABASE_ID, COL_WORKER_LOCKS, ID.unique(), {
      lockKey: key,
      owner: OWNER_ID,
      expiresAt,
    });
    return makeReleaser(String(doc.$id));
  } catch (err: unknown) {
    // Race: someone else just acquired between our list and create. The
    // unique index on lockKey makes this safe — we just back off.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already exists') || msg.includes('Document with the requested ID')) {
      return null;
    }
    logger.warn('[distributedLock] acquire failed', err);
    return null;
  }
}

function makeReleaser(docId: string): LockReleaser {
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    try {
      await databases().deleteDocument(DATABASE_ID, COL_WORKER_LOCKS, docId);
    } catch (err) {
      // If delete fails, the lock will still expire via TTL. Log and move on.
      logger.debug('[distributedLock] release failed (will expire via TTL)', err);
    }
  };
}

/**
 * Convenience wrapper. Skips the work entirely if lock is held elsewhere.
 */
export async function withLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  const release = await acquireLock(key, ttlMs);
  if (!release) return undefined;
  try {
    return await fn();
  } finally {
    await release();
  }
}
