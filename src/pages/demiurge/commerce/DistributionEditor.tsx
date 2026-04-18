/**
 * DistributionEditor — manage a listing's distribution manifest.
 *
 * Demiurge picks a source kind (R2 BYOS or GitHub Releases), provides locator
 * fields and SHA256, then clicks Verify. Backend streams the file from source,
 * computes hash, compares with declared sha256. Only verified manifests can
 * be submitted for moderation.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, FileSearch, Github, Cloud } from 'lucide-react';
import {
  getDistribution,
  setDistribution,
  verifyDistribution,
  type DistributionView,
  type ManifestInput,
  type R2Locator,
  type GitHubLocator,
} from '../../../lib/distributionApi';

interface Props {
  listingId: string;
  wallet: string;
  onChange?: (view: DistributionView) => void;
}

const TTL_PRESETS: Array<{ value: number; label: string }> = [
  { value: 3600, label: '1 hour (default)' },
  { value: 10800, label: '3 hours' },
  { value: 21600, label: '6 hours (max, for heavy builds)' },
];

export default function DistributionEditor({ listingId, wallet, onChange }: Props) {
  const [view, setView] = useState<DistributionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<'r2' | 'github'>('r2');
  const [bucket, setBucket] = useState('');
  const [key, setKey] = useState('');
  const [repo, setRepo] = useState('');
  const [tag, setTag] = useState('');
  const [asset, setAsset] = useState('');
  const [sha256, setSha256] = useState('');
  const [filename, setFilename] = useState('');
  const [ttlSec, setTtlSec] = useState(3600);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const data = await getDistribution(listingId);
        if (cancelled) return;
        setView(data);
        if (data.kind === 'r2' && data.locator) {
          const loc = data.locator as R2Locator;
          setKind('r2');
          setBucket(loc.bucket);
          setKey(loc.key);
        } else if (data.kind === 'github' && data.locator) {
          const loc = data.locator as GitHubLocator;
          setKind('github');
          setRepo(loc.repo);
          setTag(loc.tag);
          setAsset(loc.asset);
        }
        if (data.sha256) setSha256(data.sha256);
        if (data.filename) setFilename(data.filename);
        if (data.ttlSec) setTtlSec(data.ttlSec);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  function buildManifest(): ManifestInput | null {
    if (!/^[a-fA-F0-9]{64}$/.test(sha256)) {
      setError('SHA256 must be 64 hex characters');
      return null;
    }
    if (kind === 'r2') {
      if (!bucket || !key) {
        setError('Bucket and key are required for R2');
        return null;
      }
      return { kind: 'r2', bucket, key, sha256, filename: filename || undefined };
    }
    if (!repo || !tag || !asset) {
      setError('Repo, tag and asset are required for GitHub');
      return null;
    }
    return { kind: 'github', repo, tag, asset, sha256, filename: filename || undefined };
  }

  async function onSave() {
    const manifest = buildManifest();
    if (!manifest) return;
    setSaving(true);
    setError(null);
    try {
      const data = await setDistribution(listingId, wallet, manifest, ttlSec);
      setView(data);
      onChange?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onVerify() {
    setVerifying(true);
    setError(null);
    try {
      const r = await verifyDistribution(listingId, wallet);
      const data = await getDistribution(listingId);
      setView(data);
      onChange?.(data);
      if (!r.matches) {
        setError(`SHA256 mismatch! Declared: ${sha256.slice(0, 16)}... Actual: ${r.sha256.slice(0, 16)}...`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verify failed');
    } finally {
      setVerifying(false);
    }
  }

  if (loading) return <div className="text-sm text-[#666] p-4">Loading distribution...</div>;

  const state = view?.state || 'draft';
  const stateBadge = STATE_BADGES[state] || STATE_BADGES.draft;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Distribution manifest</h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] uppercase tracking-wider border ${stateBadge.className}`}>
          <stateBadge.Icon className="w-3.5 h-3.5" />
          {stateBadge.label}
        </span>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      )}

      <div className="rounded-xl border border-white/[0.08] bg-black/30 p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-2">
          <KindCard active={kind === 'r2'} onClick={() => setKind('r2')} icon={Cloud} label="R2 / S3 (your bucket)">
            Private + signed URLs. Best for paid DRM-protected builds.
          </KindCard>
          <KindCard active={kind === 'github'} onClick={() => setKind('github')} icon={Github} label="GitHub Release (public)">
            Free unlimited bandwidth. Best for open-source / freemium tools.
          </KindCard>
        </div>

        {kind === 'r2' ? (
          <>
            <Input label="Bucket" value={bucket} onChange={setBucket} placeholder="my-app-builds" />
            <Input label="Object key" value={key} onChange={setKey} placeholder="releases/v1.0.0/build.zip" mono />
          </>
        ) : (
          <>
            <Input label="Repository (owner/name)" value={repo} onChange={setRepo} placeholder="acme/my-app" />
            <Input label="Tag" value={tag} onChange={setTag} placeholder="v1.0.0" />
            <Input label="Asset name" value={asset} onChange={setAsset} placeholder="my-app-1.0.0.zip" />
          </>
        )}

        <Input label="SHA256 (64 hex chars)" value={sha256} onChange={setSha256} mono placeholder="e3b0c44..." />
        <Input label="Filename (shown to buyer)" value={filename} onChange={setFilename} placeholder="my-app-1.0.0.zip" />

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-[#888] mb-1">Download URL TTL</label>
          <select
            value={ttlSec}
            onChange={(e) => setTtlSec(parseInt(e.target.value, 10))}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          >
            {TTL_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-[#666] mt-1">
            Time the buyer has to <strong>start</strong> downloading. Once started, the connection stays alive for the full transfer.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-[#00F5FF] text-black px-4 py-2 text-sm font-semibold hover:bg-[#00F5FF]/80 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save manifest'}
          </button>
          <button
            type="button"
            onClick={onVerify}
            disabled={verifying || state === 'draft' && !view?.locator}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
          >
            <FileSearch className="w-4 h-4" /> {verifying ? 'Verifying...' : 'Verify (stream + hash)'}
          </button>
        </div>

        {view?.verifiedAt && (
          <div className="text-[11px] text-[#666]">
            Last verified: {new Date(view.verifiedAt).toLocaleString()} · size: {view.size?.toLocaleString() || '?'} bytes
          </div>
        )}
      </div>
    </div>
  );
}

const STATE_BADGES: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  draft: { label: 'Draft', className: 'border-white/10 bg-white/5 text-[#888]', Icon: FileSearch },
  verified: { label: 'Verified', className: 'border-[#00FF88]/30 bg-[#00FF88]/10 text-[#00FF88]', Icon: CheckCircle2 },
  manifest_drift: { label: 'Hash drift!', className: 'border-red-500/30 bg-red-500/10 text-red-200', Icon: AlertTriangle },
  source_unavailable: { label: 'Source down', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200', Icon: AlertTriangle },
};

function KindCard({
  active,
  onClick,
  icon: Icon,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Cloud;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-3 transition-colors ${
        active ? 'border-[#00F5FF]/50 bg-[#00F5FF]/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-center gap-2 font-semibold text-white mb-1">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <div className="text-[11px] text-[#888] leading-relaxed">{children}</div>
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-[#888] mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white ${mono ? 'font-mono text-xs' : ''}`}
      />
    </div>
  );
}
