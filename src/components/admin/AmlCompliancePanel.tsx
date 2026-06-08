import { useCallback, useState, type FC } from 'react';
import { Loader2, Lock, RefreshCw, ShieldAlert, CheckCircle2, Circle } from 'lucide-react';
import { adminCommerceFetch } from '../../lib/commerceApi';

interface AmlConfig {
  status: { enabled: boolean; threshold: number; cacheHours: number; asset: string };
  activeProvider: string;
  providers: Array<{ id: string; name: string; wired: boolean; note: string }>;
  gate: { failOpen: boolean; blocksAtOrAbove: number; note: string };
}

/**
 * AML / compliance console (MOCKUP). The AML provider is not finalised, so this
 * panel is read-only: it surfaces the live env-driven AML status, the candidate
 * provider registry, and the gate semantics. Wiring a new provider is a backend
 * change; this is the operator-facing view of where things stand.
 */
const AmlCompliancePanel: FC = () => {
  const [secretInput, setSecretInput] = useState('');
  const [secret, setSecret] = useState('');
  const [cfg, setCfg] = useState<AmlConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!secret) {
      setError('Enter the operator secret');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = (await adminCommerceFetch('/admin/aml-config', secret)) as { data: AmlConfig };
      setCfg(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  }, [secret]);

  return (
    <div className="space-y-6 text-white">
      <div className="flex items-start gap-2">
        <ShieldAlert className="w-5 h-5 mt-0.5 text-[#FFD700] shrink-0" />
        <div>
          <h2 className="text-lg font-semibold">AML / compliance</h2>
          <p className="text-xs text-gray-400 mt-1">
            Wallet-origin risk scoring that complements sanctions screening. The provider is{' '}
            <span className="text-amber-300">not finalised</span> — this console is a read-only mockup of the
            live status and the candidates under evaluation.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
        <Lock className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          The secret comes from <code className="font-mono">COMMERCE_ADMIN_SECRET</code> on the server, stored
          only in browser memory. Switching AML providers is a backend change, not done from here.
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
          onClick={() => setSecret(secretInput.trim())}
          className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || !secret}
          className="px-4 py-2 rounded-lg bg-ton-gradient text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Load config
        </button>
      </div>

      {error && <div className="text-sm text-red-300">{error}</div>}

      {cfg && (
        <div className="space-y-4">
          {/* Live status */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h3 className="font-semibold text-sm mb-3">Live status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Enabled">
                <span className={cfg.status.enabled ? 'text-emerald-300' : 'text-gray-400'}>
                  {cfg.status.enabled ? 'yes' : 'no (fail-open)'}
                </span>
              </Stat>
              <Stat label="Active provider">
                <span className="font-mono">{cfg.activeProvider}</span>
              </Stat>
              <Stat label="Block threshold">
                <span className="font-mono">{cfg.status.threshold}</span>
              </Stat>
              <Stat label="Asset / cache">
                <span className="font-mono">{cfg.status.asset} · {cfg.status.cacheHours}h</span>
              </Stat>
            </div>
          </div>

          {/* Provider registry (mockup) */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h3 className="font-semibold text-sm mb-3">Providers</h3>
            <ul className="space-y-2">
              {cfg.providers.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    {p.wired ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="font-medium">{p.name}</span>
                    {p.id === cfg.activeProvider && (
                      <span className="text-[9px] uppercase text-emerald-300 border border-emerald-300/40 rounded px-1">
                        active
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-gray-400">{p.wired ? p.note : `${p.note} · not wired`}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Gate semantics */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
            <h3 className="font-semibold mb-2">Gate</h3>
            <p>{cfg.gate.note}</p>
            <p className="text-xs text-gray-500 mt-2">
              fail-open: <span className="font-mono">{String(cfg.gate.failOpen)}</span> · blocks at score ≥{' '}
              <span className="font-mono">{cfg.gate.blocksAtOrAbove}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const Stat: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
    <div className="mt-0.5">{children}</div>
  </div>
);

export default AmlCompliancePanel;
