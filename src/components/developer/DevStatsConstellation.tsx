import { memo, useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Package, Download, Star, Calendar } from 'lucide-react';
import { formatDownloads, formatDate } from '../../domain/marketplace/platformIcons';
import type { PublicDeveloperProfile } from '../../domain/marketplace/types';

interface DevStatsConstellationProps {
  profile: PublicDeveloperProfile;
}

/** Animated count-up for a number, only when the card is in the viewport. */
function useCountUp(target: number, inView: boolean, duration = 1200, precision = 0) {
  const [val, setVal] = useState(0);
  const startedRef = useRef(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView || startedRef.current) return;
    startedRef.current = true;
    if (reduce) {
      setVal(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(eased * target);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target, duration, reduce]);

  return precision === 0 ? Math.round(val) : Number(val.toFixed(precision));
}

interface StatCardProps {
  icon: typeof Package;
  label: string;
  value: string;
  color: string;
  inView: boolean;
  delay: number;
}

const OctagonStatCard = memo(
  ({ icon: Icon, label, value, color, inView, delay }: StatCardProps) => {
    const reduce = useReducedMotion();

    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
        className="relative group"
      >
        {/* Octagonal frame via clip-path */}
        <div
          className="relative p-[1.5px] transition-all duration-500"
          style={{
            clipPath:
              'polygon(15% 0, 85% 0, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0 85%, 0 15%)',
            background: `linear-gradient(135deg, ${color}80, transparent 50%, ${color}30)`,
          }}
        >
          <div
            className="relative bg-[#0D0D1A] px-4 py-6 sm:px-5 sm:py-7 overflow-hidden"
            style={{
              clipPath:
                'polygon(15% 0, 85% 0, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0 85%, 0 15%)',
            }}
          >
            {/* Hover aura */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: `radial-gradient(circle at center, ${color}20 0%, transparent 70%)`,
              }}
            />

            {/* Pulsing corner glyph */}
            <div
              className={`absolute -top-1 -right-1 w-6 h-6 ${reduce ? '' : 'animate-aura-pulse'}`}
              style={{
                background: `radial-gradient(circle, ${color}, transparent 70%)`,
                filter: 'blur(8px)',
              }}
            />

            <div className="relative flex flex-col items-center text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-3 border"
                style={{
                  borderColor: `${color}40`,
                  background: `radial-gradient(circle, ${color}15, transparent 70%)`,
                  boxShadow: `0 0 16px ${color}30`,
                }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>

              <div
                className="text-2xl sm:text-3xl font-black tabular-nums leading-none mb-2"
                style={{
                  color: '#FFFFFF',
                  textShadow: `0 0 12px ${color}70`,
                }}
              >
                {value}
              </div>
              <div
                className="text-[9px] font-bold uppercase tracking-[0.3em]"
                style={{ color: `${color}CC` }}
              >
                {label}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  },
);
OctagonStatCard.displayName = 'OctagonStatCard';

const DevStatsConstellation = memo(({ profile }: DevStatsConstellationProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  const prodCount = useCountUp(profile.productCount, inView);
  const downloads = useCountUp(profile.totalDownloads, inView, 1400);
  const rating = useCountUp(profile.avgRating, inView, 1000, 1);

  const stats = [
    {
      icon: Package,
      label: 'Artifacts',
      value: String(prodCount),
      color: '#00F5FF',
    },
    {
      icon: Download,
      label: 'Summoned',
      value: formatDownloads(downloads),
      color: '#8B5CF6',
    },
    {
      icon: Star,
      label: 'Resonance',
      value: rating.toFixed(1),
      color: '#FFD700',
    },
    {
      icon: Calendar,
      label: 'Awakened',
      value: formatDate(profile.joinedDate),
      color: '#00FF88',
    },
  ];

  return (
    <div ref={ref} className="relative py-4">
      {/* SVG constellation lines — desktop only */}
      <svg
        aria-hidden
        className="absolute inset-0 w-full h-full hidden lg:block pointer-events-none"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="constGrad1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00F5FF" stopOpacity="0" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.line
          x1="12.5%"
          y1="50%"
          x2="37.5%"
          y2="50%"
          stroke="url(#constGrad1)"
          strokeWidth="1"
          strokeDasharray="3 4"
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{ duration: 1.2, delay: 0.3 }}
        />
        <motion.line
          x1="37.5%"
          y1="50%"
          x2="62.5%"
          y2="50%"
          stroke="url(#constGrad1)"
          strokeWidth="1"
          strokeDasharray="3 4"
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{ duration: 1.2, delay: 0.5 }}
        />
        <motion.line
          x1="62.5%"
          y1="50%"
          x2="87.5%"
          y2="50%"
          stroke="url(#constGrad1)"
          strokeWidth="1"
          strokeDasharray="3 4"
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{ duration: 1.2, delay: 0.7 }}
        />
      </svg>

      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {stats.map((s, i) => (
          <OctagonStatCard
            key={s.label}
            icon={s.icon}
            label={s.label}
            value={s.value}
            color={s.color}
            inView={inView}
            delay={0.1 + i * 0.12}
          />
        ))}
      </div>
    </div>
  );
});

DevStatsConstellation.displayName = 'DevStatsConstellation';

export default DevStatsConstellation;
