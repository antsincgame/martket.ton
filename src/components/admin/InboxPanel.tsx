import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Inbox, Mail, MailOpen, Archive, Trash2, RefreshCw,
  Copy, ExternalLink, AlertTriangle, CheckCircle2, Loader2, ChevronLeft,
  Reply, Send, PenSquare, Globe, Server, Info,
} from 'lucide-react';
import { storeApiUrl } from '../../lib/storeApi';
import { useAuth } from '../../contexts/AuthContext';

interface InboundAttachmentMeta {
  id: string;
  filename: string;
  contentType: string;
  contentDisposition?: string;
  contentId?: string;
}

interface InboundEmail {
  id: string;
  emailId: string;
  messageId: string | null;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  receivedAt: string;
  attachments: InboundAttachmentMeta[];
  previewText: string | null;
  status: 'new' | 'read' | 'replied' | 'archived';
  isRead: boolean;
  assignedTo: string | null;
  createdAt: string;
}

interface InboxList { items: InboundEmail[]; unread: number }
interface InboxSetup {
  webhookUrl: string;
  webhookSecretConfigured: boolean;
  senderFrom: string | null;
  apiKeyConfigured: boolean;
}
interface EmailBody { html?: string; text?: string; headers?: Record<string, string>; [k: string]: unknown }
interface EmailDetailResponse { meta: InboundEmail; body: EmailBody | null }
interface DomainInfo {
  domain: string;
  status: string;
  region: string;
  id: string;
  catchAll: boolean;
  suggestedAddresses: string[];
}
interface AddressesResponse { domains: DomainInfo[]; senderFrom: string | null }

type View = 'list' | 'detail' | 'compose' | 'addresses';

async function apiFetch<T>(path: string, token: string | null, options?: RequestInit): Promise<T> {
  const res = await fetch(storeApiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.message || 'API error');
  return body.data as T;
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function parseFrom(raw: string): { name: string; addr: string } {
  const m = /^(.*?)\s*<([^>]+)>\s*$/.exec(raw);
  if (m) return { name: (m[1] ?? '').replace(/^"|"$/g, '').trim(), addr: m[2] ?? '' };
  return { name: '', addr: raw };
}

const statusBadge: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300',
  read: 'bg-white/10 text-gray-400',
  replied: 'bg-green-500/20 text-green-300',
  archived: 'bg-yellow-500/15 text-yellow-400',
};

