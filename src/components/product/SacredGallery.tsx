import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';

interface SacredGalleryProps {
  images: string[];
  productName: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/**
 * Священная галерея скриншотов:
 * - главное изображение в неоновой раме с sweep-hover
 * - horizontal scroll превьюшек с активной goldglow-рамкой
 * - lightbox через Portal с ESC/стрелками/клик по фону
 */
const SacredGallery = memo(
  ({ images, productName, selectedIndex, onSelect }: SacredGalleryProps) => {
    const reduce = useReducedMotion();
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

    // Клавиши работают и в lightbox, и на странице
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

    // Блокируем скролл body, когда lightbox открыт
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
        {/* ═══ Главный кадр ═══ */}
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label="Открыть галерею в полный экран"
          className="group relative block w-full aspect-video rounded-2xl overflow-hidden border border-[#FFD700]/15 bg-[#0A0A0F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
          style={{ boxShadow: 'inset 0 0 60px rgba(0,245,255,0.08)' }}
        >
          <img
            src={images[safeIndex]}
            alt={`${productName} — кадр ${safeIndex + 1}`}
            className={`w-full h-full object-cover transition-transform duration-700 ${
              reduce ? '' : 'group-hover:scale-[1.03]'
            }`}
            loading="lazy"
          />
          {/* Sweep-блик при hover */}
          {!reduce && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background:
                  'linear-gradient(115deg, transparent 30%, rgba(255,215,0,0.18) 50%, transparent 70%)',
                transform: 'translateX(-100%)',
                animation: 'none',
              }}
            />
          )}
          {/* Expand icon */}
          <span
            className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center bg-black/60 backdrop-blur-md border border-[#FFD700]/30 text-[#FFD700] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            aria-hidden
          >
            <Maximize2 className="w-4 h-4" />
          </span>
          {/* Counter */}
          {images.length > 1 && (
            <span
              className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums bg-black/60 backdrop-blur-md border border-white/10 text-gray-300"
              aria-hidden
            >
              {safeIndex + 1} / {images.length}
            </span>
          )}
        </button>

        {/* ═══ Превью-полоса ═══ */}
        {images.length > 1 && (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide mt-3 pb-1" role="tablist" aria-label="Кадры артефакта">
            {images.map((image, index) => {
              const active = index === safeIndex;
              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`Показать кадр ${index + 1}`}
                  onClick={() => onSelect(index)}
                  className="flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                  style={{
                    borderColor: active ? '#FFD700' : 'rgba(255,255,255,0.08)',
                    boxShadow: active ? '0 0 18px rgba(255,215,0,0.35)' : 'none',
                    transform: active ? 'translateY(-2px)' : 'translateY(0)',
                  }}
                >
                  <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              );
            })}
          </div>
        )}

        {/* ═══ Lightbox ═══ */}
        {typeof document !== 'undefined' &&
          createPortal(
            <AnimatePresence>
              {lightboxOpen && (
                <motion.div
                  key="lightbox"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-[100] bg-[#0A0A0F]/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Галерея ${productName}`}
                  onClick={() => setLightboxOpen(false)}
                >
                  {/* Close */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxOpen(false);
                    }}
                    aria-label="Закрыть галерею"
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 w-12 h-12 rounded-full flex items-center justify-center bg-black/60 backdrop-blur-md border border-[#FFD700]/30 text-[#FFD700] hover:border-[#FFD700]/70 hover:bg-[#FFD700]/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Prev */}
                  {images.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        prev();
                      }}
                      aria-label="Предыдущий кадр"
                      className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center bg-black/60 backdrop-blur-md border border-[#00F5FF]/30 text-[#00F5FF] hover:border-[#00F5FF]/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F5FF]"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}
                  {/* Next */}
                  {images.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        next();
                      }}
                      aria-label="Следующий кадр"
                      className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center bg-black/60 backdrop-blur-md border border-[#00F5FF]/30 text-[#00F5FF] hover:border-[#00F5FF]/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F5FF]"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  )}

                  {/* Image with swipe */}
                  <motion.img
                    key={`lb-${safeIndex}`}
                    src={images[safeIndex]}
                    alt={`${productName} — кадр ${safeIndex + 1}`}
                    className="max-h-[85vh] max-w-full rounded-xl shadow-[0_0_60px_rgba(0,245,255,0.25)] select-none"
                    draggable={false}
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    drag={images.length > 1 ? 'x' : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.22}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -60) next();
                      else if (info.offset.x > 60) prev();
                    }}
                  />

                  {/* Caption / counter */}
                  {images.length > 1 && (
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs text-gray-300 tabular-nums">
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

SacredGallery.displayName = 'SacredGallery';

export default SacredGallery;
