import { useState } from 'react';
import {
  Settings, User, Save, Loader2, Globe, ExternalLink,
  Wand2, Github, Send, Twitter,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { storeApiUrl } from '../../lib/storeApi';
import { useToast } from '../../components/ui/Toast';
import { slugify } from '../../utils/slugify';
import type { CreatedProduct } from './types';
import {
  DEVELOPER_DISPLAY_NAME_MAX,
  DEVELOPER_DISPLAY_NAME_MIN,
  DEVELOPER_SLUG_MAX,
  BIO_MAX,
  ABOUT_LONG_MAX,
} from '../../domain/marketplace/limits';

interface SettingsSectionProps {
  myProducts?: CreatedProduct[];
}

export default function SettingsSection({ myProducts = [] }: SettingsSectionProps) {
  const { user, fetchProfile, getToken } = useAuth();
  const [displayName, setDisplayName] = useState(user?.profile?.displayName || user?.username || '');
  const [bio, setBio] = useState(user?.profile?.bio || '');
  const [slug, setSlug] = useState(() => user?.profile?.slug || (displayName ? slugify(displayName) : ''));
  const [avatarUrl, setAvatarUrl] = useState(user?.profile?.avatar || '');
  const [bannerUrl, setBannerUrl] = useState(user?.profile?.bannerUrl || '');
  const [website, setWebsite] = useState(user?.profile?.website || '');
  const [github, setGithub] = useState(user?.profile?.github || '');
  const [telegram, setTelegram] = useState(user?.profile?.telegram || '');
  const [twitter, setTwitter] = useState(user?.profile?.twitter || '');
  const [aboutLong, setAboutLong] = useState(user?.profile?.aboutLong || '');
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(
    () => new Set(user?.profile?.featuredProductIds ?? [])
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const generateSlug = () => setSlug(slugify(displayName).slice(0, DEVELOPER_SLUG_MAX));

  const toggleFeatured = (id: string) => {
    setFeaturedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    const dn = displayName.trim();
    if (dn.length < DEVELOPER_DISPLAY_NAME_MIN) {
      toast('error', `Display Name must be at least ${DEVELOPER_DISPLAY_NAME_MIN} characters`);
      return;
    }
    if (dn.length > DEVELOPER_DISPLAY_NAME_MAX) {
      toast('error', `Display Name must be at most ${DEVELOPER_DISPLAY_NAME_MAX} characters`);
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/session/profile'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          display_name: dn,
          bio: bio.trim(),
          slug: slug.trim(),
          avatar: avatarUrl.trim() || null,
          banner_url: bannerUrl.trim() || null,
          website: website.trim() || null,
          github: github.trim() || null,
          telegram: telegram.trim() || null,
          twitter: twitter.trim() || null,
          about_long: aboutLong.trim() || null,
          featured_product_ids: featuredIds.size > 0 ? JSON.stringify([...featuredIds]) : null,
        }),
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
  const labelClass = 'block text-[#999] text-xs uppercase tracking-wider font-medium mb-2';

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold uppercase tracking-widest text-white flex items-center gap-3">
            <Settings className="w-7 h-7 text-[#999]" />
            Settings
          </h1>
          <p className="text-[#666] text-sm mt-1">Manage your profile and public page</p>
        </div>
        {slug && (
          <a
            href={`/developer/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00F5FF]/10 border border-[#00F5FF]/25 text-[#00F5FF] text-xs font-semibold hover:bg-[#00F5FF]/20 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Public Profile
          </a>
        )}
      </div>

      {/* Basic Info */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111119] p-6 space-y-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/50">Basic Info</h2>

        <div className="flex items-center gap-4 pb-4 border-b border-white/[0.06]">
          <div className="w-16 h-16 rounded-full border-2 border-[#FFD700]/30 bg-[#0D0D1A] flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
            {avatarUrl && avatarUrl.startsWith('http') ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#FFD700] font-bold">{displayName.charAt(0).toUpperCase() || '?'}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{displayName || 'Demiurge'}</p>
            <p className="text-[#666] text-sm truncate">{user?.email || ''}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelClass} mb-0`}>
              <User className="w-3.5 h-3.5 inline mr-1" />
              Display Name
            </label>
            <span className={`text-[10px] tabular-nums ${
              displayName.trim().length > DEVELOPER_DISPLAY_NAME_MAX ? 'text-[#FF4444]'
                : displayName.trim().length >= DEVELOPER_DISPLAY_NAME_MIN ? 'text-[#666]' : 'text-[#FFD700]/60'
            }`}>
              {displayName.trim().length}/{DEVELOPER_DISPLAY_NAME_MAX}
            </span>
          </div>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, DEVELOPER_DISPLAY_NAME_MAX))}
            maxLength={DEVELOPER_DISPLAY_NAME_MAX}
            minLength={DEVELOPER_DISPLAY_NAME_MIN}
            disabled={saving}
            className={inputClass}
            placeholder={`Your name (${DEVELOPER_DISPLAY_NAME_MIN}-${DEVELOPER_DISPLAY_NAME_MAX} chars)...`}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelClass} mb-0`}>Profile Slug</label>
            <span className="text-[10px] tabular-nums text-[#666]">
              {slug.length}/{DEVELOPER_SLUG_MAX}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666] text-sm">/developer/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, '')
                      .slice(0, DEVELOPER_SLUG_MAX)
                  )
                }
                maxLength={DEVELOPER_SLUG_MAX}
                disabled={saving}
                className={`${inputClass} pl-[6.5rem]`}
                placeholder="your-slug"
              />
            </div>
            <button onClick={generateSlug} className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-gray-400 hover:text-[#FFD700] hover:border-[#FFD700]/30 transition-all" title="Auto-generate from name">
              <Wand2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelClass} mb-0`}>Bio (short)</label>
            <span className={`text-[10px] tabular-nums ${bio.length > BIO_MAX ? 'text-[#FF4444]' : 'text-[#666]'}`}>
              {bio.length}/{BIO_MAX}
            </span>
          </div>
          <textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            maxLength={BIO_MAX}
            disabled={saving} className={`${inputClass} resize-none`} placeholder="One-liner about yourself..." />
        </div>

        <div>
          <label className={labelClass}>Avatar URL</label>
          <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
            disabled={saving} className={inputClass} placeholder="https://..." />
        </div>

        <div>
          <label className={labelClass}>Banner URL (1500x220 recommended)</label>
          <input type="url" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)}
            disabled={saving} className={inputClass} placeholder="https://..." />
          {bannerUrl && (
            <div className="mt-2 rounded-lg overflow-hidden border border-white/10 h-[60px]">
              <img src={bannerUrl} alt="Banner preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>

      {/* Social Links */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111119] p-6 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/50">Social Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}><Globe className="w-3 h-3 inline mr-1" />Website</label>
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)}
              disabled={saving} className={inputClass} placeholder="https://yoursite.com" />
          </div>
          <div>
            <label className={labelClass}><Github className="w-3 h-3 inline mr-1" />GitHub</label>
            <input type="text" value={github} onChange={(e) => setGithub(e.target.value)}
              disabled={saving} className={inputClass} placeholder="username" />
          </div>
          <div>
            <label className={labelClass}><Send className="w-3 h-3 inline mr-1" />Telegram</label>
            <input type="text" value={telegram} onChange={(e) => setTelegram(e.target.value)}
              disabled={saving} className={inputClass} placeholder="username" />
          </div>
          <div>
            <label className={labelClass}><Twitter className="w-3 h-3 inline mr-1" />X / Twitter</label>
            <input type="text" value={twitter} onChange={(e) => setTwitter(e.target.value)}
              disabled={saving} className={inputClass} placeholder="handle" />
          </div>
        </div>
      </div>

      {/* About Long (Manifesto) */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111119] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/50">Manifesto</h2>
          <span className={`text-[10px] tabular-nums ${aboutLong.length > ABOUT_LONG_MAX ? 'text-[#FF4444]' : 'text-[#666]'}`}>
            {aboutLong.length}/{ABOUT_LONG_MAX}
          </span>
        </div>
        <textarea
          rows={6}
          value={aboutLong}
          onChange={(e) => setAboutLong(e.target.value.slice(0, ABOUT_LONG_MAX))}
          maxLength={ABOUT_LONG_MAX}
          disabled={saving}
          className={`${inputClass} resize-none`}
          placeholder="Tell your story — this appears on your public profile page as the Manifesto overlay..."
        />
      </div>

      {/* Featured Products Picker */}
      {myProducts.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-[#111119] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/50">Featured Products</h2>
            <span className="text-[10px] text-gray-600">{featuredIds.size}/4 selected</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {myProducts.map((product) => {
              const isSelected = featuredIds.has(product.id);
              return (
                <button
                  key={product.id}
                  onClick={() => toggleFeatured(product.id)}
                  disabled={!isSelected && featuredIds.size >= 4}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 text-left disabled:opacity-40 ${
                    isSelected
                      ? 'border-[#FFD700] shadow-[0_0_16px_rgba(255,215,0,0.2)]'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="aspect-video bg-[#1A1A1A]">
                    {product.image && (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-white truncate font-medium">{product.name}</p>
                    <p className="text-[10px] text-gray-500">{product.price_ton} TON</p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#FFD700] flex items-center justify-center">
                      <span className="text-[#0A0A0A] text-[10px] font-bold">&#10003;</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest text-xs px-6 py-3 rounded-lg hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all duration-300 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
      </button>
    </div>
  );
}