/* ━━━ Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const InboxPanel = () => {
  const { getToken } = useAuth();

  const [view, setView] = useState<View>('list');
  const [list, setList] = useState<InboxList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'archived'>('all');
  const [selected, setSelected] = useState<EmailDetailResponse | null>(null);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [setup, setSetup] = useState<InboxSetup | null>(null);
  const [copied, setCopied] = useState(false);

  // Reply state
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  // Compose state
  const [composeTo, setComposeTo] = useState('');
  const [composeFrom, setComposeFrom] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);

  // Addresses state
  const [addresses, setAddresses] = useState<AddressesResponse | null>(null);
  const [addressesLoading, setAddressesLoading] = useState(false);

  /* ── data loaders ── */

  const loadList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = await getToken();
      const status = filter === 'all' ? '' : filter;
      const data = await apiFetch<InboxList>(
        `/api/admin/resend/inbox${status ? `?status=${status}` : ''}`, token,
      );
      setList(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
    } finally { setLoading(false); }
  }, [getToken, filter]);

  const loadSetup = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await apiFetch<InboxSetup>('/api/admin/resend/inbox-setup', token);
      setSetup(data);
    } catch { /* optional */ }
  }, [getToken]);

  const loadAddresses = useCallback(async () => {
    setAddressesLoading(true);
    try {
      const token = await getToken();
      const data = await apiFetch<AddressesResponse>('/api/admin/resend/addresses', token);
      setAddresses(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load addresses');
    } finally { setAddressesLoading(false); }
  }, [getToken]);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { void loadSetup(); }, [loadSetup]);
  useEffect(() => { if (view === 'addresses') void loadAddresses(); }, [view, loadAddresses]);

  /* ── actions ── */

  const openEmail = async (id: string) => {
    setBodyLoading(true); setError(null);
    try {
      const token = await getToken();
      const data = await apiFetch<EmailDetailResponse>(`/api/admin/resend/inbox/${id}`, token);
      setSelected(data);
      setView('detail');
      setReplyOpen(false);
      setReplyText('');
      setList(prev => prev ? {
        ...prev,
        items: prev.items.map(e => e.id === id ? { ...e, isRead: true, status: 'read' } : e),
        unread: Math.max(0, prev.unread - (data.meta.isRead ? 0 : 1)),
      } : prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load email');
    } finally { setBodyLoading(false); }
  };

  const archiveEmail = async (id: string) => {
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/resend/inbox/${id}/archive`, token, { method: 'POST' });
      setView('list'); setSelected(null); void loadList();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Archive failed'); }
  };

  const deleteEmail = async (id: string) => {
    if (!confirm('Delete this email permanently?')) return;
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/resend/inbox/${id}`, token, { method: 'DELETE' });
      setView('list'); setSelected(null); void loadList();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setReplySending(true);
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/resend/inbox/${selected.meta.id}/reply`, token, {
        method: 'POST',
        body: JSON.stringify({ body: replyText }),
      });
      setReplyOpen(false);
      setReplyText('');
      setSelected(prev => prev ? { ...prev, meta: { ...prev.meta, status: 'replied' } } : prev);
      setList(prev => prev ? {
        ...prev,
        items: prev.items.map(e => e.id === selected.meta.id ? { ...e, status: 'replied' } : e),
      } : prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reply failed');
    } finally { setReplySending(false); }
  };

  const sendCompose = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    try {
      const token = await getToken();
      await apiFetch('/api/admin/resend/compose', token, {
        method: 'POST',
        body: JSON.stringify({
          from: composeFrom || undefined,
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
        }),
      });
      setView('list');
      setComposeTo(''); setComposeFrom(''); setComposeSubject(''); setComposeBody('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally { setComposeSending(false); }
  };

  const copyText = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const items = list?.items ?? [];
  const unread = list?.unread ?? 0;
  const setupReady = useMemo(
    () => Boolean(setup?.apiKeyConfigured && setup?.webhookSecretConfigured),
    [setup],
  );

  /* ━━━━━━━━━━━━━━━━━ ADDRESSES VIEW ━━━━━━━━━━━━━━━━━ */
  if (view === 'addresses') {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setView('list')}
          className="inline-flex items-center gap-1 text-sm text-[#888] hover:text-white mb-2">
          <ChevronLeft className="w-4 h-4" /> Inbox
        </button>

        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" /> Mailboxes
        </h3>

        {/* Important explainer */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-[#ccc] space-y-2">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-medium mb-1">How addresses work in Resend</p>
              <p>Resend uses <strong className="text-blue-300">catch-all</strong> — all emails to{' '}
                <code className="bg-white/10 px-1.5 py-0.5 rounded text-blue-200">*@your-domain</code> automatically
                land in this Inbox. No need to create separate mailboxes — just use any address.</p>
              <p className="mt-2">Examples: <code className="text-blue-200">support@</code>, <code className="text-blue-200">hello@</code>,{' '}
                <code className="text-blue-200">admin@</code> — all of them already work.</p>
            </div>
          </div>
        </div>

        {addressesLoading ? (
          <div className="text-center py-8 text-[#888]">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading domains…
          </div>
        ) : addresses ? (
          <>
            {addresses.domains.map(d => (
              <div key={d.id} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Server className="w-5 h-5 text-purple-400" />
                    <span className="text-white font-semibold text-lg">{d.domain}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    d.status === 'verified'
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {d.status}
                  </span>
                </div>

                <div className="text-sm text-[#999]">
                  Region: {d.region} · Catch-all: {d.catchAll ? '✅ All addresses active' : '❌'}
                </div>

                <div>
                  <p className="text-sm text-[#888] mb-2">Suggested addresses (all already receive mail):</p>
                  <div className="flex flex-wrap gap-2">
                    {d.suggestedAddresses.map(addr => (
                      <button key={addr} onClick={() => copyText(addr)}
                        className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-[#ccc] transition-colors">
                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                        {addr}
                        <Copy className="w-3 h-3 text-[#666]" />
                      </button>
                    ))}
                  </div>
                </div>

                {addresses.senderFrom && (
                  <div className="text-sm">
                    <span className="text-[#888]">Current sender (RESEND_FROM): </span>
                    <code className="bg-white/10 px-2 py-0.5 rounded text-green-300">{addresses.senderFrom}</code>
                  </div>
                )}
              </div>
            ))}

            {addresses.domains.length === 0 && (
              <div className="text-center py-8 text-[#888] bg-white/5 border border-white/10 rounded-xl">
                <Globe className="w-8 h-8 text-[#444] mx-auto mb-2" />
                <p>No verified domains found.</p>
                <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 hover:underline text-sm">Add domain in Resend →</a>
              </div>
            )}
          </>
        ) : null}

        {/* Email clients info */}
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-[#ccc]">
              <p className="text-amber-300 font-medium mb-2">Email clients (Outlook, Thunderbird, Apple Mail)</p>
              <p className="mb-2">
                Resend is a <strong>transactional email API</strong>, not a mail host.
                It does not support IMAP/POP3, so you cannot connect a traditional email client directly.
              </p>
              <p className="mb-2">For full-featured mailboxes with a client, consider:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><a href="https://workspace.google.com/" target="_blank" rel="noopener noreferrer" className="text-amber-300 hover:underline">Google Workspace</a> — $6/mo, full Gmail + calendar</li>
                <li><a href="https://www.zoho.com/mail/" target="_blank" rel="noopener noreferrer" className="text-amber-300 hover:underline">Zoho Mail</a> — free plan up to 5 users</li>
                <li><a href="https://www.fastmail.com/" target="_blank" rel="noopener noreferrer" className="text-amber-300 hover:underline">Fastmail</a> — $5/mo, private and fast</li>
              </ul>
              <p className="mt-2 text-[#999]">
                Tip: use Resend for sending from the admin panel + Google Workspace / Zoho for personal mailboxes.
                MX records can be configured in parallel — Resend Inbound uses its own subdomain.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━ COMPOSE VIEW ━━━━━━━━━━━━━━━━━ */
  if (view === 'compose') {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setView('list')}
          className="inline-flex items-center gap-1 text-sm text-[#888] hover:text-white mb-2">
          <ChevronLeft className="w-4 h-4" /> Inbox
        </button>

        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <PenSquare className="w-5 h-5 text-blue-400" /> New Email
        </h3>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>
        )}

        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs text-[#888] mb-1">From (optional, defaults to RESEND_FROM)</label>
            <input
              value={composeFrom} onChange={e => setComposeFrom(e.target.value)}
              placeholder={setup?.senderFrom || 'TonForge <noreply@tonforge.org>'}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-[#555] focus:border-blue-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1">To *</label>
            <input
              value={composeTo} onChange={e => setComposeTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-[#555] focus:border-blue-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1">Subject *</label>
            <input
              value={composeSubject} onChange={e => setComposeSubject(e.target.value)}
              placeholder="Email subject"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-[#555] focus:border-blue-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1">Body *</label>
            <textarea
              value={composeBody} onChange={e => setComposeBody(e.target.value)}
              rows={8}
              placeholder="Email body..."
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-[#555] focus:border-blue-500/50 focus:outline-none resize-y"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setView('list')}
              className="px-4 py-2 rounded-lg text-sm text-[#888] hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={() => void sendCompose()} disabled={composeSending || !composeTo || !composeSubject || !composeBody}
              className="inline-flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors">
              {composeSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━ DETAIL VIEW ━━━━━━━━━━━━━━━━━ */
  if (view === 'detail' && selected) {
    const { meta, body } = selected;
    const bodyHtml = body?.html || '';
    const bodyText = body?.text || '';
    return (
      <div>
        <button type="button" onClick={() => { setView('list'); setSelected(null); }}
          className="inline-flex items-center gap-1 text-sm text-[#888] hover:text-white mb-4">
          <ChevronLeft className="w-4 h-4" /> Inbox
        </button>

        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-semibold text-white truncate">{meta.subject || '(no subject)'}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${statusBadge[meta.status] || ''}`}>
                  {meta.status}
                </span>
              </div>
              <div className="text-sm text-[#888] space-y-0.5">
                <div>From: <span className="text-white">{meta.from}</span></div>
                <div>To: <span className="text-white">{meta.to.join(', ')}</span></div>
                {meta.cc.length > 0 && <div>Cc: <span className="text-white">{meta.cc.join(', ')}</span></div>}
                <div>Received: {fmtDate(meta.receivedAt)}</div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => { setReplyOpen(!replyOpen); setReplyText(''); }}
                className="inline-flex items-center gap-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 px-3 py-2 rounded-lg text-sm">
                <Reply className="w-4 h-4" /> Reply
              </button>
              <button onClick={() => void archiveEmail(meta.id)}
                className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 text-gray-300 px-3 py-2 rounded-lg text-sm">
                <Archive className="w-4 h-4" /> Archive
              </button>
              <button onClick={() => void deleteEmail(meta.id)}
                className="inline-flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-lg text-sm">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Reply form */}
          {replyOpen && (
            <div className="mb-4 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 space-y-3">
              <div className="text-xs text-[#888]">
                Reply to: <span className="text-white">{meta.from}</span> · from:{' '}
                <span className="text-blue-300">{meta.to[0] || 'noreply@tonforge.org'}</span>
              </div>
              <textarea
                value={replyText} onChange={e => setReplyText(e.target.value)}
                rows={5}
                placeholder="Reply text..."
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-[#555] focus:border-blue-500/50 focus:outline-none resize-y"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setReplyOpen(false)}
                  className="px-3 py-1.5 text-sm text-[#888] hover:text-white">Cancel</button>
                <button onClick={() => void sendReply()} disabled={replySending || !replyText.trim()}
                  className="inline-flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40">
                  {replySending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send reply
                </button>
              </div>
            </div>
          )}

          {bodyLoading && (
            <div className="flex items-center gap-2 text-[#888] py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading body…
            </div>
          )}

          {!bodyLoading && bodyHtml && (
            <div className="bg-white rounded-lg p-4 max-h-[60vh] overflow-auto">
              <iframe title="email body" sandbox="" srcDoc={bodyHtml} className="w-full h-[55vh] border-0" />
            </div>
          )}

          {!bodyLoading && !bodyHtml && bodyText && (
            <pre className="bg-white/5 border border-white/10 rounded-lg p-4 text-[#ccc] text-sm whitespace-pre-wrap max-h-[60vh] overflow-auto">
              {bodyText}
            </pre>
          )}

          {!bodyLoading && !bodyHtml && !bodyText && (
            <div className="text-[#888] text-sm py-4">
              Email body unavailable — try refreshing in a minute.
            </div>
          )}

          {meta.attachments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <h4 className="text-sm font-semibold text-white mb-2">Attachments ({meta.attachments.length})</h4>
              <ul className="space-y-1">
                {meta.attachments.map(a => (
                  <li key={a.id} className="text-sm text-[#aaa]">
                    <span className="text-white">{a.filename || '(unnamed)'}</span>
                    <span className="text-[#666]"> · {a.contentType || 'unknown'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━ LIST VIEW ━━━━━━━━━━━━━━━━━ */
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Setup hint */}
      {setup && !setupReady && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-amber-300 font-medium mb-2">Set up Resend Inbound (3 steps)</h4>
              <ol className="text-sm text-[#ccc] space-y-2 list-decimal pl-5">
                <li>In <a className="text-amber-300 underline" href="https://resend.com/domains" target="_blank" rel="noopener noreferrer">Resend → Domains</a>, add your domain and complete verification.</li>
                <li>In <a className="text-amber-300 underline" href="https://resend.com/webhooks" target="_blank" rel="noopener noreferrer">Resend → Webhooks</a> → Add Webhook → URL below → event <code className="text-amber-200">email.received</code>.</li>
                <li>Copy the Signing Secret → Coolify env: <code className="text-amber-200">RESEND_WEBHOOK_SECRET</code>.</li>
              </ol>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 bg-black/30 px-3 py-2 rounded text-amber-200 text-xs font-mono break-all">
                  {setup.webhookUrl}
                </code>
                <button onClick={() => copyText(setup.webhookUrl)}
                  className="inline-flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-2 rounded-lg text-xs font-medium">
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="mt-3 text-xs text-[#999]">
                <span className={setup.apiKeyConfigured ? 'text-green-400' : 'text-red-400'}>
                  ● RESEND_API_KEY {setup.apiKeyConfigured ? 'set' : 'missing'}
                </span>
                <span className="ml-3">
                  <span className={setup.webhookSecretConfigured ? 'text-green-400' : 'text-red-400'}>
                    ● RESEND_WEBHOOK_SECRET {setup.webhookSecretConfigured ? 'set' : 'missing'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-white">
          <Inbox className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">Inbox</span>
          {unread > 0 && (
            <span className="bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full text-xs font-bold">
              {unread} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setView('compose')}
            className="inline-flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            <PenSquare className="w-3.5 h-3.5" /> Compose
          </button>
          <button onClick={() => setView('addresses')}
            className="inline-flex items-center gap-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            <Globe className="w-3.5 h-3.5" /> Addresses
          </button>
          <span className="w-px h-5 bg-white/10" />
          {(['all', 'new', 'archived'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? 'bg-blue-500/30 text-blue-200' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}>
              {f}
            </button>
          ))}
          <button onClick={() => void loadList()} disabled={loading}
            className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 text-gray-300 px-3 py-1.5 rounded-lg text-xs disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* List */}
      {loading && items.length === 0 ? (
        <div className="text-center text-[#888] py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-[#888] py-12 bg-white/5 border border-white/10 rounded-xl">
          <Inbox className="w-10 h-10 text-[#444] mx-auto mb-3" />
          <p className="mb-1">No incoming emails yet.</p>
          <p className="text-xs">Send a test email to any address on your domain and refresh.</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
          {items.map(email => {
            const { name, addr } = parseFrom(email.from);
            return (
              <button key={email.id} onClick={() => void openEmail(email.id)}
                className={`w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors ${
                  !email.isRead ? 'bg-blue-500/[0.03]' : ''
                }`}>
                <div className="flex-shrink-0">
                  {email.status === 'replied'
                    ? <Reply className="w-4 h-4 text-green-400" />
                    : email.isRead
                      ? <MailOpen className="w-4 h-4 text-[#666]" />
                      : <Mail className="w-4 h-4 text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm truncate ${!email.isRead ? 'text-white font-semibold' : 'text-[#aaa]'}`}>
                      {name || addr}
                    </span>
                    <span className="text-xs text-[#666] truncate">{addr}</span>
                    {email.status === 'replied' && (
                      <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded-full">replied</span>
                    )}
                  </div>
                  <div className="text-sm text-[#ccc] truncate">{email.subject || '(no subject)'}</div>
                  <div className="text-xs text-[#666] mt-0.5">To: {email.to.join(', ')}</div>
                </div>
                <div className="flex-shrink-0 text-xs text-[#666]">{fmtDate(email.receivedAt)}</div>
                {email.attachments.length > 0 && (
                  <div className="flex-shrink-0 text-xs text-[#666]">📎 {email.attachments.length}</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="text-xs text-[#666] text-center pt-2">
        Full archive also in{' '}
        <a className="text-[#888] underline hover:text-white" href="https://resend.com/emails/receiving" target="_blank" rel="noopener noreferrer">
          Resend Dashboard <ExternalLink className="w-3 h-3 inline" />
        </a>
      </div>
    </div>
  );
};

export default InboxPanel;
