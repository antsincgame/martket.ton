// OrdersTab — list of buyer orders for the seller's listings.
// Fetched from the commerce backend (`/sellers/:wallet/orders`), added
// alongside this component. JWT is not required by the current contract,
// but if the endpoint becomes protected in the future we already have getToken().
import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchSellerOrders, type SellerOrderRow } from '../../../lib/commerceApi';
import { formatAmount, shortAddress, shortHash } from '../../../utils/tonAmount';

interface OrdersTabProps {
  wallet: string;
}

export default function OrdersTab({ wallet }: OrdersTabProps) {
  const { getToken } = useAuth();
  const [orders, setOrders] = useState<SellerOrderRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const rows = await fetchSellerOrders(wallet, token ? `Bearer ${token}` : undefined);
      setOrders(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
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
        <h2 className="text-sm uppercase tracking-wider text-[#FFD700]/60">Customer Orders</h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white hover:bg-white/[0.08] disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        orders && orders.length > 0 ? (
          <div className="opacity-60 pointer-events-none"><OrdersTable orders={orders} /></div>
        ) : (
          <SkeletonTable />
        )
      ) : orders === null || orders.length === 0 ? (
        <EmptyState />
      ) : (
        <OrdersTable orders={orders} />
      )}
    </div>
  );
}

function OrdersTable({ orders }: { orders: SellerOrderRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="min-w-full text-sm">
        <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-[#666]">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Listing</th>
            <th className="px-3 py-2 text-left">Buyer</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-white/[0.02]">
              <td className="px-3 py-2 text-[#888] tabular-nums whitespace-nowrap">
                {new Date(o.createdAt).toLocaleDateString()}
              </td>
              <td className="px-3 py-2 text-white max-w-[220px] truncate" title={o.listingTitle ?? o.listingId}>
                {o.listingTitle ?? o.listingId}
              </td>
              <td className="px-3 py-2 text-[#888] font-mono text-xs">{shortAddress(o.buyerWallet)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-white">
                {formatAmount(o.amountRaw, o.currency)}
              </td>
              <td className="px-3 py-2">
                <StatusPill state={o.state} />
              </td>
              <td className="px-3 py-2 font-mono text-xs text-[#00F5FF]">
                {o.tonTxHash ? shortHash(o.tonTxHash) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATE_META: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'Pending payment', color: '#FFD700' },
  paid: { label: 'Paid', color: '#00F5FF' },
  fulfilled: { label: 'Fulfilled', color: '#00FF88' },
  refunded: { label: 'Refunded', color: '#FF6B6B' },
  cancelled: { label: 'Cancelled', color: '#666666' },
};

function StatusPill({ state }: { state: string }) {
  const meta = STATE_META[state] ?? { label: state, color: '#888' };
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider border"
      style={{
        color: meta.color,
        borderColor: `${meta.color}55`,
        backgroundColor: `${meta.color}14`,
      }}
    >
      {meta.label}
    </span>
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-2" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-10 rounded-lg border border-white/[0.06] bg-black/20 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-8 text-center">
      <p className="text-sm text-[#888]">
        No orders yet. When buyers purchase your apps, they will appear here.
      </p>
    </div>
  );
}
