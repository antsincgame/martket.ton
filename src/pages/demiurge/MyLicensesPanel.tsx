// "Мои лицензии" — секция профиля для просмотра NFT-лицензий покупателя.
//
// Источник данных: GET /api/v1/commerce/buyers/me/licenses (LicensePublic[]).
// Заменил легаси-источник tonforgeApi.fetchWalletProfile (in-memory state),
// который теперь @deprecated в backend/tonforge/service.ts.
//
// Поддерживает все состояния lifecycle: mint_pending, minted, mint_failed,
// refund_pending, refunded, burned. Для активных лицензий показывает кнопку
// BuyerBurn (требует minted + trialEndsAt в будущем).
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Flame,
  Loader2,
  RefreshCw,
  Sparkles,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { beginCell } from '@ton/core';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMyLicenses, issueDownloadUrl } from '../../lib/commerceApi';
import type { LicensePublic, LicenseState } from '../../domain/commerce/types';

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

const STATE_PALETTE: Record<LicenseState, { bg: string; border: string; text: string; label: string }> = {
  mint_pending: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-300', label: 'Минт в процессе' },
  minted: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Активна' },
  mint_failed: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', label: 'Ошибка минта' },
  refund_pending: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', label: 'Refund в пути' },
  refunded: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-300', label: 'Возвращена' },
  burned: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-300', label: 'Сожжена' },
};

