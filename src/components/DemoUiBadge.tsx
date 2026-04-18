import { memo } from 'react';

type BadgeVariant = 'floating' | 'inline' | 'corner';
type BadgeTint = 'cyan' | 'gold' | 'magenta';

interface DemoUiBadgeProps {
  variant?: BadgeVariant;
  tint?: BadgeTint;
  className?: string;
  label?: string;
}

const TINTS: Record<BadgeTint, { text: string; border: string; bg: string; dot: string; glow: string }> = {
  cyan: {
    text: 'text-[#00F5FF]',
    border: 'border-[#00F5FF]/30',
    bg: 'bg-[#00F5FF]/5',
    dot: 'bg-[#00F5FF]',
    glow: 'shadow-[0_0_12px_rgba(0,245,255,0.3)]',
  },
  gold: {
    text: 'text-[#FFD700]',
    border: 'border-[#FFD700]/30',
    bg: 'bg-[#FFD700]/5',
    dot: 'bg-[#FFD700]',
    glow: 'shadow-[0_0_12px_rgba(255,215,0,0.3)]',
  },
  magenta: {
    text: 'text-[#FF00FF]',
    border: 'border-[#FF00FF]/30',
    bg: 'bg-[#FF00FF]/5',
    dot: 'bg-[#FF00FF]',
    glow: 'shadow-[0_0_12px_rgba(255,0,255,0.3)]',
  },
};

const DemoUiBadge = memo(({
  variant = 'inline',
  tint = 'cyan',
  className = '',
  label = 'Demo UI',
}: DemoUiBadgeProps) => {
  const t = TINTS[tint];

  if (variant === 'corner') {
    return (
      <div className={`absolute top-0 right-0 z-20 ${className}`}>
        <div className="relative">
          <div
            className={`
              px-3 py-1 rounded-bl-xl rounded-tr-2xl
              ${t.bg} backdrop-blur-md border-l border-b ${t.border}
              animate-neon-glow
            `}
          >
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${t.dot} animate-pulse`} />
              <span className={`text-[9px] font-bold uppercase tracking-[0.25em] ${t.text} animate-neon-flicker`}>
                {label}
              </span>
            </div>
          </div>
          <div className={`absolute -bottom-1 -left-1 w-1 h-1 rounded-full ${t.dot} opacity-40 animate-gold-orbit`} />
        </div>
      </div>
    );
  }

  if (variant === 'floating') {
    return (
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <div
          className={`
            group relative px-4 py-2 rounded-2xl
            ${t.bg} backdrop-blur-xl border ${t.border}
            animate-neon-glow cursor-default
            hover:scale-105 transition-transform duration-300
          `}
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className={`block w-2 h-2 rounded-full ${t.dot}`} />
              <span className={`absolute inset-0 w-2 h-2 rounded-full ${t.dot} animate-ping opacity-50`} />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.3em] ${t.text} animate-neon-flicker`}>
              {label}
            </span>
          </div>
          <div className="absolute -top-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-30" style={{ color: tint === 'cyan' ? '#00F5FF' : tint === 'gold' ? '#FFD700' : '#FF00FF' }} />
        </div>
      </div>
    );
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full
        px-3 py-1 ${t.bg} border ${t.border} ${t.glow}
        ${className}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot} animate-pulse`} />
      <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${t.text}`}>
        {label}
      </span>
    </span>
  );
});

DemoUiBadge.displayName = 'DemoUiBadge';

export default DemoUiBadge;
