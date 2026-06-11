/**
 * Product reviews & ratings section (store-class trust). Loads verified reviews
 * + aggregate from the backend, shows a rating breakdown, and — for a buyer who
 * holds a license and hasn't reviewed yet — a "Write a review" form.
 */
import { useEffect, useState, useCallback } from 'react';
import { Star, ThumbsUp, BadgeCheck, Loader2, User } from 'lucide-react';
import {
  fetchProductReviews,
  checkCanReview,
  submitReview,
  markReviewHelpful,
  type ReviewApiItem,
  type ReviewAggregate,
} from '../../lib/commerceApi';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { invalidateMarketplaceInventory } from '../../domain/marketplace/marketplaceRemote';
import { logger } from '../../lib/logger';

interface Props {
  catalogProductId: string;
}

const EMPTY_AGG: ReviewAggregate = { averageRating: 0, count: 0, histogram: {} };

export default function ReviewSection({ catalogProductId }: Props) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<ReviewApiItem[]>([]);
  const [agg, setAgg] = useState<ReviewAggregate>(EMPTY_AGG);
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const { reviews: r, aggregate } = await fetchProductReviews(catalogProductId);
      setReviews(r);
      setAgg(aggregate);
    } catch (err) {
      logger.warn('[ReviewSection] load failed:', err);
    }
  }, [catalogProductId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!isAuthenticated) { setCanReview(false); setAlreadyReviewed(false); return; }
    let cancelled = false;
    void (async () => {
      try {
        const c = await checkCanReview(catalogProductId);
        if (!cancelled) { setCanReview(c.canReview); setAlreadyReviewed(c.alreadyReviewed); }
      } catch { /* not eligible */ }
    })();
    return () => { cancelled = true; };
  }, [catalogProductId, isAuthenticated]);

  const onSubmit = useCallback(async () => {
    if (!comment.trim()) { toast('error', 'Write a short comment'); return; }
    setSubmitting(true);
    try {
      const { aggregate } = await submitReview(catalogProductId, rating, comment.trim());
      setAgg(aggregate);
      setComment('');
      setShowForm(false);
      setCanReview(false);
      setAlreadyReviewed(true);
      toast('success', 'Review posted — thank you!');
      // The new review changed the product's aggregate rating (denormalised
      // server-side); drop the cached inventory so the storefront card reflects it.
      invalidateMarketplaceInventory();
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to post review';
      toast('error', msg);
    } finally {
      setSubmitting(false);
    }
  }, [catalogProductId, rating, comment, toast, load]);

  const onHelpful = useCallback(async (id: string) => {
    try {
      const helpful = await markReviewHelpful(id);
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, helpful } : r)));
    } catch { /* ignore */ }
  }, []);

  const hasReviews = reviews.length > 0 || agg.count > 0;
  if (!hasReviews && !canReview) return null;

  return (
    <div className="neon-card-gold rounded-2xl p-6 backdrop-blur-sm">
      <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-3">
        <Star className="w-5 h-5 text-[#FFD700]" />
        Reviews
        {agg.count > 0 && (
          <span className="text-gray-600 text-xs font-sans normal-case tracking-normal font-normal">
            ({agg.count})
          </span>
        )}
      </h2>

      {/* Aggregate */}
      {agg.count > 0 && (
        <div className="flex items-center gap-6 mb-6 pb-6 border-b border-white/5">
          <div className="text-center">
            <div className="text-4xl font-bold text-[#FFD700]">{agg.averageRating.toFixed(1)}</div>
            <div className="flex items-center justify-center mt-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(agg.averageRating) ? 'text-[#FFD700] fill-current' : 'text-white/10'}`} />
              ))}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">{agg.count} review{agg.count === 1 ? '' : 's'}</div>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = Number(agg.histogram[String(star)] || 0);
              const pct = agg.count ? Math.round((n / agg.count) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-3">{star}</span>
                  <Star className="w-3 h-3 text-[#FFD700]" />
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-[#FFD700]/70" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-gray-600">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Write a review */}
      {canReview && (
        <div className="mb-6">
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/10 px-4 py-2 text-sm font-semibold text-[#FFD700] hover:bg-[#FFD700]/20"
            >
              <Star className="w-4 h-4" /> Write a review
            </button>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setRating(s)} aria-label={`${s} stars`}>
                    <Star className={`w-6 h-6 ${s <= rating ? 'text-[#FFD700] fill-current' : 'text-white/15'}`} />
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 5000))}
                placeholder="Share your honest experience with this product…"
                rows={3}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] focus:border-[#FFD700]/40 focus:outline-none"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void onSubmit()}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#FFD700] text-[#0A0A0A] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                  Post review
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-white">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {alreadyReviewed && !canReview && (
        <p className="text-xs text-emerald-300/80 mb-4 flex items-center gap-1.5">
          <BadgeCheck className="w-3.5 h-3.5" /> You reviewed this product.
        </p>
      )}

      {/* List */}
      <div className="space-y-5">
        {reviews.map((review) => (
          <div key={review.id} className="border-b border-white/5 pb-5 last:border-b-0 last:pb-0">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8B5CF6]/30 to-[#FF00FF]/20 border border-[#8B5CF6]/20 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-[#8B5CF6]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-semibold text-white text-sm">{review.author}</span>
                  {review.verified && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 rounded px-1.5 py-0.5">
                      <BadgeCheck className="w-3 h-3" /> Verified buyer
                    </span>
                  )}
                  <span className="text-gray-600 text-xs">{new Date(review.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(review.rating) ? 'text-[#FFD700] fill-current' : 'text-white/10'}`} />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed pl-12">{review.comment}</p>
            <button
              type="button"
              onClick={() => void onHelpful(review.id)}
              className="ml-12 mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#00F5FF]"
            >
              <ThumbsUp className="w-3.5 h-3.5" /> Helpful ({review.helpful})
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
