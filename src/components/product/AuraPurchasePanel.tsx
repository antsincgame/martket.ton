import { memo, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Heart, Share2, Shield, Gem, Cpu, Hash, Lock, Check, Zap } from 'lucide-react';
import SacredFrame from '../developer/SacredFrame';

interface AuraPurchasePanelProps {
  priceTon: number;
  /** Название артефакта — для share. */
  productName: string;
  /** Слот под TonForge checkout — вставляется ниже цены. */
  checkoutSlot: ReactNode;
}

interface GuaranteeRune {
  icon: typeof Shield;
  label: string;
  color: string;
}

const GUARANTEES: GuaranteeRune[] = [
  { icon: Shield, label: '72h escrow & dispute', color: '#00FF88' },
  { icon: Hash, label: 'SHA-256 & malware scan', color: '#00F5FF' },
  { icon: Gem, label: 'NFT lifetime entitlement', color: '#8B5CF6' },
  { icon: Cpu, label: 'Device-bound activation', color: '#FF00FF' },
  { icon: Lock, label: 'Treasury-custody trial', color: '#FFD700' },
];

/**
 * Sticky-сайдбар продукта: пульсирующая золотая цена, руны-гарантии,
 * wishlist/share-акценты. TonForge checkout встраивается как слот.
 */
const AuraPurchasePanel = memo(
  ({ priceTon, productName, checkoutSlot }: AuraPurchasePanelProps) => {
    const reduce = useReducedMotion();
    const [wished, setWished] = useState(false);
    const [shared, setShared] = useState(false);

    const handleShare = async () => {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      try {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title: productName, url });
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          setShared(true);
          window.setTimeout(() => setShared(false), 2000);
        }
      } catch {
        // share отменён пользователем — не шумим
      }
    };

    return (
      <SacredFrame color="#FFD700" className="overflow-hidden">
        {/* Пульсирующая золотая аура на фоне блока */}
        {!reduce && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl animate-aura-pulse"
            style={{
              background:
                'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(255,215,0,0.18), transparent 70%)',
            }}
          />
        )}

        <div className="relative p-6">
          {/* Цена */}
          <div className="text-center mb-5">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-[#FFD700]" />
              <motion.div
                className="text-4xl font-display font-black tabular-nums"
                style={{
                  background: 'linear-gradient(180deg, #FFE066 0%, #FFD700 50%, #F4A836 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 32px rgba(255,215,0,0.35)',
                }}
                initial={reduce ? undefined : { scale: 0.98 }}
                animate={reduce ? undefined : { scale: [0.98, 1.02, 0.98] }}
                transition={reduce ? undefined : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                {priceTon}
              </motion.div>
              <span className="text-lg font-bold text-[#FFD700] tracking-widest">TON</span>
            </div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mt-1">
              Escrow holds until you approve
            </p>
          </div>

          {/* TonForge checkout slot */}
          <div className="mb-5">{checkoutSlot}</div>

          {/* Руны-гарантии */}
          <div className="pt-5 border-t border-[#FFD700]/10">
            <div className="text-[9px] uppercase tracking-[0.35em] text-[#FFD700]/80 mb-3 text-center font-black">
              Temple Guarantees
            </div>
            <ul className="space-y-2">
              {GUARANTEES.map((g) => (
                <li
                  key={g.label}
                  className="flex items-center gap-2.5 text-[11px] text-gray-400"
                >
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center border"
                    style={{
                      borderColor: `${g.color}40`,
                      background: `${g.color}12`,
                      boxShadow: `inset 0 0 8px ${g.color}20`,
                    }}
                  >
                    <g.icon
                      className="w-3.5 h-3.5"
                      style={{ color: g.color, filter: `drop-shadow(0 0 4px ${g.color})` }}
                    />
                  </span>
                  <span className="tracking-wide">{g.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Wishlist / Share */}
          <div className="flex items-center justify-center gap-3 mt-5 pt-5 border-t border-white/5">
            <button
              type="button"
              onClick={() => setWished((v) => !v)}
              aria-pressed={wished}
              aria-label={wished ? 'Убрать из желаемого' : 'В желаемое'}
              className={[
                'w-11 h-11 rounded-full flex items-center justify-center border transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]',
                wished
                  ? 'bg-[#FF00FF]/15 border-[#FF00FF]/60 text-[#FF00FF] shadow-[0_0_18px_rgba(255,0,255,0.4)]'
                  : 'bg-[#0D0D1A]/60 border-white/10 text-gray-400 hover:border-[#FF00FF]/40 hover:text-[#FF00FF]',
              ].join(' ')}
            >
              <Heart
                className="w-4 h-4"
                fill={wished ? 'currentColor' : 'none'}
                strokeWidth={wished ? 2 : 2}
              />
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              aria-label="Поделиться"
              className="w-11 h-11 rounded-full flex items-center justify-center border bg-[#0D0D1A]/60 border-white/10 text-gray-400 hover:border-[#00F5FF]/40 hover:text-[#00F5FF] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F5FF]"
            >
              {shared ? <Check className="w-4 h-4 text-[#00FF88]" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </SacredFrame>
    );
  },
);

AuraPurchasePanel.displayName = 'AuraPurchasePanel';

export default AuraPurchasePanel;
