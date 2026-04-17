import { useState, useCallback } from 'react';
import {
  Wallet, Link2, Unlink, AlertTriangle, CheckCircle,
  TrendingUp, History, RefreshCw, Loader2,
} from 'lucide-react';
import { TonConnectButton, useTonAddress } from '@tonconnect/ui-react';
import { useAuth } from '../../contexts/AuthContext';
import { storeApiUrl } from '../../lib/storeApi';
import { CopyableText } from '../../components/ui/CopyButton';
import { useToast } from '../../components/ui/Toast';
import {
  usePayoutsQuery, useTransactionsQuery, useSessionInvalidator,
  type PayoutGroup, type TransactionRow,
} from '../../queries/sessionQueries';

export default function WalletSection() {
  const tonAddress = useTonAddress();
  const { user, fetchProfile, getToken } = useAuth();
  const [status, setStatus] = useState<'idle' | 'linking' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const { toast } = useToast();

  const linkedAddress = user?.tonAddress;

  const handleLink = useCallback(async () => {
    if (!tonAddress) return;
    setStatus('linking');
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/session/profile'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ton_address: tonAddress }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Link failed' }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      setStatus('success');
      toast('success', 'Wallet linked successfully');
      await fetchProfile();
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Failed to link wallet';
      setError(msg);
      toast('error', msg);
    }
  }, [tonAddress, getToken, fetchProfile, toast]);

  const handleUnlink = useCallback(async () => {
    setStatus('linking');
    setError(null);
    setShowUnlinkConfirm(false);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/session/profile'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ton_address: null }),
      });
      if (!res.ok) throw new Error('Unlink failed');
      setStatus('idle');
      toast('info', 'Wallet unlinked');
      await fetchProfile();
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Failed to unlink';
      setError(msg);
      toast('error', msg);
    }
  }, [getToken, fetchProfile, toast]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold uppercase tracking-widest text-white flex items-center gap-3">
          <Wallet className="w-7 h-7 text-[#00FF88]" />
          TON Wallet
        </h1>
        <p className="text-[#666] text-sm mt-1">Manage your blockchain identity</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111119] p-6 space-y-5 max-w-xl">
        {linkedAddress ? (
          <>
            <div className="rounded-lg bg-gradient-to-r from-[#00FF88]/[0.08] to-[#00F5FF]/[0.04] border border-[#00FF88]/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-[#00FF88]" />
                <span className="text-[#00FF88] text-xs font-semibold uppercase tracking-wider">Linked</span>
              </div>
              <CopyableText text={linkedAddress} truncate={false} />
            </div>

            <div className="flex items-center gap-3">
              <TonConnectButton />
              <button
                onClick={() => setShowUnlinkConfirm(true)}
                disabled={status === 'linking'}
                className="border border-[#FF4444]/20 hover:bg-[#FF4444]/10 text-[#FF4444] px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Unlink className="w-3.5 h-3.5" />
                Unlink
              </button>
            </div>

            {showUnlinkConfirm && (
              <div className="rounded-lg border border-[#FF4444]/20 bg-[#FF4444]/[0.05] p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#FF4444] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-medium">Unlink wallet?</p>
                    <p className="text-[#999] text-xs mt-1">
                      You will lose access to downloads in your Arsenal until you link a wallet again.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleUnlink}
                    className="bg-[#FF4444] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#FF4444]/80 transition-colors">
                    Yes, unlink
                  </button>
                  <button onClick={() => setShowUnlinkConfirm(false)}
                    className="border border-white/10 text-[#999] text-xs px-4 py-2 rounded-lg hover:text-white transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[#888] text-sm">
              Connect your TON wallet to enable crypto payments and receive earnings from your creations.
            </p>
            <TonConnectButton />
            {tonAddress && tonAddress !== linkedAddress && (
              <button
                onClick={handleLink}
                disabled={status === 'linking'}
                className="w-full py-3 rounded-xl bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest text-xs transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Link2 className="w-4 h-4" />
                <span>{status === 'linking' ? 'Linking...' : `Link ${tonAddress.slice(0, 6)}...${tonAddress.slice(-4)}`}</span>
              </button>
            )}
          </>
        )}

        {error && (
          <p className="text-[#FF4444] text-sm">{error}</p>
        )}
      </div>

      <PayoutsLedger />
      <TransactionsTable />
    </div>
  );
}

