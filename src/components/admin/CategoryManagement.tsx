import { useState, useEffect, useCallback } from 'react';
import { Folder, Plus, Search, Edit2, Trash2, Package, RefreshCw, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { storeApiUrl } from '../../lib/storeApi';
import { logger } from '../../lib/logger';

interface Category {
  slug: string;
  name: string;
  products: number;
}

async function adminFetch<T>(
  path: string,
  token: string | null,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(storeApiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.message ?? 'API error');
  return body.data as T;
}

const CategoryManagement = () => {
  const { getToken } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [addingName, setAddingName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const data = await adminFetch<Category[]>('/api/admin/categories', token);
      setCategories(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load categories';
      setError(msg);
      logger.error('[CategoryManagement] load:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { void load(); }, [load]);

  const filtered = categories.filter((c) =>
    !searchQuery.trim() || c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleAdd = async () => {
    setAddError(null);
    const name = addingName.trim();
    if (!name) { setAddError('Name is required'); return; }
    setAddSaving(true);
    try {
      const token = await getToken();
      const created = await adminFetch<Category>('/api/admin/categories', token, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setAddingName('');
      setShowAdd(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setAddSaving(false);
    }
  };

  const handleEdit = async (slug: string) => {
    const name = editingName.trim();
    if (!name) return;
    setEditSaving(true);
    try {
      const token = await getToken();
      const updated = await adminFetch<Category>(`/api/admin/categories/${encodeURIComponent(slug)}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      setCategories((prev) =>
        prev.map((c) => (c.slug === slug ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditingSlug(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (slug: string) => {
    setDeletingSlug(slug);
    try {
      const token = await getToken();
      await adminFetch(`/api/admin/categories/${encodeURIComponent(slug)}`, token, { method: 'DELETE' });
      setCategories((prev) => prev.filter((c) => c.slug !== slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingSlug(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-white">Category Management</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setShowAdd(true); setAddError(null); setAddingName(''); }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <h3 className="text-white font-semibold">New Category</h3>
          {addError && <p className="text-red-400 text-sm">{addError}</p>}
          <div className="flex gap-2">
            <input
              autoFocus
              value={addingName}
              onChange={(e) => setAddingName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); if (e.key === 'Escape') setShowAdd(false); }}
              placeholder="e.g. Developer Tools"
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAdd}
              disabled={addSaving}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {addSaving ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-sm font-medium"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter categories…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading categories…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          {searchQuery ? 'No categories match your filter.' : 'No categories yet.'}
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {filtered.map((category, idx) => (
            <div
              key={category.slug}
              className={`flex items-center gap-4 px-4 py-3 hover:bg-white/[0.03] transition-colors ${
                idx !== 0 ? 'border-t border-white/5' : ''
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Folder className="w-4 h-4 text-blue-400" />
              </div>

              {editingSlug === category.slug ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleEdit(category.slug);
                      if (e.key === 'Escape') setEditingSlug(null);
                    }}
                    className="flex-1 bg-white/10 border border-blue-500/40 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => void handleEdit(category.slug)}
                    disabled={editSaving}
                    className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingSlug(null)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium capitalize">{category.name}</p>
                  <p className="text-gray-500 text-xs font-mono">{category.slug}</p>
                </div>
              )}

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-1 text-gray-400 text-sm">
                  <Package className="w-3.5 h-3.5" />
                  <span>{category.products}</span>
                </div>
                {editingSlug !== category.slug && (
                  <>
                    <button
                      onClick={() => { setEditingSlug(category.slug); setEditingName(category.name); }}
                      title="Rename"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => void handleDelete(category.slug)}
                      disabled={deletingSlug === category.slug || category.products > 0}
                      title={category.products > 0 ? `Cannot delete: ${category.products} products` : 'Delete'}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryManagement;
