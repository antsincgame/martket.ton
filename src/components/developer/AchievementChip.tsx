import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { Achievement } from './achievements';

interface AchievementChipProps {
  achievement: Achievement;
  /** When compact, the chip is smaller (hero overlay). */
  compact?: boolean;
}

const AchievementChip = memo(({ achievement: ach, compact = false }: AchievementChipProps) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<'bottom' | 'top'>('bottom');
  const [align, setAlign] = useState<'center' | 'left' | 'right'>('center');
  const chipRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const calculatePosition = useCallback(() => {
    const chip = chipRef.current;
    if (!chip) return;

    const rect = chip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    setPosition(rect.bottom + 120 > vh ? 'top' : 'bottom');

    if (rect.left < 100) {
      setAlign('left');
    } else if (vw - rect.right < 100) {
      setAlign('right');
    } else {
      setAlign('center');
    }
  }, []);

  const show = useCallback(() => {
    clearTimeout(closeTimerRef.current);
    calculatePosition();
    setOpen(true);
  }, [calculatePosition]);

  const hide = useCallback(() => {
    closeTimerRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
    } else {
      calculatePosition();
      setOpen(true);
    }
  }, [open, calculatePosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (
        chipRef.current?.contains(e.target as Node) ||
        tooltipRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  const tooltipAlignClass =
    align === 'left' ? 'left-0' :
    align === 'right' ? 'right-0' :
    'left-1/2 -translate-x-1/2';

  const arrowAlignClass =
    align === 'left' ? 'left-4' :
    align === 'right' ? 'right-4' :
    'left-1/2 -translate-x-1/2';

  const sizeClasses = compact
    ? 'gap-1.5 px-2 py-1 text-[9.5px] tracking-[0.18em]'
    : 'gap-2 px-3 py-1.5 text-[10px] tracking-[0.2em]';

  const iconSize = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <span className="relative inline-flex">
      <button
        ref={chipRef}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={toggle}
        className={`inline-flex items-center ${sizeClasses} rounded-md bg-black/50 backdrop-blur-md border font-bold uppercase cursor-help transition-all duration-300 hover:scale-[1.04] active:scale-[0.97]`}
        style={{
          borderColor: `${ach.color}40`,
          color: ach.color,
          textShadow: `0 0 6px ${ach.color}55`,
          boxShadow: open
            ? `inset 0 0 16px ${ach.color}20, 0 0 20px ${ach.color}30`
            : `inset 0 0 12px ${ach.color}10`,
        }}
        aria-describedby={open ? `ach-tip-${ach.id}` : undefined}
      >
        <ach.icon className={iconSize} style={{ color: ach.color }} />
        {ach.title}
      </button>

      {open && (
        <div
          ref={tooltipRef}
          id={`ach-tip-${ach.id}`}
          role="tooltip"
          onMouseEnter={() => clearTimeout(closeTimerRef.current)}
          onMouseLeave={hide}
          className={`absolute z-[100] ${tooltipAlignClass} ${
            position === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
          } animate-in fade-in zoom-in-95 duration-200`}
          style={{ width: 'max-content', maxWidth: 'min(280px, calc(100vw - 32px))' }}
        >
          {/* Arrow */}
          <div
            className={`absolute ${arrowAlignClass} w-2.5 h-2.5 rotate-45 ${
              position === 'bottom' ? '-top-1' : '-bottom-1'
            }`}
            style={{
              background: '#0D0D1A',
              borderTop: position === 'bottom' ? `1px solid ${ach.color}50` : 'none',
              borderLeft: position === 'bottom' ? `1px solid ${ach.color}50` : 'none',
              borderBottom: position === 'top' ? `1px solid ${ach.color}50` : 'none',
              borderRight: position === 'top' ? `1px solid ${ach.color}50` : 'none',
            }}
          />

          {/* Content */}
          <div
            className="relative rounded-xl border px-4 py-3 backdrop-blur-xl"
            style={{
              background: 'linear-gradient(135deg, #0D0D1A 0%, #1a0a2e 100%)',
              borderColor: `${ach.color}40`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 24px ${ach.color}20, inset 0 0 30px ${ach.color}08`,
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center border"
                style={{
                  borderColor: `${ach.color}60`,
                  boxShadow: `0 0 10px ${ach.color}40`,
                  background: `${ach.color}15`,
                }}
              >
                <ach.icon className="w-3 h-3" style={{ color: ach.color }} />
              </div>
              <span
                className="text-[11px] font-black uppercase tracking-[0.2em]"
                style={{ color: ach.color, textShadow: `0 0 8px ${ach.color}60` }}
              >
                {ach.title}
              </span>
            </div>

            <p className="text-gray-300 text-xs leading-relaxed">
              {ach.description}
            </p>

            {/* Decorative bottom glow line */}
            <div
              className="mt-2.5 h-[1px] rounded-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${ach.color}60, transparent)`,
              }}
            />
          </div>
        </div>
      )}
    </span>
  );
});

AchievementChip.displayName = 'AchievementChip';

export default AchievementChip;
