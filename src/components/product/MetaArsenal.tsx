import { memo } from 'react';
import {
  Tag,
  Hash,
  HardDrive,
  Clock,
  Monitor,
  Cpu as CpuIcon,
} from 'lucide-react';
import SacredDivider from '../developer/SacredDivider';
import type { ProductDetail } from '../../domain/marketplace/types';

interface MetaArsenalProps {
  product: ProductDetail;
}

const PLATFORM_COLORS: Record<string, string> = {
  ios: '#00F5FF',
  android: '#00FF88',
  web: '#8B5CF6',
  windows: '#00F5FF',
  mac: '#FFD700',
  macos: '#FFD700',
  linux: '#FF00FF',
  ton: '#00F5FF',
};

function platformColor(name: string): string {
  const key = name.toLowerCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(PLATFORM_COLORS)) {
    if (key.includes(k)) return v;
  }
  return '#8B5CF6';
}

/**
 * Метаданные артефакта как 5 рун в сетке: category, version, size, updated, platforms.
 * Requirements идёт отдельной строкой ниже как «заповедь алтаря».
 */
const MetaArsenal = memo(({ product }: MetaArsenalProps) => {
  const runes = [
    { icon: Tag, label: 'Category', value: product.category, color: '#00F5FF' },
    { icon: Hash, label: 'Version', value: product.version, color: '#FFD700' },
    { icon: HardDrive, label: 'Size', value: product.size, color: '#8B5CF6' },
    { icon: Clock, label: 'Updated', value: product.lastUpdated, color: '#00FF88' },
  ];

  return (
    <section aria-label="Технические метаданные" className="relative">
      <SacredDivider label="META ARSENAL" color="#8B5CF6" icon="◈" />

      {/* 4 основные руны */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {runes.map((r) => (
          <div
            key={r.label}
            className="relative rounded-xl border backdrop-blur-sm px-3 py-2.5 overflow-hidden"
            style={{
              borderColor: `${r.color}30`,
              background: 'rgba(13,13,26,0.6)',
              boxShadow: `inset 0 0 16px ${r.color}08`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <r.icon
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: r.color, filter: `drop-shadow(0 0 4px ${r.color})` }}
              />
              <span
                className="text-[9px] font-black uppercase tracking-[0.22em]"
                style={{ color: `${r.color}CC` }}
              >
                {r.label}
              </span>
            </div>
            <div className="text-sm font-bold text-white tabular-nums truncate" title={r.value}>
              {r.value}
            </div>
          </div>
        ))}
      </div>

      {/* Platforms */}
      {product.platforms.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="w-3.5 h-3.5 text-[#FF00FF]" />
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-[#FF00FF]/90">
              Platforms
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {product.platforms.map((platform) => {
              const color = platformColor(platform);
              return (
                <span
                  key={platform}
                  className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border"
                  style={{
                    color,
                    borderColor: `${color}50`,
                    background: `${color}12`,
                    textShadow: `0 0 6px ${color}55`,
                  }}
                >
                  {platform}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Requirements — заповедь алтаря */}
      {product.requirements && (
        <div
          className="relative rounded-xl border border-[#FFD700]/15 bg-[#0D0D1A]/60 backdrop-blur-sm px-4 py-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <CpuIcon className="w-3.5 h-3.5 text-[#FFD700]" />
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-[#FFD700]/80">
              Requirements
            </span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">{product.requirements}</p>
        </div>
      )}
    </section>
  );
});

MetaArsenal.displayName = 'MetaArsenal';

export default MetaArsenal;
