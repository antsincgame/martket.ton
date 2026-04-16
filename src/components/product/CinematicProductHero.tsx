import { memo, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { Star, Download, Gem, ShieldCheck, Sparkles } from 'lucide-react';
import GlitchText from '../developer/GlitchText';
import { slugify } from '../../utils/slugify';
import type { ProductDetail } from '../../domain/marketplace/types';

interface CinematicProductHeroProps {
  product: ProductDetail;
  /** Основное изображение витрины — приходит из SacredGallery (главный кадр). */
  coverImage: string;
}

/**
 * Кинематографический hero страницы продукта:
 * parallax-обложка → тёмный градиент → GlitchText имени → Hand-Curated badge →
 * кликабельный демиург → быстрые чипы (rating, downloads).
 */
const CinematicProductHero = memo(
  ({ product, coverImage }: CinematicProductHeroProps) => {
    const reduce = useReducedMotion();
    const containerRef = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
      target: containerRef,
      offset: ['start start', 'end start'],
    });
    const coverY = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['0%', '18%']);
    const coverScale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.05, 1.15]);

    const devSlug = useMemo(() => slugify(product.developer), [product.developer]);

    return (
      <div ref={containerRef} className="relative">
        {/* ═══ Parallax cover ═══ */}
        <div className="relative h-[52vh] min-h-[360px] md:h-[58vh] md:min-h-[420px] overflow-hidden rounded-2xl">
          <motion.div
            className="absolute inset-0 will-change-transform"
            style={{ y: coverY, scale: coverScale }}
          >
            <img
              src={coverImage}
              alt=""
              aria-hidden
              className="w-full h-full object-cover"
              loading="eager"
            />
          </motion.div>

          {/* Dark vertical fade для читабельности overlay-контента */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(10,10,15,0.35) 0%, rgba(10,10,15,0.55) 40%, rgba(10,10,15,0.85) 78%, #0A0A0F 100%)',
            }}
          />

          {/* Radial золотое свечение снизу-центра */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 60% 35% at 50% 85%, rgba(255,215,0,0.15), transparent 70%)',
            }}
          />

          {/* Грани рамы — только уголки, без перекрытия фона */}
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            <CornerMark position="tl" color="#FFD700" />
            <CornerMark position="tr" color="#FFD700" />
            <CornerMark position="bl" color="#00F5FF" />
            <CornerMark position="br" color="#00F5FF" />
          </div>
        </div>

        {/* ═══ Overlay: badges + title + demiurge + stats ═══ */}
        <div className="relative -mt-28 md:-mt-36 px-1 sm:px-2 z-10">
          {/* Hand-Curated badge + Featured gem */}
          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: 12 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="flex flex-wrap items-center gap-2 mb-3"
          >
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md border text-[10px] font-black uppercase tracking-[0.25em]"
              style={{
                borderColor: 'rgba(255,215,0,0.5)',
                color: '#FFD700',
                textShadow: '0 0 10px rgba(255,215,0,0.55)',
                boxShadow: 'inset 0 0 14px rgba(255,215,0,0.08)',
              }}
              title="Каждый артефакт проходит ручную модерацию куратора"
            >
              <ShieldCheck className="w-3 h-3" />
              Hand-Curated Artifact
            </span>

            {product.isFeatured && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md border text-[10px] font-black uppercase tracking-[0.25em]"
                style={{
                  borderColor: 'rgba(139,92,246,0.5)',
                  color: '#C4A7FF',
                  boxShadow: 'inset 0 0 14px rgba(139,92,246,0.12)',
                }}
              >
                <Gem className="w-3 h-3" />
                Featured
              </span>
            )}

            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md border text-[10px] font-black uppercase tracking-[0.25em]"
              style={{
                borderColor: 'rgba(0,245,255,0.4)',
                color: '#00F5FF',
                boxShadow: 'inset 0 0 14px rgba(0,245,255,0.1)',
              }}
            >
              <Sparkles className="w-3 h-3" />
              {product.category}
            </span>
          </motion.div>

          {/* ═══ GlitchText product name ═══ */}
          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: 16 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mb-3"
          >
            <GlitchText
              text={product.name}
              tint="gold"
              intensity="calm"
              as="h1"
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-black uppercase tracking-wider leading-tight"
            />
          </motion.div>

          {/* Demiurge + quick stats */}
          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: 10 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center gap-x-5 gap-y-2"
          >
            {/* Демиург — кликабельно */}
            <Link
              to={`/developer/${devSlug}`}
              className="group inline-flex items-center gap-2 text-sm"
              aria-label={`Профиль демиурга ${product.developer}`}
            >
              <span className="text-gray-500 text-[11px] uppercase tracking-[0.28em]">by</span>
              <span
                className="font-bold transition-colors"
                style={{
                  color: '#00F5FF',
                  textShadow: '0 0 10px rgba(0,245,255,0.45)',
                }}
              >
                <span className="group-hover:underline decoration-[#00F5FF]/60 underline-offset-[3px]">
                  {product.developer}
                </span>
              </span>
            </Link>

            {/* Rating */}
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Star className="w-4 h-4 text-[#FFD700] fill-current" style={{ filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.7))' }} />
              <span className="text-white font-bold tabular-nums">{product.rating.toFixed(1)}</span>
              <span className="text-gray-500 text-xs">({product.reviewStatsCount})</span>
            </span>

            {/* Downloads */}
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-300">
              <Download className="w-4 h-4 text-[#8B5CF6]" style={{ filter: 'drop-shadow(0 0 4px rgba(139,92,246,0.6))' }} />
              <span className="tabular-nums font-bold text-white">
                {product.downloads.toLocaleString('en-US')}
              </span>
              <span className="text-gray-500 text-xs">summoned</span>
            </span>

            {/* Donation, если есть */}
            {(product.donationAmount ?? 0) > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold"
                style={{
                  background: 'rgba(255,215,0,0.1)',
                  border: '1px solid rgba(255,215,0,0.35)',
                  color: '#FFE066',
                }}
                title="Сумма благодарений артефакту"
              >
                <Gem className="w-3 h-3" />
                {product.donationAmount} TON blessed
              </span>
            )}
          </motion.div>

          {/* Короткое описание — "манифест" */}
          {product.description && (
            <motion.p
              initial={reduce ? undefined : { opacity: 0 }}
              animate={reduce ? undefined : { opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="mt-4 text-gray-300 leading-relaxed text-sm md:text-base max-w-3xl"
            >
              {product.description}
            </motion.p>
          )}
        </div>
      </div>
    );
  },
);

CinematicProductHero.displayName = 'CinematicProductHero';

export default CinematicProductHero;

// ─── Внутренний компонент: декоративные уголки на обложке ───

interface CornerMarkProps {
  position: 'tl' | 'tr' | 'bl' | 'br';
  color: string;
}

function CornerMark({ position, color }: CornerMarkProps) {
  const size = 32;
  const stroke = 1.5;
  const padding = 14;

  const basePath = (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path
        d="M1 31V10C1 5.03 5.03 1 10 1H31"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      <circle cx="1" cy="1" r="2" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );

  const style: Record<string, React.CSSProperties> = {
    tl: { top: padding, left: padding },
    tr: { top: padding, right: padding, transform: 'scaleX(-1)' },
    bl: { bottom: padding, left: padding, transform: 'scaleY(-1)' },
    br: { bottom: padding, right: padding, transform: 'scale(-1, -1)' },
  };

  return <span className="absolute" style={style[position]}>{basePath}</span>;
}
