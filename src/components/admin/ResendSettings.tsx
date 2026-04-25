import { useState, useEffect, useCallback } from 'react';
import { Mail, Send, CheckCircle, XCircle, FileText, Users, RefreshCw, Plus, Eye, Inbox, AtSign, Trash2, ToggleLeft, ToggleRight, Edit2 } from 'lucide-react';
import { storeApiUrl } from '../../lib/storeApi';
import { useAuth } from '../../contexts/AuthContext';
import InboxPanel from './InboxPanel';

interface ResendStatus {
  connected: boolean;
  domain?: string;
  domainStatus?: string;
  totalDomains?: number;
  error?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface Campaign {
  id: string;
  templateId: string;
  templateName: string;
  audience: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  scheduledAt: string | null;
  createdAt: string;
  sentAt?: string;
}

interface Mailbox {
  id: string;
  mailboxId: string;
  name: string;
  address: string;
  username: string;
  domain: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ResendDomain {
  domain: string;
  status: string;
  id: string;
  suggestedAddresses: string[];
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
  return body.data;
}

const ResendSettings = () => {
  const { getToken } = useAuth();
  const [subtab, setSubtab] = useState<'status' | 'inbox' | 'templates' | 'campaigns' | 'mailboxes'>('status');

  const [status, setStatus] = useState<ResendStatus | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [resendDomains, setResendDomains] = useState<ResendDomain[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  const [newCampaign, setNewCampaign] = useState({ templateId: '', audience: 'all' });
  const [showNewCampaign, setShowNewCampaign] = useState(false);

  const [showNewMailbox, setShowNewMailbox] = useState(false);
  const [newMailbox, setNewMailbox] = useState({ name: '', username: '', domain: '', description: '' });
  const [mailboxFormError, setMailboxFormError] = useState<string | null>(null);
  const [mailboxSaving, setMailboxSaving] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [s, t, c, inbox, mboxes, domains] = await Promise.all([
        apiFetch<ResendStatus>('/api/admin/resend/status', token),
        apiFetch<EmailTemplate[]>('/api/admin/resend/templates', token).catch(() => [] as EmailTemplate[]),
        apiFetch<Campaign[]>('/api/admin/resend/campaigns', token).catch(() => [] as Campaign[]),
        apiFetch<{ items: unknown[]; unread: number }>('/api/admin/resend/inbox?limit=1', token).catch(() => null),
        apiFetch<Mailbox[]>('/api/admin/resend/mailboxes', token).catch(() => [] as Mailbox[]),
        apiFetch<{ domains: ResendDomain[] }>('/api/admin/resend/addresses', token).catch(() => null),
      ]);
      setStatus(s);
      setTemplates(t);
      setCampaigns(c);
      setMailboxes(mboxes ?? []);
      if (domains) setResendDomains(domains.domains ?? []);
      if (inbox) setUnreadCount(inbox.unread);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleTestSend = async () => {
    if (!testEmail) return;
    setTestResult(null);
    try {
      const token = await getToken();
      await apiFetch('/api/admin/resend/test', token, {
        method: 'POST',
        body: JSON.stringify({ to: testEmail }),
      });
      setTestResult('Test email sent successfully!');
    } catch (err: unknown) {
      setTestResult(err instanceof Error ? err.message : 'Send failed');
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      const token = await getToken();
      const updated = await apiFetch<EmailTemplate>(`/api/admin/resend/templates/${editingTemplate.id}`, token, {
        method: 'PUT',
        body: JSON.stringify({
          subject: editingTemplate.subject,
          body: editingTemplate.body,
          name: editingTemplate.name,
        }),
      });
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTemplate(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleCreateCampaign = async () => {
    if (!newCampaign.templateId) return;
    try {
      const token = await getToken();
      const created = await apiFetch<Campaign>('/api/admin/resend/campaigns', token, {
        method: 'POST',
        body: JSON.stringify(newCampaign),
      });
      setCampaigns((prev) => [...prev, created]);
      setShowNewCampaign(false);
      setNewCampaign({ templateId: '', audience: 'all' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    try {
      const token = await getToken();
      const updated = await apiFetch<Campaign>(`/api/admin/resend/campaigns/${campaignId}/send`, token, {
        method: 'POST',
      });
      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Send failed');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Delete this template permanently?')) return;
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/resend/templates/${templateId}`, token, { method: 'DELETE' });
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Delete this campaign permanently?')) return;
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/resend/campaigns/${campaignId}`, token, { method: 'DELETE' });
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleCreateMailbox = async () => {
    setMailboxFormError(null);
    if (!newMailbox.name.trim() || !newMailbox.username.trim() || !newMailbox.domain) {
      setMailboxFormError('Name, username and domain are required');
      return;
    }
    setMailboxSaving(true);
    try {
      const token = await getToken();
      const created = await apiFetch<Mailbox>('/api/admin/resend/mailboxes', token, {
        method: 'POST',
        body: JSON.stringify({
          name: newMailbox.name.trim(),
          username: newMailbox.username.trim(),
          domain: newMailbox.domain,
          description: newMailbox.description.trim() || null,
        }),
      });
      setMailboxes((prev) => [created, ...prev]);
      setShowNewMailbox(false);
      setNewMailbox({ name: '', username: '', domain: '', description: '' });
    } catch (err: unknown) {
      setMailboxFormError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setMailboxSaving(false);
    }
  };

  const handleSaveMailbox = async () => {
    if (!editingMailbox) return;
    setMailboxSaving(true);
    try {
      const token = await getToken();
      const updated = await apiFetch<Mailbox>(`/api/admin/resend/mailboxes/${editingMailbox.id}`, token, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingMailbox.name,
          description: editingMailbox.description,
        }),
      });
      setMailboxes((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMailbox(null);
    } catch (err: unknown) {
      setMailboxFormError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setMailboxSaving(false);
    }
  };

  const handleToggleMailbox = async (mailbox: Mailbox) => {
    try {
      const token = await getToken();
      const updated = await apiFetch<Mailbox>(`/api/admin/resend/mailboxes/${mailbox.id}`, token, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !mailbox.isActive }),
      });
      setMailboxes((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const handleDeleteMailbox = async (id: string) => {
    if (!confirm('Delete this mailbox permanently?')) return;
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/resend/mailboxes/${id}`, token, { method: 'DELETE' });
      setMailboxes((prev) => prev.filter((m) => m.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const subtabs = [
    { id: 'status' as const, label: 'Status', icon: CheckCircle },
    { id: 'inbox' as const, label: 'Inbox', icon: Inbox },
    { id: 'mailboxes' as const, label: 'Mailboxes', icon: AtSign },
    { id: 'templates' as const, label: 'Templates', icon: FileText },
    { id: 'campaigns' as const, label: 'Campaigns', icon: Users },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold text-white flex items-center">
          <Mail className="w-7 h-7 mr-3 text-blue-400" />
          Email / Resend
        </h2>
        <button onClick={loadData} disabled={loading} className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-gray-300 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Subtabs */}
      <div className="flex space-x-2 mb-6">
        {subtabs.map((st) => (
          <button
            key={st.id}
            onClick={() => setSubtab(st.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
              subtab === st.id ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <st.icon className="w-4 h-4" />
            <span>{st.label}</span>
            {st.id === 'inbox' && unreadCount > 0 && (
              <span className="bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded-full text-[10px] font-bold ml-1">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Status */}
      {subtab === 'status' && (
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center space-x-4 mb-4">
              {status?.connected ? (
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-400" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {status?.connected ? 'Connected' : 'Not Connected'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {status?.connected
                    ? `Domain: ${status.domain || 'N/A'} (${status.domainStatus || 'unknown'})`
                    : (status?.error || 'RESEND_API_KEY not set in Coolify environment')}
                </p>
              </div>
            </div>
          </div>

          {status?.connected && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Send Test Email</h3>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleTestSend}
                  disabled={!testEmail}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </div>
              {testResult && (
                <p className={`mt-3 text-sm ${testResult.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inbox */}
      {subtab === 'inbox' && <InboxPanel />}

      {/* Mailboxes */}
      {subtab === 'mailboxes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              Corporate email addresses on your verified Resend domains.
            </p>
            <button
              onClick={() => { setShowNewMailbox(true); setMailboxFormError(null); }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Mailbox</span>
            </button>
          </div>

          {resendDomains.length === 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-yellow-300 text-sm">
              No verified Resend domains found. Add and verify a domain in Resend first.
            </div>
          )}

          {showNewMailbox && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">Create Mailbox</h3>
              {mailboxFormError && (
                <p className="text-red-400 text-sm">{mailboxFormError}</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Display Name</label>
                  <input
                    value={newMailbox.name}
                    onChange={(e) => setNewMailbox({ ...newMailbox, name: e.target.value })}
                    placeholder="Support Team"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Domain</label>
                  <select
                    value={newMailbox.domain}
                    onChange={(e) => setNewMailbox({ ...newMailbox, domain: e.target.value })}
                    className="w-full bg-[#1a1a2e] border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select domain…</option>
                    {resendDomains.map((d) => (
                      <option key={d.id} value={d.domain}>
                        {d.domain} ({d.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Username (local part)</label>
                <div className="flex items-center gap-2">
                  <input
                    value={newMailbox.username}
                    onChange={(e) => setNewMailbox({ ...newMailbox, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })}
                    placeholder="support"
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {newMailbox.domain && newMailbox.username && (
                    <span className="text-gray-300 text-sm font-mono bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                      {newMailbox.username}@{newMailbox.domain}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Description (optional)</label>
                <input
                  value={newMailbox.description}
                  onChange={(e) => setNewMailbox({ ...newMailbox, description: e.target.value })}
                  placeholder="Customer support inbox"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreateMailbox}
                  disabled={mailboxSaving}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {mailboxSaving ? 'Creating…' : 'Create'}
                </button>
                <button
                  onClick={() => { setShowNewMailbox(false); setMailboxFormError(null); }}
                  className="bg-white/10 hover:bg-white/20 text-gray-300 px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {editingMailbox && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">Edit: {editingMailbox.address}</h3>
              {mailboxFormError && (
                <p className="text-red-400 text-sm">{mailboxFormError}</p>
              )}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Display Name</label>
                <input
                  value={editingMailbox.name}
                  onChange={(e) => setEditingMailbox({ ...editingMailbox, name: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Description</label>
                <input
                  value={editingMailbox.description ?? ''}
                  onChange={(e) => setEditingMailbox({ ...editingMailbox, description: e.target.value || null })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveMailbox}
                  disabled={mailboxSaving}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {mailboxSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingMailbox(null); setMailboxFormError(null); }}
                  className="bg-white/10 hover:bg-white/20 text-gray-300 px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {mailboxes.length === 0 && !showNewMailbox && (
            <p className="text-gray-400 text-center py-8">No mailboxes yet. Create your first one.</p>
          )}

          {mailboxes.map((m) => (
            <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  m.isActive ? 'bg-blue-500/20' : 'bg-gray-500/20'
                }`}>
                  <AtSign className={`w-4 h-4 ${m.isActive ? 'text-blue-400' : 'text-gray-500'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{m.name}</p>
                  <p className="text-blue-300 text-sm font-mono">{m.address}</p>
                  {m.description && (
                    <p className="text-gray-500 text-xs truncate">{m.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  m.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {m.isActive ? 'Active' : 'Disabled'}
                </span>
                <button
                  onClick={() => { setEditingMailbox({ ...m }); setMailboxFormError(null); }}
                  title="Edit"
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleToggleMailbox(m)}
                  title={m.isActive ? 'Disable' : 'Enable'}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  {m.isActive ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleDeleteMailbox(m.id)}
                  title="Delete"
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Templates */}
      {subtab === 'templates' && (
        <div className="space-y-4">
          {editingTemplate ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">Edit Template: {editingTemplate.name}</h3>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Name</label>
                <input
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Subject</label>
                <input
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">HTML Body</label>
                <textarea
                  value={editingTemplate.body}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                  rows={8}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={handleSaveTemplate} className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                  Save
                </button>
                <button onClick={() => setEditingTemplate(null)} className="bg-white/10 hover:bg-white/20 text-gray-300 px-6 py-2 rounded-lg font-medium transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-white font-medium">{t.name}</h4>
                  <p className="text-gray-400 text-sm">{t.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingTemplate({ ...t })}
                    className="bg-white/10 hover:bg-white/20 text-gray-300 px-4 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(t.id)}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Campaigns */}
      {subtab === 'campaigns' && (
        <div className="space-y-4">
          <button
            onClick={() => setShowNewCampaign(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Campaign</span>
          </button>

          {showNewCampaign && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">Create Campaign</h3>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Template</label>
                <select
                  value={newCampaign.templateId}
                  onChange={(e) => setNewCampaign({ ...newCampaign, templateId: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Audience</label>
                <select
                  value={newCampaign.audience}
                  onChange={(e) => setNewCampaign({ ...newCampaign, audience: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Users</option>
                  <option value="developers">Developers Only</option>
                  <option value="active">Active Users (30 days)</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={handleCreateCampaign} disabled={!newCampaign.templateId} className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">
                  Create
                </button>
                <button onClick={() => setShowNewCampaign(false)} className="bg-white/10 hover:bg-white/20 text-gray-300 px-6 py-2 rounded-lg font-medium transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {campaigns.length === 0 && !showNewCampaign && (
            <p className="text-gray-400 text-center py-8">No campaigns yet. Create your first one.</p>
          )}

          {campaigns.map((c) => (
            <div key={c.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">{c.templateName}</h4>
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span>Audience: {c.audience}</span>
                  <span>Recipients: {c.recipientCount}</span>
                  <span>Sent: {c.sentCount}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    c.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                    c.status === 'sending' ? 'bg-yellow-500/20 text-yellow-400' :
                    c.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {c.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.status === 'draft' && (
                  <button
                    onClick={() => handleSendCampaign(c.id)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send Now</span>
                  </button>
                )}
                {c.status !== 'sending' && (
                  <button
                    onClick={() => handleDeleteCampaign(c.id)}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                    title="Delete campaign"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResendSettings;
