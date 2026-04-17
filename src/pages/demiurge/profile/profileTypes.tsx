import type { useAuth } from '../../../contexts/AuthContext';

export interface FormState {
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

export type FormUpdater = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

export function profileToForm(user: ReturnType<typeof useAuth>['user']): FormState {
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

export function formsEqual(a: FormState, b: FormState): boolean {
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

export const inputClass =
  'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#FFD700]/40 focus:ring-1 focus:ring-[#FFD700]/20 transition-all disabled:opacity-40';

export const labelClass = 'block text-[#999] text-xs uppercase tracking-wider font-medium mb-2';

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-[#111119] p-6 space-y-5">
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/50">{title}</h2>
      {children}
    </section>
  );
}
