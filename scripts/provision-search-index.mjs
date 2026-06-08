/**
 * Terra ops scroll #1 — public search fulltext index.
 *
 * Creates the Fulltext index on `legacy_products.name` so the public product
 * search (`Query.search('name', q)` in backend/core/productRepository.ts) uses
 * the index instead of throwing into the bounded in-memory fallback (#108).
 *
 * Idempotent: a 409 (index already exists) is treated as success. This is the
 * same index that `provision-core.mjs` now creates as part of a full provision —
 * this standalone scroll exists so it can be applied to prod WITHOUT re-running
 * the entire core provision.
 *
 * env: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY  (.env honoured)
 * run: node scripts/provision-search-index.mjs
 *  or: npm run provision:search-index
 */
import 'dotenv/config';
import { Client, Databases, IndexType } from 'node-appwrite';

const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT ?? '';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? '';
const API_KEY = process.env.APPWRITE_API_KEY ?? '';

const DATABASE_ID = 'core';
const COLLECTION = 'legacy_products';
const INDEX = 'idx_name_fulltext';

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error('[search-index] FATAL: set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const databases = new Databases(
  new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY),
);

async function waitForIndex() {
  for (let i = 0; i < 120; i += 1) {
    const idx = await databases.getIndex(DATABASE_ID, COLLECTION, INDEX);
    if (idx.status === 'available') return;
    if (idx.status === 'failed') throw new Error(`index ${INDEX} build failed: ${idx.error}`);
    await sleep(1000);
  }
  throw new Error(`timeout waiting for index ${INDEX} to become available`);
}

async function main() {
  console.log(`[search-index] ensuring ${COLLECTION}.${INDEX} (Fulltext on 'name') @ ${ENDPOINT}`);
  try {
    await databases.createIndex(DATABASE_ID, COLLECTION, INDEX, IndexType.Fulltext, ['name']);
    console.log('[search-index] creation requested — waiting for build…');
  } catch (e) {
    if (e.code === 409) {
      console.log('[search-index] index already exists — nothing to do ✓');
      return;
    }
    throw e;
  }
  await waitForIndex();
  console.log('[search-index] available ✓ — Query.search now hits the index (no fallback scan)');
}

main().catch((e) => {
  console.error('[search-index] FAILED:', e?.message || e);
  process.exit(1);
});
