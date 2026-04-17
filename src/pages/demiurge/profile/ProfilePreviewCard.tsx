import { Globe, Github, Send, Twitter, Sparkles } from 'lucide-react';
import type { FormState } from './profileTypes';

export default function ProfilePreviewCard({ form, email }: { form: FormState; email: string }) {
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

        <SocialLinks form={form} />

        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#FFD700]/60">
          <Sparkles className="w-3 h-3" aria-hidden />
          Live preview
          {email && <span className="ml-auto text-[#444] normal-case">{email}</span>}
        </div>
      </div>
    </div>
  );
}

function SocialLinks({ form }: { form: FormState }) {
  const hasSocials = form.website || form.github || form.telegram || form.twitter;
  return (
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
      {!hasSocials && <li className="text-[#555] italic">Нет соц-ссылок</li>}
    </ul>
  );
}
