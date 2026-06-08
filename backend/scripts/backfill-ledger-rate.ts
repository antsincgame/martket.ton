/**
 * Compliance-ledger re-rate back-fill — runs INSIDE the deployed backend
 * container, where Appwrite credentials are injected by Coolify. There is no
 * external machine with prod creds, so this ships in the backend image and is
 * invoked via Coolify's "Execute Command" terminal (WORKDIR /app):
 *
 *   node --import tsx scripts/backfill-ledger-rate.ts                  # dry-run
 *   node --import tsx scripts/backfill-ledger-rate.ts --apply
 *   node --import tsx scripts/backfill-ledger-rate.ts --rate=5.12 --apply
 *   node --import tsx scripts/backfill-ledger-rate.ts --max-age-hours=72 --apply
 *
 * Fills `ton_usd_rate` on compliance_ledger entries recorded null during an
 * oracle outage (#109). DRY-RUN by default. Rate source: --rate=<n> (explicit
 * historical rate) else the backend price oracle (cache → providers →
 * TON_USD_FALLBACK). Live-rate auto-fill is bounded to entries newer than
 * --max-age-hours (default 48); older nulls are listed, not approximated.
 */
import { Query } from 'node-appwrite';
import { databases } from '../core/db.js';
import { CORE_DATABASE_ID, COL_COMPLIANCE_LEDGER } from '../core/constants.js';
import { getTonUsdPrice } from '../commerce/tonPriceOracle.js';

const PAGE = 100;
const MAX_PAGES = 100; // safety bound: scan at most 10k entries

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const rateArg = args.find((a) => a.startsWith('--rate='));
const EXPLICIT_RATE = rateArg ? Number(rateArg.split('=')[1]) : null;
const ageArg = args.find((a) => a.startsWith('--max-age-hours='));
const MAX_AGE_HOURS = ageArg ? Number(ageArg.split('=')[1]) : 48;

if (EXPLICIT_RATE !== null && (!Number.isFinite(EXPLICIT_RATE) || EXPLICIT_RATE <= 0)) {
  console.error(`[re-rate] FATAL: --rate must be a positive number (got "${rateArg}")`);
  process.exit(1);
}
if (!Number.isFinite(MAX_AGE_HOURS) || MAX_AGE_HOURS <= 0) {
  console.error('[re-rate] FATAL: --max-age-hours must be a positive number');
  process.exit(1);
}

interface LedgerDoc {
  $id: string;
  $createdAt: string;
  ton_usd_rate?: number | null;
}
const isNullRate = (d: LedgerDoc): boolean =>
  d.ton_usd_rate === null || typeof d.ton_usd_rate === 'undefined';

async function main(): Promise<void> {
  const rate = EXPLICIT_RATE ?? (await getTonUsdPrice());
  const source = EXPLICIT_RATE !== null ? `explicit --rate=${EXPLICIT_RATE}` : `oracle $${rate.toFixed(4)}`;
  console.log(`[re-rate] ${APPLY ? 'APPLY' : 'DRY-RUN'} — rate source: ${source}; auto-rate window: ${MAX_AGE_HOURS}h`);

  const cutoff = Date.now() - MAX_AGE_HOURS * 3_600_000;
  const eligible: LedgerDoc[] = [];
  const manual: LedgerDoc[] = [];
  let scanned = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { documents } = await databases().listDocuments(CORE_DATABASE_ID, COL_COMPLIANCE_LEDGER, [
      Query.orderDesc('$createdAt'),
      Query.limit(PAGE),
      Query.offset(page * PAGE),
    ]);
    const docs = documents as unknown as LedgerDoc[];
    if (docs.length === 0) break;
    scanned += docs.length;

    let allOlder = true;
    for (const d of docs) {
      const within = Date.parse(d.$createdAt) >= cutoff;
      if (within) allOlder = false;
      if (!isNullRate(d)) continue;
      if (EXPLICIT_RATE !== null || within) eligible.push(d);
      else manual.push(d);
    }
    // Ordered desc by $createdAt: once a full page is older than the window and
    // we're not using an explicit rate, all later entries are older too — stop.
    if (allOlder && EXPLICIT_RATE === null) break;
    if (docs.length < PAGE) break;
  }

  console.log(`[re-rate] scanned ${scanned} → ${eligible.length} to fill, ${manual.length} need a historical --rate`);
  for (const d of manual) console.log(`[re-rate]   MANUAL  ${d.$id}  ${d.$createdAt}  (older than ${MAX_AGE_HOURS}h)`);

  if (eligible.length === 0) {
    console.log('[re-rate] nothing to fill ✓');
    return;
  }

  for (const d of eligible) {
    if (APPLY) {
      await databases().updateDocument(CORE_DATABASE_ID, COL_COMPLIANCE_LEDGER, d.$id, { ton_usd_rate: rate });
      console.log(`[re-rate]   FILLED  ${d.$id}  ${d.$createdAt}  → $${rate.toFixed(4)}`);
    } else {
      console.log(`[re-rate]   would fill  ${d.$id}  ${d.$createdAt}  → $${rate.toFixed(4)}`);
    }
  }

  console.log(APPLY ? `[re-rate] applied ${eligible.length} fill(s) ✓` : '[re-rate] DRY-RUN complete — re-run with --apply to write');
}

main().catch((e: unknown) => {
  console.error('[re-rate] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
