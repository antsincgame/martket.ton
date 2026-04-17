import { describe, expect, it } from 'vitest';
import { aggregatePayouts, monthKey, round2 } from './payoutsHelpers.js';
import type { TransactionRow } from './payoutsRepository.js';

function tx(partial: Partial<TransactionRow>): TransactionRow {
  return {
    id: partial.id ?? 't1',
    type: partial.type ?? 'sale',
    productId: partial.productId ?? 'p1',
    productName: partial.productName ?? 'Demo',
    buyerId: partial.buyerId ?? 'u1',
    amountTon: partial.amountTon ?? 1,
    txHash: partial.txHash ?? null,
    status: partial.status ?? 'completed',
    createdAt: partial.createdAt ?? '2026-04-15T10:00:00.000Z',
  };
}

describe('monthKey', () => {
  it('formats UTC year/month as YYYY-MM-01', () => {
    expect(monthKey(new Date('2026-04-15T10:00:00.000Z'))).toBe('2026-04-01');
    expect(monthKey(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01');
    expect(monthKey(new Date('2026-12-31T23:59:59.000Z'))).toBe('2026-12-01');
  });

  it('uses UTC, not local timezone, to keep groups stable globally', () => {
    const utcMidnightOfApril1 = new Date(Date.UTC(2026, 3, 1, 0, 0, 0));
    expect(monthKey(utcMidnightOfApril1)).toBe('2026-04-01');
  });
});

describe('round2', () => {
  it('rounds to 2 decimals using Math.round semantics', () => {
    expect(round2(1.236)).toBe(1.24);
    expect(round2(1.234)).toBe(1.23);
    expect(round2(0.123456)).toBe(0.12);
    expect(round2(10)).toBe(10);
    expect(round2(0)).toBe(0);
  });
});

describe('aggregatePayouts', () => {
  const now = new Date('2026-04-17T00:00:00.000Z');

  it('returns zeros when there are no transactions', () => {
    const ledger = aggregatePayouts([], now);
    expect(ledger).toEqual({
      totals: { lifetimeTon: 0, thisMonthTon: 0, salesAllTime: 0 },
      payouts: [],
    });
  });

  it('skips non-sale transactions', () => {
    const ledger = aggregatePayouts(
      [
        tx({ type: 'payout', amountTon: 5, createdAt: '2026-04-10T00:00:00Z' }),
        tx({ type: 'refund', amountTon: 3, createdAt: '2026-04-10T00:00:00Z' }),
      ],
      now,
    );
    expect(ledger.totals.salesAllTime).toBe(0);
    expect(ledger.totals.lifetimeTon).toBe(0);
    expect(ledger.payouts).toHaveLength(0);
  });

  it('groups sales by UTC month and sums totals', () => {
    const ledger = aggregatePayouts(
      [
        tx({ id: 'a', amountTon: 1.5, createdAt: '2026-03-05T00:00:00Z' }),
        tx({ id: 'b', amountTon: 2.5, createdAt: '2026-03-20T00:00:00Z' }),
        tx({ id: 'c', amountTon: 4, createdAt: '2026-04-15T00:00:00Z' }),
      ],
      now,
    );

    expect(ledger.totals).toEqual({
      lifetimeTon: 8,
      thisMonthTon: 4,
      salesAllTime: 3,
    });
    expect(ledger.payouts).toEqual([
      { month: '2026-04-01', totalTon: 4, salesCount: 1 },
      { month: '2026-03-01', totalTon: 4, salesCount: 2 },
    ]);
  });

  it('ignores transactions with invalid createdAt but still counts in totals', () => {
    const ledger = aggregatePayouts(
      [
        tx({ id: 'a', amountTon: 5, createdAt: 'not-a-date' }),
        tx({ id: 'b', amountTon: 2, createdAt: '2026-04-15T00:00:00Z' }),
      ],
      now,
    );
    expect(ledger.totals.salesAllTime).toBe(2);
    expect(ledger.totals.lifetimeTon).toBe(7);
    expect(ledger.payouts).toEqual([
      { month: '2026-04-01', totalTon: 2, salesCount: 1 },
    ]);
  });

  it('rounds totalTon to 2 decimals to avoid float drift', () => {
    const ledger = aggregatePayouts(
      [
        tx({ id: 'a', amountTon: 0.1, createdAt: '2026-04-01T00:00:00Z' }),
        tx({ id: 'b', amountTon: 0.2, createdAt: '2026-04-02T00:00:00Z' }),
      ],
      now,
    );
    expect(ledger.totals.lifetimeTon).toBe(0.3);
    expect(ledger.payouts[0].totalTon).toBe(0.3);
  });
});
