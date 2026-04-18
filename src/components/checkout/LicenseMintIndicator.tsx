import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, ExternalLink, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { fetchWalletProfile } from '../../services/tonforgeApi';
import type { TonForgeLicense } from '../../domain/tonforge/types';

interface Props {
  buyerWallet: string;
  /** When provided, only consider licenses for this app. */
  appId?: string;
  /** Network for explorer/wallet deeplinks. */
  network?: 'mainnet' | 'testnet';
}

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 90_000;

type IndicatorState =
  | { kind: 'searching' }
  | { kind: 'minting'; license: TonForgeLicense }
  | { kind: 'failed'; license: TonForgeLicense; reason: string }
  | { kind: 'ready'; license: TonForgeLicense }
  | { kind: 'no-license' };

function isPendingState(state: string): boolean {
  return state === 'mint_pending';
}

function isReadyState(state: string): boolean {
  return state === 'trial_active' || state === 'device_bound' || state === 'released';
}

export default function LicenseMintIndicator({ buyerWallet, appId, network = 'mainnet' }: Props) {
  const [state, setState] = useState<IndicatorState>({ kind: 'searching' });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!buyerWallet) return;
    let cancelled = false;
    const start = Date.now();
    let foundLicense = false;

    async function tick(): Promise<void> {
      if (cancelled) return;
      try {
        const profile = await fetchWalletProfile(buyerWallet);
        const candidates = appId
          ? profile.licenses.filter((l) => l.appId === appId)
          : profile.licenses;
        candidates.sort((a, b) => (a.trialEndsAt > b.trialEndsAt ? -1 : 1));
        const license = candidates[0];
        if (!license) {
          if (Date.now() - start > POLL_TIMEOUT_MS) {
            setState({ kind: 'no-license' });
            return;
          }
        } else if (license.state === 'mint_failed') {
          setState({ kind: 'failed', license, reason: license.mintError || 'Mint failed' });
          return;
        } else if (isReadyState(license.state)) {
          setState({ kind: 'ready', license });
          return;
        } else if (isPendingState(license.state)) {
          foundLicense = true;
          setState({ kind: 'minting', license });
        }
      } catch {
        // swallow transient errors; will retry
      }
      if (!cancelled && Date.now() - start <= POLL_TIMEOUT_MS) {
        setTimeout(() => void tick(), POLL_INTERVAL_MS);
      } else if (!cancelled && !foundLicense) {
        setState({ kind: 'no-license' });
      }
    }
    void tick();
    return () => {
      cancelled = true;
    };
  }, [buyerWallet, appId]);

  const explorerBase = useMemo(
    () => (network === 'testnet' ? 'https://testnet.tonscan.org/nft/' : 'https://tonscan.org/nft/'),
    [network],
  );

  if (state.kind === 'searching' || state.kind === 'minting') {
    return (
      <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-300" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-cyan-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Minting your License NFT
          </div>
          <p className="text-xs text-cyan-200/70 mt-0.5">
            Backend oracle is publishing your soulbound license on-chain. This usually takes 15–60 seconds.
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === 'failed') {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-300 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-amber-100">License mint pending retry</div>
          <p className="text-xs text-amber-200/70 mt-0.5">
            Your purchase is recorded but the on-chain mint failed: {state.reason}. Our team will retry
            automatically. You can still access your build via the download link above.
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === 'ready') {
    const { license } = state;
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4 space-y-3">
        <div className="flex items-center gap-2 text-emerald-200">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-semibold">License NFT minted</span>
        </div>
        <div className="text-xs text-emerald-100/80 space-y-1">
          <div>
            Address:{' '}
            <span className="font-mono text-emerald-200">
              {license.nftAddress.slice(0, 10)}…{license.nftAddress.slice(-6)}
            </span>
          </div>
          <div>State: {license.state}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`${explorerBase}${license.nftAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20"
          >
            <ExternalLink className="w-3 h-3" /> TONScan
          </a>
          <a
            href={`https://app.tonkeeper.com/transfer/${license.nftAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20"
          >
            <ExternalLink className="w-3 h-3" /> Open in Tonkeeper
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
      License NFT will appear in your profile shortly.
    </div>
  );
}
