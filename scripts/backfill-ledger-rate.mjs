/**
 * Terra ops scroll #2 — compliance ledger re-rate back-fill.
 *
 * Fills `ton_usd_rate` on compliance_ledger entries that were recorded null
 * because the price oracle was cold-down at record time (#109 writes null — an
 * honest "unknown" — instead of a fabricated 0; null is the re-rate marker).
 *
 * Rate source (first wins):
 *   --rate=<n>   explicit historical rate (use this for older entries — most
 *                accurate, since you supply the rate that held at txn time)
 *   live CoinCap (the oracle's primary provider) otherwise.
 *
 * Because a live rate is only a fair proxy for *recent* transactions, auto-rating
 * with the live rate is bounded to entries newer than --max-age-hours (default
 * 48). Older null entries are LISTED, not silently approximated — re-run with
 * --rate=<historical> to fill those deliberately.
 *
 * DRY-RUN by default: prints the plan and writes nothing. Pass --apply to write.
 *
 * env: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY  (.env honoured)
 * run: node scripts/backfill-ledger-rate.mjs                    # dry-run, live rate
 *      node scripts/backfill-ledger-rate.mjs --apply
 *      node scripts/backfill-ledger-rate.mjs --rate=5.12 --apply
 *      node scripts/backfill-ledger-rate.mjs --max-age-hours=72 --apply
 *  or: npm run backfill:ledger-rate -- --apply
 */
import 'dotenv/config';
import { Client, Databases, Query } from 'node-appwrite';

const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT ?? '';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? '';
const API_KEY = process.env.APPWRITE_API_KEY ?? '';

const DATABASE_ID = 'core';
const COLLECTION = 'compliance_ledger';
const PAGE = 100;
const MAX_PAGES = 100; // safety bound: scan at most 10k entries

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error('[re-rate] FATAL: set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const rateArg = args.find((a) => a.startsWith('--rate='));
const EXPLICIT_RATE = rateArg ? Number(rateArg.split('=')[1]) : null;
const ageArg = args.find((a) => a.startsWith('--max-age-hours='));
const MAX_AGE_HOURS = ageArg ? Number(ageArg.split('=')[1]) : 48;

if (EXPLICIT_RATE != null && (!Number.isFinite(EXPLICIT_RATE) || EXPLICIT_RATE <= 0)) {
  console.error(`[re-rate] FATAL: --rate must be a positive number (got "${rateArg}")`);
  process.exit(1);
}
if (!Number.isFinite(MAX_AGE_HOURS) || MAX_AGE_HOURS <= 0) {
  console.error('[re-rate] FATAL: --max-age-hours must be a positive number');
  process.exit(1);
}

const databases = new Databases(
  new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY),
);

async function fetchCoinCapRate() {
  const res = await fetch('https://api.coincap.io/v2/assets/toncoin');
  if (!res.ok) throw new Error(`CoinCap HTTP ${res.status}`);
  const data = await res.json();
  const price = Number(data?.data?.priceUsd);
  if (!price || price <= 0) throw new Error('CoinCap returned an invalid price');
  return price;
}

const isNullRate = (doc) => doc.ton_usd_rate === null || typeof doc.ton_usd_rate === 'undefined';

async function main() {
  const liveRate = EXPLICIT_RATE ?? (await fetchCoinCapRate());
  const rateSource = EXPLICIT_RATE != null ? `explicit --rate=${EXPLICIT_RATE}` : `live CoinCap $${liveRate.toFixed(4)}`;
  console.log(`[re-rate] ${APPLY ? 'APPLY' : 'DRY-RUN'} @ ${ENDPOINT}`);
  console.log(`[re-rate] rate source: ${rateSource}; auto-rate window: ${MAX_AGE_HOURS}h`);

  const now = Date.now();
  const cutoff = now - MAX_AGE_HOURS * 3_600_000;
  const eligible = [];
  const manual = [];
  let scanned = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { documents } = await databases.listDocuments(DATABASE_ID, COLLECTION, [
      Query.orderDesc('$createdAt'),
      Query.limit(PAGE),
      Query.offset(page * PAGE),
    ]);
    if (documents.length === 0) break;
    scanned += documents.length;

    let allOlderThanWindow = true;
    for (const doc of documents) {
      const created = Date.parse(doc.$createdAt);
      const withinWindow = created >= cutoff;
      if (withinWindow) allOlderThanWindow = false;
      if (!isNullRate(doc)) continue;
      if (EXPLICIT_RATE != null || withinWindow) eligible.push(doc);
      else manual.push(doc);
    }
    // Ordered desc by $createdAt: once a whole page is older than the window and
    // we're not using an explicit rate, every later entry is older too — stop.
    if (allOlderThanWindow && EXPLICIT_RATE == null) break;
    if (documents.length < PAGE) break;
  }

  console.log(`[re-rate] scanned ${scanned} entries → ${eligible.length} to fill, ${manual.length} need a historical --rate`);
  for (const d of manual) {
    console.log(`[re-rate]   MANUAL  ${d.$id}  ${d.$createdAt}  (older than ${MAX_AGE_HOURS}h)`);
  }

  if (eligible.length === 0) {
    console.log('[re-rate] nothing to fill ✓');
    return;
  }

  for (const d of eligible) {
    if (APPLY) {
      await databases.updateDocument(DATABASE_ID, COLLECTION, d.$id, { ton_usd_rate: liveRate });
      console.log(`[re-rate]   FILLED  ${d.$id}  ${d.$createdAt}  → $${liveRate.toFixed(4)}`);
    } else {
      console.log(`[re-rate]   would fill  ${d.$id}  ${d.$createdAt}  → $${liveRate.toFixed(4)}`);
    }
  }

  if (!APPLY) console.log('[re-rate] DRY-RUN complete — re-run with --apply to write');
  else console.log(`[re-rate] applied ${eligible.length} fill(s) ✓`);
}

main().catch((e) => {
  console.error('[re-rate] FAILED:', e?.message || e);
  process.exit(1);
});
