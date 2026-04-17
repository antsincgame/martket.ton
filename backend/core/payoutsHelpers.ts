// Чистые helpers payoutsRepository: вынесены отдельно ради unit-тестов
// (без зависимости на Appwrite SDK / runtime database()).
import type { TransactionRow, PayoutsLedger, PayoutGroup } from './payoutsRepository.js';

export function monthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Сворачивает массив транзакций в `PayoutsLedger`-агрегат. */
export function aggregatePayouts(
  transactions: TransactionRow[],
  now: Date = new Date(),
): PayoutsLedger {
  const buckets = new Map<string, PayoutGroup>();
  let lifetimeTon = 0;
  let salesAllTime = 0;
  let thisMonthTon = 0;
  const thisMonthKey = monthKey(now);

  for (const tx of transactions) {
    if (tx.type !== 'sale') continue;
    salesAllTime += 1;
    lifetimeTon += tx.amountTon;
    const created = new Date(tx.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const key = monthKey(created);
    const group = buckets.get(key) ?? { month: key, totalTon: 0, salesCount: 0 };
    group.totalTon += tx.amountTon;
    group.salesCount += 1;
    buckets.set(key, group);
    if (key === thisMonthKey) thisMonthTon += tx.amountTon;
  }

  const payouts = [...buckets.values()]
    .map((g) => ({ ...g, totalTon: round2(g.totalTon) }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));

  return {
    totals: {
      lifetimeTon: round2(lifetimeTon),
      thisMonthTon: round2(thisMonthTon),
      salesAllTime,
    },
    payouts,
  };
}