function StateBadge({ state }: { state: LicenseState }) {
  const p = STATE_PALETTE[state] ?? { bg: 'bg-white/5', border: 'border-white/10', text: 'text-white/70', label: state };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${p.bg} ${p.border} ${p.text}`}>
      {p.label}
    </span>
  );
}

// Opcodes must match contracts/src/escrow.tact (Tact compile)
const OP_BUYER_BURN = 0x7a1b3c5d;
const OP_CONFIRM_DELIVERY = 0x45dfb5a1;

function buildBuyerBurnBase64(): string {
  // Must be a valid BOC, not raw bytes — TonConnect parses payload as a Cell.
  return beginCell()
    .storeUint(OP_BUYER_BURN, 32)
    .storeUint(0, 64) // queryId
    .endCell()
    .toBoc()
    .toString('base64');
}

function buildConfirmDeliveryBase64(): string {
  return beginCell()
    .storeUint(OP_CONFIRM_DELIVERY, 32)
    .endCell()
    .toBoc()
    .toString('base64');
}

function canBuyerBurn(license: LicensePublic): boolean {
  if (!license.nftAddress) return false;
  if (license.state !== 'minted') return false;
  if (!license.trialEndsAt) return false;
  return Date.now() < new Date(license.trialEndsAt).getTime();
}

function canDownload(license: LicensePublic): boolean {
  // Mirror backend gate (distributionRoutes.ts): the file opens only when an
  // NFT is actually minted on-chain. `state==='minted'` alone is not enough —
  // legacy licenses may carry that state without `nftAddress`.
  return license.state === 'minted' && Boolean(license.nftAddress);
}

function canConfirmDelivery(license: LicensePublic): boolean {
  // Buyer can release escrow funds to seller early ONLY while trial is open
  // and they still hold a valid NFT. After trial expiry the cron sends
  // TimeoutRelease automatically.
  if (!license.escrowAddress) return false;
  if (license.state !== 'minted') return false;
  if (!license.trialEndsAt) return false;
  return Date.now() < new Date(license.trialEndsAt).getTime();
}

function DownloadButton({ license }: { license: LicensePublic }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canDownload(license)) return null;

  const handleClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await issueDownloadUrl(license.listingId);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось получить ссылку');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-400/20 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
        Скачать билд
      </button>
      {error && <p className="text-[10px] text-rose-300">{error}</p>}
    </div>
  );
}

function ConfirmDeliveryButton({
  license,
  onConfirmed,
}: {
  license: LicensePublic;
  onConfirmed: () => void;
}) {
  const [tonConnectUI] = useTonConnectUI();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canConfirmDelivery(license)) return null;
  const escrowAddress = license.escrowAddress!;

  const handleConfirm = async () => {
    setSending(true);
    setError(null);
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: escrowAddress,
            amount: '50000000', // 0.05 TON for gas
            payload: buildConfirmDeliveryBase64(),
          },
        ],
      });
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Транзакция отклонена');
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
        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/20 transition-colors"
        title="Досрочно выплатить продавцу и закрыть escrow"
      >
        <CheckCircle2 className="w-3 h-3" />
        Подтвердить доставку
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3 space-y-2 text-xs">
      <p className="text-cyan-100 font-medium">
        Средства будут немедленно переведены продавцу. Вы потеряете возможность
        вернуть их через сжигание NFT. Уверены?
      </p>
      {error && <p className="text-rose-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-white font-semibold hover:bg-cyan-500 disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Да, выплатить
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

function BuyerBurnButton({
  license,
  onBurnSent,
}: {
  license: LicensePublic;
  onBurnSent: () => void;
}) {
  const [tonConnectUI] = useTonConnectUI();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canBuyerBurn(license) || !license.nftAddress || !license.trialEndsAt) return null;

  const remainMs = new Date(license.trialEndsAt).getTime() - Date.now();
  const remainH = Math.max(0, Math.ceil(remainMs / 3_600_000));
  const nftAddress = license.nftAddress;

  const handleBurn = async () => {
    setSending(true);
    setError(null);
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: nftAddress,
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
  const [licenses, setLicenses] = useState<LicensePublic[]>([]);

  const reload = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchMyLicenses(200);
      // Newest first by createdAt; tied? then by trialEndsAt desc.
      const sorted = [...list].sort((a, b) => {
        if (a.createdAt === b.createdAt) {
          return (b.trialEndsAt ?? '').localeCompare(a.trialEndsAt ?? '');
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
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
          const hasNft = Boolean(license.nftAddress);
          return (
            <article
              key={license.id}
              className="rounded-xl border border-white/10 bg-[#0E0E18] p-4 space-y-3"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-widest text-white/40">Listing</div>
                  <div className="font-mono text-sm text-white truncate">
                    {license.catalogProductId || license.listingId}
                  </div>
                </div>
                <StateBadge state={license.state} />
              </header>

              <div className="grid grid-cols-1 gap-1 text-xs text-white/70">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/40">Order</span>
                  <span className="font-mono text-white/80">{shortAddr(license.orderId)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/40">NFT</span>
                  <span className="font-mono text-white/80">{shortAddr(license.nftAddress)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/40">Collection</span>
                  <span className="font-mono text-white/80">{shortAddr(license.collectionAddress)}</span>
                </div>
                {license.mintAttempts > 0 && license.state !== 'minted' && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/40">Mint attempts</span>
                    <span className="text-white/80">{license.mintAttempts}</span>
                  </div>
                )}
                {license.trialEndsAt && license.state === 'minted' && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/40">Refund window</span>
                    <span className="text-white/80">
                      until {new Date(license.trialEndsAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {license.mintError && (
                  <div className="text-amber-300/90 text-[11px] mt-1 break-all">
                    {license.mintError}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-start gap-2 flex-wrap pt-1">
                <DownloadButton license={license} />
                <ConfirmDeliveryButton license={license} onConfirmed={reload} />
              </div>

              <BuyerBurnButton license={license} onBurnSent={reload} />

              <div className="flex items-center justify-end gap-2 flex-wrap">
                {hasNft && (
                  <a
                    href={explorerNftUrl(license.nftAddress!, network)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-400/20"
                  >
                    <ExternalLink className="w-3 h-3" /> TONScan
                  </a>
                )}
                {hasNft && (
                  <a
                    href={tonkeeperUrl(license.nftAddress!)}
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
            </article>
          );
        })}
      </div>
    </section>
  );
}
