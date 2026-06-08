import { useCallback, useState, type FC } from 'react';
import { Loader2, Lock, RefreshCw, Save, Plus } from 'lucide-react';
import { adminCommerceFetch } from '../../lib/commerceApi';

// Mirrors backend/agent/instructions.ts InstructionSection.
interface InstructionSection {
  section: string;
  title: string;
  body: string;
  order: number;
  active: boolean;
  source: 'default' | 'admin';
}

interface Draft {
  title: string;
  body: string;
  order: number;
  active: boolean;
}

const SECTION_KEY_RE = /^[a-z0-9_]{2,64}$/;

/**
 * Admin console for the agent onboarding/instructions channel served to agents
 * at GET /api/v1/agent/instructions. Defaults live in backend code; this panel
 * edits/overrides them (and adds new sections) via the commerce-admin endpoints.
 */
const AgentInstructionsPanel: FC = () => {
  const [secretInput, setSecretInput] = useState('');
  const [secret, setSecret] = useState('');
  const [sections, setSections] = useState<InstructionSection[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newSection, setNewSection] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const persistSecret = useCallback(() => setSecret(secretInput.trim()), [secretInput]);

  const load = useCallback(async () => {
    if (!secret) {
      setError('Enter the operator secret');
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const r = (await adminCommerceFetch('/admin/agent-instructions', secret)) as {
        data: { sections: InstructionSection[] };
      };
      setSections(r.data.sections);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  }, [secret]);

  const selectSection = (s: InstructionSection) => {
    setSelected(s.section);
    setDraft({ title: s.title, body: s.body, order: s.order, active: s.active });
    setNotice(null);
    setError(null);
  };

  const startNewSection = () => {
    const key = newSection.trim().toLowerCase();
    if (!SECTION_KEY_RE.test(key)) {
      setError('Section key must be 2–64 chars: a–z, 0–9, underscore.');
      return;
    }
    if (sections.some((s) => s.section === key)) {
      setError(`Section “${key}” already exists — edit it from the list.`);
      return;
    }
    setSelected(key);
    setDraft({ title: '', body: '', order: 100, active: true });
    setNewSection('');
    setError(null);
    setNotice(null);
  };

  const save = async () => {
    if (!secret || !selected || !draft) return;
    if (!draft.title.trim() || !draft.body.trim()) {
      setError('Title and body are required.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await adminCommerceFetch(`/admin/agent-instructions/${encodeURIComponent(selected)}`, secret, {
        method: 'PUT',
        body: JSON.stringify({
          title: draft.title,
          body: draft.body,
          order: draft.order,
          active: draft.active,
        }),
      });
      setNotice(`Saved “${selected}”.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-white">
      <div>
        <h2 className="text-lg font-semibold">Agent instructions channel</h2>
        <p className="text-xs text-gray-400 mt-1">
          The machine-readable onboarding manual served to agents at{' '}
          <code className="font-mono">GET /api/v1/agent/instructions</code>. Defaults live in code;
          edits here override or extend a section by its key.
        </p>
      </div>

      <div className="flex items-start gap-2 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
        <Lock className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          The secret comes from <code className="font-mono">COMMERCE_ADMIN_SECRET</code> on the server.
          It is only stored in browser memory — re-enter it after a page refresh.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Secret</label>
          <input
            type="password"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 font-mono text-sm"
            placeholder="COMMERCE_ADMIN_SECRET"
          />
        </div>
        <button type="button" onClick={persistSecret} className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm">
          Save
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || !secret}
          className="px-4 py-2 rounded-lg bg-ton-gradient text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Load sections
        </button>
      </div>

      {error && <div className="text-sm text-red-300">{error}</div>}
      {notice && <div className="text-sm text-emerald-300">{notice}</div>}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Section list */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Sections ({sections.length})</h3>
          </div>
          <ul className="space-y-1">
            {sections.map((s) => (
              <li key={s.section}>
                <button
                  type="button"
                  onClick={() => selectSection(s)}
                  className={`w-full text-left rounded-lg px-2.5 py-2 text-xs border ${
                    selected === s.section
                      ? 'border-[#FFD700]/50 bg-[#FFD700]/10'
                      : 'border-white/10 hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <code className="font-mono text-white/90 truncate">{s.section}</code>
                    <span className="flex items-center gap-1 shrink-0">
                      {!s.active && <span className="text-[9px] uppercase text-amber-300">off</span>}
                      <span className={`text-[9px] uppercase ${s.source === 'admin' ? 'text-emerald-300' : 'text-gray-500'}`}>
                        {s.source}
                      </span>
                    </span>
                  </span>
                  <span className="block text-[11px] text-gray-400 truncate mt-0.5">{s.title}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="pt-2 border-t border-white/10 space-y-1.5">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500">New section</label>
            <div className="flex gap-1.5">
              <input
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                placeholder="e.g. fees_policy"
                className="flex-1 min-w-0 px-2 py-1 rounded bg-white/10 border border-white/20 font-mono text-xs"
              />
              <button
                type="button"
                onClick={startNewSection}
                className="px-2 py-1 rounded bg-white/15 hover:bg-white/25 text-xs flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          {!draft || !selected ? (
            <p className="text-sm text-gray-500">Select a section to edit, or add a new one.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <code className="font-mono text-[#FFD700] text-sm">{selected}</code>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Title</label>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Body (agent-facing)</label>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  maxLength={20000}
                  rows={14}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm font-mono whitespace-pre-wrap"
                />
                <p className="text-[10px] text-gray-500 mt-1">{draft.body.length}/20000</p>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-xs text-gray-400 flex items-center gap-2">
                  Order
                  <input
                    type="number"
                    value={draft.order}
                    min={0}
                    max={1000}
                    onChange={(e) => setDraft({ ...draft, order: parseInt(e.target.value, 10) || 0 })}
                    className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-sm"
                  />
                </label>
                <label className="text-xs text-gray-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  />
                  Active (served to agents)
                </label>
              </div>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-ton-gradient text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save section
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentInstructionsPanel;
