/**
 * Sumsub WebSDK widget for seller KYC verification.
 *
 * Loads the @sumsub/websdk dynamically, generates an access token via
 * the backend, and renders the embedded verification UI. On completion
 * the widget fires onComplete so the parent can refetch KYC status.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { fetchSumsubToken, fetchSellerKycStatus, type SellerKycStatus } from '../../../lib/commerceApi';
import { logger } from '../../../lib/logger';

interface Props {
  wallet: string;
  onStatusChange?: (status: SellerKycStatus) => void;
}

type WidgetPhase = 'loading' | 'active' | 'completed' | 'error' | 'already-approved' | 'rejected';

const KYC_POLL_INTERVAL_MS = 5_000;
const KYC_POLL_MAX = 120;

export default function SumsubKycWidget({ wallet, onStatusChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<WidgetPhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sdkInstanceRef = useRef<{ destroy: () => void } | null>(null);

  const pollKycStatus = useCallback(async () => {
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const status = await fetchSellerKycStatus(wallet);
        if (status.kycStatus === 'approved') {
          setPhase('completed');
          onStatusChange?.(status);
          return;
        }
        if (status.kycStatus === 'rejected') {
          setPhase('rejected');
          setError(status.kycRejectionReason || 'Verification was rejected.');
          onStatusChange?.(status);
          return;
        }
      } catch (err) {
        logger.warn('[SumsubKycWidget] poll error:', err);
      }
      if (attempts < KYC_POLL_MAX) {
        pollRef.current = setTimeout(() => void poll(), KYC_POLL_INTERVAL_MS);
      }
    };
    pollRef.current = setTimeout(() => void poll(), KYC_POLL_INTERVAL_MS);
  }, [wallet, onStatusChange]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const tokenResult = await fetchSumsubToken(wallet);
        if (cancelled) return;

        if ((tokenResult as unknown as Record<string, unknown>).alreadyApproved) {
          setPhase('already-approved');
          return;
        }

        const snsWebSdk = await import('@sumsub/websdk');
        if (cancelled || !containerRef.current) return;

        const sdk = snsWebSdk.default
          .init(tokenResult.token, async () => {
            const refreshed = await fetchSumsubToken(wallet);
            return refreshed.token;
          })
          .withConf({ lang: 'en' })
          .withOptions({ addViewportTag: false, adaptIframeHeight: true })
          .on('idCheck.onApplicantStatusChanged', (payload: unknown) => {
            logger.info('[sumsub] status changed:', payload);
          })
          .on('idCheck.onApplicantSubmitted', () => {
            void pollKycStatus();
          })
          .build();

        if (containerRef.current) {
          sdk.launch(containerRef.current);
          sdkInstanceRef.current = sdk;
          setPhase('active');
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load verification widget';
        logger.error('[SumsubKycWidget] init error:', msg);
        setError(msg);
        setPhase('error');
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
      sdkInstanceRef.current?.destroy();
    };
  }, [wallet, pollKycStatus]);

  if (phase === 'loading') {
    return (
      <div className="flex items-center gap-3 p-6 rounded-xl bg-white/5 border border-white/10">
        <Loader2 className="w-5 h-5 animate-spin text-[#00F5FF]" />
        <span className="text-sm text-gray-400">Loading verification widget…</span>
      </div>
    );
  }

  if (phase === 'already-approved') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-400" />
        <span className="text-sm text-emerald-200 font-medium">
          KYC already approved. You can publish listings and manage your store.
        </span>
      </div>
    );
  }

  if (phase === 'completed') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-400" />
        <span className="text-sm text-emerald-200 font-medium">
          Identity verified successfully! You can now publish listings.
        </span>
      </div>
    );
  }

  if (phase === 'rejected') {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 space-y-2">
        <div className="flex items-center gap-2 text-red-300 font-medium">
          <XCircle className="w-5 h-5" />
          Verification rejected
        </div>
        {error && <p className="text-sm text-red-200/80">{error}</p>}
        <p className="text-xs text-gray-400">
          Contact support to appeal or re-submit with correct documents.
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 space-y-2">
        <div className="flex items-center gap-2 text-red-300 font-medium">
          <AlertTriangle className="w-5 h-5" />
          Failed to load verification
        </div>
        {error && <p className="text-sm text-red-200/80">{error}</p>}
        <p className="text-xs text-gray-400">
          Please check your internet connection and try again. If the problem persists,
          ensure SUMSUB_APP_TOKEN is configured.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-black/30 p-5 space-y-4">
      <header className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[#FFD700]" />
        <h2 className="text-base font-semibold text-white">Identity Verification</h2>
      </header>
      <p className="text-xs text-gray-400 leading-relaxed">
        Complete document verification below. This usually takes 2–5 minutes.
        Your data is processed securely by our verification partner (Sumsub).
      </p>
      <div ref={containerRef} className="min-h-[400px] rounded-xl overflow-hidden" />
    </section>
  );
}
