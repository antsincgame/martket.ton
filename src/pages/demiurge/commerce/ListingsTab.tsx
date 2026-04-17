// ListingsTab — обзор опубликованных приложений из TonForge workspace.
// На этом этапе показываем app.published list, метрики и быстрые ссылки.
// Дальше (в commerce-orders-disputes) подключим on-chain listings из commerceApi.
import { Link } from 'react-router-dom';
import { ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import type { TonForgeDeveloperWorkspace } from '../../../domain/tonforge/types';
import { slugify } from '../../../utils/slugify';

interface ListingsTabProps {
  workspace: TonForgeDeveloperWorkspace | null;
  workspaceLoading: boolean;
}

export default function ListingsTab({ workspace, workspaceLoading }: ListingsTabProps) {
  const apps = workspace?.apps ?? [];

  if (workspaceLoading && apps.length === 0) {
    return <SkeletonRows />;
  }
  if (apps.length === 0) {
    return (
      <EmptyState
        title="Нет опубликованных приложений"
        message="Выпустите первое приложение во вкладке «Публикация» — оно появится здесь после прохождения artifact scan."
        ctaLabel="Перейти к публикации"
        ctaTo="/profile/commerce/publishing"
      />
    );
  }

  return (
    <div className="space-y-3">
      <Kpis workspace={workspace} />

      <ul className="space-y-3">
        {apps.map((app) => {
          const slugRoute = slugify(app.name) || app.slug;
          const malware = app.artifact.malwareStatus.toLowerCase();
          const malwareColor =
            malware === 'passed' || malware === 'clean'
              ? 'text-[#00FF88]'
              : malware === 'pending'
                ? 'text-[#FFD700]'
                : 'text-[#FF4444]';

          return (
            <li
              key={app.appId}
              className="rounded-xl border border-white/[0.08] bg-black/30 p-4 hover:border-white/[0.16] transition-colors"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white truncate">{app.name}</span>
                    {app.featured && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider border border-[#FFD700]/30 bg-[#FFD700]/10 text-[#FFD700]">
                        <Sparkles className="w-3 h-3" aria-hidden /> Featured
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#888] mt-0.5 truncate">
                    {app.category} · {app.priceTon} TON · {app.license.type}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className={`inline-flex items-center gap-1 ${malwareColor}`}>
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
                    {app.artifact.malwareStatus}
                  </span>
                  <span className="text-[#666]">{app.license.contractStatus}</span>
                  <Link
                    to={`/product/${encodeURIComponent(slugRoute)}`}
                    className="inline-flex items-center gap-1 text-[#00F5FF] hover:text-white"
                  >
                    Открыть страницу <ExternalLink className="w-3 h-3" aria-hidden />
                  </Link>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <Metric label="Загрузок" value={app.metrics.downloads} />
                <Metric label="Покупок (нед.)" value={app.metrics.weeklyPurchases} />
                <Metric label="Активных лицензий" value={app.metrics.activeLicenses} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Kpis({ workspace }: { workspace: TonForgeDeveloperWorkspace | null }) {
  const apps = workspace?.apps ?? [];
  if (apps.length === 0) return null;
  const totalDownloads = apps.reduce((sum, a) => sum + a.metrics.downloads, 0);
  const totalActive = apps.reduce((sum, a) => sum + a.metrics.activeLicenses, 0);
  const featured = apps.filter((a) => a.featured).length;

  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Kpi label="Листингов" value={apps.length} accent="#00F5FF" />
      <Kpi label="Featured" value={featured} accent="#FFD700" />
      <Kpi label="Всего загрузок" value={totalDownloads} accent="#8B5CF6" />
      <Kpi label="Активных лицензий" value={totalActive} accent="#00FF88" />
    </dl>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 backdrop-blur-sm px-3 py-3">
      <dt className="text-[10px] uppercase tracking-wider text-[#888]">{label}</dt>
      <dd className="text-2xl font-display font-bold tabular-nums mt-1" style={{ color: accent }}>
        {value}
      </dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5 text-center">
      <div className="text-[#666] text-[10px] uppercase tracking-wider">{label}</div>
      <div className="text-white font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <ul className="space-y-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="rounded-xl border border-white/[0.06] bg-black/20 p-4 h-28 animate-pulse"
        />
      ))}
    </ul>
  );
}

function EmptyState({
  title,
  message,
  ctaLabel,
  ctaTo,
}: {
  title: string;
  message: string;
  ctaLabel: string;
  ctaTo: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-8 text-center">
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-[#888] mb-4">{message}</p>
      <Link
        to={ctaTo}
        className="inline-block rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 px-4 py-2 text-sm font-medium text-white hover:bg-[#FF6B6B]/20 transition-colors"
      >
        {ctaLabel} →
      </Link>
    </div>
  );
}
