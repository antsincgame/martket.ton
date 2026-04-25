/**
 * Didit hosted KYC widget for seller verification.
 *
 * Creates a verification session via the backend, then opens the
 * Didit hosted verification page in a new tab. Polls for status
 * changes until the session is Approved, Declined, or times out.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { createKycSession, fetchSellerKycStatus, type SellerKycStatus } from '../../../lib/commerceApi';
import { logger } from '../../../lib/logger';

interface Props {
  wallet: string;
  onStatusChange?: (status: SellerKycStatus) => void;
}

type WidgetPhase = 'loading' | 'ready' | 'polling' | 'completed' | 'error' | 'already-approved' | 'rejected' | 'expired';

const KYC_POLL_INTERVAL_MS = 5_000;
const KYC_POLL_MAX = 240;

export default function DiditKycWidget({ wallet, onStatusChange }: Props) {
  const [phase, setPhase] = useState<WidgetPhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          setError(status.kycRejectionReason || 'Verification was declined.');
          onStatusChange?.(status);
          return;
        }
      } catch (err) {
        logger.warn('[DiditKycWidget] poll error:', err);
      }
      if (attempts < KYC_POLL_MAX) {
        pollRef.current = setTimeout(() => void poll(), KYC_POLL_INTERVAL_MS);
      } else {
        setPhase('expired');
        setError('Verification polling timed out. Refresh the page to check status.');
      }
    };
    pollRef.current = setTimeout(() => void poll(), KYC_POLL_INTERVAL_MS);
  }, [wallet, onStatusChange]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const result = await createKycSession(wallet);
        if (cancelled) return;

        if (result.alreadyApproved) {
          setPhase('already-approved');
          return;
        }

        setVerificationUrl(result.url);
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to create verification session';
        logger.error('[DiditKycWidget] init error:', msg);
        setError(msg);
        setPhase('error');
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [wallet]);

  const handleStartVerification = useCallback(() => {
    if (!verificationUrl) return;
    window.open(verificationUrl, '_blank', 'noopener,noreferrer');
    setPhase('polling');
    void pollKycStatus();
  }, [verificationUrl, pollKycStatus]);

  if (phase === 'loading') {
    return (
      <div className="flex items-center gap-3 p-6 rounded-xl bg-white/5 border border-white/10">
        <Loader2 className="w-5 h-5 animate-spin text-[#00F5FF]" />
        <span className="text-sm text-gray-400">Preparing verification session…</span>
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
          Verification declined
        </div>
        {error && <p className="text-sm text-red-200/80">{error}</p>}
        <p className="text-xs text-gray-400">
          Contact support to appeal or re-submit with correct documents.
        </p>
      </div>
    );
  }

  if (phase === 'expired') {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-2">
        <div className="flex items-center gap-2 text-amber-300 font-medium">
          <AlertTriangle className="w-5 h-5" />
          Verification session expired
        </div>
        {error && <p className="text-sm text-amber-200/80">{error}</p>}
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
          ensure DIDIT_API_KEY is configured on the server.
        </p>
      </div>
    );
  }

  if (phase === 'polling') {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-black/30 p-5 space-y-4">
        <header className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#FFD700]" />
          <h2 className="text-base font-semibold text-white">Verification in Progress</h2>
        </header>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <div className="space-y-1">
            <p className="text-sm text-cyan-200 font-medium">
              Complete verification in the Didit tab
            </p>
            <p className="text-xs text-gray-400">
              This page will update automatically once your identity is confirmed.
            </p>
          </div>
        </div>
        {verificationUrl && (
          <a
            href={verificationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Re-open verification page
          </a>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-black/30 p-5 space-y-4">
      <header className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[#FFD700]" />
        <h2 className="text-base font-semibold text-white">Identity Verification</h2>
      </header>
      <p className="text-xs text-gray-400 leading-relaxed">
        Complete document verification to start selling. This usually takes 2–5 minutes.
        Your data is processed securely by Didit — an all-in-one identity platform
        with free core KYC (500 checks/month).
      </p>
      <button
        type="button"
        onClick={handleStartVerification}
        className="inline-flex items-center gap-2 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/10 px-5 py-3 text-sm font-semibold text-[#FFD700] hover:bg-[#FFD700]/20 transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        Start Verification
      </button>
    </section>
  );
}
