// Профиль переведён на wallet-first TonForge модель и показывает лицензии, device bindings и disputes вместо старого декоративного состояния.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTonAddress } from '@tonconnect/ui-react';
import { Download, Fingerprint, ScrollText, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import type { TonForgeWalletProfile } from '../domain/tonforge/types';
import { fetchWalletProfile } from '../services/tonforgeApi';

const ProfilePage = () => {
  const wallet = useTonAddress();
  const [profile, setProfile] = useState<TonForgeWalletProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchWalletProfile(wallet)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : 'Не удалось загрузить профиль');
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto mb-6 h-20 w-20 animate-spin rounded-full border-4 border-ton-500 border-t-transparent"></div>
          <h2 className="mb-2 text-xl font-display font-bold text-white">Загрузка TonForge profile...</h2>
          <p className="text-gray-400">Проверяю лицензии, trial и device bindings.</p>
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
          <h1 className="mb-4 text-2xl font-display font-bold text-white">Подключите кошелёк</h1>
          <p className="mb-6 text-gray-300">Профиль использует wallet как ключ к библиотеке лицензий и истории trial/disputes.</p>
          <Link to="/" className="inline-flex w-full items-center justify-center rounded-xl bg-ton-gradient px-6 py-3 font-semibold text-white">
            Вернуться на витрину
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-ton-500 text-3xl">
              <Sparkles className="h-10 w-10 text-ton-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-display font-bold text-white">{profile?.profile.displayName || 'TonForge User'}</h1>
              <p className="mt-2 break-all text-sm text-gray-400">{wallet}</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-white/5 p-4 text-center">
                  <div className="text-2xl font-bold text-ton-400">{profile?.stats.totalSpentTon ?? 0}</div>
                  <div className="text-sm text-gray-400">TON spent</div>
                </div>
                <div className="rounded-xl bg-white/5 p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{profile?.stats.totalLicenses ?? 0}</div>
                  <div className="text-sm text-gray-400">Licenses</div>
                </div>
                <div className="rounded-xl bg-white/5 p-4 text-center">
                  <div className="text-2xl font-bold text-cyan-300">{profile?.stats.devicesBound ?? 0}</div>
                  <div className="text-sm text-gray-400">Devices bound</div>
                </div>
                <div className="rounded-xl bg-white/5 p-4 text-center">
                  <div className="text-2xl font-bold text-amber-300">{profile?.stats.activeTrials ?? 0}</div>
                  <div className="text-sm text-gray-400">Active trials</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 flex items-center text-xl font-semibold text-white">
              <Download className="mr-2 h-5 w-5 text-ton-400" />
              License Library
            </h2>
            {profile?.licenses.length ? (
              <div className="space-y-4">
                {profile.licenses.map((license) => (
                  <div key={license.licenseId} className="rounded-xl border border-white/10 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold text-white">{license.appId}</div>
                        <div className="text-sm text-gray-400">State: {license.state}</div>
                        <div className="mt-2 text-xs text-gray-500">NFT {license.nftAddress}</div>
                      </div>
                      <div className="text-sm text-gray-300">
                        <div>Trial ends: {new Date(license.trialEndsAt).toLocaleString('ru-RU')}</div>
                        <div>Tx: {license.purchaseTxHash}</div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg bg-white/5 p-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                        <Fingerprint className="h-4 w-4 text-cyan-300" />
                        Device bindings
                      </div>
                      {license.activatedDevices.length ? (
                        <div className="space-y-1 text-xs text-gray-300">
                          {license.activatedDevices.map((device) => (
                            <div key={device.deviceId}>
                              {device.deviceId} · {new Date(device.activatedAt).toLocaleString('ru-RU')}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Устройство ещё не привязано.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Библиотека лицензий пока пуста. Купите приложение на витрине.</p>
            )}
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-3 flex items-center text-xl font-semibold text-white">
                <ShieldCheck className="mr-2 h-5 w-5 text-green-400" />
                Buyer protection
              </h2>
              <div className="space-y-2 text-sm text-gray-300">
                <p>Escrow удерживает оплату 72 часа.</p>
                <p>Runtime verification проверяет наличие NFT и device binding.</p>
                <p>Оффлайн fallback отсутствует: blockchain остаётся source of truth.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-3 flex items-center text-xl font-semibold text-white">
                <ScrollText className="mr-2 h-5 w-5 text-purple-300" />
                My disputes
              </h2>
              {profile?.disputes.length ? (
                <div className="space-y-3 text-sm text-gray-300">
                  {profile.disputes.map((dispute) => (
                    <div key={dispute.disputeId} className="rounded-xl border border-white/10 p-3">
                      <div className="font-medium text-white">{dispute.licenseId}</div>
                      <div>{dispute.state}</div>
                      <div className="text-xs text-gray-500">{dispute.reason}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Dispute-ов пока нет.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
