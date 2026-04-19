// API Tokens tab for the Commerce console.
// Sellers manage Personal Access Tokens for the public Agent API. The
// freshly issued plaintext is shown once — after that we only have its
// prefix on hand.
import { useCallback, useEffect, useState } from 'react';
import { useTonAddress } from '@tonconnect/ui-react';
import {
  Copy, KeyRound, Loader2, Plus, ShieldAlert, Trash2,
} from 'lucide-react';
import {
  listAgentTokens,
  issueAgentToken,
  revokeAgentTokenById,
  type AgentScope,
  type AgentTokenSummary,
  type IssuedAgentToken,
} from '../../../lib/commerceApi';
import type { TonForgeDeveloperWorkspace } from '../../../domain/tonforge/types';
import { logger } from '../../../lib/logger';

const ALL_SCOPES: { value: AgentScope; label: string; help: string }[] = [
  { value: 'listings:read', label: 'listings:read', help: 'Read your listings and prices.' },
  { value: 'listings:write', label: 'listings:write', help: 'Create / update listings, change prices, activate.' },
  { value: 'orders:read', label: 'orders:read', help: 'Read recent orders and buyer wallets.' },
  { value: 'distribution:write', label: 'distribution:write', help: 'Configure the build manifest (R2 / GitHub release).' },
];

interface Props {
  workspace: TonForgeDeveloperWorkspace | null;
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export default function ApiTokensTab({ workspace }: Props) {
  const wallet = useTonAddress();
  const kycApproved = workspace?.developer.kycStatus === 'approved';

  const [tokens, setTokens] = useState<AgentTokenSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIssue, setShowIssue] = useState(false);
  const [justIssued, setJustIssued] = useState<IssuedAgentToken | null>(null);

  const reload = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listAgentTokens();
      setTokens(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => { void reload(); }, [reload]);

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this token? Agents using it will immediately lose access.')) return;
    setRevokingId(id);
    try {
      await revokeAgentTokenById(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setRevokingId(null);
    }
  };

