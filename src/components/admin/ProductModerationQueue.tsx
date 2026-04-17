import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Ban, Eye, Loader2, ShieldCheck, ShieldAlert, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { storeApiUrl } from '../../lib/storeApi';
import { logger } from '../../lib/logger';

type ScanStatus = 'pending' | 'scanning' | 'clean' | 'suspicious' | 'malicious' | 'error';

interface PendingProduct {
  id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  category: string;
  image: string | null;
  price_ton: number;
  creator_id: string;
  status: string;
  created_at: string;
  scan_status?: ScanStatus;
  scan_provider?: string | null;
  scan_report_id?: string | null;
  scan_malicious_count?: number;
  scan_total_engines?: number;
  build_sha256?: string | null;
}

function vtReportUrl(p: PendingProduct): string | null {
  if (p.scan_provider !== 'virustotal') return null;
  if (p.build_sha256) return `https://www.virustotal.com/gui/file/${p.build_sha256}`;
  if (p.scan_report_id && p.scan_report_id.length === 64) {
    return `https://www.virustotal.com/gui/file/${p.scan_report_id}`;
  }
  return null;
}

function ScanBadge({ product }: { product: PendingProduct }) {
  const status = product.scan_status ?? 'pending';
  const palette: Record<ScanStatus, string> = {
    pending: 'bg-gray-500/15 border-gray-500/30 text-gray-300',
    scanning: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300 animate-pulse',
    clean: 'bg-green-500/15 border-green-500/30 text-green-300',
    suspicious: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
    malicious: 'bg-red-500/15 border-red-500/30 text-red-300',
    error: 'bg-red-500/10 border-red-500/20 text-red-200',
  };
  const Icon = status === 'malicious' || status === 'suspicious' ? ShieldAlert : ShieldCheck;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${palette[status]}`}>
      <Icon className="w-3 h-3" />
      {status}
      {product.scan_total_engines && product.scan_total_engines > 0 ? (
        <span className="opacity-70">{product.scan_malicious_count ?? 0}/{product.scan_total_engines}</span>
      ) : null}
    </span>
  );
}

export default function ProductModerationQueue() {
  const { getToken } = useAuth();

  const authFetch = useCallback(async (path: string, init?: RequestInit): Promise<Response> => {
    const token = await getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(storeApiUrl(path), { ...init, headers, credentials: 'include' });
  }, [getToken]);
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/products/pending');
      const body = await res.json();
      setProducts(body.data || []);
    } catch (err) {
      logger.error('[mod-queue]', err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleAction = useCallback(async (productId: string, status: string, reason?: string) => {
    setActionId(productId);
    try {
      const res = await authFetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      logger.error('[mod-queue] action failed:', err);
    } finally {
      setActionId(null);
    }
  }, [authFetch]);

  const handleRescan = useCallback(async (productId: string) => {
    setActionId(productId);
    try {
      const res = await authFetch(`/api/admin/products/${productId}/rescan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok && res.status !== 202) {
        const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      setProducts((prev) => prev.map((p) => (
        p.id === productId ? { ...p, scan_status: 'pending' as ScanStatus } : p
      )));
    } catch (err) {
      logger.error('[mod-queue] rescan failed:', err);
    } finally {
      setActionId(null);
    }
  }, [authFetch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading moderation queue…
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <p className="text-gray-400">No products pending review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Pending Review ({products.length})
        </h3>
        <button
          type="button"
          onClick={() => fetchPending()}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {products.map((product) => (
        <div
          key={product.id}
          className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
        >
          <div className="flex items-start gap-4">
            {product.image && (
              <img
                src={product.image}
                alt=""
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-white font-semibold truncate">{product.name}</h4>
                <ScanBadge product={product} />
              </div>
              <p className="text-sm text-gray-400 line-clamp-2 mt-1">
                {product.short_description || product.description || 'No description'}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                <span>{product.category}</span>
                <span>{product.price_ton} TON</span>
                <span>{new Date(product.created_at).toLocaleDateString()}</span>
                {vtReportUrl(product) && (
                  <a
                    href={vtReportUrl(product) ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                  >
                    <ExternalLink className="w-3 h-3" />
                    VirusTotal report
                  </a>
                )}
              </div>
            </div>
          </div>

          {rejectTarget === product.id ? (
            <div className="space-y-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection…"
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(product.id, 'rejected', rejectReason)}
                  disabled={actionId === product.id}
                  className="rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/30 disabled:opacity-40 flex items-center gap-1"
                >
                  {actionId === product.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Confirm Reject
                </button>
                <button
                  onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleAction(product.id, 'published')}
                disabled={actionId === product.id || (product.scan_status !== undefined && product.scan_status !== 'clean')}
                title={
                  product.scan_status && product.scan_status !== 'clean'
                    ? `Cannot approve: scan status is "${product.scan_status}"`
                    : 'Publish this product'
                }
                className="rounded-lg bg-green-500/20 border border-green-500/30 px-3 py-1.5 text-sm text-green-400 hover:bg-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Approve
              </button>
              <button
                onClick={() => setRejectTarget(product.id)}
                disabled={actionId === product.id}
                className="rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/30 disabled:opacity-40 flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
              <button
                onClick={() => handleAction(product.id, 'suspended')}
                disabled={actionId === product.id}
                className="rounded-lg bg-yellow-500/20 border border-yellow-500/30 px-3 py-1.5 text-sm text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-40 flex items-center gap-1"
              >
                <Ban className="w-3.5 h-3.5" />
                Suspend
              </button>
              <button
                onClick={() => handleRescan(product.id)}
                disabled={actionId === product.id || product.scan_status === 'pending' || product.scan_status === 'scanning'}
                className="rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 text-sm text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-40 flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-scan
              </button>
              <a
                href={`/product/${product.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-gray-400 hover:text-white flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
