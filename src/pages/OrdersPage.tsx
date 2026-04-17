import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ExternalLink, Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { commerceUrl } from '../lib/commerceApi';
import { logger } from '../lib/logger';
import DisputeButton from '../components/order/DisputeButton';

interface BuyerOrder {
  id: string;
  listingId: string;
  listingTitle: string | null;
  state: string;
  amountRaw: string;
  currency: string;
  memo: string;
  tonTxHash: string | null;
  createdAt: string;
}

function rawToHuman(raw: string): string {
  if (!raw || raw === '0') return '0';
  const padded = raw.padStart(10, '0');
  const intPart = padded.slice(0, padded.length - 9);
  const frac = padded.slice(padded.length - 9).replace(/0+$/, '');
  return frac ? `${intPart}.${frac}` : intPart;
}

const stateConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending_payment: { label: 'Pending', icon: Clock, className: 'text-yellow-400' },
  paid: { label: 'Paid', icon: CheckCircle, className: 'text-green-400' },
  fulfilled: { label: 'Fulfilled', icon: CheckCircle, className: 'text-emerald-400' },
  refunded: { label: 'Refunded', icon: XCircle, className: 'text-blue-400' },
  cancelled: { label: 'Cancelled', icon: XCircle, className: 'text-gray-400' },
  disputed: { label: 'Disputed', icon: AlertTriangle, className: 'text-red-400' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = () => {
    setLoading(true);
    fetch(commerceUrl('/buyers/me/orders'), { credentials: 'include' })
      .then((r) => r.json())
      .then((body: { data?: { orders: BuyerOrder[] } }) => {
        setOrders(body.data?.orders ?? []);
      })
      .catch((err: unknown) => logger.warn('[orders]', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Package className="w-6 h-6 text-[#FFD700]" />
        My Orders
      </h1>

      {loading && (
        <div className="text-center py-12 text-gray-400">Loading orders…</div>
      )}

      {!loading && orders.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <p className="text-gray-400">No orders yet.</p>
          <Link to="/" className="text-[#00F5FF] hover:underline text-sm">Browse products</Link>
        </div>
      )}

      <div className="space-y-3">
        {orders.map((order) => {
          const cfg = stateConfig[order.state] ?? stateConfig.pending_payment!;
          const Icon = cfg.icon;
          return (
            <div
              key={order.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${cfg.className}`} />
                  <span className={`text-sm font-semibold ${cfg.className}`}>{cfg.label}</span>
                </div>
                <span className="text-sm font-mono text-[#FFD700]">
                  {rawToHuman(order.amountRaw)} {order.currency}
                </span>
              </div>

              <div className="text-sm text-gray-300">
                {order.listingTitle || order.listingId}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{new Date(order.createdAt).toLocaleString()}</span>
                <div className="flex items-center gap-3">
                  {order.tonTxHash && (
                    <a
                      href={`https://tonviewer.com/transaction/${order.tonTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#00F5FF] hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Tx
                    </a>
                  )}
                  {(order.state === 'paid' || order.state === 'fulfilled') && (
                    <DisputeButton orderId={order.id} onDisputeOpened={fetchOrders} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
