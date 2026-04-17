import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Breadcrumbs with a subtle gold accent.
 * The first item is always "Store" (link to /), the last is the current page (no link).
 */
const Breadcrumbs = memo(({ items }: BreadcrumbsProps) => {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm flex-wrap py-3 sm:py-4"
    >
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-gray-500 hover:text-[#FFD700] transition-colors"
        aria-label="Store"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Store</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={`${item.label}-${index}`} className="contents">
            <ChevronRight
              className="w-3 h-3 text-[#FFD700]/30 flex-shrink-0"
              aria-hidden
            />
            {isLast || !item.to ? (
              <span
                className="text-gray-300 truncate max-w-[200px] sm:max-w-[300px]"
                aria-current={isLast ? 'page' : undefined}
                title={item.label}
              >
                {item.label}
              </span>
            ) : (
              <Link
                to={item.to}
                className="text-gray-500 hover:text-[#FFD700] transition-colors truncate max-w-[200px]"
                title={item.label}
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
});

Breadcrumbs.displayName = 'Breadcrumbs';

export default Breadcrumbs;
