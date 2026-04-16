import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Star, Download, Zap, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { slugify } from '../../utils/slugify';
import { HERO_AUTO_ADVANCE_MS, HERO_MAX_SLIDES } from './homeConstants';
import type { CatalogListingProduct } from '../../domain/marketplace/types';

interface HomeHeroProps {
  spotlights: CatalogListingProduct[];
}

const HomeHero = memo(({ spotlights }: HomeHeroProps) => {
  const reduce = useReducedMotion();
  const slides = useMemo(() => spotlights.slice(0, HERO_MAX_SLIDES), [spotlights]);
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const timerRef = useRef<number | null>(null);

  const safeIndex = slides.length === 0 ? 0 : Math.min(index, slides.length - 1);
  const current = slides[safeIndex];

  const go = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      setDirection(next > safeIndex ? 1 : -1);
      setIndex(((next % slides.length) + slides.length) % slides.length);
    },
    [safeIndex, slides.length],
  );

  const next = useCallback(() => go(safeIndex + 1), [go, safeIndex]);
  const prev = useCallback(() => go(safeIndex - 1), [go, safeIndex]);

  useEffect(() => {
    if (isHovered || slides.length < 2 || reduce) return;
    timerRef.current = window.setTimeout(next, HERO_AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [isHovered, safeIndex, next, slides.length, reduce]);

  if (!current) return null;

  const productPath = `/product/${slugify(current.name)}`;
  const developerPath = `/developer/${slugify(current.developer)}`;

  const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
  };

  return (
    <section
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ═══ Main cinematic banner ═══ */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/5 bg-[#0D0D1A]">
        <div className="relative aspect-[16/10] sm:aspect-[21/9] lg:aspect-[21/8]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <img
                src={current.image}
                alt={current.name}
                className="w-full h-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0F] via-[#0A0A0F]/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-transparent to-transparent" />

              {/* Scan-line veil */}
              <div
                className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, rgba(0,245,255,0.4) 0px, rgba(0,245,255,0.4) 1px, transparent 1px, transparent 4px)',
                }}
              />

              {/* Content */}
              <div className="absolute inset-0 flex items-end sm:items-center">
                <div className="p-5 sm:p-8 lg:p-12 max-w-2xl">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#FFD700]/40 bg-[#FFD700]/5 text-[#FFD700] text-[10px] font-black uppercase tracking-[0.25em]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] shadow-[0_0_8px_#FFD700]" />
                      Spotlight
                    </span>
                    {current.category && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-gray-300 text-[10px] font-semibold uppercase tracking-widest">
                        {current.category}
                      </span>
                    )}
                  </div>

                  <Link to={productPath} className="block group">
                    <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black tracking-tight leading-[1.05] text-white mb-3 sm:mb-4 group-hover:text-[#FFD700] transition-colors duration-300"
                      style={{ textShadow: '0 2px 20px rgba(0,0,0,0.6)' }}
                    >
                      {current.name}
                    </h1>
                  </Link>

                  <p className="hidden sm:block text-gray-300/90 text-sm lg:text-base leading-relaxed mb-4 max-w-lg line-clamp-2">
                    {current.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-5 text-sm">
                    <Link
                      to={developerPath}
                      className="text-gray-300 hover:text-[#00F5FF] transition-colors"
                    >
                      by <span className="font-semibold underline decoration-dotted underline-offset-4">{current.developer}</span>
                    </Link>
                    <span className="inline-flex items-center gap-1 text-[#FFD700]">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="font-bold">{current.rating.toFixed(1)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-gray-400">
                      <Download className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{current.downloads.toLocaleString()}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      to={productPath}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#F4A836] text-[#0A0A0F] text-sm font-black uppercase tracking-wider shadow-[0_0_30px_rgba(255,215,0,0.35)] hover:shadow-[0_0_50px_rgba(255,215,0,0.5)] hover:scale-[1.02] transition-all duration-300"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {current.price > 0 ? `Claim · ${current.price} TON` : 'Claim Free'}
                    </Link>
                    <Link
                      to={productPath}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/15 bg-white/5 backdrop-blur-sm text-white/90 text-sm font-semibold uppercase tracking-wider hover:bg-white/10 hover:border-[#00F5FF]/40 hover:text-[#00F5FF] transition-all duration-300"
                    >
                      <Zap className="w-4 h-4" />
                      Details
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Nav arrows — desktop */}
          {slides.length > 1 && (
            <>
              <button
                onClick={prev}
                aria-label="Previous spotlight"
                className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/15 text-white/80 hover:bg-black/60 hover:border-[#FFD700]/40 hover:text-[#FFD700] transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={next}
                aria-label="Next spotlight"
                className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/15 text-white/80 hover:bg-black/60 hover:border-[#FFD700]/40 hover:text-[#FFD700] transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Progress dots */}
          {slides.length > 1 && (
            <div className="absolute bottom-3 sm:bottom-5 right-5 flex items-center gap-1.5 z-10">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`Go to spotlight ${i + 1}`}
                  className={`transition-all duration-300 rounded-full ${
                    i === safeIndex
                      ? 'w-8 h-1.5 bg-[#FFD700] shadow-[0_0_8px_#FFD700]'
                      : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Mini thumbs (Steam-like) — desktop only ═══ */}
      {slides.length > 1 && (
        <div className="hidden lg:grid grid-cols-5 gap-3 mt-4">
          {slides.map((slide, i) => {
            const isActive = i === safeIndex;
            return (
              <button
                key={slide.id}
                onClick={() => go(i)}
                className={`group relative rounded-xl overflow-hidden aspect-[16/9] border-2 transition-all duration-300 ${
                  isActive
                    ? 'border-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.3)]'
                    : 'border-white/5 hover:border-white/20 opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={slide.image}
                  alt={slide.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 text-left">
                  <p className="text-[11px] font-bold text-white truncate">{slide.name}</p>
                  <p className="text-[9px] text-gray-400 truncate">{slide.developer}</p>
                </div>
                {isActive && !reduce && (
                  <motion.div
                    layoutId="heroThumbBar"
                    className="absolute bottom-0 left-0 h-[2px] bg-[#FFD700]"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: HERO_AUTO_ADVANCE_MS / 1000, ease: 'linear' }}
                    key={`bar-${safeIndex}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
});

HomeHero.displayName = 'HomeHero';

export default HomeHero;
