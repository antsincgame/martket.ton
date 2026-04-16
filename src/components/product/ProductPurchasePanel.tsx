import { memo, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Star, Heart, Share2, Check, CheckCircle2 } from 'lucide-react';
import { slugify } from '../../utils/slugify';
import type { ProductDetail } from '../../domain/marketplace/types';

interface ProductPurchasePanelProps {
  product: ProductDetail;
  /** TonForge checkout — встраивается под кнопкой Buy Now. */
  checkoutSlot: ReactNode;
  /**
   * По умолчанию на мобилке хедер (имя/dev/rating) рендерит отдельный
   * `ProductHeader` сверху страницы; в самой панели хедер виден только на `lg+`.
   * Поставьте `true`, чтобы спрятать хедер целиком.
   */
  hideHeader?: boolean;
}

const TRUST_ITEMS: ReadonlyArray<{ label: string; hint: string }> = [
  { label: 'Hand-curated by editor', hint: 'Каждое приложение проходит ручную модерацию' },
  { label: '72h escrow buyer protection', hint: 'Средства удерживаются до приёмки' },
  { label: 'NFT lifetime license', hint: 'Право собственности в блокчейне TON' },
  { label: 'SHA-256 & malware scan', hint: 'Подпись и антивирус-проверка артефакта' },
  { label: 'Device-bound activation', hint: 'Активация привязана к устройству' },
];

/**
 * Главная информационная панель товара (Steam/Epic/App Store style):
 * имя → dev → rating → цена → Buy Now → wishlist/share → meta → trust.
 */
const ProductPurchasePanel = memo(
  ({ product, checkoutSlot, hideHeader = false }: ProductPurchasePanelProps) => {
    const [wished, setWished] = useState(false);
    const [shared, setShared] = useState(false);

    const devSlug = useMemo(() => slugify(product.developer), [product.developer]);
    const usdEquivalent = useMemo(() => (product.price * 2.3).toFixed(2), [product.price]);

    const handleShare = async () => {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      try {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title: product.name, url });
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          setShared(true);
          window.setTimeout(() => setShared(false), 2000);
        }
      } catch {
        // отменено пользователем
      }
    };

    const meta: ReadonlyArray<{ label: string; value: string }> = [
      { label: 'Category', value: product.category },
      { label: 'Version', value: product.version },
      { label: 'Size', value: product.size },
      { label: 'Updated', value: product.lastUpdated },
    ];

    return (
      <div className="rounded-xl border border-white/10 bg-[#12121F] overflow-hidden">
        <div className="p-5 sm:p-6 space-y-5">
          {/* Header (название/dev/rating) — на мобилке выводится отдельным ProductHeader сверху, поэтому здесь lg+ only */}
          {!hideHeader && (
            <header className="hidden lg:block space-y-2">
              <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight">
                {product.name}
              </h1>
              <div className="text-sm text-gray-400">
                by{' '}
                <Link
                  to={`/developer/${devSlug}`}
                  className="text-[#4facfe] hover:underline underline-offset-2"
                >
                  {product.developer}
                </Link>
              </div>
              <RatingRow
                rating={product.rating}
                reviewCount={product.reviewStatsCount}
                downloads={product.downloads}
              />
            </header>
          )}

          {/* Цена */}
          <div className="pt-2">
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-bold text-white tabular-nums">
                {product.price} <span className="text-xl text-gray-400">TON</span>
              </div>
              <div className="text-sm text-gray-500 tabular-nums">≈ ${usdEquivalent}</div>
            </div>
          </div>

          {/* TonForge checkout — реальный flow: createPurchaseSession, escrow, NFT, device activation */}
          <div>{checkoutSlot}</div>

          {/* Wishlist + Share */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWished((v) => !v)}
              aria-pressed={wished}
              className={[
                'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4facfe]',
                wished
                  ? 'bg-pink-500/15 border-pink-500/50 text-pink-300'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20',
              ].join(' ')}
            >
              <Heart className="w-4 h-4" fill={wished ? 'currentColor' : 'none'} />
              {wished ? 'Wishlisted' : 'Wishlist'}
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-gray-300 text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4facfe]"
            >
              {shared ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
              {shared ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>

        {/* Meta info */}
        <div className="border-t border-white/10 px-5 sm:px-6 py-4">
          <h3 className="sr-only">Information</h3>
          <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            {meta.map((m) => (
              <div key={m.label} className="contents">
                <dt className="text-gray-500">{m.label}</dt>
                <dd className="text-white text-right truncate" title={m.value}>
                  {m.value}
                </dd>
              </div>
            ))}
            {product.platforms.length > 0 && (
              <div className="contents">
                <dt className="text-gray-500">Platforms</dt>
                <dd className="text-white text-right truncate" title={product.platforms.join(', ')}>
                  {product.platforms.join(', ')}
                </dd>
              </div>
            )}
          </dl>
          {product.requirements && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="text-gray-500 text-xs mb-1">Requirements</div>
              <p className="text-gray-300 text-xs leading-relaxed">{product.requirements}</p>
            </div>
          )}
        </div>

        {/* Trust badges */}
        <div className="border-t border-white/10 px-5 sm:px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Purchase protection
          </h3>
          <ul className="space-y-2">
            {TRUST_ITEMS.map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-2 text-sm text-gray-300"
                title={item.hint}
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  },
);

