import { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Star, Download, Zap, Users } from 'lucide-react';
import SacredDivider from '../developer/SacredDivider';
import {
  getMarketplaceInventoryOnce,
  productSlug,
} from '../../domain/marketplace/marketplaceRemote';
import type { CatalogListingProduct } from '../../domain/marketplace/types';

interface KindredArtifactsProps {
  /** id текущего продукта — исключается из подборки. */
  currentProductId: string;
  /** Категория текущего продукта для скоринга. */
  category: string;
  /** Демиург текущего продукта. */
  developer: string;
  /** Тэги текущего продукта. */
  tags: readonly string[];
}

interface Scored {
  product: CatalogListingProduct;
  score: number;
  sameDeveloper: boolean;
}

const MAX_ITEMS = 6;

/**
 * Похожие артефакты: scoring по developer + category + tags + rating,
 * карточки с hover-lift, мобильный snap-scroll, desktop grid.
 */
const KindredArtifacts = memo(
  ({ currentProductId, category, developer, tags }: KindredArtifactsProps) => {
    const reduce = useReducedMotion();
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

    const kindred = useMemo<Scored[]>(() => {
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
          for (const t of p.tags) {
            if (tagSet.has(t.toLowerCase())) score += 1;
          }
        }
        score += (p.rating || 0) * 0.5;
        if (score > 0) scored.push({ product: p, score, sameDeveloper: sameDev });
      }

      scored.sort((a, b) => b.score - a.score);

      if (scored.length < 3) {
        // Fallback: добираем spotlight/featured
        const existingIds = new Set(scored.map((s) => s.product.id));
        for (const p of all) {
          if (scored.length >= MAX_ITEMS) break;
          if (p.id === currentProductId) continue;
          if (existingIds.has(p.id)) continue;
          if (p.isFeatured) {
            scored.push({ product: p, score: 0, sameDeveloper: false });
            existingIds.add(p.id);
          }
        }
      }

      return scored.slice(0, MAX_ITEMS);
    }, [all, currentProductId, category, developer, tags]);

    if (!all || kindred.length === 0) return null;

    return (
      <section aria-label="Похожие артефакты" className="relative">
        <SacredDivider
          label={`KINDRED ARTIFACTS · ${kindred.length}`}
          color="#8B5CF6"
          icon="⟐"
        />
        <p className="-mt-4 mb-6 text-[11px] uppercase tracking-[0.28em] text-gray-500 text-center">
          Сокровища одной линии силы
        </p>

        {/* ═══ Mobile: snap-scroll ═══ */}
        <div className="md:hidden -mx-4 px-4">
          <div
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
            role="list"
          >
            {kindred.map((k) => (
              <div
                key={k.product.id}
                role="listitem"
                className="snap-center flex-shrink-0"
                style={{ width: 'min(78vw, 300px)' }}
              >
                <KindredCard scored={k} reduce={Boolean(reduce)} />
              </div>
            ))}
          </div>
        </div>

        {/* ═══ Desktop: grid ═══ */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kindred.map((k, idx) => (
            <motion.div
              key={k.product.id}
              initial={reduce ? undefined : { opacity: 0, y: 14 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: idx * 0.06 }}
            >
              <KindredCard scored={k} reduce={Boolean(reduce)} />
            </motion.div>
          ))}
        </div>
      </section>
    );
  },
);

KindredArtifacts.displayName = 'KindredArtifacts';

export default KindredArtifacts;

// ─── Карточка ───

interface KindredCardProps {
  scored: Scored;
  reduce: boolean;
}

const KindredCard = memo(({ scored, reduce }: KindredCardProps) => {
  const { product, sameDeveloper } = scored;
  const slug = productSlug(product);

  return (
    <Link
      to={`/product/${slug}`}
      className="group block relative rounded-2xl overflow-hidden border border-[#FFD700]/10 bg-[#0D0D1A]/70 backdrop-blur-sm transition-all duration-300 hover:border-[#FFD700]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
      style={{
        boxShadow: 'inset 0 0 20px rgba(139,92,246,0.05)',
      }}
    >
      {/* Обложка */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[#0A0A0F]">
        <img
          src={product.image}
          alt=""
          aria-hidden
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-500 ${
            reduce ? '' : 'group-hover:scale-[1.05]'
          }`}
        />

        {/* Нижняя тень */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, transparent 40%, rgba(10,10,15,0.4) 70%, rgba(10,10,15,0.95) 100%)',
          }}
        />

        {/* Sweep-блик */}
        {!reduce && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background:
                'linear-gradient(115deg, transparent 35%, rgba(255,215,0,0.14) 50%, transparent 65%)',
            }}
          />
        )}

        {/* Top-left: категория */}
        <span
          className="absolute top-2 left-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] bg-black/65 backdrop-blur-md border border-[#00F5FF]/40 text-[#00F5FF]"
          style={{ textShadow: '0 0 6px rgba(0,245,255,0.4)' }}
        >
          {product.category}
        </span>

        {/* Top-right: rating */}
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tabular-nums bg-black/65 backdrop-blur-md border border-[#FFD700]/35 text-[#FFD700]">
          <Star className="w-2.5 h-2.5 fill-current" />
          {product.rating.toFixed(1)}
        </span>

        {/* Badge: by same demiurge */}
        {sameDeveloper && (
          <span
            className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] bg-black/75 backdrop-blur-md border border-[#FF00FF]/50 text-[#FF00FF]"
            style={{ textShadow: '0 0 6px rgba(255,0,255,0.5)' }}
          >
            <Users className="w-2.5 h-2.5" />
            Same Demiurge
          </span>
        )}
      </div>

      {/* Тело */}
      <div className="p-3">
        <div
          className="font-display font-bold text-white text-sm leading-tight truncate"
          title={product.name}
        >
          {product.name}
        </div>
        <div className="mt-0.5 text-[11px] text-gray-500 truncate">by {product.developer}</div>

        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-gray-400">
            <Download className="w-3 h-3" />
            <span className="tabular-nums">{product.downloads.toLocaleString('en-US')}</span>
          </span>
          <span
            className="inline-flex items-center gap-1 font-bold tabular-nums"
            style={{ color: '#FFD700', textShadow: '0 0 8px rgba(255,215,0,0.45)' }}
          >
            <Zap className="w-3 h-3" />
            {product.price} TON
          </span>
        </div>
      </div>
    </Link>
  );
});

KindredCard.displayName = 'KindredCard';
