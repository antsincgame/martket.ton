import { useState, useEffect, useCallback, type FC } from 'react';
import { Server, RefreshCw, CheckCircle, XCircle, Shield, Wifi, AlertCircle } from 'lucide-react';
import { storeApiUrl } from '../../lib/storeApi';
import { useAuth } from '../../contexts/AuthContext';

interface DetailedHealth {
  status: string;
  db: string;
  auth: string;
  shield: string;
  model: string;
  storage: string;
  scan: string;
  resend: string;
  nodeEnv: string;
  nodeVersion: string;
  uptimeSec: number;
  memoryMb: number;
}

interface EnvEntry {
  label: string;
  key: string;
  configured: boolean;
}

const frontendEnvEntries: EnvEntry[] = [
  { label: 'Appwrite Endpoint', key: 'VITE_APPWRITE_ENDPOINT', configured: !!import.meta.env.VITE_APPWRITE_ENDPOINT },
  { label: 'Appwrite Project ID', key: 'VITE_APPWRITE_PROJECT_ID', configured: !!import.meta.env.VITE_APPWRITE_PROJECT_ID },
  { label: 'Commerce API URL', key: 'VITE_COMMERCE_API_URL', configured: !!import.meta.env.VITE_COMMERCE_API_URL },
  { label: 'App Origin', key: 'VITE_APP_ORIGIN', configured: !!import.meta.env.VITE_APP_ORIGIN },
];

const StatusDot: FC<{ ok: boolean }> = ({ ok }) =>
  ok ? <CheckCircle className="w-4 h-4 text-[#00FF88]" /> : <XCircle className="w-4 h-4 text-[#FF4444]" />;

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const SystemConfig: FC = () => {
  const { getToken } = useAuth();
  const [health, setHealth] = useState<DetailedHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setHealthError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(storeApiUrl('/api/admin/system/health'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { success: boolean; data: DetailedHealth };
      setHealth(body.data);
    } catch (err) {
      setHealthError((err as Error).message);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { void fetchHealth(); }, [fetchHealth]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white uppercase tracking-widest flex items-center">
          <Server className="mr-3 text-[#FFD700]" />
          System Config
        </h2>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="border border-[#FFD700]/30 text-[#FFD700] px-4 py-2 rounded-lg hover:bg-[#FFD700]/10 transition-colors flex items-center space-x-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backend Health */}
        <div className="rounded-xl border border-[#FFD700]/10 bg-[#0D0D1A] p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Wifi className="w-5 h-5 mr-2 text-[#00F5FF]" />
            Backend Services
          </h3>
          {healthError ? (
            <div className="rounded-lg bg-[#FF4444]/10 border border-[#FF4444]/20 p-4">
              <div className="flex items-center space-x-2 text-[#FF4444] mb-1">
                <AlertCircle className="w-5 h-5" />
                <span className="font-semibold">Unreachable</span>
              </div>
              <p className="text-[#999999] text-sm">{healthError}</p>
            </div>
          ) : health ? (
            <div className="space-y-3">
              {([
                ['Status', health.status === 'OK', health.status],
                ['Database', health.db !== 'not_configured', health.db],
                ['Auth (Appwrite)', health.auth !== 'not_configured', health.auth],
                ['Storage (R2)', health.storage !== 'not_configured', health.storage],
                ['Email (Resend)', health.resend === 'configured', health.resend],
                ['AV Scan (VirusTotal)', health.scan !== 'not_configured', health.scan],
              ] as const).map(([label, ok, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[#999999] text-sm">{label}</span>
                  <div className="flex items-center space-x-2">
                    <StatusDot ok={ok} />
                    <span className={`text-sm font-mono ${ok ? 'text-[#00FF88]' : 'text-[#FF4444]'}`}>
                      {value}
                    </span>
                  </div>
                </div>
              ))}

              <div className="pt-3 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#999999] text-sm">Shield</span>
                  <span className="text-sm font-mono text-[#8B5CF6]">{health.shield}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#999999] text-sm">Model</span>
                  <span className="text-sm font-mono text-[#00F5FF]">{health.model}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#999999] text-sm">Node.js</span>
                  <span className="text-sm font-mono text-[#999999]">{health.nodeVersion}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#999999] text-sm">Uptime</span>
                  <span className="text-sm font-mono text-[#FFD700]">{formatUptime(health.uptimeSec)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#999999] text-sm">Memory (RSS)</span>
                  <span className="text-sm font-mono text-[#FFD700]">{health.memoryMb} MB</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center p-4">
              <RefreshCw className="w-5 h-5 animate-spin text-[#FFD700]" />
            </div>
          )}
        </div>

        {/* Frontend Environment */}
        <div className="rounded-xl border border-[#FFD700]/10 bg-[#0D0D1A] p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-[#FFD700]" />
            Frontend Environment
          </h3>
          <div className="space-y-3">
            {frontendEnvEntries.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between">
                <div>
                  <span className="text-[#999999] text-sm">{entry.label}</span>
                  <div className="text-xs font-mono text-[#666666]">{entry.key}</div>
                </div>
                <StatusDot ok={entry.configured} />
              </div>
            ))}
            <div className="pt-3 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[#999999] text-sm">Mode</span>
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                  import.meta.env.DEV
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-[#00FF88]/20 text-[#00FF88] border border-[#00FF88]/30'
                }`}>
                  {import.meta.env.DEV ? 'Development' : 'Production'}
                </span>
              </div>
              {health?.nodeEnv && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[#999999] text-sm">Backend Env</span>
                  <span className="text-xs font-mono text-[#999999]">{health.nodeEnv}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemConfig;
