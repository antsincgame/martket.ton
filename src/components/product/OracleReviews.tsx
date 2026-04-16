import { memo, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Star, ThumbsUp, User } from 'lucide-react';
import SacredDivider from '../developer/SacredDivider';
import type { ProductReview } from '../../domain/marketplace/types';

interface OracleReviewsProps {
  reviews: readonly ProductReview[];
  avgRating: number;
  totalCount: number;
}

/**
 * Отзывы как голоса оракулов: hex-аватар, ритуальные звёзды,
 * helpful-кнопка с glow. Пустое состояние — призыв стать первым голосом.
 */
const OracleReviews = memo(({ reviews, avgRating, totalCount }: OracleReviewsProps) => {
  const reduce = useReducedMotion();

  // Распределение звёзд
  const distribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0]; // 1..5
    for (const r of reviews) {
      const idx = Math.max(0, Math.min(4, Math.round(r.rating) - 1));
      buckets[idx] += 1;
    }
    const total = reviews.length || 1;
    return buckets.map((c) => ({ count: c, pct: (c / total) * 100 }));
  }, [reviews]);

  return (
    <section aria-label="Голоса оракулов" className="relative">
      <SacredDivider
        label={`ORACLE VOICES · ${totalCount}`}
        color="#8B5CF6"
        icon="✧"
      />

      {reviews.length === 0 ? (
        <div
          className="relative rounded-2xl border border-[#8B5CF6]/25 bg-[#0D0D1A]/60 backdrop-blur-sm p-8 text-center overflow-hidden"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139,92,246,0.12), transparent 70%)',
            }}
          />
          <Star className="w-8 h-8 mx-auto mb-3 text-[#FFD700]/70" />
          <p className="text-white font-bold text-base mb-1">Ни один оракул ещё не произнёс слова.</p>
          <p className="text-gray-400 text-sm">Стань первым голосом этого артефакта.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-8">
          {/* Сводка слева на lg+, сверху на mobile */}
          <div className="space-y-4">
            <div
              className="relative rounded-2xl border border-[#FFD700]/20 bg-[#0D0D1A]/60 backdrop-blur-sm p-5 text-center overflow-hidden"
              style={{ boxShadow: 'inset 0 0 30px rgba(255,215,0,0.08)' }}
            >
              <div
                className="text-5xl font-display font-black mb-1 tabular-nums"
                style={{
                  background: 'linear-gradient(180deg, #FFE066 0%, #FFD700 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 24px rgba(255,215,0,0.35)',
                }}
              >
                {avgRating.toFixed(1)}
              </div>
              <div className="flex items-center justify-center gap-0.5 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.round(avgRating) ? 'text-[#FFD700] fill-current' : 'text-gray-700'
                    }`}
                    style={
                      i < Math.round(avgRating)
                        ? { filter: 'drop-shadow(0 0 5px rgba(255,215,0,0.7))' }
                        : undefined
                    }
                  />
                ))}
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500">
                {totalCount} voice{totalCount === 1 ? '' : 's'}
              </div>
            </div>

            {/* Гистограмма */}
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((stars) => {
                const bucket = distribution[stars - 1];
                return (
                  <div key={stars} className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="w-3 tabular-nums">{stars}</span>
                    <Star className="w-3 h-3 text-[#FFD700]" />
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${bucket.pct}%`,
                          background:
                            'linear-gradient(90deg, #FFE066 0%, #FFD700 50%, #F4A836 100%)',
                          boxShadow: '0 0 6px rgba(255,215,0,0.45)',
                        }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums">{bucket.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Отзывы */}
          <div className="space-y-4">
            {reviews.map((review, idx) => (
              <motion.article
                key={review.id}
                initial={reduce ? undefined : { opacity: 0, y: 10 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="relative rounded-2xl border border-[#8B5CF6]/20 bg-[#0D0D1A]/55 backdrop-blur-sm p-5 hover:border-[#8B5CF6]/45 transition-colors"
              >
                <header className="flex items-start gap-3 mb-3">
                  <ReviewHexAvatar avatar={review.authorAvatar} initials={review.author.slice(0, 2).toUpperCase()} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white truncate">{review.author}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < review.rating ? 'text-[#FFD700] fill-current' : 'text-gray-700'
                            }`}
                            style={
                              i < review.rating
                                ? { filter: 'drop-shadow(0 0 4px rgba(255,215,0,0.6))' }
                                : undefined
                            }
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-gray-500">{review.date}</span>
                    </div>
                  </div>
                </header>
                <p className="text-gray-300 leading-relaxed text-sm mb-3">{review.comment}</p>
                <div className="flex items-center gap-4 text-[11px] text-gray-500 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 hover:text-[#00FF88] transition-colors"
                    aria-label={`Отметить отзыв полезным (${review.helpful})`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Helpful · <span className="tabular-nums">{review.helpful}</span>
                  </button>
                  <button
                    type="button"
                    className="hover:text-[#00F5FF] transition-colors"
                  >
                    Reply
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
});

OracleReviews.displayName = 'OracleReviews';

export default OracleReviews;

// ─── Hex avatar для отзывов ───

interface ReviewHexAvatarProps {
  avatar?: string;
  initials: string;
}

function ReviewHexAvatar({ avatar, initials }: ReviewHexAvatarProps) {
  return (
    <div className="relative flex-shrink-0 w-10 h-10" aria-hidden>
      <svg
        className="absolute inset-0"
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
      >
        <polygon
          points="50,3 93,27 93,73 50,97 7,73 7,27"
          fill="rgba(10,10,15,0.9)"
          stroke="#8B5CF6"
          strokeOpacity="0.6"
          strokeWidth="1.5"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{
          clipPath: 'polygon(50% 3%, 93% 27%, 93% 73%, 50% 97%, 7% 73%, 7% 27%)',
        }}
      >
        {avatar ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : initials ? (
          <span
            className="text-xs font-black tracking-wider"
            style={{ color: '#C4A7FF', textShadow: '0 0 6px rgba(139,92,246,0.7)' }}
          >
            {initials}
          </span>
        ) : (
          <User className="w-4 h-4 text-[#8B5CF6]" />
        )}
      </div>
    </div>
  );
}
