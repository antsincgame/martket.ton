import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';

interface ProductGalleryProps {
  images: string[];
  productName: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/**
 * Галерея в стиле Steam/Epic: главный кадр + thumb strip + lightbox.
 * Чистая стилизация без неоновых украшений.
 */
const ProductGallery = memo(
  ({ images, productName, selectedIndex, onSelect }: ProductGalleryProps) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);

    const safeIndex = useMemo(
      () => Math.max(0, Math.min(selectedIndex, Math.max(images.length - 1, 0))),
      [selectedIndex, images.length],
    );

    const prev = useCallback(() => {
      if (images.length === 0) return;
      onSelect((safeIndex - 1 + images.length) % images.length);
    }, [safeIndex, images.length, onSelect]);

    const next = useCallback(() => {
      if (images.length === 0) return;
      onSelect((safeIndex + 1) % images.length);
    }, [safeIndex, images.length, onSelect]);

    useEffect(() => {
      if (!lightboxOpen) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setLightboxOpen(false);
        else if (e.key === 'ArrowLeft') prev();
        else if (e.key === 'ArrowRight') next();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [lightboxOpen, prev, next]);

    useEffect(() => {
      if (!lightboxOpen) return;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }, [lightboxOpen]);

    if (images.length === 0) return null;

    return (
      <div>
        {/* Главный кадр */}
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label="Открыть галерею"
          className="group relative block w-full aspect-video rounded-xl overflow-hidden bg-[#1A1A2E] border border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4facfe]"
        >
          <motion.img
            key={`main-${safeIndex}`}
            src={images[safeIndex]}
            alt={`${productName} — скриншот ${safeIndex + 1}`}
            className="w-full h-full object-cover"
            loading="eager"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />

          <span
            className="absolute bottom-3 right-3 w-10 h-10 rounded-md flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden
          >
            <Maximize2 className="w-4 h-4" />
          </span>

          {images.length > 1 && (
            <span
              className="absolute top-3 right-3 px-2 py-0.5 rounded text-[11px] font-medium tabular-nums bg-black/60 text-white"
              aria-hidden
            >
              {safeIndex + 1} / {images.length}
            </span>
          )}
        </button>

        {/* Превью-полоса (desktop + tablet) */}
        {images.length > 1 && (
          <div
            className="hidden sm:flex gap-2 overflow-x-auto scrollbar-hide mt-3 pb-1"
            role="tablist"
            aria-label="Скриншоты"
          >
            {images.map((image, index) => {
              const active = index === safeIndex;
              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`Кадр ${index + 1}`}
                  onClick={() => onSelect(index)}
                  className={[
                    'flex-shrink-0 w-28 h-16 rounded-md overflow-hidden border-2 transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4facfe]',
                    active ? 'border-[#4facfe]' : 'border-white/10 hover:border-white/30 opacity-70 hover:opacity-100',
                  ].join(' ')}
                >
                  <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              );
            })}
          </div>
        )}

        {/* Mobile: dots-indicator */}
        {images.length > 1 && (
          <div className="sm:hidden flex items-center justify-center gap-1.5 mt-3" aria-hidden>
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSelect(index)}
                aria-label={`Кадр ${index + 1}`}
                className={[
                  'rounded-full transition-all',
                  index === safeIndex
                    ? 'w-6 h-1.5 bg-[#4facfe]'
                    : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50',
                ].join(' ')}
              />
            ))}
          </div>
        )}

        {/* Lightbox */}
        {typeof document !== 'undefined' &&
          createPortal(
            <AnimatePresence>
              {lightboxOpen && (
                <motion.div
                  key="lightbox"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 sm:p-8"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Галерея ${productName}`}
                  onClick={() => setLightboxOpen(false)}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxOpen(false);
                    }}
                    aria-label="Закрыть"
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {images.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        prev();
                      }}
                      aria-label="Предыдущий"
                      className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}
                  {images.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        next();
                      }}
                      aria-label="Следующий"
                      className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  )}

                  <motion.img
                    key={`lb-${safeIndex}`}
                    src={images[safeIndex]}
                    alt={`${productName} — кадр ${safeIndex + 1}`}
                    className="max-h-[88vh] max-w-full rounded-lg select-none"
                    draggable={false}
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    drag={images.length > 1 ? 'x' : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.22}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -60) next();
                      else if (info.offset.x > 60) prev();
                    }}
                  />

                  {images.length > 1 && (
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-xs text-white tabular-nums">
                      {safeIndex + 1} / {images.length}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}
      </div>
    );
  },
);

ProductGallery.displayName = 'ProductGallery';

export default ProductGallery;
