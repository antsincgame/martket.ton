// Дашборд разработчика подключён к TonForge workspace и показывает реальные KYC/license/contract сигналы вместо placeholder-статистики.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTonAddress } from '@tonconnect/ui-react';
import { Boxes, FileCheck, Rocket, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import type { TonForgeDeveloperWorkspace } from '../domain/tonforge/types';
import { fetchDeveloperWorkspace, fetchTonForgeConfig } from '../services/tonforgeApi';

const DeveloperDashboard = () => {
  const wallet = useTonAddress();
  const [workspace, setWorkspace] = useState<TonForgeDeveloperWorkspace | null>(null);
  const [treasuryWallet, setTreasuryWallet] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet) {
      setWorkspace(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void Promise.all([fetchDeveloperWorkspace(wallet), fetchTonForgeConfig()])
      .then(([nextWorkspace, config]) => {
        if (cancelled) return;
        setWorkspace(nextWorkspace);
        setTreasuryWallet(config.treasuryWallet);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : 'Не удалось загрузить developer workspace');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const metrics = useMemo(() => {
    const apps = workspace?.apps ?? [];
    return {
      apps: apps.length,
      activeLicenses: apps.reduce((sum, app) => sum + app.metrics.activeLicenses, 0),
      weeklyPurchases: apps.reduce((sum, app) => sum + app.metrics.weeklyPurchases, 0),
      passedScans: workspace?.recentScans.filter((scan) => scan.status === 'passed').length ?? 0,
    };
  }, [workspace]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto mb-6 h-20 w-20 animate-spin rounded-full border-4 border-ton-500 border-t-transparent"></div>
          <h2 className="mb-2 text-xl font-display font-bold text-white">Загрузка TonForge workspace...</h2>
          <p className="text-gray-400">Проверяю KYC, публикации и contract readiness.</p>
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-ton-500/20">
            <Wallet className="h-10 w-10 text-ton-400" />
          </div>
          <h1 className="mb-4 text-2xl font-display font-bold text-white">Подключите кошелёк разработчика</h1>
          <p className="mb-6 text-gray-300">Дашборд использует адрес кошелька как owner developer workspace и publisher identity.</p>
          <Link to="/" className="inline-flex w-full items-center justify-center rounded-xl bg-ton-gradient px-6 py-3 font-semibold text-white">
            Вернуться на витрину
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center text-3xl font-display font-bold text-white">
              <Sparkles className="mr-3 h-8 w-8 text-purple-400" />
              TonForge Developer Dashboard
            </h1>
            <p className="text-gray-400">Wallet-driven publisher console для KYC, artifact scan, license policy и escrow-aware релизов.</p>
          </div>
          <Link to="/seller/commerce" className="inline-flex items-center justify-center rounded-full bg-ton-gradient px-6 py-3 font-semibold text-white">
            Открыть Publisher Console
          </Link>
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

        <div className="mb-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center justify-between">
              <Boxes className="h-6 w-6 text-purple-400" />
              <span className="text-xs text-gray-400">apps</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics.apps}</div>
            <div className="text-sm text-gray-400">Опубликованные приложения</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center justify-between">
              <Rocket className="h-6 w-6 text-cyan-300" />
              <span className="text-xs text-gray-400">licenses</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics.activeLicenses}</div>
            <div className="text-sm text-gray-400">Активные лицензии</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center justify-between">
              <ShieldCheck className="h-6 w-6 text-green-400" />
              <span className="text-xs text-gray-400">kyc</span>
            </div>
            <div className="text-2xl font-bold capitalize text-white">{workspace?.developer.kycStatus ?? 'draft'}</div>
            <div className="text-sm text-gray-400">{workspace?.developer.sellerBadge ?? 'Нет бейджа'}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center justify-between">
              <FileCheck className="h-6 w-6 text-yellow-400" />
              <span className="text-xs text-gray-400">weekly</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics.weeklyPurchases}</div>
            <div className="text-sm text-gray-400">Покупки за неделю</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">Мои приложения</h2>
            {workspace?.apps.length ? (
              <div className="space-y-4">
                {workspace.apps.map((app) => (
                  <div key={app.appId} className="rounded-xl border border-white/10 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{app.name}</h3>
                        <p className="text-sm text-gray-400">{app.summary}</p>
                        <div className="mt-2 text-xs text-gray-500">
                          {app.license.type} · {app.artifact.malwareStatus} · {app.license.contractStatus}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-ton-400">{app.priceTon} TON</div>
                        <div className="text-gray-400">{app.metrics.activeLicenses} лицензий</div>
                        <Link to={`/product/${app.catalogProductId}`} className="text-purple-300 hover:text-purple-200">
                          Страница товара →
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Пока нет опубликованных приложений. Начните с Publisher Console.</p>
            )}
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-3 text-xl font-semibold text-white">Contract readiness</h2>
              <div className="space-y-2 text-sm text-gray-300">
                <p>Treasury wallet: <span className="break-all text-white">{treasuryWallet || 'не задан'}</span></p>
                <p>Последних успешных scan: <span className="text-white">{metrics.passedScans}</span></p>
                <p>Подход: Registry → AppCollection → LicenseNFT → Escrow</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-3 text-xl font-semibold text-white">Последние scan</h2>
              {workspace?.recentScans.length ? (
                <div className="space-y-3 text-sm text-gray-300">
                  {workspace.recentScans.map((scan) => (
                    <div key={scan.scanId} className="rounded-xl border border-white/10 p-3">
                      <div className="font-medium text-white">{scan.fileName}</div>
                      <div>{scan.status} · {new Date(scan.scannedAt).toLocaleString('ru-RU')}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Scan-отчётов пока нет.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DeveloperDashboard;