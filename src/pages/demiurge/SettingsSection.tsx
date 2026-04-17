// SettingsSection (он же /profile/profile, экспортируется через ProfileSection)
//
// Identity-редактор кабинета. Двухколоночная вёрстка на больших экранах:
// слева — форма (basic / socials / manifest / featured), справа — live preview
// карточки публичного профиля. На мобильных layout сворачивается в одну
// колонку, preview уезжает наверх.
//
// Сохранение: «грязное» состояние подсвечивает StickyActionBar внизу экрана,
// а не маленькая кнопка в конце страницы. Avatar и banner грузятся через
// общий ImageUploader (R2). После сохранения перезагружаем профиль и
// инвалидируем session-кэш, чтобы остальные секции увидели новые данные.
import { useEffect, useMemo, useState } from 'react';
import {
  User, Globe, ExternalLink, Wand2, Github, Send, Twitter, Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { storeApiUrl } from '../../lib/storeApi';
import { useToast } from '../../components/ui/Toast';
import { slugify } from '../../utils/slugify';
import StickyActionBar from './components/StickyActionBar';
import ImageUploader from '../../components/studio/ImageUploader';
import { useSessionInvalidator } from '../../queries/sessionQueries';
import type { CreatedProduct } from './types';
import {
  DEVELOPER_DISPLAY_NAME_MAX,
  DEVELOPER_DISPLAY_NAME_MIN,
  DEVELOPER_SLUG_MAX,
  BIO_MAX,
  ABOUT_LONG_MAX,
} from '../../domain/marketplace/limits';

export interface SettingsSectionProps {
  myProducts?: CreatedProduct[];
}

interface FormState {
  displayName: string;
  bio: string;
  slug: string;
  avatarUrl: string;
  bannerUrl: string;
  website: string;
  github: string;
  telegram: string;
  twitter: string;
  aboutLong: string;
  featuredIds: string[];
}

function profileToForm(user: ReturnType<typeof useAuth>['user']): FormState {
  return {
    displayName: user?.profile?.displayName || user?.username || '',
    bio: user?.profile?.bio || '',
    slug: user?.profile?.slug || '',
    avatarUrl: user?.profile?.avatar || '',
    bannerUrl: user?.profile?.bannerUrl || '',
    website: user?.profile?.website || '',
    github: user?.profile?.github || '',
    telegram: user?.profile?.telegram || '',
    twitter: user?.profile?.twitter || '',
    aboutLong: user?.profile?.aboutLong || '',
    featuredIds: [...(user?.profile?.featuredProductIds ?? [])],
  };
}

function formsEqual(a: FormState, b: FormState): boolean {
  if (a.featuredIds.length !== b.featuredIds.length) return false;
  if (a.featuredIds.some((v, i) => v !== b.featuredIds[i])) return false;
  return (
    a.displayName === b.displayName &&
    a.bio === b.bio &&
    a.slug === b.slug &&
    a.avatarUrl === b.avatarUrl &&
    a.bannerUrl === b.bannerUrl &&
    a.website === b.website &&
    a.github === b.github &&
    a.telegram === b.telegram &&
    a.twitter === b.twitter &&
    a.aboutLong === b.aboutLong
  );
}

export default function SettingsSection({ myProducts = [] }: SettingsSectionProps) {
  const { user, fetchProfile, getToken } = useAuth();
  const { invalidateAll } = useSessionInvalidator();
  const { toast } = useToast();

  const [initial, setInitial] = useState<FormState>(() => profileToForm(user));
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = profileToForm(user);
    setInitial(next);
    setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.profile]);

  const dirty = useMemo(() => !formsEqual(form, initial), [form, initial]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const generateSlug = () =>
    update('slug', slugify(form.displayName).slice(0, DEVELOPER_SLUG_MAX));

  const toggleFeatured = (id: string) => {
    setForm((prev) => {
      const set = new Set(prev.featuredIds);
      if (set.has(id)) set.delete(id);
      else if (set.size < 4) set.add(id);
      return { ...prev, featuredIds: [...set] };
    });
  };

  const handleSave = async () => {
    const dn = form.displayName.trim();
    if (dn.length < DEVELOPER_DISPLAY_NAME_MIN) {
      toast('error', `Display Name: минимум ${DEVELOPER_DISPLAY_NAME_MIN} символов`);
      return;
    }
    if (dn.length > DEVELOPER_DISPLAY_NAME_MAX) {
      toast('error', `Display Name: максимум ${DEVELOPER_DISPLAY_NAME_MAX} символов`);
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
          bio: form.bio.trim(),
          slug: form.slug.trim(),
          avatar: form.avatarUrl.trim() || null,
          banner_url: form.bannerUrl.trim() || null,
          website: form.website.trim() || null,
          github: form.github.trim() || null,
          telegram: form.telegram.trim() || null,
          twitter: form.twitter.trim() || null,
          about_long: form.aboutLong.trim() || null,
          featured_product_ids:
            form.featuredIds.length > 0 ? JSON.stringify(form.featuredIds) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Save failed' }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      toast('success', 'Профиль сохранён');
      await fetchProfile();
      void invalidateAll();
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Header slug={form.slug} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-6 min-w-0">
          <BasicInfoCard
            form={form}
            update={update}
            onGenerateSlug={generateSlug}
            getToken={getToken}
            saving={saving}
            email={user?.email ?? ''}
          />
          <SocialsCard form={form} update={update} saving={saving} />
          <ManifestoCard form={form} update={update} saving={saving} />
          <FeaturedPickerCard
            myProducts={myProducts}
            featured={form.featuredIds}
            onToggle={toggleFeatured}
          />
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-6">
            <LivePreviewCard form={form} email={user?.email ?? ''} />
          </div>
        </aside>
      </div>

      <StickyActionBar
        visible={dirty || saving}
        saving={saving}
        onSave={handleSave}
        onCancel={() => setForm(initial)}
        saveLabel={saving ? 'Сохраняем…' : 'Сохранить изменения'}
        cancelLabel="Отменить"
        message={dirty ? 'У вас есть несохранённые изменения профиля.' : undefined}
      />
    </div>
  );
}

function Header({ slug }: { slug: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-[#C9A6FF]/10 border border-[#C9A6FF]/30 flex items-center justify-center flex-shrink-0">
        <User className="w-6 h-6 text-[#C9A6FF]" aria-hidden />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-wide">Public Profile</h1>
        <p className="text-sm text-[#888]">Как вас видит маркетплейс. Все поля синхронизируются с публичной страницей.</p>
      </div>
      {slug && (
        <a
          href={`/developer/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#00F5FF]/25 bg-[#00F5FF]/10 px-3 py-2 text-xs font-semibold text-[#00F5FF] hover:bg-[#00F5FF]/20"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          /developer/{slug}
        </a>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-[#111119] p-6 space-y-5">
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/50">{title}</h2>
      {children}
    </section>
  );
}

const inputClass =
  'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#FFD700]/40 focus:ring-1 focus:ring-[#FFD700]/20 transition-all disabled:opacity-40';
const labelClass = 'block text-[#999] text-xs uppercase tracking-wider font-medium mb-2';

function BasicInfoCard({
  form,
  update,
  onGenerateSlug,
  getToken,
  saving,
  email,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onGenerateSlug: () => void;
  getToken: () => Promise<string | null>;
  saving: boolean;
  email: string;
}) {
  return (
    <Card title="Basic Info">
      <div className="grid gap-5 sm:grid-cols-[140px_minmax(0,1fr)] items-start">
        <div>
          <span className={labelClass}>Avatar</span>
          <ImageUploader
            value={form.avatarUrl || null}
            onChange={(url) => update('avatarUrl', url ?? '')}
            kind="avatar"
            getToken={getToken}
            aspectClass="aspect-square"
            hint="Квадрат, до 5 MB"
          />
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`${labelClass} mb-0`}>
                <User className="w-3.5 h-3.5 inline mr-1" />
                Display Name
              </label>
              <span
                className={`text-[10px] tabular-nums ${
                  form.displayName.trim().length > DEVELOPER_DISPLAY_NAME_MAX
                    ? 'text-[#FF4444]'
                    : form.displayName.trim().length >= DEVELOPER_DISPLAY_NAME_MIN
                      ? 'text-[#666]'
                      : 'text-[#FFD700]/60'
                }`}
              >
                {form.displayName.trim().length}/{DEVELOPER_DISPLAY_NAME_MAX}
              </span>
            </div>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) =>
                update('displayName', e.target.value.slice(0, DEVELOPER_DISPLAY_NAME_MAX))
              }
              maxLength={DEVELOPER_DISPLAY_NAME_MAX}
              minLength={DEVELOPER_DISPLAY_NAME_MIN}
              disabled={saving}
              className={inputClass}
              placeholder={`Имя (${DEVELOPER_DISPLAY_NAME_MIN}-${DEVELOPER_DISPLAY_NAME_MAX} симв.)`}
            />
            <p className="text-[10px] text-[#555] mt-1">{email}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`${labelClass} mb-0`}>Profile Slug</label>
              <span className="text-[10px] tabular-nums text-[#666]">
                {form.slug.length}/{DEVELOPER_SLUG_MAX}
              </span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666] text-sm">
                  /developer/
                </span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) =>
                    update(
                      'slug',
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, '')
                        .slice(0, DEVELOPER_SLUG_MAX),
                    )
                  }
                  maxLength={DEVELOPER_SLUG_MAX}
                  disabled={saving}
                  className={`${inputClass} pl-[6.5rem]`}
                  placeholder="your-slug"
                />
              </div>
              <button
                type="button"
                onClick={onGenerateSlug}
                className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-gray-400 hover:text-[#FFD700] hover:border-[#FFD700]/30 transition-all"
                title="Сгенерировать из имени"
              >
                <Wand2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`${labelClass} mb-0`}>Bio (короткое)</label>
              <span
                className={`text-[10px] tabular-nums ${
                  form.bio.length > BIO_MAX ? 'text-[#FF4444]' : 'text-[#666]'
                }`}
              >
                {form.bio.length}/{BIO_MAX}
              </span>
            </div>
            <textarea
              rows={2}
              value={form.bio}
              onChange={(e) => update('bio', e.target.value.slice(0, BIO_MAX))}
              maxLength={BIO_MAX}
              disabled={saving}
              className={`${inputClass} resize-none`}
              placeholder="Одна строка о себе…"
            />
          </div>
        </div>
      </div>

      <div>
        <span className={labelClass}>Banner (1500×220 рекомендуется)</span>
        <ImageUploader
          value={form.bannerUrl || null}
          onChange={(url) => update('bannerUrl', url ?? '')}
          kind="banner"
          getToken={getToken}
          aspectClass="aspect-[6/1]"
          hint="Широкий баннер для героя публичного профиля"
        />
      </div>
    </Card>
  );
}

function SocialsCard({
  form,
  update,
  saving,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  saving: boolean;
}) {
  return (
    <Card title="Social Links">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            <Globe className="w-3 h-3 inline mr-1" />
            Website
          </label>
          <input
            type="url"
            value={form.website}
            onChange={(e) => update('website', e.target.value)}
            disabled={saving}
            className={inputClass}
            placeholder="https://yoursite.com"
          />
        </div>
        <div>
          <label className={labelClass}>
            <Github className="w-3 h-3 inline mr-1" />
            GitHub
          </label>
          <input
            type="text"
            value={form.github}
            onChange={(e) => update('github', e.target.value)}
            disabled={saving}
            className={inputClass}
            placeholder="username"
          />
        </div>
        <div>
          <label className={labelClass}>
            <Send className="w-3 h-3 inline mr-1" />
            Telegram
          </label>
          <input
            type="text"
            value={form.telegram}
            onChange={(e) => update('telegram', e.target.value)}
            disabled={saving}
            className={inputClass}
            placeholder="username"
          />
        </div>
        <div>
          <label className={labelClass}>
            <Twitter className="w-3 h-3 inline mr-1" />
            X / Twitter
          </label>
          <input
            type="text"
            value={form.twitter}
            onChange={(e) => update('twitter', e.target.value)}
            disabled={saving}
            className={inputClass}
            placeholder="handle"
          />
        </div>
      </div>
    </Card>
  );
}

function ManifestoCard({
  form,
  update,
  saving,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  saving: boolean;
}) {
  return (
    <Card title="Manifesto">
      <div className="flex items-center justify-between -mt-2">
        <p className="text-xs text-[#666]">
          До {ABOUT_LONG_MAX} символов. Появляется на публичной странице героя.
        </p>
        <span
          className={`text-[10px] tabular-nums ${
            form.aboutLong.length > ABOUT_LONG_MAX ? 'text-[#FF4444]' : 'text-[#666]'
          }`}
        >
          {form.aboutLong.length}/{ABOUT_LONG_MAX}
        </span>
      </div>
      <textarea
        rows={6}
        value={form.aboutLong}
        onChange={(e) => update('aboutLong', e.target.value.slice(0, ABOUT_LONG_MAX))}
        maxLength={ABOUT_LONG_MAX}
        disabled={saving}
        className={`${inputClass} resize-none`}
        placeholder="Расскажите свою историю…"
      />
    </Card>
  );
}

function FeaturedPickerCard({
  myProducts,
  featured,
  onToggle,
}: {
  myProducts: CreatedProduct[];
  featured: string[];
  onToggle: (id: string) => void;
}) {
  if (myProducts.length === 0) return null;
  const set = new Set(featured);
  return (
    <Card title="Featured Products (до 4)">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {myProducts.map((product) => {
          const isSelected = set.has(product.id);
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => onToggle(product.id)}
              disabled={!isSelected && set.size >= 4}
              className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 text-left disabled:opacity-40 ${
                isSelected
                  ? 'border-[#FFD700] shadow-[0_0_16px_rgba(255,215,0,0.2)]'
                  : 'border-white/10 hover:border-white/25'
              }`}
            >
              <div className="aspect-video bg-[#1A1A1A]">
                {product.image && (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
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
    </Card>
  );
}

function LivePreviewCard({ form, email }: { form: FormState; email: string }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0A0A0F]">
      <div
        className="h-24 w-full bg-gradient-to-r from-[#8B5CF6]/30 via-[#FFD700]/10 to-[#00F5FF]/30 relative"
        style={
          form.bannerUrl
            ? { backgroundImage: `url(${form.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] to-transparent" aria-hidden />
      </div>
      <div className="p-5 -mt-10 relative">
        <div className="w-16 h-16 rounded-2xl border-2 border-[#FFD700]/40 bg-[#0D0D1A] overflow-hidden flex items-center justify-center mb-3">
          {form.avatarUrl ? (
            <img src={form.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl text-[#FFD700] font-display font-bold">
              {form.displayName.charAt(0).toUpperCase() || '◊'}
            </span>
          )}
        </div>

        <h3 className="text-lg font-display font-bold text-white truncate">
          {form.displayName || 'Demiurge'}
        </h3>
        {form.slug && <p className="text-xs text-[#00F5FF]">/developer/{form.slug}</p>}
        {form.bio && <p className="text-sm text-[#aaa] mt-2 line-clamp-3">{form.bio}</p>}

        {form.aboutLong && (
          <p className="text-xs text-[#888] mt-3 line-clamp-4 border-t border-white/[0.06] pt-3">
            {form.aboutLong}
          </p>
        )}

        <ul className="mt-4 space-y-1.5 text-xs text-[#666]">
          {form.website && (
            <li className="flex items-center gap-2 truncate">
              <Globe className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{form.website}</span>
            </li>
          )}
          {form.github && (
            <li className="flex items-center gap-2 truncate">
              <Github className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">github.com/{form.github}</span>
            </li>
          )}
          {form.telegram && (
            <li className="flex items-center gap-2 truncate">
              <Send className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">t.me/{form.telegram}</span>
            </li>
          )}
          {form.twitter && (
            <li className="flex items-center gap-2 truncate">
              <Twitter className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">@{form.twitter}</span>
            </li>
          )}
          {!form.website && !form.github && !form.telegram && !form.twitter && (
            <li className="text-[#555] italic">Нет соц-ссылок</li>
          )}
        </ul>

        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#FFD700]/60">
          <Sparkles className="w-3 h-3" aria-hidden />
          Live preview
          {email && <span className="ml-auto text-[#444] normal-case">{email}</span>}
        </div>
      </div>
    </div>
  );
}