  if (!wallet) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        Connect your TON wallet to manage Agent API tokens.
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[#a8a8be]">
        Loading workspace...
      </div>
    );
  }

  if (!kycApproved) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
        <div className="flex items-center gap-2 text-amber-100 font-semibold text-sm">
          <ShieldAlert className="w-4 h-4" />
          KYC required
        </div>
        <p className="text-xs text-amber-100/80">
          Agent API tokens are available only to verified sellers. Submit
          KYC in the Publishing tab first.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#FFD700]" />
            Agent API tokens
          </h2>
          <p className="text-xs text-[#888] mt-1">
            Personal access tokens for AI agents acting on your behalf.
            Each token is bound to your wallet and the scopes you grant.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setJustIssued(null); setShowIssue(true); }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#FFD700] text-[#0A0A0A] px-3 py-1.5 text-sm font-semibold hover:shadow-[0_0_20px_rgba(255,215,0,0.3)]"
        >
          <Plus className="w-4 h-4" /> Issue new token
        </button>
      </header>

      {justIssued && <FreshTokenBanner issued={justIssued} onClose={() => setJustIssued(null)} />}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {showIssue && (
        <IssueTokenForm
          onCancel={() => setShowIssue(false)}
          onIssued={(t) => {
            setShowIssue(false);
            setJustIssued(t);
            void reload();
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#888]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading tokens…
        </div>
      ) : tokens.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-black/30 p-6 text-center text-sm text-[#888]">
          No tokens yet. Issue your first one to let an AI agent manage your listings.
        </div>
      ) : (
        <ul className="space-y-2">
          {tokens.map((t) => {
            const isRevoked = !!t.revokedAt;
            const isExpired = !!t.expiresAt && new Date(t.expiresAt).getTime() < Date.now();
            return (
              <li
                key={t.id}
                className={`rounded-xl border p-3 flex items-start justify-between gap-3 ${
                  isRevoked || isExpired
                    ? 'border-white/[0.06] bg-black/10 opacity-60'
                    : 'border-white/[0.08] bg-black/30'
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm truncate">{t.name}</span>
                    {isRevoked && <span className="text-[10px] uppercase text-rose-300">revoked</span>}
                    {!isRevoked && isExpired && <span className="text-[10px] uppercase text-amber-300">expired</span>}
                  </div>
                  <code className="block text-[11px] font-mono text-[#888] break-all">{t.tokenPrefix}…</code>
                  <p className="text-[11px] text-[#666]">
                    scopes: <span className="text-white/80">{t.scopes || '—'}</span>
                  </p>
                  <p className="text-[11px] text-[#666]">
                    created {shortDate(t.createdAt)} · expires {shortDate(t.expiresAt)} · last used {shortDate(t.lastUsedAt)}
                  </p>
                </div>
                {!isRevoked && (
                  <button
                    type="button"
                    disabled={revokingId === t.id}
                    onClick={() => void handleRevoke(t.id)}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    {revokingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Revoke
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function IssueTokenForm({
  onCancel,
  onIssued,
}: {
  onCancel: () => void;
  onIssued: (issued: IssuedAgentToken) => void;
}) {
  const wallet = useTonAddress();
  const [name, setName] = useState('');
  const [ttlDays, setTtlDays] = useState(90);
  const [scopes, setScopes] = useState<AgentScope[]>(['listings:read']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (s: AgentScope) => {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const issued = await issueAgentToken({ wallet, name: name.trim(), scopes, ttlDays });
      onIssued(issued);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Issue failed';
      setError(msg);
      logger.warn('[ApiTokensTab] issue failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  const valid = name.trim().length >= 2 && scopes.length > 0;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white">Issue a new Agent API token</h3>
      <label className="block">
        <span className="block text-[10px] uppercase tracking-wider text-[#666] mb-1">Token name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My pricing agent"
          className="w-full rounded-lg border border-white/[0.1] bg-black/40 px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="block">
        <span className="block text-[10px] uppercase tracking-wider text-[#666] mb-1">Expires in (days, max 365)</span>
        <input
          type="number"
          value={ttlDays}
          min={1}
          max={365}
          onChange={(e) => setTtlDays(parseInt(e.target.value, 10) || 90)}
          className="w-32 rounded-lg border border-white/[0.1] bg-black/40 px-3 py-2 text-sm text-white"
        />
      </label>
      <fieldset className="space-y-1.5">
        <legend className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Scopes</legend>
        {ALL_SCOPES.map((s) => (
          <label key={s.value} className="flex items-start gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={scopes.includes(s.value)}
              onChange={() => toggle(s.value)}
              className="mt-0.5"
            />
            <span>
              <code className="font-mono text-white">{s.label}</code> — <span className="text-[#888]">{s.help}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!valid || submitting}
          onClick={() => void submit()}
          className="rounded-lg bg-[#FFD700] text-[#0A0A0A] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Generate token'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FreshTokenBanner({
  issued,
  onClose,
}: {
  issued: IssuedAgentToken;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const copy = () => {
    navigator.clipboard
      .writeText(issued.token)
      .then(() => {
        setCopied('ok');
        setTimeout(() => setCopied('idle'), 1500);
      })
      .catch(() => {
        setCopied('fail');
        setTimeout(() => setCopied('idle'), 2500);
      });
  };
  return (
    <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-emerald-100">Token issued — copy it now</h3>
        <button onClick={onClose} className="text-xs text-emerald-100/70 hover:text-emerald-100">Dismiss</button>
      </div>
      <p className="text-xs text-emerald-100/80">
        We will not show this token again. Store it in your secret manager.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono text-[12px] text-white break-all bg-black/40 px-3 py-2 rounded-lg">
          {issued.token}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100"
        >
          <Copy className="w-3.5 h-3.5" /> {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Failed — copy manually' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
