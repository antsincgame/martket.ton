import { memo } from 'react';

interface SacredDividerProps {
  label: string;
  color?: string;
  icon?: string;
}

/**
 * Sacred section divider: [gradient-line] [◆ LABEL ◆] [gradient-line].
 * Used as a unified section heading on the developer page.
 */
const SacredDivider = memo(({ label, color = '#FFD700', icon = '✧' }: SacredDividerProps) => {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div
        className="h-px flex-1"
        style={{
          background: `linear-gradient(to right, transparent, ${color}40 50%, ${color}80)`,
        }}
      />
      <div className="flex items-center gap-2.5 select-none">
        <span
          className="text-sm"
          style={{ color, textShadow: `0 0 12px ${color}` }}
        >
          {icon}
        </span>
        <span
          className="text-[11px] font-black uppercase tracking-[0.4em]"
          style={{ color, textShadow: `0 0 10px ${color}60` }}
        >
          {label}
        </span>
        <span
          className="text-sm"
          style={{ color, textShadow: `0 0 12px ${color}` }}
        >
          {icon}
        </span>
      </div>
      <div
        className="h-px flex-1"
        style={{
          background: `linear-gradient(to left, transparent, ${color}40 50%, ${color}80)`,
        }}
      />
    </div>
  );
});

SacredDivider.displayName = 'SacredDivider';

export default SacredDivider;
