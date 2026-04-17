import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Sparkles } from 'lucide-react';

export interface CabinetHeroKpi {
  label: string;
  value: string | number;
  accent?: string;
  hint?: string;
}

interface CabinetHeroProps {
  displayName: string;
  role: string;
  avatar?: string | null;
  publicSlug?: string | null;
  kpis: CabinetHeroKpi[];
}

const DEFAULT_ACCENT = '#FFD700';

/**
 * Compact "creator hero" — звучит из тех же neon-аккордов, что DevCinematicHero
 * на публичной странице, но в студийном, рабочем тоне. Показывает имя/роль/аватар
 * и до четырёх ключевых KPI в одной полосе.
 */
const CabinetHero = memo(({ displayName, role, avatar, publicSlug, kpis }: CabinetHeroProps) => {
  return (
    <section
      aria-label="Studio overview"
      className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#111119] via-[#0F0F18] to-[#0A0A0F]"
    >
      {/* sacred gradient halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(circle at 0% 0%, rgba(255,215,0,0.10), transparent 35%), radial-gradient(circle at 100% 100%, rgba(0,245,255,0.08), transparent 40%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/3 opacity-40"
        style={{
          background:
            'conic-gradient(from 90deg at 100% 50%, rgba(139,92,246,0.0), rgba(139,92,246,0.18), rgba(0,245,255,0.0))',
        }}
      />

      <div className="relative flex flex-col gap-6 p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-[#FFD700]/40 bg-[#0D0D1A] overflow-hidden flex items-center justify-center flex-shrink-0 shadow-[0_0_24px_rgba(255,215,0,0.15)]">
            {avatar && avatar.startsWith('http') ? (
              <img src={avatar} alt={`${displayName} avatar`} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl sm:text-4xl text-[#FFD700] font-display font-bold">
                {displayName.charAt(0).toUpperCase() || '◊'}
              </span>
            )}
          </div>

          {/* Name + role */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[#FFD700]/70">
              <Sparkles className="w-3 h-3" aria-hidden />
              {role}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-white tracking-wide truncate mt-1">
              {displayName}
            </h1>
            {publicSlug && (
              <Link
                to={`/developer/${publicSlug}`}
                className="inline-flex items-center gap-1.5 text-xs text-[#00F5FF] hover:text-white transition-colors mt-2"
              >
                <ExternalLink className="w-3 h-3" aria-hidden />
                /developer/{publicSlug}
              </Link>
            )}
          </div>
        </div>

        {/* KPI strip */}
        {kpis.length > 0 && (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.slice(0, 4).map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-white/[0.08] bg-black/20 backdrop-blur-sm px-3 py-3 sm:px-4 sm:py-3.5"
              >
                <dt className="text-[10px] uppercase tracking-wider text-[#888]">{kpi.label}</dt>
                <dd
                  className="text-xl sm:text-2xl font-display font-bold tabular-nums mt-1"
                  style={{ color: kpi.accent ?? DEFAULT_ACCENT }}
                >
                  {kpi.value}
                </dd>
                {kpi.hint && <p className="text-[10px] text-[#666] mt-0.5">{kpi.hint}</p>}
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
});

CabinetHero.displayName = 'CabinetHero';

export default CabinetHero;
