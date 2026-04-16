import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Package, Users, Star, Download } from 'lucide-react';
import { formatDownloads } from '../../domain/marketplace/platformIcons';
import type { CatalogListingProduct } from '../../domain/marketplace/types';

interface HomeStatsBarProps {
  products: CatalogListingProduct[];
}

const HomeStatsBar = memo(({ products }: HomeStatsBarProps) => {
  const stats = useMemo(() => {
    const creators = new Set(products.map((p) => p.developer));
    const totalDownloads = products.reduce((s, p) => s + p.downloads, 0);
    const avg =
      products.length === 0
        ? 0
        : products.reduce((s, p) => s + p.rating, 0) / products.length;

    return [
      {
        icon: Package,
        label: 'Artifacts',
        value: String(products.length),
        color: '#00F5FF',
      },
      {
        icon: Users,
        label: 'Demiurges',
        value: String(creators.size),
        color: '#8B5CF6',
      },
      {
        icon: Star,
        label: 'Avg Resonance',
        value: avg.toFixed(1),
        color: '#FFD700',
      },
      {
        icon: Download,
        label: 'Summoned',
        value: formatDownloads(totalDownloads),
        color: '#00FF88',
      },
    ];
  }, [products]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3"
    >
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 + i * 0.08 }}
          className="relative group flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0D0D1A]/70 border border-white/5 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-white/10"
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: `radial-gradient(circle at left center, ${s.color}12, transparent 60%)`,
            }}
          />
          <div
            className="relative w-9 h-9 rounded-lg flex items-center justify-center border flex-shrink-0"
            style={{
              borderColor: `${s.color}30`,
              background: `radial-gradient(circle, ${s.color}15, transparent 70%)`,
              boxShadow: `0 0 12px ${s.color}20`,
            }}
          >
            <s.icon className="w-4 h-4" style={{ color: s.color }} />
          </div>
          <div className="relative min-w-0">
            <div
              className="text-lg sm:text-xl font-black tabular-nums leading-none text-white"
              style={{ textShadow: `0 0 10px ${s.color}40` }}
            >
              {s.value}
            </div>
            <div
              className="text-[9px] font-bold uppercase tracking-[0.22em] mt-1 truncate"
              style={{ color: `${s.color}CC` }}
            >
              {s.label}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
});

HomeStatsBar.displayName = 'HomeStatsBar';

export default HomeStatsBar;
