import { memo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';

interface HexRuneAvatarProps {
  avatar: string;
  initials: string;
  isTopDev: boolean;
  size?: number;
}

/**
 * Avatar in a hexagonal mask, surrounded by 2 rotating rings with runes/dots.
 * Outer ring is gold for Top Dev, cyan for regular demiurges.
 */
const HexRuneAvatar = memo(({ avatar, initials, isTopDev, size = 180 }: HexRuneAvatarProps) => {
  const reduce = useReducedMotion();
  const outerColor = isTopDev ? '#FFD700' : '#00F5FF';
  const innerColor = '#8B5CF6';

  const RUNES = ['☥', '✦', '◈', '⟁', '⎊', '✧', '◉', '⟐'];
  const ringRadius = size * 0.48;
  const innerRingRadius = size * 0.4;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Outer glow aura */}
      <div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{
          background: `radial-gradient(circle, ${outerColor}35, transparent 70%)`,
        }}
      />

      {/* Outer rune ring (slow rotate) */}
      <div
        className={`absolute inset-0 ${reduce ? '' : 'animate-[sacred-rotate-slow_40s_linear_infinite]'}`}
      >
        {RUNES.map((rune, i) => {
          const angle = (i * Math.PI * 2) / RUNES.length;
          const x = Math.cos(angle) * ringRadius;
          const y = Math.sin(angle) * ringRadius;
          return (
            <span
              key={`outer-${i}`}
              className="absolute text-[14px] font-bold select-none"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                color: outerColor,
                opacity: 0.7,
                textShadow: `0 0 8px ${outerColor}`,
              }}
            >
              {rune}
            </span>
          );
        })}
      </div>

      {/* Inner dot ring (reverse rotate) */}
      <div
        className={`absolute inset-0 ${reduce ? '' : 'animate-[sacred-rotate-reverse_30s_linear_infinite]'}`}
      >
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 12;
          const x = Math.cos(angle) * innerRingRadius;
          const y = Math.sin(angle) * innerRingRadius;
          const highlight = i % 3 === 0;
          return (
            <span
              key={`inner-${i}`}
              className="absolute rounded-full"
              style={{
                left: '50%',
                top: '50%',
                width: highlight ? 4 : 2,
                height: highlight ? 4 : 2,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                background: highlight ? outerColor : innerColor,
                boxShadow: `0 0 6px ${highlight ? outerColor : innerColor}`,
              }}
            />
          );
        })}
      </div>

      {/* Hex frame (SVG) */}
      <svg
        className="absolute"
        width={size * 0.78}
        height={size * 0.78}
        viewBox="0 0 100 100"
        fill="none"
      >
        <defs>
          <linearGradient id={`hexGrad-${isTopDev ? 'gold' : 'cyan'}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={outerColor} stopOpacity="0.9" />
            <stop offset="100%" stopColor={innerColor} stopOpacity="0.6" />
          </linearGradient>
          <clipPath id={`hexClip-${isTopDev ? 'gold' : 'cyan'}`}>
            <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" />
          </clipPath>
        </defs>
        <polygon
          points="50,3 93,27 93,73 50,97 7,73 7,27"
          stroke={`url(#hexGrad-${isTopDev ? 'gold' : 'cyan'})`}
          strokeWidth="1.5"
          fill="rgba(10,10,15,0.9)"
        />
      </svg>

      {/* Avatar inside hex clip */}
      <div
        className="absolute overflow-hidden flex items-center justify-center"
        style={{
          width: size * 0.78,
          height: size * 0.78,
          clipPath: 'polygon(50% 3%, 93% 27%, 93% 73%, 50% 97%, 7% 73%, 7% 27%)',
        }}
      >
        {avatar ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background:
                'radial-gradient(circle, rgba(255,215,0,0.25) 0%, rgba(139,92,246,0.15) 60%, #0A0A0F 100%)',
            }}
          >
            <span
              className="text-5xl font-black"
              style={{
                color: outerColor,
                textShadow: `0 0 20px ${outerColor}`,
              }}
            >
              {initials}
            </span>
          </div>
        )}
      </div>

      {/* Top Dev shield */}
      {isTopDev && (
        <div
          className="absolute z-20 w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            right: size * 0.05,
            bottom: size * 0.05,
            background: 'linear-gradient(135deg, #FFD700, #F4A836)',
            boxShadow: '0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3)',
          }}
        >
          <ShieldCheck className="w-5 h-5 text-[#0A0A0F]" strokeWidth={2.5} />
        </div>
      )}
    </div>
  );
});

HexRuneAvatar.displayName = 'HexRuneAvatar';

export default HexRuneAvatar;
