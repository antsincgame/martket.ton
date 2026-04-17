import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Loader2, Search, Award } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { storeApiUrl } from '../../lib/storeApi';
import { logger } from '../../lib/logger';

interface DemiurgeRow {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  verified: boolean;
  trust_score: number;
  published_count: number;
  rejection_count: number;
}

export default function VerifiedDemiurges() {
  const { getToken } = useAuth();
  const [users, setUsers] = useState<DemiurgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/admin/users'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json();
      setUsers((body.data || []) as DemiurgeRow[]);
    } catch (err) {
      logger.error('[verified-demiurges] load:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { void load(); }, [load]);

  const toggleVerified = useCallback(async (id: string, next: boolean) => {
    setBusy(id);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl(`/api/admin/profiles/${id}/verify`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ verified: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, verified: next } : u)));
    } catch (err) {
      logger.error('[verified-demiurges] toggle:', err);
    } finally {
      setBusy(null);
    }
  }, [getToken]);

  const filtered = users.filter((u) => {
    const term = search.toLowerCase();
    return (
      !term ||
      (u.display_name || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)
    );
  });

  const verifiedCount = users.filter((u) => u.verified).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading demiurges…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#00FF88]" />
            Verified Demiurges
          </h2>
          <p className="text-sm text-[#888]">
            Verified demiurges get auto-publish after a clean VirusTotal scan ({verifiedCount}/{users.length} verified).
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#FFD700]/40"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-[#888] text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Demiurge</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-right px-4 py-3">Trust</th>
              <th className="text-right px-4 py-3">Published</th>
              <th className="text-right px-4 py-3">Rejected</th>
              <th className="text-right px-4 py-3">Verified</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{u.display_name || '—'}</p>
                  <p className="text-xs text-[#666]">{u.email || '—'}</p>
                </td>
                <td className="px-4 py-3 text-[#aaa] uppercase text-xs">{u.role}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1 text-[#FFD700]">
                    <Award className="w-3 h-3" />
                    {u.trust_score}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[#aaa]">{u.published_count}</td>
                <td className="px-4 py-3 text-right text-[#aaa]">{u.rejection_count}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleVerified(u.id, !u.verified)}
                    disabled={busy === u.id}
                    aria-pressed={u.verified}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      u.verified ? 'bg-[#00FF88]/40' : 'bg-white/10'
                    } disabled:opacity-40`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        u.verified ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#666]">
                  No demiurges match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
