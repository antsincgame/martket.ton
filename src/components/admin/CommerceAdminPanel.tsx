import { useCallback, useState, type FC } from 'react';
import { Loader2, Lock, RefreshCw } from 'lucide-react';
import { adminCommerceFetch } from '../../lib/commerceApi';

const SESSION_KEY = 'tonwebstore_commerce_admin_secret';

const CommerceAdminPanel: FC = () => {
  const [secretInput, setSecretInput] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? '');
  const [secret, setSecret] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? '');
  const [orders, setOrders] = useState<unknown[]>([]);
  const [disputes, setDisputes] = useState<unknown[]>([]);
  const [audit, setAudit] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderStateId, setOrderStateId] = useState('');
  const [orderStateValue, setOrderStateValue] = useState('paid');
  const [resolveDisputeId, setResolveDisputeId] = useState('');
  const [resolveKind, setResolveKind] = useState<'refund' | 'release'>('release');
  const [resolveNote, setResolveNote] = useState('');

  const persistSecret = useCallback(() => {
    const s = secretInput.trim();
    sessionStorage.setItem(SESSION_KEY, s);
    setSecret(s);
  }, [secretInput]);

  const loadAll = useCallback(async () => {
    if (!secret) {
      setError('Введите секрет оператора');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [o, d, a] = await Promise.all([
        adminCommerceFetch('/admin/orders', secret) as Promise<{ data: { orders: unknown[] } }>,
        adminCommerceFetch('/admin/disputes', secret) as Promise<{ data: { disputes: unknown[] } }>,
        adminCommerceFetch('/admin/audit', secret) as Promise<{ data: { logs: unknown[] } }>,
      ]);
      setOrders(o.data.orders);
      setDisputes(d.data.disputes);
      setAudit(a.data.logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
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
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const resolveDispute = async () => {
    if (!secret || !resolveDisputeId.trim()) return;
    setLoading(true);
    try {
      await adminCommerceFetch(
        `/admin/disputes/${encodeURIComponent(resolveDisputeId.trim())}/resolve`,
        secret,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution: resolveKind, resolutionNote: resolveNote }),
        }
      );
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-white">
      <div className="flex items-start gap-2 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
        <Lock className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          Секрет берётся из <code className="font-mono">COMMERCE_ADMIN_SECRET</code> на сервере. Хранится только в
          sessionStorage браузера для этой вкладки.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Секрет</label>
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
          Сохранить
        </button>
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading || !secret}
          className="px-4 py-2 rounded-lg bg-ton-gradient text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Обновить
        </button>
      </div>

      {error && <div className="text-sm text-red-300">{error}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 p-4 bg-black/20">
          <h3 className="font-semibold mb-2">Статус заказа</h3>
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
            Применить
          </button>
        </div>
        <div className="rounded-xl border border-white/10 p-4 bg-black/20">
          <h3 className="font-semibold mb-2">Решение спора</h3>
          <input
            value={resolveDisputeId}
            onChange={(e) => setResolveDisputeId(e.target.value)}
            placeholder="dispute id"
            className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 font-mono text-xs mb-2"
          />
          <select
            value={resolveKind}
            onChange={(e) => setResolveKind(e.target.value as 'refund' | 'release')}
            className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-sm mb-2 text-black"
          >
            <option value="release">release (заказ fulfilled)</option>
            <option value="refund">refund (заказ refunded)</option>
          </select>
          <textarea
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            placeholder="Заметка"
            rows={2}
            className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-xs mb-2 text-white"
          />
          <button
            type="button"
            onClick={() => void resolveDispute()}
            className="text-sm px-3 py-1 rounded bg-amber-600"
          >
            Закрыть спор
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 p-4 bg-black/20 overflow-x-auto">
        <h3 className="font-semibold mb-2">Заказы ({orders.length})</h3>
        <pre className="text-[10px] text-gray-400 max-h-64 overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(orders, null, 2)}
        </pre>
      </div>
      <div className="rounded-xl border border-white/10 p-4 bg-black/20 overflow-x-auto">
        <h3 className="font-semibold mb-2">Споры ({disputes.length})</h3>
        <pre className="text-[10px] text-gray-400 max-h-48 overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(disputes, null, 2)}
        </pre>
      </div>
      <div className="rounded-xl border border-white/10 p-4 bg-black/20 overflow-x-auto">
        <h3 className="font-semibold mb-2">Аудит commerce ({audit.length})</h3>
        <pre className="text-[10px] text-gray-400 max-h-48 overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(audit, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default CommerceAdminPanel;
