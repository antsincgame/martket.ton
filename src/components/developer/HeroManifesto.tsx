import { memo } from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

interface HeroManifestoProps {
  text: string;
  /** На desktop рендерится внутри hero-grid справа → компактнее, без больших nebula blobs. */
  compact?: boolean;
}

/**
 * Внутренняя версия Manifesto: используется внутри DevCinematicHero.
 * Сохраняет эстетику (quote glyph, dropcap, SEALED IN THE FORGE footer),
 * но с меньшими паддингами и без тяжёлых декораций.
 */
const HeroManifesto = memo(({ text, compact = true }: HeroManifestoProps) => {
  if (!text || text.trim().length === 0) return null;

  const trimmed = text.trim();
  const first = trimmed.charAt(0);
  const rest = trimmed.slice(1);

  const paddingClass = compact ? 'p-5 sm:p-6' : 'p-7 sm:p-9';

  return (
    <motion.aside
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`relative rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md overflow-hidden ${paddingClass}`}
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 40px -20px rgba(0,0,0,0.6)',
      }}
    >
      <div
        aria-hidden
        className="absolute -top-20 -right-16 w-[260px] h-[260px] rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(255,215,0,0.25), rgba(255,0,255,0.15) 50%, transparent 70%)',
        }}
      />

      <div className="relative flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.4em] text-[#FF00FF]/70 font-bold">
        <span className="text-[#FF00FF]/50">❖</span>
        <span>Manifesto</span>
        <span className="flex-1 h-px bg-gradient-to-r from-[#FF00FF]/30 to-transparent" />
      </div>

      <Quote
        className="absolute top-4 right-4 w-6 h-6 text-[#FFD700]/25"
        strokeWidth={1.5}
        aria-hidden
      />

      <div className="relative">
        <p className="text-gray-200/95 text-sm sm:text-base leading-[1.75] whitespace-pre-line font-light italic">
          <span
            className="float-left text-5xl sm:text-6xl font-black leading-none mr-2 mt-0.5"
            style={{
              background: 'linear-gradient(180deg, #FFD700 0%, #F4A836 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 32px rgba(255,215,0,0.35)',
              fontStyle: 'normal',
            }}
          >
            {first}
          </span>
          {rest}
        </p>

        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-white/[0.05]">
          <span className="text-[#FFD700]/30 text-[10px]">◆</span>
          <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.4em] text-[#FFD700]/40 font-bold">
            Sealed in the Forge
          </span>
          <span className="text-[#FFD700]/30 text-[10px]">◆</span>
        </div>
      </div>
    </motion.aside>
  );
});

HeroManifesto.displayName = 'HeroManifesto';

export default HeroManifesto;
