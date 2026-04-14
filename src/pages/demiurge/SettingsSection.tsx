import { useState } from 'react';
import { Settings, User, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { storeApiUrl } from '../../lib/storeApi';
import { useToast } from '../../components/ui/Toast';

export default function SettingsSection() {
  const { user, fetchProfile, getToken } = useAuth();
  const [displayName, setDisplayName] = useState(user?.profile?.displayName || user?.username || '');
  const [bio, setBio] = useState(user?.profile?.bio || '');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/session/profile'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_name: displayName.trim(), bio: bio.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Save failed' }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      toast('success', 'Profile updated');
      await fetchProfile();
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#FFD700]/40 focus:ring-1 focus:ring-[#FFD700]/20 transition-all disabled:opacity-40';

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-display font-bold uppercase tracking-widest text-white flex items-center gap-3">
          <Settings className="w-7 h-7 text-[#999]" />
          Настройки
        </h1>
        <p className="text-[#666] text-sm mt-1">Manage your profile</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111119] p-6 space-y-5">
        <div className="flex items-center gap-4 pb-5 border-b border-white/[0.06]">
          <div className="w-16 h-16 rounded-full border-2 border-[#FFD700]/30 bg-[#0D0D1A] flex items-center justify-center text-2xl">
            {user?.profile?.avatar || '🌌'}
          </div>
          <div>
            <p className="text-white font-semibold">{user?.profile?.displayName || user?.username || 'Demiurge'}</p>
            <p className="text-[#666] text-sm">{user?.email || ''}</p>
          </div>
        </div>

        <div>
          <label className="block text-[#999] text-xs uppercase tracking-wider font-medium mb-2">
            <User className="w-3.5 h-3.5 inline mr-1" />
            Display Name
          </label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            disabled={saving} className={inputClass} placeholder="Your name..." />
        </div>

        <div>
          <label className="block text-[#999] text-xs uppercase tracking-wider font-medium mb-2">Bio</label>
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)}
            disabled={saving} className={`${inputClass} resize-none`} placeholder="Tell the world about yourself..." />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest text-xs px-6 py-3 rounded-lg hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all duration-300 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>
    </div>
  );
}
