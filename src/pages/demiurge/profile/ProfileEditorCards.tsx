import { User, Globe, ExternalLink, Wand2, Github, Send, Twitter } from 'lucide-react';
import ImageUploader from '../../../components/studio/ImageUploader';
import type { CreatedProduct } from '../types';
import type { FormState, FormUpdater } from './profileTypes';
import { Card, inputClass, labelClass } from './profileTypes';
import {
  DEVELOPER_DISPLAY_NAME_MAX,
  DEVELOPER_DISPLAY_NAME_MIN,
  DEVELOPER_SLUG_MAX,
  BIO_MAX,
  ABOUT_LONG_MAX,
} from '../../../domain/marketplace/limits';

export function ProfileHeader({ slug }: { slug: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-[#C9A6FF]/10 border border-[#C9A6FF]/30 flex items-center justify-center flex-shrink-0">
        <User className="w-6 h-6 text-[#C9A6FF]" aria-hidden />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-wide">Public Profile</h1>
        <p className="text-sm text-[#888]">How the marketplace sees you. All fields sync with the public page.</p>
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

export function BasicInfoCard({
  form, update, onGenerateSlug, getToken, saving, email,
}: {
  form: FormState;
  update: FormUpdater;
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
          <ImageUploader value={form.avatarUrl || null} onChange={(url) => update('avatarUrl', url ?? '')} kind="avatar" getToken={getToken} aspectClass="aspect-square" hint="Square, up to 5 MB" />
        </div>
        <div className="space-y-4">
          <DisplayNameField form={form} update={update} saving={saving} email={email} />
          <SlugField form={form} update={update} saving={saving} onGenerate={onGenerateSlug} />
          <BioField form={form} update={update} saving={saving} />
        </div>
      </div>
      <div>
        <span className={labelClass}>Banner (1500×220 recommended)</span>
        <ImageUploader value={form.bannerUrl || null} onChange={(url) => update('bannerUrl', url ?? '')} kind="banner" getToken={getToken} aspectClass="aspect-[6/1]" hint="Wide banner for the public profile hero" />
      </div>
    </Card>
  );
}

function DisplayNameField({ form, update, saving, email }: { form: FormState; update: FormUpdater; saving: boolean; email: string }) {
  const len = form.displayName.trim().length;
  const color = len > DEVELOPER_DISPLAY_NAME_MAX ? 'text-[#FF4444]' : len >= DEVELOPER_DISPLAY_NAME_MIN ? 'text-[#666]' : 'text-[#FFD700]/60';
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={`${labelClass} mb-0`}><User className="w-3.5 h-3.5 inline mr-1" />Display Name</label>
        <span className={`text-[10px] tabular-nums ${color}`}>{len}/{DEVELOPER_DISPLAY_NAME_MAX}</span>
      </div>
      <input type="text" value={form.displayName} onChange={(e) => update('displayName', e.target.value.slice(0, DEVELOPER_DISPLAY_NAME_MAX))} maxLength={DEVELOPER_DISPLAY_NAME_MAX} minLength={DEVELOPER_DISPLAY_NAME_MIN} disabled={saving} className={inputClass} placeholder={`Name (${DEVELOPER_DISPLAY_NAME_MIN}-${DEVELOPER_DISPLAY_NAME_MAX} chars)`} />
      <p className="text-[10px] text-[#555] mt-1">{email}</p>
    </div>
  );
}

function SlugField({ form, update, saving, onGenerate }: { form: FormState; update: FormUpdater; saving: boolean; onGenerate: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={`${labelClass} mb-0`}>Profile Slug</label>
        <span className="text-[10px] tabular-nums text-[#666]">{form.slug.length}/{DEVELOPER_SLUG_MAX}</span>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666] text-sm">/developer/</span>
          <input type="text" value={form.slug} onChange={(e) => update('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, DEVELOPER_SLUG_MAX))} maxLength={DEVELOPER_SLUG_MAX} disabled={saving} className={`${inputClass} pl-[6.5rem]`} placeholder="your-slug" />
        </div>
        <button type="button" onClick={onGenerate} className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-gray-400 hover:text-[#FFD700] hover:border-[#FFD700]/30 transition-all" title="Generate from name">
          <Wand2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function BioField({ form, update, saving }: { form: FormState; update: FormUpdater; saving: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={`${labelClass} mb-0`}>Bio (short)</label>
        <span className={`text-[10px] tabular-nums ${form.bio.length > BIO_MAX ? 'text-[#FF4444]' : 'text-[#666]'}`}>{form.bio.length}/{BIO_MAX}</span>
      </div>
      <textarea rows={2} value={form.bio} onChange={(e) => update('bio', e.target.value.slice(0, BIO_MAX))} maxLength={BIO_MAX} disabled={saving} className={`${inputClass} resize-none`} placeholder="One line about yourself…" />
    </div>
  );
}

export function SocialsCard({ form, update, saving }: { form: FormState; update: FormUpdater; saving: boolean }) {
  const fields: Array<{ key: keyof FormState; label: string; icon: React.ReactNode; placeholder: string; type?: string }> = [
    { key: 'website', label: 'Website', icon: <Globe className="w-3 h-3 inline mr-1" />, placeholder: 'https://yoursite.com', type: 'url' },
    { key: 'github', label: 'GitHub', icon: <Github className="w-3 h-3 inline mr-1" />, placeholder: 'username' },
    { key: 'telegram', label: 'Telegram', icon: <Send className="w-3 h-3 inline mr-1" />, placeholder: 'username' },
    { key: 'twitter', label: 'X / Twitter', icon: <Twitter className="w-3 h-3 inline mr-1" />, placeholder: 'handle' },
  ];
  return (
    <Card title="Social Links">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map(({ key, label, icon, placeholder, type }) => (
          <div key={key}>
            <label className={labelClass}>{icon}{label}</label>
            <input type={type ?? 'text'} value={form[key] as string} onChange={(e) => update(key, e.target.value)} disabled={saving} className={inputClass} placeholder={placeholder} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ManifestoCard({ form, update, saving }: { form: FormState; update: FormUpdater; saving: boolean }) {
  return (
    <Card title="Manifesto">
      <div className="flex items-center justify-between -mt-2">
        <p className="text-xs text-[#666]">Up to {ABOUT_LONG_MAX} characters. Appears on the public hero page.</p>
        <span className={`text-[10px] tabular-nums ${form.aboutLong.length > ABOUT_LONG_MAX ? 'text-[#FF4444]' : 'text-[#666]'}`}>{form.aboutLong.length}/{ABOUT_LONG_MAX}</span>
      </div>
      <textarea rows={6} value={form.aboutLong} onChange={(e) => update('aboutLong', e.target.value.slice(0, ABOUT_LONG_MAX))} maxLength={ABOUT_LONG_MAX} disabled={saving} className={`${inputClass} resize-none`} placeholder="Tell your story…" />
    </Card>
  );
}

export function FeaturedPickerCard({ myProducts, featured, onToggle }: { myProducts: CreatedProduct[]; featured: string[]; onToggle: (id: string) => void }) {
  if (myProducts.length === 0) return null;
  const set = new Set(featured);
  return (
    <Card title="Featured Products (up to 4)">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {myProducts.map((product) => {
          const isSelected = set.has(product.id);
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => onToggle(product.id)}
              disabled={!isSelected && set.size >= 4}
              className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 text-left disabled:opacity-40 ${isSelected ? 'border-[#FFD700] shadow-[0_0_16px_rgba(255,215,0,0.2)]' : 'border-white/10 hover:border-white/25'}`}
            >
              <div className="aspect-video bg-[#1A1A1A]">
                {product.image && <img src={product.image} alt={product.name} className="w-full h-full object-cover" loading="lazy" />}
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
