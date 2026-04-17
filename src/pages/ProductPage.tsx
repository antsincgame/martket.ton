// Страница продукта обновлена по терминологии TonForge, чтобы purchase card объясняла escrow/NFT/device flow вместо старых обещаний.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Star, Download, Heart, Share2, Shield, Zap, User, Calendar, Gem, Sparkles, ThumbsUp } from 'lucide-react';
import { slugify } from '../utils/slugify';
import LoadingScreen from '../components/LoadingScreen';
import Breadcrumbs from '../components/Breadcrumbs';
import CommerceCheckout from '../components/checkout/CommerceCheckout';
import { resolveProductDetail, resolveProductReviews } from '../domain/marketplace/marketplaceRemote';
import { categoryLabelToSlug } from '../domain/marketplace/catalog';
import type { ProductDetail, ProductReview } from '../domain/marketplace/types';

const ProductPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);
  const [product, setProduct] = useState<ProductDetail | null | undefined>(undefined);
  const [reviews, setReviews] = useState<ProductReview[]>([]);

  useEffect(() => {
    if (!slug) {
      setProduct(null);
      setReviews([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [nextProduct, nextReviews] = await Promise.all([
        resolveProductDetail(slug),
        resolveProductReviews(slug),
      ]);
      if (!cancelled) {
        setProduct(nextProduct);
        setReviews(nextReviews);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Canonical URL: если пришли по id или кривому slug — незаметно заменяем на ЧПУ.
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
    return <LoadingScreen message="Загрузка товара..." />;
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Товар не найден</h1>
        <p className="text-gray-400 mb-6">Проверьте ссылку или вернитесь в каталог.</p>
        <Link
          to="/category/apps"
          className="bg-ton-gradient text-white font-semibold px-6 py-3 rounded-full"
        >
          В каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs
          items={[
            {
              label: product.category,
              to: `/category/${categorySlug ?? 'apps'}`,
            },
            { label: product.name },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Product Images */}
            <div className="mb-8">
              <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl overflow-hidden mb-4">
                <img
                  src={product.images[selectedImage]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex space-x-4 overflow-x-auto">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === index
                        ? 'border-ton-500 scale-105'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    <img src={image} alt={`Screenshot ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-display font-bold text-white mb-2 flex items-center">
                    {product.name}
                    {product.isFeatured && (
                      <Gem className="w-6 h-6 ml-3 text-purple-400 animate-sparkle" />
                    )}
                  </h1>
                  <p className="text-purple-400 font-medium flex items-center">
                    by <Link to={`/developer/${slugify(product.developer)}`} className="ml-1 underline decoration-purple-700 underline-offset-2 hover:text-purple-300 transition-colors">{product.developer}</Link>
                    {(product.donationAmount ?? 0) > 0 && (
                      <span className="ml-4 bg-yellow-500/20 border border-yellow-500/30 px-2 py-1 rounded-full text-xs text-yellow-400 flex items-center">
                        <Heart className="w-3 h-3 mr-1" />
                        {product.donationAmount} TON blessed
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-6 mb-6">
                <div className="flex items-center space-x-1">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${
                          i < Math.floor(product.rating)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-yellow-400 font-semibold ml-2">{product.rating}</span>
                  <span className="text-gray-400">({product.reviewStatsCount} reviews)</span>
                </div>
                <div className="flex items-center space-x-1 text-gray-400">
                  <Download className="w-5 h-5" />
                  <span>{product.downloads.toLocaleString()} downloads</span>
                </div>
              </div>

              <p className="text-gray-300 mb-6 leading-relaxed">
                {product.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-ton-500/20 text-ton-400 px-3 py-1 rounded-full text-sm border border-ton-500/30"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div id="checkout-section">
                <CommerceCheckout catalogProductId={product.id} />
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <button
                  type="button"
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-4 px-6 rounded-full transition-all duration-300 border border-white/20 flex items-center justify-center space-x-2"
                >
                  <Heart className="w-5 h-5" />
                  <span>Wishlist</span>
                </button>
                <button
                  type="button"
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-4 px-6 rounded-full transition-all duration-300 border border-white/20 flex items-center justify-center space-x-2"
                >
                  <Share2 className="w-5 h-5" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8">
              <h2 className="text-2xl font-display font-bold text-white mb-4 flex items-center">
                <Sparkles className="w-6 h-6 mr-3 text-purple-400" />
                Sacred Description
              </h2>
              <div className="text-gray-300 leading-relaxed whitespace-pre-line">
                {product.longDescription}
              </div>
            </div>

            {/* Reviews */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <Star className="w-6 h-6 mr-3 text-yellow-400" />
                Sacred Reviews
              </h2>
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="border-b border-white/10 pb-6 last:border-b-0">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-white">{review.author}</div>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${
                                    i < review.rating
                                      ? 'text-yellow-400 fill-current'
                                      : 'text-gray-600'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-gray-400 text-sm">{review.date}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-300 mb-3">{review.comment}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <button className="hover:text-white transition-colors">
                        <ThumbsUp className="w-3.5 h-3.5 inline mr-1" /> Helpful ({review.helpful})
                      </button>
                      <button className="hover:text-white transition-colors">Reply</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Purchase Card */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6 sticky top-24">
              <div className="text-center mb-6">
                <div className="text-3xl font-display font-bold text-ton-400 mb-2 flex items-center justify-center">
                  <Zap className="w-6 h-6 mr-2" />
                  {product.price} TON
                </div>
                <p className="text-gray-400 text-sm">≈ ${(product.price * 2.3).toFixed(2)} USD</p>
              </div>

              <button
                type="button"
                onClick={() => document.getElementById('checkout-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full bg-ton-gradient hover:scale-105 text-white font-semibold py-4 px-6 rounded-full transition-all duration-300 shadow-lg hover:shadow-ton-500/50 mb-4"
              >
                Purchase Now
              </button>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Category:</span>
                  <span className="text-white">{product.category}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Version:</span>
                  <span className="text-white">{product.version}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Size:</span>
                  <span className="text-white">{product.size}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Updated:</span>
                  <span className="text-white">{product.lastUpdated}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/10">
                <h4 className="font-semibold text-white mb-3 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-green-400" />
                  TonForge Guarantees
                </h4>
                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    72h escrow and dispute window
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    SHA-256 and malware verification
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    NFT-based lifetime entitlement
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    Device activation and runtime checks
                  </div>
                </div>
              </div>
            </div>

            {/* System Requirements */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-purple-400" />
                System Requirements
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-gray-400 mb-1">Platforms:</div>
                  <div className="flex flex-wrap gap-2">
                    {product.platforms.map((platform) => (
                      <span
                        key={platform}
                        className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs border border-purple-500/30"
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Requirements:</div>
                  <div className="text-white text-xs">{product.requirements}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;