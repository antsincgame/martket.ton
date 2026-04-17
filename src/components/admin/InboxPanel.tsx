import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Inbox, Mail, MailOpen, Archive, Trash2, RefreshCw,
  Copy, ExternalLink, AlertTriangle, CheckCircle2, Loader2, ChevronLeft,
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

interface InboxList {
  items: InboundEmail[];
  unread: number;
}

interface InboxSetup {
  webhookUrl: string;
  webhookSecretConfigured: boolean;
  senderFrom: string | null;
  apiKeyConfigured: boolean;
}

interface EmailBody {
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

interface EmailDetailResponse {
  meta: InboundEmail;
  body: EmailBody | null;
}

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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function shortFrom(raw: string): { name: string; addr: string } {
  const m = /^(.*?)\s*<([^>]+)>\s*$/.exec(raw);
  if (m) return { name: (m[1] ?? '').replace(/^"|"$/g, '').trim(), addr: m[2] ?? '' };
  return { name: '', addr: raw };
}

const InboxPanel = () => {
  const { getToken } = useAuth();
  const [list, setList] = useState<InboxList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'archived'>('all');
  const [selected, setSelected] = useState<EmailDetailResponse | null>(null);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [setup, setSetup] = useState<InboxSetup | null>(null);
  const [copied, setCopied] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const status = filter === 'all' ? '' : filter;
      const path = `/api/admin/resend/inbox${status ? `?status=${status}` : ''}`;
      const data = await apiFetch<InboxList>(path, token);
      setList(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [getToken, filter]);

  const loadSetup = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await apiFetch<InboxSetup>('/api/admin/resend/inbox-setup', token);
      setSetup(data);
    } catch {
      // setup card is optional — silently ignore
    }
  }, [getToken]);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { void loadSetup(); }, [loadSetup]);

  const openEmail = async (id: string): Promise<void> => {
    setBodyLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const data = await apiFetch<EmailDetailResponse>(`/api/admin/resend/inbox/${id}`, token);
      setSelected(data);
      setList((prev) => prev ? {
        ...prev,
        items: prev.items.map((e) => e.id === id ? { ...e, isRead: true, status: 'read' } : e),
        unread: Math.max(0, prev.unread - (data.meta.isRead ? 0 : 1)),
      } : prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load email');
    } finally {
      setBodyLoading(false);
    }
  };

  const archiveEmail = async (id: string): Promise<void> => {
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/resend/inbox/${id}/archive`, token, { method: 'POST' });
      setSelected(null);
      void loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Archive failed');
    }
  };

  const deleteEmail = async (id: string): Promise<void> => {
    if (!confirm('Удалить письмо безвозвратно?')) return;
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/resend/inbox/${id}`, token, { method: 'DELETE' });
      setSelected(null);
      void loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const copyWebhookUrl = (): void => {
    if (!setup?.webhookUrl) return;
    void navigator.clipboard.writeText(setup.webhookUrl).then(() => {
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

  if (selected) {
    const { meta, body } = selected;
    const bodyHtml = body?.html || '';
    const bodyText = body?.text || '';
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1 text-sm text-[#888] hover:text-white mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Back to inbox
        </button>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold text-white mb-1">{meta.subject || '(без темы)'}</h3>
              <div className="text-sm text-[#888]">
                <div>From: <span className="text-white">{meta.from}</span></div>
                <div>To: <span className="text-white">{meta.to.join(', ')}</span></div>
                {meta.cc.length > 0 && <div>Cc: <span className="text-white">{meta.cc.join(', ')}</span></div>}
                <div>Received: {formatDate(meta.receivedAt)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => archiveEmail(meta.id)}
                className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 text-gray-300 px-3 py-2 rounded-lg text-sm"
              >
                <Archive className="w-4 h-4" /> Archive
              </button>
              <button
                onClick={() => deleteEmail(meta.id)}
                className="inline-flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-lg text-sm"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>

          {bodyLoading && (
            <div className="flex items-center gap-2 text-[#888] py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading body…
            </div>
          )}

          {!bodyLoading && bodyHtml && (
            <div className="bg-white rounded-lg p-4 max-h-[60vh] overflow-auto">
              <iframe
                title="email body"
                sandbox=""
                srcDoc={bodyHtml}
                className="w-full h-[55vh] border-0"
              />
            </div>
          )}

          {!bodyLoading && !bodyHtml && bodyText && (
            <pre className="bg-white/5 border border-white/10 rounded-lg p-4 text-[#ccc] text-sm whitespace-pre-wrap max-h-[60vh] overflow-auto">
              {bodyText}
            </pre>
          )}

          {!bodyLoading && !bodyHtml && !bodyText && (
            <div className="text-[#888] text-sm py-4">
              Тело письма недоступно. Возможно, Resend ещё не успел его проиндексировать —
              попробуй обновить через минуту.
            </div>
          )}

          {meta.attachments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <h4 className="text-sm font-semibold text-white mb-2">Attachments ({meta.attachments.length})</h4>
              <ul className="space-y-1">
                {meta.attachments.map((a) => (
                  <li key={a.id} className="text-sm text-[#aaa]">
                    <span className="text-white">{a.filename || '(без имени)'}</span>
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

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Setup hint */}
      {setup && !setupReady && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-amber-300 font-medium mb-2">Настрой Resend Inbound (3 шага)</h4>
              <ol className="text-sm text-[#ccc] space-y-2 list-decimal pl-5">
                <li>
                  В <a className="text-amber-300 underline" href="https://resend.com/domains" target="_blank" rel="noopener noreferrer">Resend → Domains</a>
                  {' '}добавь свой домен и пройди verification (Resend покажет MX, TXT/SPF, DKIM записи для Cloudflare DNS).
                </li>
                <li>
                  В <a className="text-amber-300 underline" href="https://resend.com/webhooks" target="_blank" rel="noopener noreferrer">Resend → Webhooks</a>
                  {' '}нажми Add Webhook → URL ниже → выбери event <code className="text-amber-200">email.received</code>.
                </li>
                <li>
                  Скопируй Signing Secret и положи в Coolify env как <code className="text-amber-200">RESEND_WEBHOOK_SECRET</code>.
                </li>
              </ol>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 bg-black/30 px-3 py-2 rounded text-amber-200 text-xs font-mono break-all">
                  {setup.webhookUrl}
                </code>
                <button
                  onClick={copyWebhookUrl}
                  className="inline-flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-2 rounded-lg text-xs font-medium"
                >
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Inbox className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">Inbox</span>
          {unread > 0 && (
            <span className="bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full text-xs font-bold">
              {unread} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'new', 'archived'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-500/30 text-blue-200'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={() => void loadList()}
            disabled={loading}
            className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 text-gray-300 px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* List */}
      {loading && items.length === 0 ? (
        <div className="text-center text-[#888] py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-[#888] py-12 bg-white/5 border border-white/10 rounded-xl">
          <Inbox className="w-10 h-10 text-[#444] mx-auto mb-3" />
          <p className="mb-1">Входящих пока нет.</p>
          <p className="text-xs">
            Отправь тестовое письмо на любой адрес твоего домена и обнови список.
          </p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
          {items.map((email) => {
            const { name, addr } = shortFrom(email.from);
            return (
              <button
                key={email.id}
                onClick={() => void openEmail(email.id)}
                className={`w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors ${
                  !email.isRead ? 'bg-blue-500/[0.03]' : ''
                }`}
              >
                <div className="flex-shrink-0">
                  {email.isRead ? (
                    <MailOpen className="w-4 h-4 text-[#666]" />
                  ) : (
                    <Mail className="w-4 h-4 text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm truncate ${!email.isRead ? 'text-white font-semibold' : 'text-[#aaa]'}`}>
                      {name || addr}
                    </span>
                    <span className="text-xs text-[#666] truncate">{addr}</span>
                  </div>
                  <div className="text-sm text-[#ccc] truncate">{email.subject || '(без темы)'}</div>
                  <div className="text-xs text-[#666] mt-0.5">
                    To: {email.to.join(', ')}
                  </div>
                </div>
                <div className="flex-shrink-0 text-xs text-[#666]">
                  {formatDate(email.receivedAt)}
                </div>
                {email.attachments.length > 0 && (
                  <div className="flex-shrink-0 text-xs text-[#666]">
                    📎 {email.attachments.length}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="text-xs text-[#666] text-center pt-2">
        Полный архив писем доступен также в <a className="text-[#888] underline hover:text-white" href="https://resend.com/emails/receiving" target="_blank" rel="noopener noreferrer">Resend Dashboard <ExternalLink className="w-3 h-3 inline" /></a>
      </div>
    </div>
  );
};

export default InboxPanel;
