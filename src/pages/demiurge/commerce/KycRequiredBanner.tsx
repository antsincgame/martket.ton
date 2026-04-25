/**
 * Surfaces the seller's KYC status. Publishing flows are blocked when status
 * is anything but `approved`. Now reads from Appwrite seller_profiles.kyc_status
 * instead of TonForge in-memory store.
 */
import { ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import type { SellerKycStatus } from '../../../lib/commerceApi';

interface Props {
  kycStatus: SellerKycStatus | null;
  onStartKyc?: () => void;
}

export default function KycRequiredBanner({ kycStatus, onStartKyc }: Props) {
  if (!kycStatus) return null;
  const status = kycStatus.kycStatus;

  if (status === 'approved') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2 text-xs text-emerald-200">
        <ShieldCheck className="w-4 h-4 flex-shrink-0" aria-hidden />
        <span>
          KYC approved. You can publish listings, manage prices, and issue Agent API tokens.
        </span>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 flex items-center gap-2 text-xs text-cyan-100">
        <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" aria-hidden />
        <span>
          KYC verification is in progress. Publishing unlocks once your identity is confirmed.
        </span>
      </div>
    );
  }

  const isRejected = status === 'rejected';

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-amber-100">
            {isRejected ? 'KYC was rejected' : 'KYC required to publish products'}
          </p>
          <p className="text-amber-100/80 text-xs leading-relaxed">
            Sellers must complete identity verification before publishing listings.
            Buyers don&apos;t need KYC — they pass an automatic sanctions screening only.
          </p>
          {kycStatus.kycRejectionReason && (
            <p className="text-xs text-red-300">
              Reason: {kycStatus.kycRejectionReason}
            </p>
          )}
          {onStartKyc && (
            <button
              type="button"
              onClick={onStartKyc}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 hover:text-amber-100 underline"
            >
              {isRejected ? 'Re-submit KYC' : 'Start Identity Verification'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
