// DisputesTab — открытые споры по заказам продавца. Покупатели могут
// открывать спор только по оплаченному заказу; разрешать споры может только
// admin (commerce admin secret). Тут продавец видит ситуацию и контекст.
import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchSellerDisputes, type SellerDisputeRow } from '../../../lib/commerceApi';

interface DisputesTabProps {
  wallet: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: 'Открыт', color: '#FF6B6B' },
  under_review: { label: 'На разборе', color: '#FFD700' },
  resolved_refund: { label: 'Возврат покупателю', color: '#FF6B6B' },
  resolved_release: { label: 'В пользу продавца', color: '#00FF88' },
};

export default function DisputesTab({ wallet }: DisputesTabProps) {
  const { getToken } = useAuth();
  const [disputes, setDisputes] = useState<SellerDisputeRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const rows = await fetchSellerDisputes(wallet, token ? `Bearer ${token}` : undefined);
      setDisputes(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить споры');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-wider text-[#FFD700]/60">Споры</h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white hover:bg-white/[0.08] disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Обновить
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          {error}
        </div>
      )}

      {loading && disputes === null ? (
        <SkeletonRows />
      ) : disputes === null || disputes.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {disputes.map((d) => {
            const meta = STATUS_META[d.status] ?? { label: d.status, color: '#888' };
            return (
              <li
                key={d.id}
                className="rounded-xl border border-white/[0.08] bg-black/30 p-4"
              >
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider border"
                    style={{
                      color: meta.color,
                      borderColor: `${meta.color}55`,
                      backgroundColor: `${meta.color}14`,
                    }}
                  >
                    <AlertTriangle className="w-3 h-3" aria-hidden />
                    {meta.label}
                  </span>
                  <span className="text-xs text-[#888]">
                    {new Date(d.createdAt).toLocaleString()}
                  </span>
                  <span className="ml-auto text-xs text-[#666] font-mono">
                    {d.buyerWallet.slice(0, 4)}…{d.buyerWallet.slice(-4)}
                  </span>
                </div>
                <h3 className="text-white font-semibold mb-1 truncate">
                  {d.order?.listingTitle ?? `Order ${d.orderId.slice(0, 8)}…`}
                </h3>
                <p className="text-sm text-[#aaa] whitespace-pre-wrap break-words">
                  {d.reason || '(без причины)'}
                </p>
                {d.resolutionNote && (
                  <p className="mt-2 text-xs text-[#888] border-l-2 border-white/[0.1] pl-3">
                    Резолюция: {d.resolutionNote}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <ul className="space-y-3" aria-busy="true">
      {[0, 1].map((i) => (
        <li key={i} className="h-24 rounded-xl border border-white/[0.06] bg-black/20 animate-pulse" />
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-8 text-center">
      <p className="text-sm text-[#888]">Споров нет — продавайте дальше с чистой совестью.</p>
    </div>
  );
}
