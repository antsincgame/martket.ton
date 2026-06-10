/**
 * Compact seller store-analytics card for the Demiurge UI. Reads the SAME
 * endpoint as the agent `get_analytics` tool, so the human Demiurge sees the
 * identical numbers a machine agent would (parity goal).
 */
import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { BarChart3, Loader2, TrendingUp, RotateCcw, Clock } from 'lucide-react';
import { fetchSellerAnalytics, type SellerAnalytics } from '../../../lib/commerceApi';
import { logger } from '../../../lib/logger';

interface Props {
  wallet: string | undefined;
}

export default function SellerAnalyticsCard({ wallet }: Props) {
  const [data, setData] = useState<SellerAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchSellerAnalytics(wallet));
    } catch (err) {
      logger.warn('[SellerAnalyticsCard] load failed:', err);
      setError('Could not load analytics yet.');
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => { void load(); }, [load]);

  if (!wallet) return null;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-black/30 p-5 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#00F5FF]" />
          <h2 className="text-base font-semibold text-white">Store analytics</h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </header>

      {error && <p className="text-xs text-amber-300/90">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} label="Sales" value={String(data.totals.salesCount)} />
            <Stat label="Net revenue" value={`${data.totals.sellerNetTon} TON`} accent />
            <Stat label="Platform fees" value={`${data.totals.platformFeesTon} TON`} />
            <Stat icon={<RotateCcw className="w-4 h-4 text-red-300" />} label="Refunds" value={String(data.totals.refundsCount)} />
          </div>

          {data.totals.pendingCount > 0 && (
            <p className="text-[11px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {data.totals.pendingCount} order(s) awaiting payment.
            </p>
          )}

          {data.topProducts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Top products</p>
              {data.topProducts.map((p) => (
                <div key={p.listingId} className="flex items-center justify-between text-sm">
                  <span className="text-gray-200 truncate pr-3">{p.title || p.listingId}</span>
                  <span className="text-gray-400 whitespace-nowrap">
                    {p.salesCount} sale{p.salesCount === 1 ? '' : 's'} · {p.sellerNetTon} TON
                  </span>
                </div>
              ))}
            </div>
          )}

          {data.totals.salesCount === 0 && (
            <p className="text-xs text-gray-500">No sales yet — publish a listing to start.</p>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon?: ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-sm font-semibold ${accent ? 'text-[#FFD700]' : 'text-white'}`}>{value}</div>
    </div>
  );
}
