/**
 * Public bestseller / trending ranking (store-class discovery). Replaces the
 * static seed `downloads`/`isFeatured` signal with REAL sales: counts of
 * paid/fulfilled orders per catalog product, across all sellers.
 *
 * PII-safe by construction — the output is only `{ catalogProductId, salesCount }`;
 * buyer wallets, amounts, and order ids never leave this module.
 */
import { databases, Query } from './appwrite.js';
import { DATABASE_ID, COL_ORDERS, COL_LISTINGS, ORDER_STATE } from './constants.js';
import { logger } from '../logger.js';

const SUCCESS_STATES = new Set<string>([ORDER_STATE.PAID, ORDER_STATE.FULFILLED]);

export interface OrderForBestseller {
  state: string;
  listingId: string;
  createdAt: string;
}

export interface BestsellerEntry {
  catalogProductId: string;
  salesCount: number;
}

// ─── Pure ranking (unit-tested) ─────────────────────────────────────

export function computeBestsellers(
  orders: OrderForBestseller[],
  listingToCatalog: Map<string, string>,
  opts: { sinceIso?: string; limit?: number } = {},
): BestsellerEntry[] {
  const counts = new Map<string, number>();
  for (const o of orders) {
    if (!SUCCESS_STATES.has(o.state)) continue;
    if (opts.sinceIso && o.createdAt < opts.sinceIso) continue;
    const catalogId = listingToCatalog.get(o.listingId);
    if (!catalogId) continue; // listing without a catalog mapping → skip
    counts.set(catalogId, (counts.get(catalogId) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .map(([catalogProductId, salesCount]) => ({ catalogProductId, salesCount }))
    .sort((a, b) => b.salesCount - a.salesCount);
  return opts.limit ? ranked.slice(0, opts.limit) : ranked;
}

// ─── Effectful loader + TTL cache ───────────────────────────────────

interface CacheEntry { at: number; data: BestsellerEntry[]; }
const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

export async function loadBestsellers(opts: { windowDays?: number; limit?: number } = {}): Promise<BestsellerEntry[]> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const windowDays = opts.windowDays && opts.windowDays > 0 ? opts.windowDays : 0;
  const key = `${windowDays}:${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  try {
    const sinceIso = windowDays ? new Date(Date.now() - windowDays * 86_400_000).toISOString() : undefined;

    // Listing → catalog product map.
    const { documents: listings } = await databases().listDocuments(DATABASE_ID, COL_LISTINGS, [
      Query.limit(5000),
    ]);
    const listingToCatalog = new Map<string, string>();
    for (const l of listings) {
      const cpid = String(l['catalogProductId'] ?? '');
      if (cpid) listingToCatalog.set(String(l.$id), cpid);
    }

    // Successful orders (cross-seller). Read counts only.
    const queries = [
      Query.equal('state', [ORDER_STATE.PAID, ORDER_STATE.FULFILLED]),
      Query.orderDesc('$createdAt'),
      Query.limit(5000),
    ];
    if (sinceIso) queries.push(Query.greaterThan('$createdAt', sinceIso));
    const { documents: orders } = await databases().listDocuments(DATABASE_ID, COL_ORDERS, queries);
    const rows: OrderForBestseller[] = orders.map((o) => ({
      state: String(o['state'] ?? ''),
      listingId: String(o['listingId'] ?? ''),
      createdAt: String(o.$createdAt ?? ''),
    }));

    const data = computeBestsellers(rows, listingToCatalog, { sinceIso, limit });
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    logger.warn('[bestsellers] load failed:', err instanceof Error ? err.message : err);
    return hit?.data ?? [];
  }
}

/** Test seam. */
export function __clearBestsellerCache(): void {
  cache.clear();
}
