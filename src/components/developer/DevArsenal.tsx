import { memo, useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles, Package } from 'lucide-react';
import type {
  PublicDeveloperProfile,
  CatalogListingProduct,
} from '../../domain/marketplace/types';
import ProductCard from '../ProductCard';
import SteamProductRow from '../SteamProductRow';
import SacredDivider from './SacredDivider';
import SacredFrame from './SacredFrame';

const PAGE_SIZE = 20;

interface DevArsenalProps {
  profile: PublicDeveloperProfile;
}

const DevArsenal = memo(({ profile }: DevArsenalProps) => {
  const [page, setPage] = useState(0);
  const [hoveredProduct, setHoveredProduct] = useState<CatalogListingProduct | null>(null);

  const featuredProducts = useMemo(() => {
    if (profile.featuredProductIds.length === 0) return profile.products.slice(0, 4);
    return profile.featuredProductIds
      .map((id) => profile.products.find((p) => p.id === id))
      .filter(Boolean) as CatalogListingProduct[];
  }, [profile]);

  const totalPages = Math.max(1, Math.ceil(profile.products.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageProducts = profile.products.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleHover = useCallback((p: CatalogListingProduct) => setHoveredProduct(p), []);
  const handleHoverEnd = useCallback(() => setHoveredProduct(null), []);

  return (
    <div className="space-y-14">
      {/* ═══ Featured ═══ */}
      {featuredProducts.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <SacredDivider label="Featured Relics" color="#FFD700" icon="✦" />

          <div className="relative">
            {/* Animated conic-gradient border aura */}
            <div
              aria-hidden
              className="absolute -inset-[2px] rounded-3xl opacity-40 blur-sm"
              style={{
                background:
                  'conic-gradient(from 0deg, #FFD70040, transparent 25%, #00F5FF30, transparent 50%, #FF00FF30, transparent 75%, #FFD70040)',
              }}
            />
            <SacredFrame color="#FFD700" className="relative p-5 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {featuredProducts.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.08, duration: 0.5 }}
                    className="relative group"
                  >
                    {/* Featured glyph */}
                    <div className="absolute -top-2 -right-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#FFD700] to-[#F4A836] shadow-[0_0_12px_rgba(255,215,0,0.5)]">
                      <Sparkles className="w-2.5 h-2.5 text-[#0A0A0F]" strokeWidth={3} />
                      <span className="text-[9px] font-black uppercase tracking-wider text-[#0A0A0F]">
                        Relic
                      </span>
                    </div>
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </div>
            </SacredFrame>
          </div>
        </motion.section>
      )}

      {/* ═══ All Products (Arsenal) ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <SacredDivider
          label={`Arsenal · ${profile.products.length} Artifacts`}
          color="#00F5FF"
          icon="◈"
        />

        <SacredFrame color="#00F5FF" className="overflow-hidden">
          {pageProducts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Package className="w-8 h-8 text-[#00F5FF]/30 mb-3" />
              <p className="text-gray-500 text-sm">The demiurge's forge is silent for now.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {pageProducts.map((product) => (
                <SteamProductRow
                  key={product.id}
                  product={product}
                  isActive={hoveredProduct?.id === product.id}
                  onHover={handleHover}
                  onHoverEnd={handleHoverEnd}
                />
              ))}
            </div>
          )}
        </SacredFrame>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              disabled={safePage === 0}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
              className="group p-2.5 rounded-xl bg-[#0D0D1A] border border-[#00F5FF]/20 text-[#00F5FF]/60 hover:text-[#00F5FF] hover:border-[#00F5FF]/60 hover:shadow-[0_0_16px_rgba(0,245,255,0.25)] disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D0D1A] border border-white/5">
              <span className="text-[#00F5FF] font-bold tabular-nums text-sm">{safePage + 1}</span>
              <span className="text-gray-600 text-xs">/</span>
              <span className="text-gray-400 tabular-nums text-sm">{totalPages}</span>
            </div>
            <button
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
              className="group p-2.5 rounded-xl bg-[#0D0D1A] border border-[#00F5FF]/20 text-[#00F5FF]/60 hover:text-[#00F5FF] hover:border-[#00F5FF]/60 hover:shadow-[0_0_16px_rgba(0,245,255,0.25)] disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </motion.section>
    </div>
  );
});

DevArsenal.displayName = 'DevArsenal';

export default DevArsenal;
