import { IndexType } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_LEGACY_PRODUCTS } from './constants.js';
import { logger } from '../logger.js';

const INDEX = 'idx_name_fulltext';

/**
 * Idempotently ensure the Fulltext index on `legacy_products.name` exists, so
 * the public product search uses `Query.search` (productRepository.searchProducts)
 * instead of the bounded in-memory fallback.
 *
 * This runs at backend startup because prod Appwrite credentials live ONLY inside
 * the deployed container (Coolify-injected env) — there is no external machine
 * from which to run the provision scripts. Self-healing on boot means the next
 * deploy provisions the index with zero manual ops.
 *
 * Fire-and-forget + fully guarded: a 409 means it already exists; any other
 * failure is logged but never thrown — search degrades gracefully without it, so
 * this must never affect boot or the health check. Call it AFTER `app.listen`.
 */
export async function ensureSearchIndex(): Promise<void> {
  try {
    await databases().createIndex(
      CORE_DATABASE_ID,
      COL_LEGACY_PRODUCTS,
      INDEX,
      IndexType.Fulltext,
      ['name'],
    );
    logger.info(`[search-index] created ${COL_LEGACY_PRODUCTS}.${INDEX} (Fulltext on name)`);
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 409) {
      logger.debug('[search-index] already exists');
      return;
    }
    logger.warn(
      '[search-index] ensure failed (search will use the in-memory fallback):',
      err instanceof Error ? err.message : err,
    );
  }
}
