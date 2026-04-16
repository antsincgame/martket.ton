// Страница продукта — Neon Sacred Redesign.
// Hero → Gallery → TrustConstellation → Scripture → MetaArsenal → Oracle Reviews → Kindred Artifacts
// Логика загрузки и canonical-slug redirect сохранены из прошлой версии.
import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { slugify } from '../utils/slugify';
import LoadingScreen from '../components/LoadingScreen';
import ProductCryptoCheckout from '../components/ProductCryptoCheckout';
import DevSacredBackground from '../components/developer/DevSacredBackground';
import CinematicProductHero from '../components/product/CinematicProductHero';
import SacredGallery from '../components/product/SacredGallery';
import AuraPurchasePanel from '../components/product/AuraPurchasePanel';
import MetaArsenal from '../components/product/MetaArsenal';
import TrustConstellation from '../components/product/TrustConstellation';
import { resolveProductDetail, resolveProductReviews } from '../domain/marketplace/marketplaceRemote';
import type { ProductDetail, ProductReview } from '../domain/marketplace/types';

// Тяжёлые секции — под скроллом. Разгружаем initial bundle.
const ScriptureDescription = lazy(() => import('../components/product/ScriptureDescription'));
const OracleReviews = lazy(() => import('../components/product/OracleReviews'));
const KindredArtifacts = lazy(() => import('../components/product/KindredArtifacts'));

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

  if (product === undefined) {
    return <LoadingScreen message="Призываю артефакт..." />;
  }

  if (!product) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 text-center overflow-hidden">
        <DevSacredBackground />
        <div className="relative z-10">
          <h1 className="text-3xl font-display font-black uppercase tracking-widest text-white mb-3">
            Артефакт не найден
          </h1>
          <p className="text-gray-400 mb-6">Проверьте ссылку или вернитесь в храм каталога.</p>
          <Link
            to="/category/apps"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#FFD700]/50 bg-[#FFD700]/10 text-[#FFD700] text-sm font-black uppercase tracking-[0.25em] hover:bg-[#FFD700]/20 transition-colors"
          >
            В каталог
          </Link>
        </div>
      </div>
    );
  }

  const coverImage = product.images[selectedImage] ?? product.image;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <DevSacredBackground />

      <div className="relative z-10 py-6 sm:py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {/* ═══ HERO ═══ */}
          <div className="mb-10 md:mb-16">
            <CinematicProductHero product={product} coverImage={coverImage} />
          </div>

          {/* ═══ Main grid: content + aside ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            <div className="lg:col-span-2 space-y-12 min-w-0">
              {/* Sacred gallery */}
              <SacredGallery
                images={product.images}
                productName={product.name}
                selectedIndex={selectedImage}
                onSelect={setSelectedImage}
              />

              {/* Trust Constellation — главный эмоциональный крючок */}
              <TrustConstellation />

              {/* Scripture */}
              <Suspense fallback={<SectionFallback />}>
                <ScriptureDescription
                  longDescription={product.longDescription}
                  tags={product.tags}
                />
              </Suspense>

              {/* Meta arsenal */}
              <MetaArsenal product={product} />

              {/* Oracle reviews */}
              <Suspense fallback={<SectionFallback />}>
                <OracleReviews
                  reviews={reviews}
                  avgRating={product.rating}
                  totalCount={product.reviewStatsCount}
                />
              </Suspense>
            </div>

            {/* ═══ Aside: sticky purchase panel ═══ */}
            <aside className="lg:col-span-1">
              <div className="lg:sticky lg:top-24">
                <AuraPurchasePanel
                  priceTon={product.price}
                  productName={product.name}
                  checkoutSlot={<ProductCryptoCheckout catalogProductId={product.id} />}
                />
              </div>
            </aside>
          </div>

          {/* ═══ Kindred Artifacts — полноширинная секция внизу ═══ */}
          <div className="mt-14 md:mt-20">
            <Suspense fallback={<SectionFallback />}>
              <KindredArtifacts
                currentProductId={product.id}
                category={product.category}
                developer={product.developer}
                tags={product.tags}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;

function SectionFallback() {
  return (
    <div className="py-10 text-center text-[10px] uppercase tracking-[0.35em] text-gray-600">
      Unveiling...
    </div>
  );
}
