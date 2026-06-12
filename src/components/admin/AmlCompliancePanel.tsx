import { useCallback, useState, type FC } from 'react';
import { Loader2, Lock, RefreshCw, ShieldAlert, CheckCircle2, Circle } from 'lucide-react';
import { adminCommerceFetch } from '../../lib/commerceApi';

interface AmlConfig {
  status: { enabled: boolean; threshold: number; cacheHours: number; asset: string };
  activeProvider: string;
  providers: Array<{ id: string; name: string; wired: boolean; note: string }>;
  gate: { failOpen: boolean; blocksAtOrAbove: number; note: string };
}

interface AmlCheckRow {
  id: string;
  wallet: string;
  asset: string;
  riskScore: number;
  verdict: string;
  checkedAt: string;
}

/**
 * AML / compliance console. Read-only operational view: the live env-driven
 * AML status, the provider registry (only AMLBot is wired; the rest are
 * candidates under evaluation), the gate semantics, and — the live part — the
 * REAL screening verdicts the order path writes to `aml_checks`. Wiring a new
 * provider is a backend change, not done from here.
 */
const AmlCompliancePanel: FC = () => {
  const [secretInput, setSecretInput] = useState('');
  const [secret, setSecret] = useState('');
  const [cfg, setCfg] = useState<AmlConfig | null>(null);
  const [checks, setChecks] = useState<AmlCheckRow[] | null>(null);
  const [checksNotProvisioned, setChecksNotProvisioned] = useState(false);
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
      const [cfgRes, checksRes] = await Promise.all([
        adminCommerceFetch('/admin/aml-config', secret) as Promise<{ data: AmlConfig }>,
        adminCommerceFetch('/admin/aml-checks?limit=50', secret) as Promise<{
          data: { checks: AmlCheckRow[]; notProvisioned?: boolean };
        }>,
      ]);
      setCfg(cfgRes.data);
      setChecks(checksRes.data.checks);
      setChecksNotProvisioned(Boolean(checksRes.data.notProvisioned));
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
            Wallet-origin risk scoring that complements sanctions screening: live status, the
            provider registry (final provider <span className="text-amber-300">under evaluation</span>),
            and the real screening verdicts written by the order path.
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
          Load
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

          {/* Live screening verdicts (real aml_checks rows) */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h3 className="font-semibold text-sm mb-3">
              Recent screenings{checks ? ` (${checks.length})` : ''}
            </h3>
            {checksNotProvisioned ? (
              <p className="text-xs text-amber-300/90">
                The <code className="font-mono">aml_checks</code> collection is not provisioned on this
                deployment yet — run the commerce provisioning script, then reload.
              </p>
            ) : !checks || checks.length === 0 ? (
              <p className="text-xs text-gray-500">
                No screenings recorded yet — rows appear here as soon as buyers create orders.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
                      <th className="py-1.5 pr-3">Wallet</th>
                      <th className="py-1.5 pr-3">Score</th>
                      <th className="py-1.5 pr-3">Verdict</th>
                      <th className="py-1.5">Checked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map((c) => {
                      const blocked = cfg && c.riskScore >= cfg.gate.blocksAtOrAbove;
                      return (
                        <tr key={c.id} className="border-t border-white/5">
                          <td className="py-1.5 pr-3 font-mono text-gray-300">
                            {c.wallet.length > 16 ? `${c.wallet.slice(0, 8)}…${c.wallet.slice(-6)}` : c.wallet}
                          </td>
                          <td className={`py-1.5 pr-3 font-mono ${blocked ? 'text-red-300' : 'text-emerald-300'}`}>
                            {c.riskScore < 0 ? '—' : c.riskScore}
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className={blocked ? 'text-red-300' : 'text-gray-300'}>
                              {c.verdict || '—'}
                            </span>
                          </td>
                          <td className="py-1.5 text-gray-500">
                            {c.checkedAt ? new Date(c.checkedAt).toLocaleString() : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
