import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { storeApiUrl } from '../../lib/storeApi';
import { useToast } from '../../components/ui/Toast';
import { slugify } from '../../utils/slugify';
import StickyActionBar from './components/StickyActionBar';
import { useSessionInvalidator } from '../../queries/sessionQueries';
import type { CreatedProduct } from './types';
import { DEVELOPER_DISPLAY_NAME_MAX, DEVELOPER_DISPLAY_NAME_MIN, DEVELOPER_SLUG_MAX } from '../../domain/marketplace/limits';
import { type FormState, profileToForm, formsEqual } from './profile/profileTypes';
import { ProfileHeader, BasicInfoCard, SocialsCard, ManifestoCard, FeaturedPickerCard } from './profile/ProfileEditorCards';
import ProfilePreviewCard from './profile/ProfilePreviewCard';

export interface SettingsSectionProps {
  myProducts?: CreatedProduct[];
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
          featured_product_ids: form.featuredIds.length > 0 ? JSON.stringify(form.featuredIds) : null,
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
      <ProfileHeader slug={form.slug} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-6 min-w-0">
          <BasicInfoCard form={form} update={update} onGenerateSlug={generateSlug} getToken={getToken} saving={saving} email={user?.email ?? ''} />
          <SocialsCard form={form} update={update} saving={saving} />
          <ManifestoCard form={form} update={update} saving={saving} />
          <FeaturedPickerCard myProducts={myProducts} featured={form.featuredIds} onToggle={toggleFeatured} />
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-6">
            <ProfilePreviewCard form={form} email={user?.email ?? ''} />
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
