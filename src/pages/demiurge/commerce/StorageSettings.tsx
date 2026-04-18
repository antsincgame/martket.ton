/**
 * StorageSettings — Bring Your Own Storage configuration for demiurges.
 *
 * Demiurges connect their own R2 (or S3-compatible) bucket here. Credentials
 * are sent once over HTTPS, encrypted server-side (AES-256-GCM), and never
 * leave the backend in plaintext. The UI displays only metadata: provider,
 * account, bucket, status, last check.
 */

import { useEffect, useState } from 'react';
import { Database, Plug, ShieldAlert, ShieldCheck, Trash2, RefreshCcw } from 'lucide-react';
import {
  getStorageConfig,
  saveStorageConfig,
  testStorageConfig,
  revokeStorageConfig,
  type StorageView,
  type StorageProvider,
} from '../../../lib/storageApi';

interface Props {
  wallet: string;
}

const PROVIDERS: Array<{ id: StorageProvider; label: string; hint: string }> = [
  {
    id: 'cloudflare-r2',
    label: 'Cloudflare R2',
    hint: '10 GB free, zero egress fees. Recommended for most demiurges.',
  },
  {
    id: 'b2',
    label: 'Backblaze B2',
    hint: '10 GB free + 30 GB/day egress. S3-compatible.',
  },
  {
    id: 's3',
    label: 'AWS S3',
    hint: '5 GB free for 12 months. Egress charged after free tier.',
  },
];

export default function StorageSettings({ wallet }: Props) {
  const [config, setConfig] = useState<StorageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Form state (only shown when editing)
  const [provider, setProvider] = useState<StorageProvider>('cloudflare-r2');
  const [accountId, setAccountId] = useState('');
  const [bucket, setBucket] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [publicBaseUrl, setPublicBaseUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getStorageConfig(wallet);
        if (!cancelled) setConfig(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load storage config');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  async function onSave() {
    if (!provider || !accountId || !bucket || !accessKeyId || !secretAccessKey) {
      setError('All fields are required (account, bucket, access key, secret).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await saveStorageConfig({
        wallet,
        provider,
        accountId,
        bucket,
        endpoint: endpoint || undefined,
        accessKeyId,
        secretAccessKey,
        publicBaseUrl: publicBaseUrl || undefined,
      });
      setConfig(data);
      setEditing(false);
      setAccessKeyId('');
      setSecretAccessKey('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    setError(null);
    try {
      const r = await testStorageConfig(wallet);
      setConfig((prev) => (prev ? { ...prev, status: r.status, lastCheckAt: r.lastCheckAt, lastError: r.lastError } : prev));
      if (r.status !== 'connected') {
        setError(`Test failed: ${r.lastError}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  async function onRevoke() {
    if (!confirm('Revoke storage credentials? Your products will become undownloadable.')) return;
    setSaving(true);
    setError(null);
    try {
      await revokeStorageConfig(wallet);
      const data = await getStorageConfig(wallet);
      setConfig(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-[#666] p-4">Loading storage settings...</div>;
  }

  const status = config?.status || 'unconfigured';
  const isConfigured = status === 'connected' || status === 'error';

  return (
    <div className="space-y-4">
      <header className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#00F5FF]/10 border border-[#00F5FF]/30 flex items-center justify-center">
          <Database className="w-5 h-5 text-[#00F5FF]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white">Bring Your Own Storage</h2>
          <p className="text-sm text-[#888]">
            Host your builds on your own R2 / S3 bucket. Zero platform egress fees, you control the file.
          </p>
        </div>
        <StatusBadge status={status} />
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!editing && isConfigured && config && (
        <div className="rounded-xl border border-white/[0.08] bg-black/30 p-4 space-y-3">
          <Row label="Provider" value={config.provider || '-'} />
          <Row label="Account" value={config.accountId || '-'} />
          <Row label="Bucket" value={config.bucket || '-'} />
          <Row label="Endpoint" value={config.endpoint || '-'} mono />
          <Row label="Last check" value={config.lastCheckAt ? new Date(config.lastCheckAt).toLocaleString() : '-'} />
          {config.lastError && <Row label="Last error" value={config.lastError} mono />}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={onTest}
              disabled={testing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCcw className="w-3.5 h-3.5" /> {testing ? 'Testing...' : 'Test connection'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              <Plug className="w-3.5 h-3.5" /> Update credentials
            </button>
            <button
              type="button"
              onClick={onRevoke}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Revoke
            </button>
          </div>
        </div>
      )}

      {(editing || !isConfigured) && (
        <div className="rounded-xl border border-white/[0.08] bg-black/30 p-4 space-y-4">
          <Field label="Provider">
            <div className="grid sm:grid-cols-3 gap-2">
              {PROVIDERS.map((p) => (
                <label
                  key={p.id}
                  className={`cursor-pointer rounded-xl border p-3 text-xs transition-colors ${
                    provider === p.id
                      ? 'border-[#00F5FF]/50 bg-[#00F5FF]/10'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <input
                    type="radio"
                    name="storage_provider"
                    value={p.id}
                    checked={provider === p.id}
                    onChange={() => setProvider(p.id)}
                    className="sr-only"
                  />
                  <div className="font-semibold text-white mb-1">{p.label}</div>
                  <div className="text-[#888] text-[11px]">{p.hint}</div>
                </label>
              ))}
            </div>
          </Field>
          <Field label={provider === 'cloudflare-r2' ? 'Account ID' : provider === 's3' ? 'Region (e.g. us-east-1)' : 'Account/Region'}>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder={provider === 'cloudflare-r2' ? 'a1b2c3d4...' : 'us-east-1'}
            />
          </Field>
          <Field label="Bucket name">
            <input
              type="text"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="my-app-builds"
            />
          </Field>
          <Field label="Endpoint (optional, for custom)">
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="https://...r2.cloudflarestorage.com"
            />
          </Field>
          <Field label="Access Key ID">
            <input
              type="text"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white font-mono"
              autoComplete="off"
            />
          </Field>
          <Field label="Secret Access Key">
            <input
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white font-mono"
              autoComplete="off"
            />
          </Field>
          <Field label="Public base URL (optional, for public covers/screenshots)">
            <input
              type="text"
              value={publicBaseUrl}
              onChange={(e) => setPublicBaseUrl(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="https://cdn.yourapp.com"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00F5FF] text-black px-4 py-2 text-sm font-semibold hover:bg-[#00F5FF]/80 disabled:opacity-50"
            >
              {saving ? 'Validating...' : 'Save & test'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="text-[11px] text-[#666] leading-relaxed">
            Credentials are encrypted server-side with AES-256-GCM. The plaintext key is not persisted.
            We perform a HeadBucket / PutObject probe on save to validate access.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; Icon: typeof ShieldCheck }> = {
    connected: { label: 'Connected', className: 'border-[#00FF88]/30 bg-[#00FF88]/10 text-[#00FF88]', Icon: ShieldCheck },
    error: { label: 'Error', className: 'border-red-500/30 bg-red-500/10 text-red-200', Icon: ShieldAlert },
    revoked: { label: 'Revoked', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200', Icon: ShieldAlert },
    unconfigured: { label: 'Not configured', className: 'border-white/10 bg-white/5 text-[#888]', Icon: Plug },
  };
  const m = map[status] || map.unconfigured!;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] uppercase tracking-wider border ${m.className}`}>
      <m.Icon className="w-3.5 h-3.5" />
      {m.label}
    </span>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-[#888]">{label}</span>
      <span className={`text-white text-right ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-[#888] mb-1">{label}</label>
      {children}
    </div>
  );
}
