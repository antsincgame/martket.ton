import { useCallback, useState, type FC } from 'react';
import { Loader2, Lock, RefreshCw } from 'lucide-react';
import { adminCommerceFetch } from '../../lib/commerceApi';

const CommerceAdminPanel: FC = () => {
  const [secretInput, setSecretInput] = useState('');
  const [secret, setSecret] = useState('');
  const [orders, setOrders] = useState<unknown[]>([]);
  const [audit, setAudit] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderStateId, setOrderStateId] = useState('');
  const [orderStateValue, setOrderStateValue] = useState('paid');

  const persistSecret = useCallback(() => {
    setSecret(secretInput.trim());
  }, [secretInput]);

  const loadAll = useCallback(async () => {
    if (!secret) {
      setError('Enter the operator secret');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [o, a] = await Promise.all([
        adminCommerceFetch('/admin/orders', secret) as Promise<{ data: { orders: unknown[] } }>,
        adminCommerceFetch('/admin/audit', secret) as Promise<{ data: { logs: unknown[] } }>,
      ]);
      setOrders(o.data.orders);
      setAudit(a.data.logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  }, [secret]);

  const patchOrderState = async () => {
    if (!secret || !orderStateId.trim()) return;
    setLoading(true);
    try {
      await adminCommerceFetch(`/admin/orders/${encodeURIComponent(orderStateId.trim())}/state`, secret, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: orderStateValue }),
      });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-white">
      <div className="flex items-start gap-2 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
        <Lock className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          The secret comes from <code className="font-mono">COMMERCE_ADMIN_SECRET</code> on the server. It is only stored in
          browser memory — you will need to re-enter it after a page refresh.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Secret</label>
          <input
            type="password"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 font-mono text-sm"
            placeholder="COMMERCE_ADMIN_SECRET"
          />
        </div>
        <button
          type="button"
          onClick={persistSecret}
          className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading || !secret}
          className="px-4 py-2 rounded-lg bg-ton-gradient text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {error && <div className="text-sm text-red-300">{error}</div>}

      <div className="rounded-xl border border-white/10 p-4 bg-black/20">
        <h3 className="font-semibold mb-2">Order Status</h3>
        <input
          value={orderStateId}
          onChange={(e) => setOrderStateId(e.target.value)}
          placeholder="order document id"
          className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 font-mono text-xs mb-2"
        />
        <select
          value={orderStateValue}
          onChange={(e) => setOrderStateValue(e.target.value)}
          className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-sm mb-2 text-black"
        >
          <option value="pending_payment">pending_payment</option>
          <option value="paid">paid</option>
          <option value="fulfilled">fulfilled</option>
          <option value="refunded">refunded</option>
          <option value="cancelled">cancelled</option>
        </select>
        <button
          type="button"
          onClick={() => void patchOrderState()}
          className="text-sm px-3 py-1 rounded bg-purple-600"
        >
          Apply
        </button>
      </div>

      <div className="rounded-xl border border-white/10 p-4 bg-black/20 overflow-x-auto">
        <h3 className="font-semibold mb-2">Orders ({orders.length})</h3>
        <pre className="text-[10px] text-gray-400 max-h-64 overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(orders, null, 2)}
        </pre>
      </div>
      <div className="rounded-xl border border-white/10 p-4 bg-black/20 overflow-x-auto">
        <h3 className="font-semibold mb-2">Commerce Audit ({audit.length})</h3>
        <pre className="text-[10px] text-gray-400 max-h-48 overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(audit, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default CommerceAdminPanel;
