// "Мои лицензии" — секция профиля для просмотра NFT-лицензий пользователя.
// Показывает on-chain статус, ссылку на TONScan/Tonkeeper и кнопку on-chain верификации владельца.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  ExternalLink,
  Flame,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchWalletProfile,
  verifyLicenseOnchain,
  type TonForgeOnchainVerify,
} from '../../services/tonforgeApi';
import type { TonForgeLicense } from '../../domain/tonforge/types';

type Network = 'mainnet' | 'testnet';

function resolveNetwork(): Network {
  if (typeof window === 'undefined') return 'mainnet';
  return window.localStorage.getItem('ton_network') === 'testnet' ? 'testnet' : 'mainnet';
}

function explorerNftUrl(addr: string, network: Network): string {
  const base = network === 'testnet' ? 'https://testnet.tonscan.org/nft/' : 'https://tonscan.org/nft/';
  return `${base}${addr}`;
}

function explorerAccountUrl(addr: string, network: Network): string {
  const base = network === 'testnet' ? 'https://testnet.tonscan.org/address/' : 'https://tonscan.org/address/';
  return `${base}${addr}`;
}

function tonkeeperUrl(addr: string): string {
  return `https://app.tonkeeper.com/transfer/${addr}`;
}

function shortAddr(addr: string | undefined | null): string {
  if (!addr) return '—';
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

interface StateBadgeProps {
  state: string;
}

function StateBadge({ state }: StateBadgeProps) {
  const palette: Record<string, { bg: string; border: string; text: string; label: string }> = {
    mint_pending: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-300', label: 'Минт в процессе' },
    mint_failed: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', label: 'Ошибка минта' },
    trial_active: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Trial active' },
    device_bound: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-300', label: 'Привязана к устройству' },
    released: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Released' },
    burn_pending: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-300', label: 'Burn pending' },
    revoked: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-300', label: 'Сожжена' },
    refunded: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-300', label: 'Refunded' },
  };
  const p = palette[state] ?? { bg: 'bg-white/5', border: 'border-white/10', text: 'text-white/70', label: state };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${p.bg} ${p.border} ${p.text}`}>
      {p.label}
    </span>
  );
}

interface VerifyState {
  loading: boolean;
  result?: TonForgeOnchainVerify;
  error?: string;
}

function VerifyBadge({
  license,
  state,
  onVerify,
}: {
  license: TonForgeLicense;
  state: VerifyState | undefined;
  onVerify: (license: TonForgeLicense) => void;
}) {
  if (!license.nftAddress) {
    return <span className="text-[11px] text-white/40">NFT ещё не выпущен</span>;
  }
  if (state?.loading) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300">
        <Loader2 className="w-3 h-3 animate-spin" />
        Проверка on-chain…
      </span>
    );
  }
  if (state?.error) {
    return (
      <button
        type="button"
        onClick={() => onVerify(license)}
        className="inline-flex items-center gap-1 text-[11px] text-rose-300 hover:text-rose-200"
      >
        <ShieldAlert className="w-3 h-3" />
        Ошибка: {state.error}. Повторить
      </button>
    );
  }
  if (state?.result) {
    if (state.result.ok) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
          <ShieldCheck className="w-3 h-3" />
          Владение подтверждено on-chain
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onVerify(license)}
        className="inline-flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200"
      >
        <ShieldAlert className="w-3 h-3" />
        {state.result.reason || 'Не подтверждено'}. Повторить
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onVerify(license)}
      className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200"
    >
      <ShieldCheck className="w-3 h-3" />
      Проверить on-chain
    </button>
  );
}

const OP_BUYER_BURN = 0x7a1b3c5d;

function buildBuyerBurnBase64(): string {
  const buf = new ArrayBuffer(12);
  const view = new DataView(buf);
  view.setUint32(0, OP_BUYER_BURN, false);
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function canBuyerBurn(license: TonForgeLicense): boolean {
  if (!license.nftAddress) return false;
  if (license.state !== 'trial_active' && license.state !== 'device_bound') return false;
  const deadline = new Date(license.trialEndsAt).getTime();
  return Date.now() < deadline;
}

function BuyerBurnButton({
  license,
  onBurnSent,
}: {
  license: TonForgeLicense;
  onBurnSent: () => void;
}) {
  const [tonConnectUI] = useTonConnectUI();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canBuyerBurn(license)) return null;

  const deadline = new Date(license.trialEndsAt);
  const remainMs = deadline.getTime() - Date.now();
  const remainH = Math.max(0, Math.ceil(remainMs / 3_600_000));

  const handleBurn = async () => {
    setSending(true);
    setError(null);
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: license.nftAddress,
            amount: '50000000',
            payload: buildBuyerBurnBase64(),
          },
        ],
      });
      onBurnSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction rejected');
    } finally {
      setSending(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"
      >
        <Flame className="w-3 h-3" />
        Сжечь и вернуть ({remainH}h)
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 space-y-2 text-xs">
      <p className="text-rose-200 font-medium">
        NFT будет сожжён, а средства вернутся вам. Это действие необратимо.
      </p>
      {error && <p className="text-rose-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleBurn()}
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-white font-semibold hover:bg-rose-500 disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flame className="w-3 h-3" />}
          Подтвердить
        </button>
        <button
          type="button"
          onClick={() => { setConfirming(false); setError(null); }}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-white/70 hover:text-white"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

export default function MyLicensesPanel() {
  const { user } = useAuth();
  const wallet = user?.tonAddress ?? '';
  const network = useMemo<Network>(() => resolveNetwork(), []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [licenses, setLicenses] = useState<TonForgeLicense[]>([]);
  const [verifyState, setVerifyState] = useState<Record<string, VerifyState>>({});

  const reload = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const profile = await fetchWalletProfile(wallet);
      const sorted = [...profile.licenses].sort((a, b) =>
        a.trialEndsAt > b.trialEndsAt ? -1 : 1,
      );
      setLicenses(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить лицензии');
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleVerify = useCallback(async (license: TonForgeLicense) => {
    setVerifyState((prev) => ({ ...prev, [license.licenseId]: { loading: true } }));
    try {
      const result = await verifyLicenseOnchain(license.licenseId);
      setVerifyState((prev) => ({ ...prev, [license.licenseId]: { loading: false, result } }));
    } catch (err) {
      setVerifyState((prev) => ({
        ...prev,
        [license.licenseId]: {
          loading: false,
          error: err instanceof Error ? err.message : 'verify_failed',
        },
      }));
    }
  }, []);

  if (!wallet) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex items-start gap-3">
        <WalletIcon className="w-5 h-5 text-[#FFD700]" />
        <div>
          <h3 className="text-sm font-semibold text-white">Подключите TON-кошелёк</h3>
          <p className="text-xs text-white/60 mt-1">
            Чтобы увидеть свои лицензии-NFT, привяжите кошелёк в разделе Wallet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-display font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FFD700]" />
            Мои лицензии
          </h2>
          <p className="text-xs text-white/50 mt-1">
            On-chain License NFTs, привязанные к вашему кошельку{' '}
            <span className="font-mono text-white/70">{shortAddr(wallet)}</span>{' '}
            ({network}).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {!loading && licenses.length === 0 && !error && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
          У вас пока нет купленных лицензий. После покупки приложения сюда подъедет ваш License NFT.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {licenses.map((license) => {
          const vs = verifyState[license.licenseId];
          const hasNft = Boolean(license.nftAddress);
          return (
            <article
              key={license.licenseId}
              className="rounded-xl border border-white/10 bg-[#0E0E18] p-4 space-y-3"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-widest text-white/40">App</div>
                  <div className="font-mono text-sm text-white truncate">{license.appId}</div>
                </div>
                <StateBadge state={license.state} />
              </header>

              <div className="grid grid-cols-1 gap-1 text-xs text-white/70">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/40">License ID</span>
                  <span className="font-mono text-white/80">{shortAddr(license.licenseId)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/40">NFT</span>
                  <span className="font-mono text-white/80">{shortAddr(license.nftAddress)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/40">Collection</span>
                  <span className="font-mono text-white/80">{shortAddr(license.collectionAddress)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/40">Devices</span>
                  <span className="text-white/80">{license.activatedDevices.length}</span>
                </div>
                {license.collectionIndex !== undefined && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/40">Index</span>
                    <span className="text-white/80">#{license.collectionIndex}</span>
                  </div>
                )}
                {license.mintError && (
                  <div className="text-amber-300/90 text-[11px] mt-1">
                    Mint error: {license.mintError}
                  </div>
                )}
              </div>

              <BuyerBurnButton license={license} onBurnSent={reload} />

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <VerifyBadge license={license} state={vs} onVerify={handleVerify} />
                <div className="flex items-center gap-2">
                  {hasNft && (
                    <a
                      href={explorerNftUrl(license.nftAddress, network)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-400/20"
                    >
                      <ExternalLink className="w-3 h-3" /> TONScan
                    </a>
                  )}
                  {hasNft && (
                    <a
                      href={tonkeeperUrl(license.nftAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-400/20"
                    >
                      <ExternalLink className="w-3 h-3" /> Tonkeeper
                    </a>
                  )}
                  {license.escrowAddress && (
                    <a
                      href={explorerAccountUrl(license.escrowAddress, network)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/70 hover:bg-white/10"
                      title="Escrow contract"
                    >
                      <ExternalLink className="w-3 h-3" /> Escrow
                    </a>
                  )}
                </div>
              </div>

              {vs?.result?.ok && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-300/80">
                  <CheckCircle className="w-3 h-3" /> Owner on-chain совпадает с {shortAddr(vs.result.ownerOnchain)}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
