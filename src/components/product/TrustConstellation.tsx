import { memo, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Shield, Gem, Hash, Cpu } from 'lucide-react';

interface TrustNode {
  id: string;
  icon: typeof Shield;
  title: string;
  caption: string;
  color: string;
}

const NODES: TrustNode[] = [
  {
    id: 'curated',
    icon: Sparkles,
    title: 'Hand-Curated',
    caption: 'Проверено куратором вручную',
    color: '#FFD700',
  },
  {
    id: 'escrow',
    icon: Shield,
    title: 'Escrow 72h',
    caption: 'Средства под замком до приёмки',
    color: '#00FF88',
  },
  {
    id: 'nft',
    icon: Gem,
    title: 'NFT Entitlement',
    caption: 'Пожизненная лицензия в блокчейне',
    color: '#8B5CF6',
  },
  {
    id: 'sha',
    icon: Hash,
    title: 'SHA-256 Verified',
    caption: 'Хеш и антивирус-скан',
    color: '#00F5FF',
  },
  {
    id: 'device',
    icon: Cpu,
    title: 'Device-Bound',
    caption: 'Активация по устройству',
    color: '#FF00FF',
  },
];

/**
 * Созвездие доверия: 5 рун вокруг золотого ядра VERIFIED ARTIFACT.
 * Desktop — круговое расположение с SVG-линиями к ядру.
 * Mobile — компактная сетка 2x3 с тем же ядром наверху.
 */
