import { memo, useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import type {
  PublicDeveloperProfile,
  CatalogListingProduct,
} from '../../domain/marketplace/types';
import SteamProductRow from '../SteamProductRow';
import SacredDivider from './SacredDivider';
import SacredFrame from './SacredFrame';

const PAGE_SIZE = 12;
/** Maximum number of page numbers displayed between Prev/Next. */
const MAX_PAGE_BUTTONS = 5;

interface DevArsenalProps {
  profile: PublicDeveloperProfile;
}

/** Builds an array of displayed page numbers with "…" (null = ellipsis). */
function buildPageNumbers(current: number, total: number): (number | null)[] {
  if (total <= MAX_PAGE_BUTTONS + 2) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const half = Math.floor(MAX_PAGE_BUTTONS / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(total - 2, start + MAX_PAGE_BUTTONS - 1);
  if (end - start < MAX_PAGE_BUTTONS - 1) start = Math.max(1, end - MAX_PAGE_BUTTONS + 1);

  const pages: (number | null)[] = [0];
  if (start > 1) pages.push(null);
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 2) pages.push(null);
  pages.push(total - 1);
  return pages;
}

const DevArsenal = memo(({ profile }: DevArsenalProps) => {
  const [page, setPage] = useState(0);
  const [hoveredProduct, setHoveredProduct] = useState<CatalogListingProduct | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const totalPages = Math.max(1, Math.ceil(profile.products.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageProducts = profile.products.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const goToPage = useCallback(
    (next: number) => {
      setPage(next);
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [],
  );

  const handleHover = useCallback((p: CatalogListingProduct) => setHoveredProduct(p), []);
  const handleHoverEnd = useCallback(() => setHoveredProduct(null), []);

  const pageNumbers = buildPageNumbers(safePage, totalPages);

  return (
    <div className="space-y-14">
      {/* ═══ Arsenal (all products) ═══ */}
      <motion.section
        ref={sectionRef}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <SacredDivider
          label={`Arsenal · ${profile.products.length} Artifact${profile.products.length !== 1 ? 's' : ''}`}
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
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-6 flex-wrap">
            {/* Prev */}
            <button
              disabled={safePage === 0}
              onClick={() => goToPage(safePage - 1)}
              aria-label="Previous page"
              className="p-2.5 rounded-xl bg-[#0D0D1A] border border-[#00F5FF]/20 text-[#00F5FF]/60 hover:text-[#00F5FF] hover:border-[#00F5FF]/60 hover:shadow-[0_0_16px_rgba(0,245,255,0.25)] disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page numbers */}
            {pageNumbers.map((n, idx) =>
              n === null ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1 text-gray-600 text-sm tabular-nums select-none"
                >
                  …
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => goToPage(n)}
                  aria-label={`Page ${n + 1}`}
                  aria-current={n === safePage ? 'page' : undefined}
                  className={[
                    'min-w-[36px] h-9 px-2 rounded-xl text-sm font-bold tabular-nums transition-all duration-200',
                    n === safePage
                      ? 'bg-[#00F5FF]/15 border border-[#00F5FF]/60 text-[#00F5FF] shadow-[0_0_14px_rgba(0,245,255,0.3)]'
                      : 'bg-[#0D0D1A] border border-white/5 text-gray-400 hover:text-[#00F5FF] hover:border-[#00F5FF]/30',
                  ].join(' ')}
                >
                  {n + 1}
                </button>
              ),
            )}

            {/* Next */}
            <button
              disabled={safePage >= totalPages - 1}
              onClick={() => goToPage(safePage + 1)}
              aria-label="Next page"
              className="p-2.5 rounded-xl bg-[#0D0D1A] border border-[#00F5FF]/20 text-[#00F5FF]/60 hover:text-[#00F5FF] hover:border-[#00F5FF]/60 hover:shadow-[0_0_16px_rgba(0,245,255,0.25)] disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300"
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