ProductPurchasePanel.displayName = 'ProductPurchasePanel';

export default ProductPurchasePanel;

// ─── Header вынесен в отдельный экспорт для мобильного использования ───

interface ProductHeaderProps {
  product: ProductDetail;
}

/**
 * Компактная шапка товара для мобильного flow (показывается над галереей).
 * На десктопе тот же контент рендерится внутри ProductPurchasePanel.
 */
export const ProductHeader = memo(({ product }: ProductHeaderProps) => {
  const devSlug = useMemo(() => slugify(product.developer), [product.developer]);

  return (
    <header className="space-y-2">
      <div className="flex items-start gap-3">
        {/* Маленькая иконка для App-Store-вкуса */}
        <img
          src={product.image}
          alt=""
          aria-hidden
          className="w-14 h-14 rounded-xl object-cover border border-white/10 flex-shrink-0"
          loading="eager"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight truncate">
            {product.name}
          </h1>
          <div className="text-sm text-gray-400 truncate">
            <Link
              to={`/developer/${devSlug}`}
              className="text-[#4facfe] hover:underline underline-offset-2"
            >
              {product.developer}
            </Link>
            <span className="mx-1.5 text-gray-600">·</span>
            <span>{product.category}</span>
          </div>
        </div>
      </div>

      <RatingRow
        rating={product.rating}
        reviewCount={product.reviewStatsCount}
        downloads={product.downloads}
      />
    </header>
  );
});

ProductHeader.displayName = 'ProductHeader';

// ─── Внутренний компонент: строка рейтинг + downloads ───

interface RatingRowProps {
  rating: number;
  reviewCount: number;
  downloads: number;
}

function RatingRow({ rating, reviewCount, downloads }: RatingRowProps) {
  return (
    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm">
      <div className="flex items-center gap-1">
        <div className="flex items-center" aria-label={`Рейтинг ${rating.toFixed(1)} из 5`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${
                i < Math.round(rating) ? 'text-amber-400 fill-current' : 'text-gray-700'
              }`}
            />
          ))}
        </div>
        <span className="text-white font-medium tabular-nums ml-1">{rating.toFixed(1)}</span>
        <span className="text-gray-500">({reviewCount.toLocaleString('en-US')})</span>
      </div>
      <span className="text-gray-600">·</span>
      <span className="text-gray-400 tabular-nums">
        {downloads.toLocaleString('en-US')} downloads
      </span>
    </div>
  );
}
