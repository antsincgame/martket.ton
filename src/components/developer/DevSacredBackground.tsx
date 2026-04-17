import { memo, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Temple background: Flower of Life + Metatron's Cube + floating particles + gradient veil.
 * pointer-events: none, pinned to the nearest relative parent (page section).
 */

const FLOWER_RADIUS = 40;
const FLOWER_CENTERS: Array<{ cx: number; cy: number }> = (() => {
  // 19-circle Flower of Life pattern: center + 6 neighbors + 12 outer.
  const c = { cx: 150, cy: 150 };
  const r = FLOWER_RADIUS;
  const ring = (count: number, radius: number, offset = 0) =>
    Array.from({ length: count }, (_, i) => {
      const a = offset + (i * Math.PI * 2) / count;
      return { cx: c.cx + radius * Math.cos(a), cy: c.cy + radius * Math.sin(a) };
    });
  return [c, ...ring(6, r), ...ring(6, r * Math.sqrt(3), Math.PI / 6), ...ring(6, r * 2, 0)];
})();

const METATRON_NODES = [
  { x: 180, y: 30 },
  { x: 310, y: 105 },
  { x: 310, y: 255 },
  { x: 180, y: 330 },
  { x: 50, y: 255 },
  { x: 50, y: 105 },
  { x: 180, y: 180 },
  { x: 180, y: 105 },
  { x: 245, y: 142 },
  { x: 245, y: 218 },
  { x: 180, y: 255 },
  { x: 115, y: 218 },
  { x: 115, y: 142 },
];

const DevSacredBackground = memo(() => {
  const reduce = useReducedMotion();

  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2.5,
        duration: 8 + Math.random() * 10,
        delay: Math.random() * 6,
        hue: ['#FFD700', '#00F5FF', '#8B5CF6', '#FF00FF'][i % 4],
      })),
    [],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden -z-10"
    >
      {/* Gradient veil: magenta/violet at the bottom, deep space at the top */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(139,92,246,0.08), transparent 60%), radial-gradient(ellipse 100% 60% at 50% 100%, rgba(0,245,255,0.06), transparent 70%), linear-gradient(180deg, #0A0A0F 0%, #0D0D1A 50%, #0A0A0F 100%)',
        }}
      />

      {/* Flower of Life — bottom left */}
      <svg
        className="absolute -left-16 -bottom-20 w-[420px] h-[420px] opacity-[0.08]"
        viewBox="0 0 300 300"
        fill="none"
      >
        <defs>
          <radialGradient id="flowerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00F5FF" stopOpacity="1" />
            <stop offset="100%" stopColor="#00F5FF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="150" cy="150" r="140" fill="url(#flowerGlow)" opacity="0.35" />
        {FLOWER_CENTERS.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={FLOWER_RADIUS}
            stroke="#00F5FF"
            strokeWidth="0.8"
            fill="none"
          />
        ))}
      </svg>

      {/* Metatron's Cube — top right */}
      <svg
        className={`absolute -right-20 -top-16 w-[380px] h-[380px] opacity-[0.07] ${
          reduce ? '' : 'animate-[sacred-rotate-slow_120s_linear_infinite]'
        }`}
        viewBox="0 0 360 360"
        fill="none"
      >
        <defs>
          <radialGradient id="cubeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFD700" stopOpacity="1" />
            <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="180" cy="180" r="170" fill="url(#cubeGlow)" opacity="0.3" />
        {/* Lines between every pair */}
        {METATRON_NODES.map((a, i) =>
          METATRON_NODES.slice(i + 1).map((b, j) => (
            <line
              key={`${i}-${j}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#FFD700"
              strokeWidth="0.4"
            />
          )),
        )}
        {METATRON_NODES.map((n, i) => (
          <circle key={`n-${i}`} cx={n.x} cy={n.y} r="3" fill="#FFD700" />
        ))}
      </svg>

      {/* Floating particles */}
      {!reduce && (
        <div className="absolute inset-0">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                background: p.hue,
                boxShadow: `0 0 ${p.size * 4}px ${p.hue}`,
              }}
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 0.8, 0.2, 0.8, 0],
                y: [0, -30, -60, -90, -120],
                x: [0, 10, -10, 15, 0],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Scan-line subtle overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px)',
        }}
      />
    </div>
  );
});

DevSacredBackground.displayName = 'DevSacredBackground';

export default DevSacredBackground;
