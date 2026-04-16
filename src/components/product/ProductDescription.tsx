import { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

interface ProductDescriptionProps {
  longDescription: string;
  tags: string[];
}

const READ_MORE_THRESHOLD = 640;

/**
 * Описание товара (Steam/Epic/App Store style):
 * h2 "About this app" → rich text (bold, links) → Read More → tags.
 */
const ProductDescription = memo(({ longDescription, tags }: ProductDescriptionProps) => {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = longDescription.length > READ_MORE_THRESHOLD;
  const showFullText = !hasOverflow || expanded;

  const rendered = useMemo(() => renderRichText(longDescription), [longDescription]);

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
            'prose-product text-gray-300 leading-relaxed text-[15px]',
            !showFullText ? 'max-h-[260px] overflow-hidden' : '',
          ].join(' ')}
          dangerouslySetInnerHTML={{ __html: rendered }}
        />

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

// ─── Lightweight rich-text renderer ───

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a subset of Markdown into safe HTML:
 * - **bold** → <strong>
 * - [link text](url) → <a>
 * - Lines starting with `- ` → <li> inside <ul>
 * - Empty lines → paragraph breaks
 */
function renderRichText(raw: string): string {
  const lines = raw.split('\n');
  const parts: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      if (inList) {
        parts.push('</ul>');
        inList = false;
      }
      parts.push('<div class="h-3" aria-hidden="true"></div>');
      continue;
    }

    if (trimmed.startsWith('- ')) {
      if (!inList) {
        parts.push('<ul class="space-y-1.5 pl-1">');
        inList = true;
      }
      parts.push(
        `<li class="flex gap-2 items-start"><span class="text-gray-600 mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-gray-500 inline-block" aria-hidden="true"></span><span>${inlineFormat(escapeHtml(trimmed.slice(2)))}</span></li>`,
      );
      continue;
    }

    if (inList) {
      parts.push('</ul>');
      inList = false;
    }

    parts.push(`<p>${inlineFormat(escapeHtml(trimmed))}</p>`);
  }

  if (inList) parts.push('</ul>');

  return parts.join('');
}

function inlineFormat(html: string): string {
  // **bold**
  let result = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  // [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#4facfe] hover:underline underline-offset-2">$1</a>',
  );
  return result;
}
