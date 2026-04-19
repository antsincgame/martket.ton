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

function isUniqueViolation(err: unknown): boolean {
  // Appwrite returns code 409 with a "Document with the requested ID already
  // exists" / "duplicate index" message when a unique index trips. Match on
  // either, plus generic "already exists" for forward-compat.
  const msg = err instanceof Error ? err.message : String(err);
  if (typeof err === 'object' && err !== null && 'code' in err) {
    if ((err as { code: number }).code === 409) return true;
  }
  return msg.includes('already exists') || msg.includes('duplicate');
}

/**
 * Try to acquire a named lock. Returns a releaser function on success,
 * `null` if the lock is already held by another live owner.
 *
 * `ttlMs` should be a generous upper bound for the work. If the worker
 * crashes mid-work, the lock auto-expires after `ttlMs` and the next
 * acquirer reclaims it (it sees `expiresAt` in the past and steals it
 * via delete + create).
 *
 * Atomicity: we always go through `createDocument` first and rely on
 * the `uniq_lockKey` unique index to atomically reject concurrent
 * acquirers. The previous implementation used list-then-update, which
 * had a TOCTOU window — two replicas could both observe an expired
 * lock and both update it, both believing they hold it.
 */
export async function acquireLock(
  key: string,
  ttlMs: number,
): Promise<LockReleaser | null> {
  const db = databases();
  const now = Date.now();
  const expiresAt = new Date(now + ttlMs).toISOString();
  const payload = { lockKey: key, owner: OWNER_ID, expiresAt };

  // Fast path: try to insert. The unique index on `lockKey` makes this
  // atomic — exactly one concurrent caller wins.
  try {
    const doc = await db.createDocument(DATABASE_ID, COL_WORKER_LOCKS, ID.unique(), payload);
    return makeReleaser(String(doc.$id));
  } catch (err) {
    if (!isUniqueViolation(err)) {
      logger.warn('[distributedLock] create failed', err);
      return null;
    }
    // Fallthrough — lock exists. Check if it's expired and steal it.
  }

  // Stale-lock recovery: read the existing doc, see if expiresAt is in the
  // past, and if so delete + recreate. Two concurrent stealers race here:
  // the loser's delete will succeed (idempotent) but their createDocument
  // will hit the unique index and fail — i.e. only one wins, no double lock.
  let existingId: string;
  let existingExpiresAt: number;
  try {
    const { documents } = await db.listDocuments(DATABASE_ID, COL_WORKER_LOCKS, [
      Query.equal('lockKey', [key]),
      Query.limit(1),
    ]);
    const existing = documents[0];
    if (!existing) {
      // The lock vanished between create attempt and list — extremely rare,
      // but bail and let the next tick retry.
      return null;
    }
    existingId = String(existing.$id);
    existingExpiresAt = new Date(String(existing.expiresAt || 0)).getTime();
  } catch (err) {
    logger.warn('[distributedLock] list failed, refusing lock', err);
    return null;
  }

  if (existingExpiresAt > now) {
    // Live lock — back off.
    return null;
  }

  // Expired. Try to steal: delete then re-create. If the delete loses the
  // race (someone else already deleted) that's fine — both deleters then
  // race the create, which the unique index serialises.
  try {
    await db.deleteDocument(DATABASE_ID, COL_WORKER_LOCKS, existingId);
  } catch (err) {
    // Already deleted by another stealer — continue.
    logger.debug('[distributedLock] delete-on-steal failed (continuing)', err);
  }
  try {
    const doc = await db.createDocument(DATABASE_ID, COL_WORKER_LOCKS, ID.unique(), payload);
    return makeReleaser(String(doc.$id));
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Lost the race to another stealer. They hold the lock now.
      return null;
    }
    logger.warn('[distributedLock] re-acquire failed', err);
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
