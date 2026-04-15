import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ProductCard from './ProductCard';
import type { CatalogListingProduct } from '../domain/marketplace/types';

interface CollectionRowProps {
  title: string;
  icon: LucideIcon;
  products: CatalogListingProduct[];
}

const SCROLL_AMOUNT = 320;

const CollectionRow: React.FC<CollectionRowProps> = ({ title, icon: Icon, products }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateArrows, products]);

  const scroll = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({
      left: direction === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: 'smooth',
    });
  };

  if (products.length === 0) return null;

  return (
    <section className="py-6">
      <div className="flex items-center gap-3 mb-4">
        <Icon className="w-5 h-5 text-[#FFD700]" />
        <h2 className="text-xl font-display font-bold text-white">{title}</h2>
      </div>

      <div className="group relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm border border-white/10 hover:bg-black/80 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
        >
          {products.map((product) => (
            <div key={product.id} className="snap-start flex-shrink-0 w-[260px] sm:w-[280px]">
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm border border-white/10 hover:bg-black/80 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-[#0A0A0A] to-transparent pointer-events-none" />
      </div>
    </section>
  );
};

export default CollectionRow;
