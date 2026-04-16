import { memo } from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import SacredDivider from './SacredDivider';
import SacredFrame from './SacredFrame';

interface DevManifestoProps {
  text: string;
}

const DevManifesto = memo(({ text }: DevManifestoProps) => {
  if (!text || text.trim().length === 0) return null;

  const first = text.trim().charAt(0);
  const rest = text.trim().slice(1);

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <SacredDivider label="Manifesto" color="#FF00FF" icon="❖" />

      <SacredFrame color="#FF00FF" className="relative p-8 sm:p-12 overflow-hidden">
        {/* Nebula glow */}
        <div
          aria-hidden
          className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(255,215,0,0.25), rgba(255,0,255,0.15) 50%, transparent 70%)',
          }}
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-20 w-[360px] h-[360px] rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(0,245,255,0.2), rgba(139,92,246,0.1) 50%, transparent 70%)',
          }}
        />

        {/* Opening quote glyph */}
        <Quote
          className="absolute top-4 left-4 w-8 h-8 text-[#FFD700]/30"
          strokeWidth={1.5}
        />

        <div className="relative">
          <p className="text-gray-200 text-base sm:text-lg leading-[1.85] whitespace-pre-line font-light italic">
            <span
              className="float-left text-6xl sm:text-7xl font-black leading-none mr-3 mt-1"
              style={{
                background: 'linear-gradient(180deg, #FFD700 0%, #F4A836 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 40px rgba(255,215,0,0.4)',
                fontStyle: 'normal',
              }}
            >
              {first}
            </span>
            {rest}
          </p>

          {/* Closing glyph */}
          <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-white/[0.06]">
            <span className="text-[#FFD700]/30 text-xs">◆</span>
            <span className="text-[10px] uppercase tracking-[0.4em] text-[#FFD700]/40 font-bold">
              Sealed in the Forge
            </span>
            <span className="text-[#FFD700]/30 text-xs">◆</span>
          </div>
        </div>
      </SacredFrame>
    </motion.section>
  );
});

DevManifesto.displayName = 'DevManifesto';

export default DevManifesto;
