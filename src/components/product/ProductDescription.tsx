import { memo, useState } from 'react';
import { Link } from 'react-router-dom';

interface ProductDescriptionProps {
  longDescription: string;
  tags: string[];
}

const READ_MORE_THRESHOLD = 640;

/**
 * Описание товара в стиле Steam/Epic/App Store:
 * h2 "About this app" → текст → Read More → tags без glow.
 */
const ProductDescription = memo(({ longDescription, tags }: ProductDescriptionProps) => {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = longDescription.length > READ_MORE_THRESHOLD;
  const showFullText = !hasOverflow || expanded;

  return (
    <section aria-labelledby="about-heading" className="space-y-4">
      <h2
        id="about-heading"
        className="text-xl sm:text-2xl font-bold text-white"
      >
        About this app
      </h2>

      <div className="relative">
        <div
          className={[
            'text-gray-300 leading-relaxed text-[15px] whitespace-pre-line',
            !showFullText ? 'max-h-[260px] overflow-hidden' : '',
          ].join(' ')}
        >
          {longDescription}
        </div>

        {!showFullText && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0A0A0F] to-transparent"
            aria-hidden
          />
        )}
      </div>

      {hasOverflow && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="text-sm font-medium text-[#4facfe] hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4facfe] rounded"
        >
          {expanded ? 'Show Less' : 'Read More'}
        </button>
      )}

      {tags.length > 0 && (
        <div className="pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Tags
          </h3>
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <Link
                  to={`/category/apps?tag=${encodeURIComponent(tag)}`}
                  className="inline-flex items-center px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 hover:text-white hover:border-white/20 transition-colors"
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
});

ProductDescription.displayName = 'ProductDescription';

export default ProductDescription;
