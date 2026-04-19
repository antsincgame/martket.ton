import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  ExternalLink,
  Loader2,
  ShieldAlert,
  Sparkles,
  RefreshCcw,
  Wallet,
} from 'lucide-react';
import { fetchLicense } from '../../lib/commerceApi';
import type { LicensePublic } from '../../domain/commerce/types';
import DownloadAction from './DownloadAction';

interface Props {
  licenseId: string;
  network?: 'mainnet' | 'testnet';
  /** Listing the license belongs to — used to issue presigned download URL.
   *  Without this prop the download button is hidden. */
  listingId?: string;
}

const POLL_INTERVAL_MS = 3000;
// Refund cycle starts 1h after mint_failed and may take a few minutes to
// settle, so we keep the page polling for up to 90 minutes total.
const MAX_POLL_DURATION_MS = 90 * 60 * 1000;

type Phase =
  | 'polling'
  | 'minted'
  | 'mint_failed'
  | 'refund_pending'
  | 'refunded'
  | 'invalid'
  | 'error';

interface ProgressView {
  phase: Phase;
  license: LicensePublic | null;
  error?: string;
}

/**
 * Post-checkout NFT mint progress indicator.
 *
 * Polls /api/v1/commerce/licenses/:id every 3s. Terminal states:
 *   - minted:         NFT is on-chain, download is unlocked.
 *   - mint_failed:    backend retries exhausted; auto-refund will start in <1h.
 *   - refund_pending: OracleRefund broadcast, awaiting on-chain settlement.
 *   - refunded:       funds returned to buyer; nothing to do.
 *   - burned:         buyer voluntarily burned NFT (legacy, treated as invalid).
 */
export default function MintProgress({ licenseId, network = 'mainnet', listingId }: Props) {
  const [view, setView] = useState<ProgressView>({ phase: 'polling', license: null });
  const cancelledRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    cancelledRef.current = false;
    startedAtRef.current = Date.now();

    async function tick(): Promise<void> {
      if (cancelledRef.current) return;
      try {
        const license = await fetchLicense(licenseId);
        if (cancelledRef.current) return;
        if (license.state === 'minted') {
          setView({ phase: 'minted', license });
          return;
        }
        if (license.state === 'mint_failed') {
          setView({ phase: 'mint_failed', license });
          // Keep polling: the refund worker may flip us into refund_pending
          // before this component is unmounted.
        } else if (license.state === 'refund_pending') {
          setView({ phase: 'refund_pending', license });
        } else if (license.state === 'refunded') {
          setView({ phase: 'refunded', license });
          return;
        } else if (license.state === 'burned') {
          setView({ phase: 'invalid', license });
          return;
        } else {
          setView({ phase: 'polling', license });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'License lookup failed';
        setView((prev) => ({ ...prev, error: msg }));
      }
      if (cancelledRef.current) return;
      if (Date.now() - startedAtRef.current > MAX_POLL_DURATION_MS) {
        setView((prev) => ({
          ...prev,
          phase: 'error',
          error: prev.error || 'Mint is taking longer than expected. Refresh the page in a few minutes.',
        }));
        return;
      }
      setTimeout(() => void tick(), POLL_INTERVAL_MS);
    }

    void tick();
    return () => {
      cancelledRef.current = true;
    };
  }, [licenseId]);

  const explorerBase = useMemo(
    () => (network === 'testnet' ? 'https://testnet.tonscan.org/nft/' : 'https://tonscan.org/nft/'),
    [network],
  );

  const license = view.license;
  const steps = useMemo(() => {
    const minted = view.phase === 'minted';
    const refunded = view.phase === 'refunded';
    const refundPending = view.phase === 'refund_pending';
    const failed = view.phase === 'mint_failed' || view.phase === 'invalid';
    const hasNft = Boolean(license?.nftAddress);
    if (refunded || refundPending) {
      return [
        { label: 'Payment confirmed', done: true, failed: false },
        { label: 'Mint failed', done: false, failed: true },
        {
          label: refunded ? 'Refund settled' : 'Refund in progress',
          done: refunded,
          failed: false,
        },
      ];
    }
    return [
      { label: 'Payment confirmed', done: true, failed: false },
      {
        label: 'Minting NFT on-chain',
        done: minted || hasNft,
        failed: failed && !hasNft,
      },
      {
        label: 'Registering with escrow',
        done: minted,
        failed: failed && hasNft,
      },
    ];
  }, [view.phase, license?.nftAddress]);

  return (
    <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-5 space-y-4">
      <div className="flex items-center gap-2 text-cyan-100 font-semibold text-sm">
        <Sparkles className="w-4 h-4" />
        License NFT issuance
      </div>

      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            {s.failed ? (
              <ShieldAlert className="w-4 h-4 text-amber-300 flex-shrink-0" />
            ) : s.done ? (
              <CheckCircle className="w-4 h-4 text-emerald-300 flex-shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin text-cyan-300 flex-shrink-0" />
            )}
            <span
              className={
                s.failed
                  ? 'text-amber-200'
                  : s.done
                    ? 'text-emerald-200'
                    : 'text-cyan-100/80'
              }
            >
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      {view.phase === 'polling' && (
        <div className="space-y-1">
          <p className="text-[11px] text-cyan-200/70">
            Usually completes in 30–90 seconds. Keep this page open or check your library later — the
            NFT will be in your wallet either way.
          </p>
          {view.error && (
            <p className="text-[10px] text-amber-200/80">
              Temporary issue: {view.error} — retrying...
            </p>
          )}
        </div>
      )}

      {view.phase === 'minted' && license && (
        <div className="space-y-3">
          <p className="text-xs text-emerald-200/90">
            Your License NFT is live on TON. Download is now unlocked.
          </p>
          {license.nftAddress && (
            <div className="text-[11px] text-emerald-100/80 font-mono break-all">
              {license.nftAddress}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {listingId && <DownloadAction listingId={listingId} variant="emerald" label="Download" />}
            {license.nftAddress && (
              <a
                href={`${explorerBase}${license.nftAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20"
              >
                <ExternalLink className="w-3 h-3" /> TONScan
              </a>
            )}
          </div>
        </div>
      )}

      {view.phase === 'mint_failed' && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100 space-y-2">
          <p className="font-semibold">Mint failed after retries.</p>
          <p>
            Your funds are safe in escrow. The platform will automatically broadcast a refund
            within 1 hour — no action required from you. This page will update once the refund
            settles on-chain.
          </p>
          {license?.mintError && (
            <p className="text-[10px] opacity-70 break-all">Detail: {license.mintError}</p>
          )}
        </div>
      )}

      {view.phase === 'refund_pending' && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100 space-y-2">
          <p className="font-semibold flex items-center gap-1">
            <RefreshCcw className="w-3 h-3 animate-spin" /> Refund in progress
          </p>
          <p>
            We've broadcast the refund to the escrow contract. Your TON should land back in your
            wallet within 1–2 minutes. This page updates automatically.
          </p>
        </div>
      )}

      {view.phase === 'refunded' && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-100 space-y-2">
          <p className="font-semibold flex items-center gap-1">
            <Wallet className="w-3 h-3" /> Refund settled
          </p>
          <p>
            Your TON has been returned to {license?.buyerWallet ? (
              <span className="font-mono break-all">{license.buyerWallet}</span>
            ) : (
              'your wallet'
            )}. You can safely close this page.
          </p>
        </div>
      )}

      {view.phase === 'invalid' && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-300">
          This license is no longer active ({license?.state}).
        </div>
      )}

      {view.phase === 'error' && view.error && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
          {view.error}
        </div>
      )}
    </div>
  );
}
