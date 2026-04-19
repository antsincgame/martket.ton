/**
 * One-shot migration: suspend every ACTIVE listing that lacks a deployed
 * AppCollection address.
 *
 * Why: after the NFT-mint bridge, `collection_address` is required for every
 * Commerce purchase (validation in backend/commerce/validation.ts). Legacy
 * listings created before the bridge can still be ACTIVE in Appwrite —
 * accepting purchases on them would create a license that bypasses the
 * NFT mint gate (handled at ensureLicenseForOrder, but defence in depth).
 *
 * What it does:
 *   1. Loads every COL_LISTINGS doc with status=='active'.
 *   2. For each one with empty/missing `collection_address`, updates
 *      status to 'suspended'. Records the previous status / reason in
 *      audit logs (best effort).
 *   3. Prints a summary so ops can email affected sellers.
 *
 * Usage:
 *   APPWRITE_ENDPOINT=... APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... \
 *     node scripts/migrate-suspend-no-collection.mjs [--dry-run]
 *
 * env: same as provision-commerce.mjs (databases.* permissions on API key).
 */
import 'dotenv/config';
import { Client, Databases, ID, Query } from 'node-appwrite';

const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT ?? '';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? '';
const API_KEY = process.env.APPWRITE_API_KEY ?? '';

const DATABASE_ID = 'marketplace';
const COL_LISTINGS = 'listings';
const COL_AUDIT = 'commerce_audit_logs';

const DRY_RUN = process.argv.includes('--dry-run');

function assertEnv() {
  const missing = [
    ['APPWRITE_ENDPOINT', ENDPOINT],
    ['APPWRITE_PROJECT_ID', PROJECT_ID],
    ['APPWRITE_API_KEY', API_KEY],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`Missing env: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function listAllActive(databases) {
  const acc = [];
  let offset = 0;
  const PAGE = 100;
  while (true) {
    const { documents, total } = await databases.listDocuments(DATABASE_ID, COL_LISTINGS, [
      Query.equal('status', 'active'),
      Query.limit(PAGE),
      Query.offset(offset),
    ]);
    acc.push(...documents);
    if (acc.length >= total || documents.length === 0) break;
    offset += documents.length;
  }
  return acc;
}

async function main() {
  assertEnv();
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);

  console.log(`[migrate] mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log(`[migrate] scanning ACTIVE listings...`);
  const all = await listAllActive(databases);
  console.log(`[migrate] total ACTIVE: ${all.length}`);

  const orphans = all.filter((d) => !((d.collection_address || '').trim()));
  console.log(`[migrate] without collection_address: ${orphans.length}`);

  if (orphans.length === 0) {
    console.log('[migrate] nothing to do — all ACTIVE listings have collection_address.');
    return;
  }

  const summary = [];
  for (const doc of orphans) {
    const row = {
      id: doc.$id,
      title: doc.title,
      sellerWallet: doc.sellerWallet,
      catalogProductId: doc.catalogProductId,
    };
    if (DRY_RUN) {
      summary.push({ ...row, action: 'WOULD_SUSPEND' });
      continue;
    }
    try {
      await databases.updateDocument(DATABASE_ID, COL_LISTINGS, doc.$id, {
        status: 'suspended',
      });
      // Best-effort audit; ignore failures so a missing audit collection
      // doesn't block the migration.
      try {
        await databases.createDocument(DATABASE_ID, COL_AUDIT, ID.unique(), {
          actor: 'system:migrate-no-collection',
          action: 'listing_suspend',
          subjectType: 'listing',
          subjectId: doc.$id,
          metadata: JSON.stringify({ reason: 'missing_collection_address' }),
          createdAt: new Date().toISOString(),
        });
      } catch (auditErr) {
        console.warn(`[migrate] audit insert failed for ${doc.$id}: ${auditErr.message || auditErr}`);
      }
      summary.push({ ...row, action: 'SUSPENDED' });
    } catch (err) {
      summary.push({ ...row, action: 'FAILED', error: err.message || String(err) });
    }
  }

  console.log('\n[migrate] === SUMMARY ===');
  for (const r of summary) {
    console.log(
      `  ${r.action.padEnd(14)} ${r.id}  seller=${r.sellerWallet || 'n/a'}  title="${r.title || ''}"`
        + (r.error ? `  ERROR: ${r.error}` : ''),
    );
  }
  console.log(`\n[migrate] processed ${summary.length} listing(s). Email these sellers.`);
}

main().catch((err) => {
  console.error('[migrate] fatal:', err);
  process.exit(1);
});
