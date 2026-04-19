import { TrendingUp, History, RefreshCw, Loader2 } from 'lucide-react';
import {
  usePayoutsQuery, useTransactionsQuery, useSessionInvalidator,
  type PayoutGroup, type TransactionRow,
} from '../../../queries/sessionQueries';

export function PayoutsLedger() {
  const { data, isLoading, error } = usePayoutsQuery();
  const { invalidatePayouts } = useSessionInvalidator();
  const ledger = data ?? null;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-[#111119] p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-[#FFD700]" aria-hidden />
          <h2 className="text-lg font-semibold text-white">Payout Ledger</h2>
        </div>
        <button
          type="button"
          onClick={() => void invalidatePayouts()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white hover:bg-white/[0.08] disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          {error.message}
        </div>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Totals label="Lifetime" value={`${(ledger?.totals.lifetimeTon ?? 0).toFixed(2)} TON`} accent="#FFD700" />
        <Totals label="This month" value={`${(ledger?.totals.thisMonthTon ?? 0).toFixed(2)} TON`} accent="#00F5FF" />
        <Totals label="Total sales" value={String(ledger?.totals.salesAllTime ?? 0)} accent="#00FF88" />
      </dl>

      {isLoading && !ledger ? (
        <SkeletonRows />
      ) : ledger && ledger.payouts.length > 0 ? (
        <ul className="divide-y divide-white/[0.04] rounded-lg border border-white/[0.06] overflow-hidden">
          {ledger.payouts.map((row: PayoutGroup) => (
            <li key={row.month} className="flex items-center justify-between px-4 py-3">
              <span className="text-[#888] text-sm tabular-nums">{formatMonth(row.month)}</span>
              <span className="text-white font-semibold tabular-nums">{row.totalTon.toFixed(2)} TON</span>
              <span className="text-[#666] text-xs tabular-nums">{row.salesCount} sales</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#666]">No payouts yet. Publish an app and make your first sale.</p>
      )}
    </section>
  );
}

export function TransactionsTable() {
  const { data, isLoading, error } = useTransactionsQuery(50);
  const txs = data ?? [];

  return (
    <section className="rounded-xl border border-white/[0.06] bg-[#111119] p-6">
      <header className="flex items-center gap-3 mb-4">
        <History className="w-5 h-5 text-[#00F5FF]" aria-hidden />
        <h2 className="text-lg font-semibold text-white">Transaction History</h2>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">{error.message}</div>
      )}

      {isLoading && txs.length === 0 ? (
        <SkeletonRows />
      ) : txs.length === 0 ? (
        <p className="text-sm text-[#666]">No transactions yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-[#666]">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {txs.map((tx: TransactionRow) => (
                <tr key={tx.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-[#888] tabular-nums whitespace-nowrap">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2"><TypeBadge type={tx.type} /></td>
                  <td className="px-3 py-2 text-white max-w-[220px] truncate" title={tx.productName ?? ''}>{tx.productName ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-white">+{tx.amountTon.toFixed(2)} TON</td>
                  <td className="px-3 py-2 text-xs text-[#888]">{tx.status}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#00F5FF]">{tx.txHash ? `${tx.txHash.slice(0, 6)}…${tx.txHash.slice(-4)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Totals({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-[#888]">{label}</div>
      <div className="text-xl font-display font-bold tabular-nums mt-1" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function TypeBadge({ type }: { type: TransactionRow['type'] }) {
  const meta: Record<string, { label: string; color: string }> = {
    sale: { label: 'Sale', color: '#00FF88' },
    payout: { label: 'Payout', color: '#FFD700' },
    refund: { label: 'Refund', color: '#FF6B6B' },
  };
  const m = meta[type] ?? { label: String(type), color: '#888888' };
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider border" style={{ color: m.color, borderColor: `${m.color}55`, backgroundColor: `${m.color}14` }}>
      {m.label}
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2" aria-busy="true">
      {[0, 1, 2].map((i) => <div key={i} className="h-9 rounded-lg border border-white/[0.06] bg-black/20 animate-pulse" />)}
    </div>
  );
}

function formatMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
