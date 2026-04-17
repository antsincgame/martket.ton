import { useState, useEffect, useCallback, type FC } from 'react';
import { MessageCircle, RefreshCw, AlertCircle, CheckCircle, Clock, Send, User, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { storeApiUrl } from '../../lib/storeApi';
import { logger } from '../../lib/logger';

interface TicketMessage {
  authorId: string;
  role: string;
  text: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  product_id: string | null;
  assigned_to: string | null;
  messages: TicketMessage[];
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/30',
  in_progress: 'bg-[#00F5FF]/20 text-[#00F5FF] border-[#00F5FF]/30',
  resolved: 'bg-[#00FF88]/20 text-[#00FF88] border-[#00FF88]/30',
  closed: 'bg-white/10 text-[#999999] border-white/20',
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'text-[#FF4444]',
  high: 'text-[#FFD700]',
  normal: 'text-[#999999]',
  low: 'text-[#666666]',
};

interface SupportTicketsProps {
  isAdminView?: boolean;
}

const SupportTickets: FC<SupportTicketsProps> = ({ isAdminView = true }) => {
  const { getToken } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const authFetch = useCallback(async (path: string, init?: RequestInit): Promise<Response> => {
    const token = await getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(storeApiUrl(path), { ...init, headers });
  }, [getToken]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = isAdminView
        ? `/api/support/admin/tickets${statusFilter ? `?status=${statusFilter}` : ''}`
        : '/api/support/tickets';
      const res = await authFetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { data: Ticket[] };
      setTickets(body.data || []);
    } catch (err) {
      setError((err as Error).message);
      logger.error('[support]', err);
    } finally {
      setLoading(false);
    }
  }, [authFetch, isAdminView, statusFilter]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleReply = useCallback(async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await authFetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { data: Ticket };
      setSelectedTicket(body.data);
      setTickets((prev) => prev.map((t) => (t.id === body.data.id ? body.data : t)));
      setReplyText('');
    } catch (err) {
      logger.error('[support] reply failed:', err);
    } finally {
      setSending(false);
    }
  }, [authFetch, selectedTicket, replyText]);

  const handleStatusChange = useCallback(async (ticketId: string, newStatus: string) => {
    try {
      const res = await authFetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { data: Ticket };
      setTickets((prev) => prev.map((t) => (t.id === body.data.id ? body.data : t)));
      if (selectedTicket?.id === ticketId) setSelectedTicket(body.data);
    } catch (err) {
      logger.error('[support] status change failed:', err);
    }
  }, [authFetch, selectedTicket]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#999999]">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading tickets...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-8 h-8 text-[#FF4444] mx-auto mb-3" />
        <p className="text-[#FF4444] font-semibold mb-2">Failed to load tickets</p>
        <p className="text-[#999999] text-sm mb-4">{error}</p>
        <button onClick={loadTickets} className="border border-[#00F5FF]/30 text-[#00F5FF] px-4 py-2 rounded-lg hover:bg-[#00F5FF]/10 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (selectedTicket) {
    return (
      <div>
        <button
          onClick={() => setSelectedTicket(null)}
          className="text-[#999999] hover:text-white text-sm mb-4 flex items-center gap-1"
        >
          &larr; Back to list
        </button>
        <div className="rounded-xl border border-[#FFD700]/10 bg-[#0D0D1A] p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-white">{selectedTicket.subject}</h3>
            <span className={`px-2 py-1 text-xs rounded-full border font-medium ${STATUS_STYLES[selectedTicket.status] || STATUS_STYLES.open}`}>
              {selectedTicket.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <div className="flex gap-4 text-xs text-[#666666] mb-3">
            <span>Category: {selectedTicket.category}</span>
            <span className={PRIORITY_STYLES[selectedTicket.priority]}>Priority: {selectedTicket.priority}</span>
            <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
          </div>
          {isAdminView && (
            <div className="flex gap-2">
              {['open', 'in_progress', 'resolved', 'closed'].map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(selectedTicket.id, s)}
                  disabled={selectedTicket.status === s}
                  className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                    selectedTicket.status === s
                      ? 'border-[#FFD700]/40 bg-[#FFD700]/20 text-[#FFD700]'
                      : 'border-white/10 text-[#999999] hover:text-white hover:border-white/20'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
          {selectedTicket.messages.map((msg, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 ${
                msg.role === 'staff'
                  ? 'bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 ml-8'
                  : 'bg-white/5 border border-white/10 mr-8'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {msg.role === 'staff' ? (
                  <Shield className="w-3.5 h-3.5 text-[#8B5CF6]" />
                ) : (
                  <User className="w-3.5 h-3.5 text-[#999999]" />
                )}
                <span className={`text-xs font-medium ${msg.role === 'staff' ? 'text-[#8B5CF6]' : 'text-[#999999]'}`}>
                  {msg.role === 'staff' ? 'Support' : 'User'}
                </span>
                <span className="text-xs text-[#666666]">{new Date(msg.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-white whitespace-pre-wrap">{msg.text}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type a reply..."
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-[#666666] focus:border-[#FFD700]/30 focus:outline-none"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
          />
          <button
            onClick={handleReply}
            disabled={sending || !replyText.trim()}
            className="px-4 py-2 bg-[#8B5CF6] rounded-lg text-white text-sm flex items-center gap-1 disabled:opacity-40 hover:bg-[#7C3AED] transition-colors"
          >
            <Send className="w-4 h-4" />
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white uppercase tracking-widest flex items-center">
          <MessageCircle className="w-6 h-6 mr-3 text-[#8B5CF6]" />
          Support Tickets
        </h2>
        <div className="flex items-center gap-2">
          {isAdminView && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          )}
          <button
            onClick={loadTickets}
            className="border border-[#8B5CF6]/30 text-[#8B5CF6] px-4 py-2 rounded-lg hover:bg-[#8B5CF6]/10 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-[#00FF88] mx-auto mb-3" />
          <p className="text-[#999999]">No tickets found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket)}
              className="w-full text-left rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/5 p-4 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-white font-medium truncate">{ticket.subject}</h4>
                <span className={`px-2 py-0.5 text-[10px] rounded-full border font-medium shrink-0 ${STATUS_STYLES[ticket.status] || STATUS_STYLES.open}`}>
                  {ticket.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex gap-3 text-xs text-[#666666]">
                <span>{ticket.category}</span>
                <span className={PRIORITY_STYLES[ticket.priority]}>{ticket.priority}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(ticket.updated_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" />
                  {ticket.messages.length}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SupportTickets;
