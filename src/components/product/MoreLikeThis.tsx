import { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Download } from 'lucide-react';
import {
  getMarketplaceInventoryOnce,
  productSlug,
} from '../../domain/marketplace/marketplaceRemote';
import type { CatalogListingProduct } from '../../domain/marketplace/types';

interface MoreLikeThisProps {
  currentProductId: string;
  category: string;
  developer: string;
  tags: readonly string[];
}

interface Scored {
  product: CatalogListingProduct;
  score: number;
  sameDeveloper: boolean;
}

const MAX_ITEMS = 6;

/**
 * Подборка похожих товаров (Steam/App Store style):
 * scoring developer + category + tags + rating, чистые карточки,
 * на мобилке snap-scroll, на десктопе grid.
 */
const MoreLikeThis = memo(
  ({ currentProductId, category, developer, tags }: MoreLikeThisProps) => {
    const [all, setAll] = useState<CatalogListingProduct[] | null>(null);

    useEffect(() => {
      let cancelled = false;
      void getMarketplaceInventoryOnce().then((inv) => {
        if (!cancelled) setAll(inv.products);
      });
      return () => {
        cancelled = true;
      };
    }, []);

    const items = useMemo<Scored[]>(() => {
      if (!all) return [];
      const tagSet = new Set(tags.map((t) => t.toLowerCase()));

      const scored: Scored[] = [];
      for (const p of all) {
        if (p.id === currentProductId) continue;
        let score = 0;
        const sameDev = p.developer === developer;
        if (sameDev) score += 5;
        if (p.category === category) score += 3;
        if (p.tags) {
          for (const t of p.tags) if (tagSet.has(t.toLowerCase())) score += 1;
        }
        score += (p.rating || 0) * 0.5;
        if (score > 0) scored.push({ product: p, score, sameDeveloper: sameDev });
      }

      scored.sort((a, b) => b.score - a.score);

      // Fallback: добираем featured, если совпадений мало
      if (scored.length < 3) {
        const existingIds = new Set(scored.map((s) => s.product.id));
        for (const p of all) {
          if (scored.length >= MAX_ITEMS) break;
          if (p.id === currentProductId || existingIds.has(p.id)) continue;
          if (p.isFeatured) {
            scored.push({ product: p, score: 0, sameDeveloper: false });
            existingIds.add(p.id);
          }
        }
      }

      return scored.slice(0, MAX_ITEMS);
    }, [all, currentProductId, category, developer, tags]);

    if (!all || items.length === 0) return null;

    return (
      <section aria-labelledby="more-like-this-heading" className="space-y-4">
        <h2
          id="more-like-this-heading"
          className="text-xl sm:text-2xl font-bold text-white"
        >
          More Like This
        </h2>

        {/* Mobile: snap-scroll */}
        <div className="md:hidden -mx-4 px-4">
          <div
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
            role="list"
          >
            {items.map((k) => (
              <div
                key={k.product.id}
                role="listitem"
                className="snap-start flex-shrink-0"
                style={{ width: 'min(72vw, 280px)' }}
              >
                <ProductMiniCard scored={k} />
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: grid */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((k) => (
            <ProductMiniCard key={k.product.id} scored={k} />
          ))}
        </div>
      </section>
    );
  },
);

MoreLikeThis.displayName = 'MoreLikeThis';

export default MoreLikeThis;

// ─── Карточка ───

const ProductMiniCard = memo(({ scored }: { scored: Scored }) => {
  const { product, sameDeveloper } = scored;
  const slug = productSlug(product);

  return (
    <Link
      to={`/product/${slug}`}
      className="group block rounded-xl overflow-hidden border border-white/10 bg-[#12121F] hover:border-white/20 hover:bg-[#161626] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4facfe]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[#0A0A0F]">
        <img
          src={product.image}
          alt=""
          aria-hidden
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {sameDeveloper && (
          <span className="absolute top-2 left-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#4facfe]/90 text-white">
            By same developer
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="font-medium text-white text-sm leading-tight line-clamp-1" title={product.name}>
          {product.name}
        </div>
        <div className="mt-0.5 text-xs text-gray-500 truncate">{product.developer}</div>

        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-gray-400 min-w-0">
            <span className="inline-flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-current" />
              <span className="tabular-nums">{product.rating.toFixed(1)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span className="tabular-nums">{formatDownloads(product.downloads)}</span>
            </span>
          </div>
          <span className="font-semibold text-white tabular-nums">
            {product.price} <span className="text-gray-500">TON</span>
          </span>
        </div>
      </div>
    </Link>
  );
});

ProductMiniCard.displayName = 'ProductMiniCard';

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US');
}
