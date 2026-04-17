import { Package, ArrowRight, UserCheck, ExternalLink, Sparkles, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionStatsQuery } from '../../queries/sessionQueries';
import CabinetHero, { type CabinetHeroKpi } from './components/CabinetHero';
import type { CreatedProduct, PurchaseWithProduct } from './types';

interface OverviewProps {
  library: PurchaseWithProduct[];
  myProducts: CreatedProduct[];
  isLoading: boolean;
  dataError?: string | null;
  displayName: string;
}

export default function OverviewSection({
  library,
  myProducts,
  isLoading,
  dataError = null,
  displayName,
}: OverviewProps) {
  const { user } = useAuth();
  const statsQuery = useSessionStatsQuery();
  const stats = statsQuery.data;

  const profileChecks = [
    { label: 'Avatar', done: Boolean(user?.profile?.avatar) },
    { label: 'Bio', done: Boolean(user?.profile?.bio) },
    { label: 'Slug', done: Boolean(user?.profile?.slug) },
    { label: 'Products', done: myProducts.length > 0 },
    { label: 'Banner', done: Boolean(user?.profile?.bannerUrl) },
  ];
  const profilePercent = Math.round((profileChecks.filter((c) => c.done).length / profileChecks.length) * 100);

  const role = user?.role ?? 'demiurge';

  const kpis: CabinetHeroKpi[] = [
    {
      label: 'Загрузки',
      value: stats?.downloadsTotal ?? 0,
      accent: '#00F5FF',
      hint: stats ? `${stats.productsPublished} опубл.` : undefined,
    },
    {
      label: 'Доход 30д',
      value: `${(stats?.revenue30d ?? 0).toFixed(2)} TON`,
      accent: '#FFD700',
      hint: stats ? `${stats.sales30d} продаж` : undefined,
    },
    {
      label: 'На модерации',
      value: stats?.pendingReview ?? 0,
      accent: '#8B5CF6',
      hint: stats?.drafts ? `${stats.drafts} черновиков` : undefined,
    },
    {
      label: 'Библиотека',
      value: stats?.librarySize ?? library.length,
      accent: '#00FF88',
      hint: stats?.avgRating ? `★ ${stats.avgRating.toFixed(1)}` : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <CabinetHero
        displayName={displayName}
        role={role.toString()}
        avatar={user?.profile?.avatar ?? null}
        publicSlug={user?.profile?.slug ?? null}
        kpis={kpis}
      />

      {dataError && <ErrorBanner message={dataError} />}
      {statsQuery.error && <ErrorBanner message={statsQuery.error.message} />}

      <ProfileCompletion
        percent={profilePercent}
        checks={profileChecks}
        slug={user?.profile?.slug ?? null}
      />

      <QuickActions />

      <RecentCreations products={myProducts} isLoading={isLoading} />

      {!isLoading && myProducts.length === 0 && library.length === 0 && <FirstTimeEmptyState />}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

function ProfileCompletion({
  percent,
  checks,
  slug,
}: {
  percent: number;
  checks: { label: string; done: boolean }[];
  slug: string | null;
}) {
  return (
    <div className="rounded-xl border border-[#00F5FF]/15 bg-gradient-to-r from-[#00F5FF]/[0.03] to-transparent p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[#00F5FF]" />
          <h2 className="text-sm font-semibold text-white">Public Profile</h2>
        </div>
        <span
          className="text-xs font-bold tabular-nums"
          style={{ color: percent === 100 ? '#00FF88' : '#FFD700' }}
        >
          {percent}%
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/[0.06] rounded-full mb-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percent}%`,
            background:
              percent === 100
                ? 'linear-gradient(90deg, #00FF88, #00F5FF)'
                : 'linear-gradient(90deg, #FFD700, #F4A836)',
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {checks.map((check) => (
          <span
            key={check.label}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              check.done
                ? 'bg-[#00FF88]/10 border-[#00FF88]/30 text-[#00FF88]'
                : 'bg-white/[0.03] border-white/10 text-gray-500'
            }`}
          >
            {check.done ? '\u2713' : '\u25CB'} {check.label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/profile/profile" className="text-xs text-[#FFD700] hover:underline">
          Дополнить профиль
        </Link>
        {slug && (
          <a
            href={`/developer/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#00F5FF] hover:underline flex items-center gap-1"
          >
            Открыть публичный кабинет <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    {
      to: '/profile/studio',
      label: 'Создать продукт',
      hint: 'Загрузите .zip и пройдите wizard',
      accent: '#FFD700',
      icon: Sparkles,
    },
    {
      to: '/profile/commerce/publishing',
      label: 'Опубликовать в TonForge',
      hint: 'KYC + Artifact Scan + NFT lic.',
      accent: '#FF6B6B',
      icon: Package,
    },
    {
      to: '/profile/wallet',
      label: 'Реестр выплат',
      hint: 'Доход и история транзакций',
      accent: '#00FF88',
      icon: ArrowRight,
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {actions.map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className="group rounded-xl border border-white/[0.08] bg-black/20 p-4 hover:border-white/[0.18] transition-colors"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
            style={{ backgroundColor: `${action.accent}15` }}
          >
            <action.icon className="w-4.5 h-4.5" style={{ color: action.accent }} />
          </div>
          <p className="text-white text-sm font-semibold">{action.label}</p>
          <p className="text-[#666] text-xs mt-0.5">{action.hint}</p>
        </Link>
      ))}
    </div>
  );
}

function RecentCreations({ products, isLoading }: { products: CreatedProduct[]; isLoading: boolean }) {
  if (isLoading && products.length === 0) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }
  if (products.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Недавние продукты</h2>
        <Link
          to="/profile/studio"
          className="text-[#FFD700] text-xs font-medium hover:text-[#FFE066] flex items-center gap-1 transition-colors"
        >
          Все <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <ul className="space-y-2">
        {products.slice(0, 4).map((product) => (
          <li
            key={product.id}
            className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-[#111119] p-4 hover:border-white/[0.1] transition-all"
          >
            <Link to={`/profile/studio/${product.id}/edit`} className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
                <Package className="w-4.5 h-4.5 text-[#8B5CF6]" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{product.name}</p>
                <p className="text-[#666] text-xs">{product.downloads ?? 0} downloads · v{product.version ?? '—'}</p>
              </div>
            </Link>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${statusBadge(product.status)}`}
            >
              {product.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function statusBadge(status: string): string {
  switch (status) {
    case 'published':
      return 'bg-[#00FF88]/10 text-[#00FF88]';
    case 'pending_review':
      return 'bg-[#00F5FF]/10 text-[#00F5FF]';
    case 'suspended':
      return 'bg-[#FF4444]/10 text-[#FF4444]';
    case 'draft':
    default:
      return 'bg-[#FFD700]/10 text-[#FFD700]';
  }
}

function FirstTimeEmptyState() {
  return (
    <div className="rounded-xl border-2 border-dashed border-white/[0.08] hover:border-[#FFD700]/30 p-8 text-center transition-all duration-300 group">
      <Link to="/profile/studio" className="block">
        <Sparkles className="w-10 h-10 text-[#FFD700]/40 group-hover:text-[#FFD700] mx-auto mb-3 transition-colors" />
        <p className="text-[#888] group-hover:text-white transition-colors text-sm font-medium">
          Откройте Studio, чтобы выпустить первый <span className="text-[#FFD700]">артефакт</span>
        </p>
        <p className="text-[#555] text-xs mt-1">Загрузите .zip с билдом — wizard сделает остальное</p>
      </Link>
    </div>
  );
}