const TrustConstellation = memo(() => {
  const reduce = useReducedMotion();

  // Позиции узлов на desktop (круг радиуса R вокруг центра 50/50)
  const positions = useMemo(() => {
    const count = NODES.length;
    const R = 42; // % от контейнера
    // Начинаем сверху и идём по часовой
    return NODES.map((_, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
      return {
        x: 50 + R * Math.cos(angle),
        y: 50 + R * Math.sin(angle),
      };
    });
  }, []);

  return (
    <section aria-label="Temple Trust Constellation" className="relative">
      {/* ═══ DESKTOP (md+) — круговое созвездие ═══ */}
      <div className="hidden md:block relative mx-auto" style={{ maxWidth: 780, aspectRatio: '16 / 9' }}>
        {/* SVG-линии от каждой руны к ядру */}
        <svg
          aria-hidden
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            {NODES.map((n, i) => (
              <linearGradient
                key={n.id}
                id={`trust-line-${n.id}`}
                x1={`${positions[i].x}%`}
                y1={`${positions[i].y}%`}
                x2="50%"
                y2="50%"
              >
                <stop offset="0%" stopColor={n.color} stopOpacity="0.55" />
                <stop offset="100%" stopColor="#FFD700" stopOpacity="0.65" />
              </linearGradient>
            ))}
          </defs>
          {NODES.map((n, i) => (
            <line
              key={n.id}
              x1={positions[i].x}
              y1={positions[i].y}
              x2={50}
              y2={50}
              stroke={`url(#trust-line-${n.id})`}
              strokeWidth={0.18}
              vectorEffect="non-scaling-stroke"
              style={{
                strokeDasharray: '0.6 0.4',
              }}
            />
          ))}
        </svg>

        {/* Ядро VERIFIED ARTIFACT */}
        <TrustCore reduce={Boolean(reduce)} />

        {/* Узлы-руны */}
        {NODES.map((n, i) => (
          <motion.div
            key={n.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${positions[i].x}%`, top: `${positions[i].y}%` }}
            initial={reduce ? undefined : { opacity: 0, scale: 0.9 }}
            whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45, delay: 0.1 + i * 0.08 }}
          >
            <TrustRune node={n} />
          </motion.div>
        ))}
      </div>

      {/* ═══ MOBILE (<md) — ядро + сетка 2 колонки ═══ */}
      <div className="md:hidden flex flex-col items-center gap-6">
        <TrustCore reduce={Boolean(reduce)} compact />
        <div className="grid grid-cols-2 gap-3 w-full">
          {NODES.map((n, i) => (
            <motion.div
              key={n.id}
              initial={reduce ? undefined : { opacity: 0, y: 10 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
            >
              <TrustRune node={n} compact />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});

TrustConstellation.displayName = 'TrustConstellation';

export default TrustConstellation;

// ─── Ядро созвездия ───

interface TrustCoreProps {
  reduce: boolean;
  compact?: boolean;
}

function TrustCore({ reduce, compact }: TrustCoreProps) {
  const size = compact ? 120 : 150;

  return (
    <div
      className={
        compact
          ? 'relative flex items-center justify-center'
          : 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center'
      }
      style={{ width: size, height: size }}
    >
      {/* Внешняя пульсирующая аура */}
      {!reduce && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(255,215,0,0.35) 0%, rgba(255,215,0,0) 70%)',
            filter: 'blur(6px)',
          }}
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [0.95, 1.1, 0.95] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Вращающееся кольцо рун */}
      <div
        className={`absolute inset-0 ${reduce ? '' : 'animate-[sacred-rotate-slow_28s_linear_infinite]'}`}
        aria-hidden
      >
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          <circle
            cx="50"
            cy="50"
            r="46"
            stroke="#FFD700"
            strokeOpacity="0.5"
            strokeWidth="0.6"
            strokeDasharray="1 2.5"
          />
          <circle cx="50" cy="4" r="1.3" fill="#FFD700" />
          <circle cx="96" cy="50" r="1" fill="#00F5FF" />
          <circle cx="50" cy="96" r="1.3" fill="#FF00FF" />
          <circle cx="4" cy="50" r="1" fill="#00FF88" />
        </svg>
      </div>

      {/* Внутренний гексагон */}
      <svg
        className="absolute"
        width={size * 0.74}
        height={size * 0.74}
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="coreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFD700" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#F4A836" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <polygon
          points="50,3 93,27 93,73 50,97 7,73 7,27"
          stroke="url(#coreGrad)"
          strokeWidth="1.4"
          fill="rgba(10,10,15,0.88)"
          style={{ filter: 'drop-shadow(0 0 14px rgba(255,215,0,0.55))' }}
        />
      </svg>

      {/* Надпись */}
      <div className="relative z-10 text-center px-3">
        <Shield
          className="w-6 h-6 mx-auto mb-1.5 text-[#FFD700]"
          style={{ filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.9))' }}
        />
        <div
          className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] leading-tight"
          style={{ color: '#FFD700', textShadow: '0 0 10px rgba(255,215,0,0.7)' }}
        >
          Verified
          <br />
          Artifact
        </div>
      </div>
    </div>
  );
}

// ─── Отдельная руна ───

interface TrustRuneProps {
  node: TrustNode;
  compact?: boolean;
}

function TrustRune({ node, compact }: TrustRuneProps) {
  const Icon = node.icon;
  return (
    <div
      className={[
        'relative flex items-center gap-2.5 rounded-xl border backdrop-blur-md transition-transform duration-300',
        compact ? 'px-3 py-2.5' : 'px-3.5 py-2.5 flex-col sm:flex-row text-center sm:text-left min-w-[160px]',
        'hover:scale-[1.04]',
      ].join(' ')}
      style={{
        borderColor: `${node.color}45`,
        background: 'rgba(13,13,26,0.7)',
        boxShadow: `0 0 24px ${node.color}22, inset 0 0 12px ${node.color}0F`,
      }}
      title={node.caption}
    >
      <span
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{
          background: `${node.color}15`,
          border: `1px solid ${node.color}40`,
        }}
      >
        <Icon
          className="w-4 h-4"
          style={{ color: node.color, filter: `drop-shadow(0 0 6px ${node.color})` }}
        />
      </span>
      <div className="min-w-0">
        <div
          className="text-[10px] font-black uppercase tracking-[0.2em] truncate"
          style={{ color: node.color, textShadow: `0 0 6px ${node.color}55` }}
        >
          {node.title}
        </div>
        <div className="text-[10px] text-gray-400 leading-tight truncate">{node.caption}</div>
      </div>
    </div>
  );
}
