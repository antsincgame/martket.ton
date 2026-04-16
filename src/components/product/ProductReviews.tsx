import { memo, useMemo, useState } from 'react';
import { Star, ThumbsUp, MessageSquare } from 'lucide-react';
import type { ProductReview } from '../../domain/marketplace/types';

interface ProductReviewsProps {
  reviews: ProductReview[];
  avgRating: number;
  totalCount: number;
}

const INITIAL_VISIBLE = 5;

/**
 * Блок отзывов в стиле Steam/Play Market:
 * сводка слева (рейтинг + гистограмма) | список карточек справа.
 */
const ProductReviews = memo(({ reviews, avgRating, totalCount }: ProductReviewsProps) => {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Гистограмма из реальных отзывов; если их нет — пропорциональная оценка по avgRating.
  const distribution = useMemo(() => buildDistribution(reviews, avgRating), [reviews, avgRating]);

  return (
    <section aria-labelledby="reviews-heading" className="space-y-6">
      <h2 id="reviews-heading" className="text-xl sm:text-2xl font-bold text-white">
        Ratings & Reviews
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
        {/* Сводка */}
        <aside className="md:col-span-1">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-white tabular-nums">
                {avgRating.toFixed(1)}
              </span>
              <span className="text-gray-500 text-sm">/ 5</span>
            </div>
            <div className="flex items-center mt-1" aria-label={`Средний рейтинг ${avgRating.toFixed(1)} из 5`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  className={`w-5 h-5 ${
                    i < Math.round(avgRating) ? 'text-amber-400 fill-current' : 'text-gray-700'
                  }`}
                />
              ))}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {totalCount.toLocaleString('en-US')} reviews
            </div>

            <div className="mt-5 space-y-1.5">
              {distribution.map((d) => (
                <div key={d.stars} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 w-3 tabular-nums text-right">{d.stars}</span>
                  <Star className="w-3 h-3 text-amber-400 fill-current flex-shrink-0" />
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-[width] duration-500"
                      style={{ width: `${d.percent}%` }}
                    />
                  </div>
                  <span className="text-gray-500 w-10 tabular-nums text-right">
                    {Math.round(d.percent)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Список */}
        <div className="md:col-span-2">
          {reviews.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {reviews.slice(0, visibleCount).map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}

              {visibleCount < reviews.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((v) => v + INITIAL_VISIBLE)}
                  className="w-full py-3 rounded-lg border border-white/10 bg-white/5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Show {Math.min(INITIAL_VISIBLE, reviews.length - visibleCount)} more reviews
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

ProductReviews.displayName = 'ProductReviews';

export default ProductReviews;

// ─── Внутренние компоненты ───

function ReviewCard({ review }: { review: ProductReview }) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <Avatar name={review.author} src={review.authorAvatar} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-medium text-white truncate">{review.author}</div>
            <time className="text-xs text-gray-500 tabular-nums" dateTime={review.date}>
              {review.date}
            </time>
          </div>
          <div className="flex items-center mt-0.5" aria-label={`Рейтинг ${review.rating} из 5`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${
                  i < review.rating ? 'text-amber-400 fill-current' : 'text-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <p className="text-[15px] text-gray-300 leading-relaxed mt-3 whitespace-pre-line">
        {review.comment}
      </p>

      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 hover:text-gray-300 transition-colors"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          Helpful ({review.helpful})
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 hover:text-gray-300 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Reply
        </button>
      </div>
    </article>
  );
}

function Avatar({ name, src }: { name: string; src?: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        className="w-10 h-10 rounded-full object-cover bg-white/5 flex-shrink-0"
        loading="lazy"
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      aria-hidden
      className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 text-white text-sm font-medium flex-shrink-0"
    >
      {initial}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <div className="inline-flex w-12 h-12 rounded-full items-center justify-center bg-white/5 mb-3">
        <MessageSquare className="w-5 h-5 text-gray-500" />
      </div>
      <div className="text-white font-medium">No reviews yet</div>
      <p className="text-sm text-gray-400 mt-1">Be the first to review this app.</p>
    </div>
  );
}

function buildDistribution(reviews: ProductReview[], avgRating: number) {
  const counts = [0, 0, 0, 0, 0];
  for (const r of reviews) {
    const stars = Math.max(1, Math.min(5, Math.round(r.rating)));
    counts[stars - 1] += 1;
  }
  const total = reviews.length;
  if (total === 0) {
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      percent: estimatePercent(stars, avgRating),
    }));
  }
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    percent: (counts[stars - 1] / total) * 100,
  }));
}

function estimatePercent(stars: number, avgRating: number) {
  const distance = Math.abs(stars - avgRating);
  const weight = Math.max(0, 5 - distance) ** 2;
  const totalWeight = [1, 2, 3, 4, 5].reduce(
    (acc, s) => acc + Math.max(0, 5 - Math.abs(s - avgRating)) ** 2,
    0,
  );
  return totalWeight === 0 ? 0 : (weight / totalWeight) * 100;
}
