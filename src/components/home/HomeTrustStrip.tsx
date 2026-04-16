import { memo } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, BadgeCheck, Coins } from 'lucide-react';
import { HOME_NEON } from './homeConstants';

interface TrustItem {
  icon: typeof ShieldCheck;
  label: string;
  sub: string;
  color: string;
}

const ITEMS: TrustItem[] = [
  {
    icon: ShieldCheck,
    label: 'Smart-Contract Escrow',
    sub: 'Funds locked on-chain',
    color: HOME_NEON.emerald,
  },
  {
    icon: Zap,
    label: 'Instant TON Delivery',
    sub: 'Seconds to download',
    color: HOME_NEON.cyan,
  },
  {
    icon: BadgeCheck,
    label: 'Verified Creators',
    sub: 'Real demiurges, no bots',
    color: HOME_NEON.violet,
  },
  {
    icon: Coins,
    label: 'Zero Hidden Fees',
    sub: 'Creator keeps the yield',
    color: HOME_NEON.gold,
  },
];

const HomeTrustStrip = memo(() => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/5 bg-gradient-to-r from-[#0D0D1A]/80 via-[#12121F]/80 to-[#0D0D1A]/80 backdrop-blur-sm px-3 sm:px-5 py-3 sm:py-4 overflow-hidden"
    >
      {/* Очень тонкая сакральная подложка */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, rgba(255,215,0,0.4), transparent 40%), radial-gradient(circle at 80% 50%, rgba(0,245,255,0.4), transparent 40%)',
        }}
      />

      {ITEMS.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
            className="relative flex items-center gap-2.5 min-w-0"
          >
            <div
              className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center border"
              style={{
                borderColor: `${item.color}30`,
                background: `radial-gradient(circle, ${item.color}18, transparent 70%)`,
                boxShadow: `0 0 10px ${item.color}20`,
              }}
            >
              <Icon
                className="w-4 h-4"
                style={{ color: item.color }}
                strokeWidth={2.25}
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <div
                className="text-[11px] sm:text-xs font-bold text-white leading-tight truncate"
                style={{ textShadow: `0 0 8px ${item.color}30` }}
              >
                {item.label}
              </div>
              <div className="text-[9px] sm:text-[10px] text-gray-500 leading-tight truncate uppercase tracking-wider">
                {item.sub}
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
});

HomeTrustStrip.displayName = 'HomeTrustStrip';

export default HomeTrustStrip;
