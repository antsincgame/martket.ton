import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Star, Download, Share2, Shield, Zap, User, Calendar, Gem, Sparkles, ThumbsUp, RefreshCw, ExternalLink } from 'lucide-react';
import { slugify } from '../utils/slugify';
import LoadingScreen from '../components/LoadingScreen';
import Breadcrumbs from '../components/Breadcrumbs';
import DemoUiBadge from '../components/DemoUiBadge';
import CommerceCheckout from '../components/checkout/CommerceCheckout';
import { resolveProductDetail, resolveProductReviews } from '../domain/marketplace/marketplaceRemote';
import { categoryLabelToSlug } from '../domain/marketplace/catalog';
import { useTonPrice } from '../hooks/useTonPrice';
import { logger } from '../lib/logger';
import type { ProductDetail, ProductReview } from '../domain/marketplace/types';

const ProductPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);
  const [product, setProduct] = useState<ProductDetail | null | undefined>(undefined);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { data: tonPrice } = useTonPrice();
  const [retryNonce, setRetryNonce] = useState(0);
  const [shareConfirm, setShareConfirm] = useState(false);

  useEffect(() => {
    if (!slug) {
      setProduct(null);
      setReviews([]);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    setProduct(undefined);
    (async () => {
      try {
        const [nextProduct, nextReviews] = await Promise.all([
          resolveProductDetail(slug),
          resolveProductReviews(slug),
        ]);
        if (!cancelled) {
          setProduct(nextProduct);
          setReviews(nextReviews);
        }
      } catch (err) {
        logger.warn('[ProductPage] load failed', err);
        if (!cancelled) {
          setProduct(null);
          setLoadError(err instanceof Error ? err.message : 'Failed to load product');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, retryNonce]);

  useEffect(() => {
    if (!product || !slug) return;
    const canonical = slugify(product.name);
    if (canonical && canonical !== slug) {
      navigate(`/product/${canonical}`, { replace: true });
    }
  }, [product, slug, navigate]);

  useEffect(() => {
    setSelectedImage(0);
  }, [product?.id]);

  const categorySlug = useMemo(
    () => product ? categoryLabelToSlug(product.category) : null,
    [product],
  );

  if (product === undefined) {
    return <LoadingScreen message="Loading product..." />;
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <div className="w-24 h-24 rounded-full bg-[#FFD700]/5 border border-[#FFD700]/15 flex items-center justify-center mb-8 animate-aura-pulse">
          <Gem className="w-10 h-10 text-[#FFD700]/40" />
        </div>
        <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-white mb-4">
          {loadError ? 'Signal Lost' : 'Void Echo'}
        </h1>
        <p className="text-gray-500 mb-8 max-w-sm">
          {loadError ?? 'This product does not exist in the forge. Check the link or return to the catalog.'}
        </p>
        <div className="flex gap-3">
          {loadError && (
            <button
              onClick={() => setRetryNonce((n) => n + 1)}
              className="bg-white/5 hover:bg-white/10 text-white font-semibold px-6 py-3 rounded-xl border border-white/10 flex items-center gap-2 transition-all duration-300 hover:border-[#00F5FF]/30 hover:shadow-[0_0_20px_rgba(0,245,255,0.1)]"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          )}
          <Link
            to="/"
            className="bg-gradient-to-r from-[#FFD700]/10 to-[#FFD700]/5 border border-[#FFD700]/30 text-[#FFD700] font-bold uppercase tracking-widest text-xs px-6 py-3 rounded-xl transition-all duration-300 hover:from-[#FFD700]/20 hover:shadow-[0_0_30px_rgba(255,215,0,0.15)]"
          >
            Browse Catalog
          </Link>
        </div>
      </div>
    );
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: product.name, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        setShareConfirm(true);
        setTimeout(() => setShareConfirm(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs
          items={[
            { label: product.category, to: `/category/${categorySlug ?? 'apps'}` },
            { label: product.name },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ─── Main Content ─── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Hero Image */}
            <div className="relative">
              <DemoUiBadge variant="corner" tint="cyan" />
              <div className="aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-[#0D0D1A] to-[#12121F] border border-white/5">
                {product.images.length > 0 ? (
                  <img
                    src={product.images[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="relative">
                      <Gem className="w-20 h-20 text-[#FFD700]/15" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-[#FFD700]/10 animate-aura-pulse" />
                      </div>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 pointer-events-none rounded-2xl ring-1 ring-inset ring-white/5" />
              </div>
              {product.images.length > 1 && (
                <div className="flex gap-3 mt-4 overflow-x-auto scrollbar-hide">
                  {product.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                        selectedImage === index
                          ? 'border-[#FFD700]/60 shadow-[0_0_15px_rgba(255,215,0,0.2)] scale-105'
                          : 'border-white/10 hover:border-white/25 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={image} alt={`View ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info Card */}
            <div className="neon-card-gold rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-start justify-between mb-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-white uppercase tracking-tight">
                      {product.name}
                    </h1>
                    {product.isFeatured && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 text-[10px] font-bold uppercase tracking-widest text-[#8B5CF6]">
                        <Gem className="w-3 h-3" />
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm flex items-center gap-1">
                    by
                    <Link
                      to={`/developer/${slugify(product.developer)}`}
                      className="text-[#FFD700] hover:text-[#FFE066] transition-colors font-medium"
                    >
                      {product.developer}
                    </Link>
                    {(product.donationAmount ?? 0) > 0 && (
                      <span className="ml-3 inline-flex items-center gap-1 bg-[#FFD700]/5 border border-[#FFD700]/15 px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-[#FFD700]">
                        <Sparkles className="w-3 h-3" />
                        {product.donationAmount} TON blessed
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-6 mb-6 py-3 px-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(product.rating)
                            ? 'text-[#FFD700] fill-current'
                            : 'text-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[#FFD700] font-bold text-sm">{product.rating}</span>
                  <span className="text-gray-600 text-xs">({product.reviewStatsCount})</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  <span>{product.downloads.toLocaleString()}</span>
                </div>
              </div>

              <p className="text-gray-300 leading-relaxed mb-6">{product.description}</p>

              {/* Tags */}
              {product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-[#00F5FF]/5 text-[#00F5FF] px-3 py-1 rounded-full text-xs border border-[#00F5FF]/15 font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div id="checkout-section">
                <CommerceCheckout catalogProductId={product.id} />
              </div>

              {/* Share */}
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleShare}
                  className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm transition-all duration-300 hover:border-[#00F5FF]/30 hover:text-[#00F5FF] hover:shadow-[0_0_20px_rgba(0,245,255,0.08)]"
                >
                  <Share2 className="w-4 h-4" />
                  {shareConfirm ? 'Copied!' : 'Share'}
                </button>
              </div>
            </div>

            {/* Long Description */}
            {product.longDescription && (
              <div className="neon-card-cyan rounded-2xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-5 flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-[#8B5CF6]" />
                  Description
                </h2>
                <div className="text-gray-300 leading-relaxed whitespace-pre-line text-sm">
                  {product.longDescription}
                </div>
              </div>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div className="neon-card-gold rounded-2xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                  <Star className="w-5 h-5 text-[#FFD700]" />
                  Reviews
                  <span className="text-gray-600 text-xs font-sans normal-case tracking-normal font-normal">
                    ({reviews.length})
                  </span>
                </h2>
                <div className="space-y-5">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-white/5 pb-5 last:border-b-0 last:pb-0">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8B5CF6]/30 to-[#FF00FF]/20 border border-[#8B5CF6]/20 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-[#8B5CF6]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-white text-sm">{review.author}</span>
                            <span className="text-gray-600 text-xs">{review.date}</span>
                          </div>
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < review.rating ? 'text-[#FFD700] fill-current' : 'text-white/10'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm leading-relaxed ml-12">{review.comment}</p>
                      {review.helpful > 0 && (
                        <div className="ml-12 mt-2 text-xs text-gray-600 flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {review.helpful} found helpful
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── Sidebar ─── */}
          <div className="lg:col-span-1 space-y-6">

            {/* Purchase Card */}
            <div className="relative sticky top-24 neon-card-gold rounded-2xl p-6 backdrop-blur-sm overflow-hidden">
              <DemoUiBadge variant="corner" tint="gold" label="Demo UI" />

              {/* Sacred glow behind price */}
              <div className="absolute top-8 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full bg-[#FFD700]/5 blur-3xl pointer-events-none" />

              <div className="relative text-center mb-6 pt-2">
                <div className="text-3xl font-display font-black text-white mb-1 flex items-center justify-center gap-2">
                  <Zap className="w-6 h-6 text-[#FFD700]" />
                  <span className="gold-shimmer-text">{product.price} TON</span>
                </div>
                {tonPrice ? (
                  <p className="text-gray-500 text-sm font-medium">
                    ≈ <span className="text-gray-400">${(product.price * tonPrice).toFixed(2)}</span> USD
                  </p>
                ) : (
                  <p className="text-gray-600 text-xs">on-chain settlement via TON</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => document.getElementById('checkout-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="relative w-full py-4 px-6 rounded-xl font-bold text-sm uppercase tracking-[0.2em] text-[#0A0A0A] bg-[#FFD700] transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,215,0,0.3)] hover:scale-[1.02] active:scale-[0.98] mb-6"
              >
                Purchase Now
              </button>

              <div className="space-y-3">
                {[
                  ['Category', product.category],
                  ['Version', product.version],
                  ['Size', product.size],
                  ['Updated', product.lastUpdated],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="text-gray-300 font-medium">{value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-white/5">
                <h4 className="font-display text-xs font-bold uppercase tracking-widest text-white mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#00FF88]" />
                  TonForge Guarantees
                </h4>
                <div className="space-y-2.5">
                  {[
                    '72h escrow and buyer trial window',
                    'SHA-256 and malware verification',
                    'NFT-based lifetime entitlement',
                    'Device activation and runtime checks',
                  ].map((text) => (
                    <div key={text} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#00FF88] shadow-[0_0_6px_rgba(0,255,136,0.5)] flex-shrink-0" />
                      <span className="text-gray-400">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* System Requirements */}
            <div className="neon-card-cyan rounded-2xl p-6 backdrop-blur-sm">
              <h3 className="font-display text-xs font-bold uppercase tracking-widest text-white mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#8B5CF6]" />
                System Requirements
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-gray-600 text-xs uppercase tracking-wider mb-2">Platforms</div>
                  <div className="flex flex-wrap gap-2">
                    {product.platforms.map((platform) => (
                      <span
                        key={platform}
                        className="bg-[#8B5CF6]/10 text-[#8B5CF6] px-2.5 py-1 rounded-lg text-xs border border-[#8B5CF6]/20 font-medium"
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 text-xs uppercase tracking-wider mb-1">Requirements</div>
                  <div className="text-gray-400 text-xs">{product.requirements}</div>
                </div>
              </div>
            </div>

            {/* Developer Link */}
            <Link
              to={`/developer/${slugify(product.developer)}`}
              className="group flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#FFD700]/20 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,215,0,0.05)]"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700]/15 to-[#FF00FF]/10 border border-[#FFD700]/15 flex items-center justify-center">
                <User className="w-5 h-5 text-[#FFD700]/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{product.developer}</p>
                <p className="text-gray-600 text-xs">View demiurge profile</p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-[#FFD700] transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