function PayoutsLedger() {
  const { data, isLoading, error } = usePayoutsQuery();
  const { invalidatePayouts } = useSessionInvalidator();
  const ledger = data ?? null;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-[#111119] p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-[#FFD700]" aria-hidden />
          <h2 className="text-lg font-semibold text-white">Реестр выплат</h2>
        </div>
        <button
          type="button"
          onClick={() => void invalidatePayouts()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white hover:bg-white/[0.08] disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Обновить
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          {error.message}
        </div>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Totals label="Lifetime" value={`${(ledger?.totals.lifetimeTon ?? 0).toFixed(2)} TON`} accent="#FFD700" />
        <Totals label="Текущий месяц" value={`${(ledger?.totals.thisMonthTon ?? 0).toFixed(2)} TON`} accent="#00F5FF" />
        <Totals label="Всего продаж" value={String(ledger?.totals.salesAllTime ?? 0)} accent="#00FF88" />
      </dl>

      {isLoading && !ledger ? (
        <SkeletonRows />
      ) : ledger && ledger.payouts.length > 0 ? (
        <ul className="divide-y divide-white/[0.04] rounded-lg border border-white/[0.06] overflow-hidden">
          {ledger.payouts.map((row: PayoutGroup) => (
            <li key={row.month} className="flex items-center justify-between px-4 py-3">
              <span className="text-[#888] text-sm tabular-nums">
                {formatMonth(row.month)}
              </span>
              <span className="text-white font-semibold tabular-nums">
                {row.totalTon.toFixed(2)} TON
              </span>
              <span className="text-[#666] text-xs tabular-nums">
                {row.salesCount} прод.
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#666]">Пока нет начислений. Опубликуйте приложение и продайте первую копию.</p>
      )}
    </section>
  );
}

function TransactionsTable() {
  const { data, isLoading, error } = useTransactionsQuery(50);
  const txs = data ?? [];

  return (
    <section className="rounded-xl border border-white/[0.06] bg-[#111119] p-6">
      <header className="flex items-center gap-3 mb-4">
        <History className="w-5 h-5 text-[#00F5FF]" aria-hidden />
        <h2 className="text-lg font-semibold text-white">История транзакций</h2>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          {error.message}
        </div>
      )}

      {isLoading && txs.length === 0 ? (
        <SkeletonRows />
      ) : txs.length === 0 ? (
        <p className="text-sm text-[#666]">Пока нет транзакций.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-[#666]">
              <tr>
                <th className="px-3 py-2 text-left">Дата</th>
                <th className="px-3 py-2 text-left">Тип</th>
                <th className="px-3 py-2 text-left">Продукт</th>
                <th className="px-3 py-2 text-right">Сумма</th>
                <th className="px-3 py-2 text-left">Статус</th>
                <th className="px-3 py-2 text-left">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {txs.map((tx: TransactionRow) => (
                <tr key={tx.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-[#888] tabular-nums whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <TypeBadge type={tx.type} />
                  </td>
                  <td className="px-3 py-2 text-white max-w-[220px] truncate" title={tx.productName ?? ''}>
                    {tx.productName ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white">
                    +{tx.amountTon.toFixed(2)} TON
                  </td>
                  <td className="px-3 py-2 text-xs text-[#888]">{tx.status}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#00F5FF]">
                    {tx.txHash ? `${tx.txHash.slice(0, 6)}…${tx.txHash.slice(-4)}` : '—'}
                  </td>
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
      <div className="text-xl font-display font-bold tabular-nums mt-1" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: TransactionRow['type'] }) {
  const meta: Record<TransactionRow['type'], { label: string; color: string }> = {
    sale: { label: 'Продажа', color: '#00FF88' },
    payout: { label: 'Выплата', color: '#FFD700' },
    refund: { label: 'Возврат', color: '#FF6B6B' },
  };
  const m = meta[type];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider border"
      style={{
        color: m.color,
        borderColor: `${m.color}55`,
        backgroundColor: `${m.color}14`,
      }}
    >
      {m.label}
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-9 rounded-lg border border-white/[0.06] bg-black/20 animate-pulse" />
      ))}
    </div>
  );
}

function formatMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
}
