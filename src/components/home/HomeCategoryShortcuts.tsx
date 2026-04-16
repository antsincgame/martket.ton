import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CATEGORY_ICONS } from '../../domain/marketplace/categoryIcons';
import { HOME_NEON } from './homeConstants';
import type { HomeCategorySummary, HomeCategorySlug } from '../../domain/marketplace/types';

interface HomeCategoryShortcutsProps {
  categories: HomeCategorySummary[];
  /** Если передан — клик зовёт фильтр; иначе скроллит к StoreBrowser. */
  onPick?: (slug: HomeCategorySlug) => void;
}

const SHORTCUT_LIMIT = 6;

/** Цветовое колесо для категорий — стабильное по slug. */
const CATEGORY_ACCENT: Record<string, string> = {
  apps: HOME_NEON.cyan,
  games: HOME_NEON.magenta,
  ai: HOME_NEON.violet,
  'developer-tools': HOME_NEON.gold,
  design: '#FF6B35',
  defi: HOME_NEON.emerald,
  education: HOME_NEON.cyan,
  security: HOME_NEON.emerald,
  media: HOME_NEON.magenta,
  social: HOME_NEON.violet,
  health: HOME_NEON.emerald,
  utilities: HOME_NEON.gold,
};

const HomeCategoryShortcuts = memo(({ categories, onPick }: HomeCategoryShortcutsProps) => {
  const top = useMemo(
    () =>
      [...categories]
        .sort((a, b) => b.count - a.count)
        .slice(0, SHORTCUT_LIMIT),
    [categories],
  );

  if (top.length === 0) return null;

  return (
    <section aria-label="Browse by category" className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-gray-400">
          Choose Your Realm
        </h2>
        <span className="text-[10px] text-gray-600 uppercase tracking-widest">
          {categories.length} realms
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
        {top.map((cat, i) => {
          const Icon = CATEGORY_ICONS[cat.slug];
          const color = CATEGORY_ACCENT[cat.slug] ?? HOME_NEON.cyan;

          const content = (
            <>
              <div
                aria-hidden
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at center, ${color}14, transparent 70%)`,
                }}
              />
              <div
                aria-hidden
                className="absolute -inset-[1px] rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${color}, transparent 70%)`,
                  maskImage:
                    'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                  padding: 1,
                }}
              />

              <div
                className="relative flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl border mb-2 transition-all duration-300 group-hover:scale-110"
                style={{
                  borderColor: `${color}30`,
                  background: `radial-gradient(circle, ${color}15, transparent 70%)`,
                  boxShadow: `0 0 14px ${color}20`,
                }}
              >
                <Icon
                  className="w-4 h-4 sm:w-5 sm:h-5 transition-colors"
                  style={{ color }}
                  strokeWidth={2.25}
                  aria-hidden
                />
              </div>

              <div
                className="relative text-[11px] sm:text-sm font-semibold text-center leading-tight truncate max-w-full text-gray-200 group-hover:text-white transition-colors"
              >
                {cat.name}
              </div>
              <div className="relative text-[9px] sm:text-[10px] text-gray-600 group-hover:text-gray-400 mt-0.5 tabular-nums transition-colors">
                {cat.count}
              </div>
            </>
          );

          const common =
            'group relative flex flex-col items-center justify-center aspect-square rounded-xl sm:rounded-2xl bg-[#0D0D1A]/60 border border-white/5 backdrop-blur-sm overflow-hidden px-2 transition-all duration-300 hover:border-white/15 hover:bg-[#12121F]/80';

          return (
            <motion.div
              key={cat.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
            >
              {onPick ? (
                <button
                  type="button"
                  onClick={() => onPick(cat.slug)}
                  className={`${common} w-full`}
                  aria-label={`Browse ${cat.name}`}
                >
                  {content}
                </button>
              ) : (
                <Link
                  to={`/category/${cat.slug}`}
                  className={common}
                  aria-label={`Browse ${cat.name}`}
                >
                  {content}
                </Link>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
});

HomeCategoryShortcuts.displayName = 'HomeCategoryShortcuts';

export default HomeCategoryShortcuts;
