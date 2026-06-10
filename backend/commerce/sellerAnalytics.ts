/**
 * Pure seller-analytics aggregator (Agent/Demiurge automation track).
 *
 * Turns a seller's raw order rows into a store-class summary: sales, revenue
 * split (gross vs the seller's net vs platform fees), refunds, state breakdown,
 * and a top-products ranking by actual sales. Kept pure (raw nanoton in/out, no
 * I/O) so it's exactly testable; the route layer fetches the rows and adds
 * human-readable TON. Shared by the agent endpoint and the human Demiurge UI so
 * machine and human see identical numbers (the "singularity" parity goal).
 */

import { ORDER_STATE, DATABASE_ID, COL_LISTINGS, COL_ORDERS } from './constants.js';
import { databases, Query } from './appwrite.js';
import { nanoRawToTonHuman } from './money.js';

export interface OrderForAnalytics {
  state: string;
  /** Buyer's total (seller price + platform fee), raw nanoton. */
  amountRaw: string;
  /** Seller's net cut, raw nanoton. */
  sellerNetAmountRaw: string;
  listingId: string;
  title: string;
}

export interface TopProduct {
  listingId: string;
  title: string;
  salesCount: number;
  sellerNetTonRaw: string;
}

export interface SellerAnalytics {
  totals: {
    /** Orders that reached a successful, paid state (paid or fulfilled). */
    salesCount: number;
    grossRevenueTonRaw: string;
    sellerNetTonRaw: string;
    platformFeesTonRaw: string;
    refundsCount: number;
    refundedTonRaw: string;
    pendingCount: number;
  };
  byState: Record<string, number>;
  topProducts: TopProduct[];
}

const SUCCESS_STATES = new Set<string>([ORDER_STATE.PAID, ORDER_STATE.FULFILLED]);

function toBig(raw: string | undefined | null): bigint {
  try {
    return BigInt(raw || '0');
  } catch {
    return 0n;
  }
}

/**
 * @param orders the seller's order rows (already scoped to their listings).
 * @param topN   how many products to rank (default 5).
 */
export function computeSellerAnalytics(orders: OrderForAnalytics[], topN = 5): SellerAnalytics {
  let salesCount = 0;
  let gross = 0n;
  let sellerNet = 0n;
  let refundsCount = 0;
  let refunded = 0n;
  let pendingCount = 0;
  const byState: Record<string, number> = {};

  // Per-listing accumulation for the top-products ranking.
  const perProduct = new Map<string, { title: string; salesCount: number; sellerNet: bigint }>();

  for (const o of orders) {
    byState[o.state] = (byState[o.state] ?? 0) + 1;

    if (SUCCESS_STATES.has(o.state)) {
      salesCount += 1;
      gross += toBig(o.amountRaw);
      sellerNet += toBig(o.sellerNetAmountRaw);
      const cur = perProduct.get(o.listingId) ?? { title: o.title, salesCount: 0, sellerNet: 0n };
      cur.salesCount += 1;
      cur.sellerNet += toBig(o.sellerNetAmountRaw);
      cur.title = o.title || cur.title;
      perProduct.set(o.listingId, cur);
    } else if (o.state === ORDER_STATE.REFUNDED) {
      refundsCount += 1;
      refunded += toBig(o.amountRaw);
    } else if (o.state === ORDER_STATE.PENDING_PAYMENT) {
      pendingCount += 1;
    }
  }

  const platformFees = gross - sellerNet;

  const topProducts: TopProduct[] = [...perProduct.entries()]
    .map(([listingId, v]) => ({
      listingId,
      title: v.title,
      salesCount: v.salesCount,
      sellerNetTonRaw: v.sellerNet.toString(),
    }))
    .sort((a, b) => b.salesCount - a.salesCount || (BigInt(b.sellerNetTonRaw) > BigInt(a.sellerNetTonRaw) ? 1 : -1))
    .slice(0, topN);

  return {
    totals: {
      salesCount,
      grossRevenueTonRaw: gross.toString(),
      sellerNetTonRaw: sellerNet.toString(),
      platformFeesTonRaw: (platformFees > 0n ? platformFees : 0n).toString(),
      refundsCount,
      refundedTonRaw: refunded.toString(),
      pendingCount,
    },
    byState,
    topProducts,
  };
}

/** Add human-readable TON next to each raw nanoton field (for API responses). */
export function withHumanTon(a: SellerAnalytics) {
  return {
    totals: {
      ...a.totals,
      grossRevenueTon: nanoRawToTonHuman(a.totals.grossRevenueTonRaw),
      sellerNetTon: nanoRawToTonHuman(a.totals.sellerNetTonRaw),
      platformFeesTon: nanoRawToTonHuman(a.totals.platformFeesTonRaw),
      refundedTon: nanoRawToTonHuman(a.totals.refundedTonRaw),
    },
    byState: a.byState,
    topProducts: a.topProducts.map((p) => ({
      ...p,
      sellerNetTon: nanoRawToTonHuman(p.sellerNetTonRaw),
    })),
  };
}

/**
 * Effectful loader: fetch the seller's listings → orders, aggregate, and attach
 * human TON. Shared by the agent endpoint (`GET /agent/analytics`) and the human
 * Demiurge endpoint so both surfaces report identical numbers.
 */
export async function loadSellerAnalytics(wallet: string) {
  const db = databases();
  const { documents: listings } = await db.listDocuments(DATABASE_ID, COL_LISTINGS, [
    Query.equal('sellerWallet', wallet),
    Query.limit(500),
  ]);
  const listingIds = listings.map((l) => l.$id);
  if (listingIds.length === 0) {
    return withHumanTon(computeSellerAnalytics([]));
  }
  const { documents: orders } = await db.listDocuments(DATABASE_ID, COL_ORDERS, [
    Query.equal('listingId', listingIds),
    Query.limit(5000),
  ]);
  const rows: OrderForAnalytics[] = orders.map((o) => ({
    state: String(o['state'] ?? ''),
    amountRaw: String(o['amountRaw'] ?? '0'),
    sellerNetAmountRaw: String(o['sellerNetAmountRaw'] ?? '0'),
    listingId: String(o['listingId'] ?? ''),
    title: String(o['listingSnapshotTitle'] ?? ''),
  }));
  return withHumanTon(computeSellerAnalytics(rows));
}
