import { memo } from 'react';
import { useReducedMotion } from 'framer-motion';

type Tint = 'gold' | 'cyan';
type Intensity = 'calm' | 'aggressive';

interface GlitchTextProps {
  text: string;
  tint?: Tint;
  intensity?: Intensity;
  className?: string;
  as?: 'h1' | 'h2' | 'span';
}

/**
 * 3-layer glitch text. Base — gold/cyan shimmer, 2 offset layers with clip-path animation.
 * Respects prefers-reduced-motion — degrades to a simple shimmer.
 */
const GlitchText = memo(
  ({ text, tint = 'gold', intensity = 'calm', className = '', as = 'h1' }: GlitchTextProps) => {
    const reduce = useReducedMotion();
    const Tag = as;

    const baseGradient =
      tint === 'gold'
        ? 'linear-gradient(90deg, #FFD700 0%, #FFE066 50%, #F4A836 100%)'
        : 'linear-gradient(90deg, #00F5FF 0%, #A6F1FF 50%, #00C8D7 100%)';

    const ghost1 = tint === 'gold' ? '#00F5FF' : '#FF00FF';
    const ghost2 = tint === 'gold' ? '#FF00FF' : '#FFD700';

    const period = intensity === 'aggressive' ? '4s' : '7s';

    return (
      <span className={`relative inline-block ${className}`} aria-label={text}>
        {/* Ghost 1 — cyan/magenta shift */}
        {!reduce && (
          <span
            aria-hidden
            className="absolute inset-0 select-none"
            style={{
              color: ghost1,
              transform: 'translate(-2px, 0)',
              mixBlendMode: 'screen',
              animation: `glitch-clip ${period} infinite steps(1, end)`,
              opacity: 0.7,
            }}
          >
            {text}
          </span>
        )}

        {/* Ghost 2 — opposite shift */}
        {!reduce && (
          <span
            aria-hidden
            className="absolute inset-0 select-none"
            style={{
              color: ghost2,
              transform: 'translate(2px, 0)',
              mixBlendMode: 'screen',
              animation: `glitch-clip ${period} infinite steps(1, end)`,
              animationDelay: '0.15s',
              opacity: 0.6,
            }}
          >
            {text}
          </span>
        )}

        {/* Base layer — gradient text */}
        <Tag
          className="relative gold-shimmer-text"
          style={{
            background: baseGradient,
            backgroundSize: '200% 100%',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow:
              tint === 'gold'
                ? '0 0 40px rgba(255,215,0,0.35), 0 0 80px rgba(255,215,0,0.15)'
                : '0 0 40px rgba(0,245,255,0.35), 0 0 80px rgba(0,245,255,0.15)',
          }}
        >
          {text}
        </Tag>
      </span>
    );
  },
);

GlitchText.displayName = 'GlitchText';

export default GlitchText;
