import { memo, ReactNode } from 'react';

interface SacredFrameProps {
  children: ReactNode;
  color?: string;
  className?: string;
  cornerSize?: number;
}

/**
 * Temple frame: 4 SVG corner accents at the block's corners + a thin border.
 * Used to frame the Featured grid and the All Products section.
 */
const SacredFrame = memo(
  ({ children, color = '#FFD700', className = '', cornerSize = 22 }: SacredFrameProps) => {
    const cornerPath = (
      <svg
        width={cornerSize}
        height={cornerSize}
        viewBox="0 0 22 22"
        fill="none"
        style={{ color }}
      >
        <path
          d="M1 21V8C1 4.13401 4.13401 1 8 1H21"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="1" cy="1" r="1.5" fill="currentColor" />
      </svg>
    );

    return (
      <div
        className={`relative rounded-2xl border border-white/[0.04] bg-[#0D0D1A]/50 backdrop-blur-sm ${className}`}
      >
        <span className="absolute -top-[2px] -left-[2px] pointer-events-none">{cornerPath}</span>
        <span
          className="absolute -top-[2px] -right-[2px] pointer-events-none"
          style={{ transform: 'scaleX(-1)' }}
        >
          {cornerPath}
        </span>
        <span
          className="absolute -bottom-[2px] -left-[2px] pointer-events-none"
          style={{ transform: 'scaleY(-1)' }}
        >
          {cornerPath}
        </span>
        <span
          className="absolute -bottom-[2px] -right-[2px] pointer-events-none"
          style={{ transform: 'scale(-1, -1)' }}
        >
          {cornerPath}
        </span>
        {children}
      </div>
    );
  },
);

SacredFrame.displayName = 'SacredFrame';

export default SacredFrame;
