// Страница продукта — Store-Style (Steam / Epic / Play Market / App Store).
// Layout:
//   Desktop: Breadcrumbs → [Gallery (col-span-2) | PurchasePanel (col-span-1)]
//                       → About → Reviews → More Like This
//   Mobile:  ProductHeader (имя/dev/rating) → Gallery → PurchasePanel
//                       → About → Reviews → More Like This
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { slugify } from '../utils/slugify';
import LoadingScreen from '../components/LoadingScreen';
import ProductCryptoCheckout from '../components/ProductCryptoCheckout';
import ProductGallery from '../components/product/ProductGallery';
import ProductPurchasePanel, { ProductHeader } from '../components/product/ProductPurchasePanel';
import { resolveProductDetail, resolveProductReviews } from '../domain/marketplace/marketplaceRemote';
import { categoryLabelToSlug } from '../domain/marketplace/catalog';
import type { ProductDetail, ProductReview } from '../domain/marketplace/types';

// Тяжёлые секции — под скроллом.
const ProductDescription = lazy(() => import('../components/product/ProductDescription'));
const ProductReviews = lazy(() => import('../components/product/ProductReviews'));
const MoreLikeThis = lazy(() => import('../components/product/MoreLikeThis'));

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
    () => (product ? categoryLabelToSlug(product.category) : null),
    [product],
  );

  if (product === undefined) {
    return <LoadingScreen message="Загружаем артефакт..." />;
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-[#0A0A0F]">
        <h1 className="text-3xl font-bold text-white mb-3">Product not found</h1>
        <p className="text-gray-400 mb-6">Проверьте ссылку или вернитесь в каталог.</p>
        <Link
          to="/category/apps"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#4facfe] text-white text-sm font-medium hover:bg-[#3a9be8] transition-colors"
        >
          Browse Store
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* ─── Breadcrumbs ─── */}
        <nav aria-label="Breadcrumb" className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-500 flex items-center gap-1.5 flex-wrap">
          <Link to="/" className="hover:text-white transition-colors">
            Store
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-700" aria-hidden />
          <Link
            to={categorySlug ? `/category/${categorySlug}` : '/category/apps'}
            className="hover:text-white transition-colors"
          >
            {product.category}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-700" aria-hidden />
          <span className="text-gray-300 truncate" aria-current="page">
            {product.name}
          </span>
        </nav>

        {/* ─── Mobile ProductHeader (выше галереи) ─── */}
        <div className="lg:hidden mb-4">
          <ProductHeader product={product} />
        </div>

        {/* ─── Above the fold: Gallery + Purchase Panel ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 min-w-0">
            <ProductGallery
              images={product.images.length > 0 ? product.images : [product.image]}
              productName={product.name}
              selectedIndex={selectedImage}
              onSelect={setSelectedImage}
            />
          </div>

          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <ProductPurchasePanel
                product={product}
                hideHeader={false /* mobile хедер уже отрендерен выше; на десктопе панель показывает свой */}
                checkoutSlot={<ProductCryptoCheckout catalogProductId={product.id} />}
              />
            </div>
          </aside>
        </div>

        {/* ─── About this app ─── */}
        <div className="mt-10 lg:mt-14">
          <Suspense fallback={<SectionFallback />}>
            <ProductDescription
              longDescription={product.longDescription}
              tags={product.tags}
            />
          </Suspense>
        </div>

        {/* ─── Reviews ─── */}
        <div className="mt-10 lg:mt-14">
          <Suspense fallback={<SectionFallback />}>
            <ProductReviews
              reviews={reviews}
              avgRating={product.rating}
              totalCount={product.reviewStatsCount}
            />
          </Suspense>
        </div>

        {/* ─── More Like This ─── */}
        <div className="mt-10 lg:mt-14 pb-10">
          <Suspense fallback={<SectionFallback />}>
            <MoreLikeThis
              currentProductId={product.id}
              category={product.category}
              developer={product.developer}
              tags={product.tags}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;

function SectionFallback() {
  return (
    <div className="py-10 text-center text-xs text-gray-600">Loading...</div>
  );
}
